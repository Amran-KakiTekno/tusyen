import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { auditLog } from '../audit';
import { db, withTransaction } from '../database';
import { deleteSession, redis } from '../redis';
import {
  assertCanAttachMediaReferences,
  isMediaAccessError,
  protectMediaReferences,
} from '../media-access';
import { ExternalVideoError, normalizeExternalVideoBlock } from '../external-video';
import {
  ntfyHealth,
  ntfyPublicTopicUrl,
  ntfySmokeTopic,
  normalizeNtfyTopic,
  publishLessonAssignedNotification,
  publishNtfyNotification,
} from '../notifications';

const SALT_ROUNDS = 10;
const validRoles = new Set(['student', 'teacher', 'parent', 'admin']);

function generateClassCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function adminRoutes(fastify: FastifyInstance) {
  // Middleware: Admin only
  fastify.addHook('onRequest', async (request, reply) => {
    await (fastify as any).authenticate(request, reply);
    const user = (request as any).user;
    if (user.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin access required' });
    }
  });

  fastify.addHook('onResponse', async (request, reply) => {
    auditLog(request, 'admin.request', {
      method: request.method,
      path: (request as any).routeOptions?.url || request.url,
      statusCode: reply.statusCode,
    });
  });

  // User management
  fastify.get('/users', async (request, reply) => {
    const { role, isActive, search, limit = 50, offset = 0 } = request.query as any;
    const pageLimit = boundedInt(limit, 50, 1, 200);
    const pageOffset = boundedInt(offset, 0, 0, 100000);

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (role) {
      where += ` AND role = $${params.length + 1}`;
      params.push(role);
    }

    if (isActive !== undefined) {
      where += ` AND is_active = $${params.length + 1}`;
      params.push(isActive === 'true');
    }

    if (search) {
      where += ` AND (full_name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 2})`;
      params.push(`%${search}%`, `%${search}%`);
    }

    const count = await db.query(`SELECT COUNT(*)::int as total FROM users ${where}`, params);
    const result = await db.query(
      `SELECT id, email, full_name, role, phone_number, date_of_birth, is_active, created_at, last_login
       FROM users
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageLimit, pageOffset]
    );

    return {
      users: result.rows,
      total: Number(count.rows[0]?.total || 0),
      limit: pageLimit,
      offset: pageOffset,
    };
  });

  fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params as any;

    const user = await db.query(
      `SELECT id, email, full_name, role, phone_number, date_of_birth, avatar_url,
              is_active, created_at, updated_at, last_login
       FROM users
       WHERE id = $1`,
      [id]
    );

    if ((user.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const parentLinks = await db.query(
      `SELECT psl.id, psl.parent_id, psl.student_id, psl.is_active, psl.created_at,
              p.full_name as parent_name, p.email as parent_email,
              s.full_name as student_name, s.email as student_email
       FROM parent_student_links psl
       JOIN users p ON p.id = psl.parent_id
       JOIN users s ON s.id = psl.student_id
       WHERE (psl.parent_id = $1 OR psl.student_id = $1) AND psl.is_active = true
       ORDER BY psl.created_at DESC`,
      [id]
    );

    const classroomsOwned = await db.query(
      `SELECT id, name, subject, form_level, join_code, is_active, created_at
       FROM classrooms
       WHERE teacher_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    const classroomEnrollments = await db.query(
      `SELECT c.id, c.name, c.subject, c.form_level, c.join_code, ce.is_active, ce.joined_at
       FROM classroom_enrollments ce
       JOIN classrooms c ON c.id = ce.classroom_id
       WHERE ce.student_id = $1
       ORDER BY ce.joined_at DESC`,
      [id]
    );

    return {
      user: user.rows[0],
      parentLinks: parentLinks.rows,
      classroomsOwned: classroomsOwned.rows,
      classroomEnrollments: classroomEnrollments.rows,
    };
  });

  fastify.post('/users', async (request, reply) => {
    const { email, password, role, fullName, phoneNumber, dateOfBirth, isActive } = request.body as any;
    const normalizedRole = `${role ?? ''}`.trim();

    if (!email || !password || !fullName || !validRoles.has(normalizedRole)) {
      return reply.code(400).send({ error: 'email, password, fullName, and valid role are required' });
    }

    if (`${password}`.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if ((existing.rowCount ?? 0) > 0) {
      return reply.code(409).send({ error: 'Email already registered' });
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await db.query(
      `INSERT INTO users (id, email, password_hash, role, full_name, phone_number, date_of_birth, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, full_name, role, phone_number, date_of_birth, is_active, created_at, last_login`,
      [
        userId,
        `${email}`.trim().toLowerCase(),
        passwordHash,
        normalizedRole,
        fullName,
        stringOrNull(phoneNumber),
        stringOrNull(dateOfBirth),
        isActive !== false,
      ]
    );

    return { success: true, user: result.rows[0] };
  });

  fastify.patch('/users/bulk-status', async (request, reply) => {
    const { userIds, isActive } = request.body as any;
    const ids = Array.isArray(userIds)
      ? Array.from(new Set(userIds.map(stringOrNull).filter(Boolean)))
      : [];

    if (ids.length === 0 || typeof isActive !== 'boolean') {
      return reply.code(400).send({ error: 'userIds and boolean isActive are required' });
    }

    const result = await db.query(
      `UPDATE users
       SET is_active = $1, updated_at = NOW()
       WHERE id = ANY($2::uuid[])
       RETURNING id`,
      [isActive, ids]
    );

    await Promise.all(result.rows.map((row) => deleteSession(row.id)));

    return { success: true, updated: result.rowCount ?? 0 };
  });

  fastify.patch('/users/:id', async (request, reply) => {
    const { id } = request.params as any;
    const { email, password, role, fullName, phoneNumber, dateOfBirth, isActive } = request.body as any;
    const normalizedRole = role === undefined ? undefined : `${role}`.trim();

    if (normalizedRole !== undefined && !validRoles.has(normalizedRole)) {
      return reply.code(400).send({ error: 'Invalid role' });
    }

    if (password !== undefined && `${password}`.length > 0 && `${password}`.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });
    }

    const existing = await db.query('SELECT id, role FROM users WHERE id = $1', [id]);
    if ((existing.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const passwordHash =
      password === undefined || `${password}`.trim().length === 0
        ? null
        : await bcrypt.hash(password, SALT_ROUNDS);

    const result = await db.query(
      `UPDATE users
       SET email = COALESCE($1, email),
           password_hash = COALESCE($2, password_hash),
           role = COALESCE($3, role),
           full_name = COALESCE($4, full_name),
           phone_number = CASE WHEN $5::boolean THEN $6 ELSE phone_number END,
           date_of_birth = CASE WHEN $7::boolean THEN $8 ELSE date_of_birth END,
           is_active = COALESCE($9, is_active),
           updated_at = NOW()
       WHERE id = $10
       RETURNING id, email, full_name, role, phone_number, date_of_birth, is_active, created_at, last_login`,
      [
        email === undefined ? null : `${email}`.trim().toLowerCase(),
        passwordHash,
        normalizedRole ?? null,
        fullName === undefined ? null : fullName,
        phoneNumber !== undefined,
        stringOrNull(phoneNumber),
        dateOfBirth !== undefined,
        stringOrNull(dateOfBirth),
        typeof isActive === 'boolean' ? isActive : null,
        id,
      ]
    );

    await deleteSession(id);

    return { success: true, user: result.rows[0] };
  });

  fastify.delete('/users/:id', async (request, reply) => {
    const { id } = request.params as any;

    const result = await db.query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );

    if ((result.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'User not found' });
    }

    await deleteSession(id);

    return { success: true };
  });

  // Toggle user active status
  fastify.patch('/users/:id/status', async (request, reply) => {
    const { id } = request.params as any;
    const { isActive } = request.body as any;

    await db.query(
      'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2',
      [isActive, id]
    );

    // Invalidate sessions
    await deleteSession(id);

    return { success: true };
  });

  fastify.get('/parent-links', async (request, reply) => {
    const { parentId, studentId } = request.query as any;
    const params: any[] = [];
    let query = `
      SELECT psl.id, psl.parent_id, psl.student_id, psl.is_active, psl.created_at,
             p.full_name as parent_name, p.email as parent_email,
             s.full_name as student_name, s.email as student_email
      FROM parent_student_links psl
      JOIN users p ON p.id = psl.parent_id
      JOIN users s ON s.id = psl.student_id
      WHERE psl.is_active = true
    `;

    if (parentId) {
      query += ` AND psl.parent_id = $${params.length + 1}`;
      params.push(parentId);
    }

    if (studentId) {
      query += ` AND psl.student_id = $${params.length + 1}`;
      params.push(studentId);
    }

    query += ' ORDER BY psl.created_at DESC';
    const result = await db.query(query, params);
    return { links: result.rows };
  });

  fastify.post('/parent-links', async (request, reply) => {
    const { parentId, studentId } = request.body as any;

    const users = await db.query(
      `SELECT id, role
       FROM users
       WHERE id = ANY($1::uuid[]) AND is_active = true`,
      [[parentId, studentId]]
    );

    const parent = users.rows.find((row) => row.id === parentId && row.role === 'parent');
    const student = users.rows.find((row) => row.id === studentId && row.role === 'student');

    if (!parent || !student) {
      return reply.code(400).send({ error: 'Valid active parentId and studentId are required' });
    }

    const result = await db.query(
      `INSERT INTO parent_student_links (id, parent_id, student_id, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (parent_id, student_id)
       DO UPDATE SET is_active = true
       RETURNING id, parent_id, student_id, is_active, created_at`,
      [uuidv4(), parentId, studentId]
    );

    return { success: true, link: result.rows[0] };
  });

  fastify.delete('/parent-links/:id', async (request, reply) => {
    const { id } = request.params as any;
    const result = await db.query(
      'UPDATE parent_student_links SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if ((result.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Parent link not found' });
    }

    return { success: true };
  });

  fastify.get('/classrooms', async (request, reply) => {
    const { teacherId, subject, formLevel, isActive, search } = request.query as any;
    const params: any[] = [];
    let query = `
      SELECT c.*,
             u.full_name as teacher_name,
             u.email as teacher_email,
             (SELECT COUNT(*)::int FROM classroom_enrollments ce WHERE ce.classroom_id = c.id AND ce.is_active = true) as student_count,
             (SELECT COUNT(*)::int FROM posts p WHERE p.classroom_id = c.id AND p.is_active = true) as post_count,
             (SELECT COUNT(*)::int FROM classroom_lessons cl WHERE cl.classroom_id = c.id) as lesson_count
      FROM classrooms c
      JOIN users u ON u.id = c.teacher_id
      WHERE 1=1
    `;

    if (teacherId) {
      query += ` AND c.teacher_id = $${params.length + 1}`;
      params.push(teacherId);
    }

    if (subject) {
      query += ` AND c.subject = $${params.length + 1}`;
      params.push(subject);
    }

    if (formLevel) {
      query += ` AND c.form_level = $${params.length + 1}`;
      params.push(formLevel);
    }

    if (isActive !== undefined) {
      query += ` AND c.is_active = $${params.length + 1}`;
      params.push(isActive === 'true');
    }

    if (search) {
      query += ` AND (c.name ILIKE $${params.length + 1} OR c.subject ILIKE $${params.length + 2} OR u.full_name ILIKE $${params.length + 3})`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY c.created_at DESC';
    const result = await db.query(query, params);
    return { classrooms: result.rows };
  });

  fastify.post('/classrooms', async (request, reply) => {
    const { teacherId, name, description, subject, formLevel, joinCode, isPublic, isActive } = request.body as any;

    if (!teacherId || !name || !subject || !formLevel) {
      return reply.code(400).send({ error: 'teacherId, name, subject, and formLevel are required' });
    }

    if (!(await isRole(teacherId, 'teacher'))) {
      return reply.code(400).send({ error: 'teacherId must belong to an active teacher' });
    }

    const classId = uuidv4();
    let code: string;
    try {
      code = await uniqueJoinCode(joinCode);
    } catch (error) {
      return reply.code(409).send({ error: errorMessage(error) });
    }
    const result = await db.query(
      `INSERT INTO classrooms (id, teacher_id, name, description, subject, form_level, join_code, is_public, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        classId,
        teacherId,
        name,
        stringOrNull(description),
        subject,
        Number(formLevel),
        code,
        Boolean(isPublic),
        isActive !== false,
      ]
    );

    return { success: true, classroom: result.rows[0] };
  });

  fastify.patch('/classrooms/:id', async (request, reply) => {
    const { id } = request.params as any;
    const { teacherId, name, description, subject, formLevel, joinCode, isPublic, isActive } = request.body as any;

    if (teacherId && !(await isRole(teacherId, 'teacher'))) {
      return reply.code(400).send({ error: 'teacherId must belong to an active teacher' });
    }

    let code: string | null = null;
    if (joinCode !== undefined) {
      try {
        code = await uniqueJoinCode(joinCode, id);
      } catch (error) {
        return reply.code(409).send({ error: errorMessage(error) });
      }
    }
    const result = await db.query(
      `UPDATE classrooms
       SET teacher_id = COALESCE($1, teacher_id),
           name = COALESCE($2, name),
           description = CASE WHEN $3::boolean THEN $4 ELSE description END,
           subject = COALESCE($5, subject),
           form_level = COALESCE($6, form_level),
           join_code = COALESCE($7, join_code),
           is_public = COALESCE($8, is_public),
           is_active = COALESCE($9, is_active),
           updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        teacherId || null,
        name || null,
        description !== undefined,
        stringOrNull(description),
        subject || null,
        formLevel || null,
        code,
        typeof isPublic === 'boolean' ? isPublic : null,
        typeof isActive === 'boolean' ? isActive : null,
        id,
      ]
    );

    if ((result.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Classroom not found' });
    }

    return { success: true, classroom: result.rows[0] };
  });

  fastify.delete('/classrooms/:id', async (request, reply) => {
    const { id } = request.params as any;
    const result = await db.query(
      'UPDATE classrooms SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );

    if ((result.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Classroom not found' });
    }

    return { success: true };
  });

  fastify.post('/classrooms/:id/students', async (request, reply) => {
    const { id } = request.params as any;
    const { studentId } = request.body as any;

    if (!(await isRole(studentId, 'student'))) {
      return reply.code(400).send({ error: 'studentId must belong to an active student' });
    }

    const classroom = await db.query('SELECT id FROM classrooms WHERE id = $1', [id]);
    if ((classroom.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Classroom not found' });
    }

    await db.query(
      `INSERT INTO classroom_enrollments (id, student_id, classroom_id, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (student_id, classroom_id)
       DO UPDATE SET is_active = true, last_active_at = NOW()`,
      [uuidv4(), studentId, id]
    );

    return { success: true };
  });

  fastify.get('/classrooms/:id/students', async (request, reply) => {
    const { id } = request.params as any;

    const classroom = await db.query('SELECT id FROM classrooms WHERE id = $1', [id]);
    if ((classroom.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Classroom not found' });
    }

    const result = await db.query(
      `SELECT u.id, u.full_name, u.email, ce.joined_at, ce.last_active_at
       FROM classroom_enrollments ce
       JOIN users u ON u.id = ce.student_id
       WHERE ce.classroom_id = $1 AND ce.is_active = true
       ORDER BY u.full_name ASC, u.email ASC`,
      [id]
    );

    return {
      students: result.rows,
      total: result.rowCount ?? 0,
    };
  });

  fastify.delete('/classrooms/:id/students/:studentId', async (request, reply) => {
    const { id, studentId } = request.params as any;

    const result = await db.query(
      `UPDATE classroom_enrollments
       SET is_active = false
       WHERE classroom_id = $1 AND student_id = $2
       RETURNING id`,
      [id, studentId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Enrollment not found' });
    }

    return { success: true };
  });

  // Get system stats
  fastify.get('/stats', async (request, reply) => {
    const stats = await db.query(`
      SELECT 
        (SELECT COUNT(*)::int FROM users WHERE role = 'student' AND is_active = true) as total_students,
        (SELECT COUNT(*)::int FROM users WHERE role = 'teacher' AND is_active = true) as total_teachers,
        (SELECT COUNT(*)::int FROM users WHERE role = 'parent' AND is_active = true) as total_parents,
        (SELECT COUNT(*)::int FROM users WHERE is_active = true) as active_users,
        (SELECT COUNT(*)::int FROM users WHERE is_active = false) as inactive_users,
        (SELECT COUNT(*)::int FROM users) as all_users,
        (SELECT COUNT(*)::int FROM classrooms WHERE is_active = true) as active_classrooms,
        (SELECT COUNT(*)::int FROM classroom_enrollments WHERE is_active = true) as total_enrollments,
        (SELECT COUNT(*)::int FROM lessons WHERE is_active = true) as total_lessons,
        (SELECT COUNT(*)::int FROM progress WHERE updated_at > NOW() - INTERVAL '24 hours') as activities_today,
        (SELECT COUNT(*)::int FROM progress WHERE updated_at <= NOW() - INTERVAL '24 hours' AND updated_at > NOW() - INTERVAL '48 hours') as activities_previous_day,
        (SELECT COUNT(*)::int FROM users WHERE role = 'student' AND created_at > NOW() - INTERVAL '7 days') as new_students_7d,
        (SELECT COUNT(*)::int FROM users WHERE role = 'teacher' AND created_at > NOW() - INTERVAL '7 days') as new_teachers_7d,
        (SELECT COUNT(*)::int FROM users WHERE role = 'parent' AND created_at > NOW() - INTERVAL '7 days') as new_parents_7d
    `);

    return { stats: stats.rows[0] };
  });

  fastify.get('/logs', async (request, reply) => {
    const { limit = 20, offset = 0 } = request.query as any;
    const pageLimit = boundedInt(limit, 20, 1, 100);
    const pageOffset = boundedInt(offset, 0, 0, 100000);

    const result = await db.query(
      `
      WITH events AS (
        SELECT 'info' as type,
               'Pengguna log masuk: ' || COALESCE(full_name, email) as message,
               last_login as event_at
        FROM users
        WHERE last_login IS NOT NULL

        UNION ALL

        SELECT 'warn' as type,
               'Akaun dinyahaktif: ' || COALESCE(full_name, email) as message,
               updated_at as event_at
        FROM users
        WHERE is_active = false

        UNION ALL

        SELECT 'success' as type,
               'Pelajaran diterbitkan: ' || title as message,
               created_at as event_at
        FROM lessons
        WHERE is_active = true

        UNION ALL

        SELECT 'success' as type,
               'Kemajuan pelajar direkod: ' || COALESCE(u.full_name, u.email, 'Pelajar') as message,
               p.updated_at as event_at
        FROM progress p
        LEFT JOIN users u ON u.id = p.student_id

        UNION ALL

        SELECT 'info' as type,
               'Kelas aktif: ' || name as message,
               created_at as event_at
        FROM classrooms
        WHERE is_active = true
      )
      SELECT type, message, event_at, (COUNT(*) OVER())::int as total
      FROM events
      WHERE event_at IS NOT NULL
      ORDER BY event_at DESC
      LIMIT $1 OFFSET $2
      `,
      [pageLimit, pageOffset]
    );

    return {
      logs: result.rows.map(({ total, ...row }) => row),
      total: Number(result.rows[0]?.total || 0),
      limit: pageLimit,
      offset: pageOffset,
    };
  });

  fastify.get('/system', async (request, reply) => {
    const [syncDevices, pendingQueues] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int as total_devices,
                MAX(last_sync_at) as latest_sync_at
         FROM device_syncs`
      ),
      redis.keys('sync:queue:*'),
    ]);

    return {
      config: {
        nodeEnv: config.NODE_ENV,
        port: config.PORT,
        corsAllowedOrigins: config.CORS_ALLOWED_ORIGINS,
        keycloakRealm: config.KEYCLOAK_REALM,
        keycloakClientId: config.KEYCLOAK_CLIENT_ID,
        ntfyEnabled: config.NTFY_ENABLED,
        publicAppUrl: config.PUBLIC_APP_URL,
        syncBatchSize: config.SYNC_BATCH_SIZE,
        maxSyncHistoryDays: config.MAX_SYNC_HISTORY_DAYS,
        demoAdminLoginEnabled: config.DEMO_ADMIN_LOGIN_ENABLED,
        publicAdminRegistrationEnabled: config.PUBLIC_ADMIN_REGISTRATION_ENABLED,
        allowGuestQuizJoin: config.ALLOW_GUEST_QUIZ_JOIN,
      },
      sync: {
        registeredDevices: Number(syncDevices.rows[0]?.total_devices || 0),
        latestSyncAt: syncDevices.rows[0]?.latest_sync_at || null,
        pendingQueues: pendingQueues.length,
      },
      backup: {
        driver: 'postgres',
        mode: 'external',
        note: 'Use scheduled pg_dump or managed volume snapshots outside the app process.',
      },
    };
  });

  // Syllabus management (Admin creates global curriculum)
  fastify.post('/syllabus', async (request, reply) => {
    const { subject, formLevel, topic, subtopic, orderIndex, content } = request.body as any;

    const result = await db.query(
      `INSERT INTO syllabus_items (id, subject, form_level, topic, subtopic, order_index, content, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [uuidv4(), subject, formLevel, topic, subtopic || null, orderIndex || 0, JSON.stringify(content), (request as any).user.userId]
    );

    return { success: true, item: result.rows[0] };
  });

  fastify.patch('/syllabus/:id', async (request, reply) => {
    const { id } = request.params as any;
    const { subject, formLevel, topic, subtopic, orderIndex, content } = request.body as any;

    const result = await db.query(
      `UPDATE syllabus_items
       SET subject = $1,
           form_level = $2,
           topic = $3,
           subtopic = $4,
           order_index = $5,
           content = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [subject, formLevel, topic, subtopic || null, orderIndex || 0, JSON.stringify(content || {}), id]
    );

    if ((result.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Syllabus item not found' });
    }

    return { success: true, item: result.rows[0] };
  });

  fastify.delete('/syllabus/:id', async (request, reply) => {
    const { id } = request.params as any;
    const result = await db.query(
      'UPDATE syllabus_items SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );

    if ((result.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Syllabus item not found' });
    }

    return { success: true };
  });

  // Get syllabus
  fastify.get('/syllabus', async (request, reply) => {
    const { subject, formLevel } = request.query as any;

    let query = `SELECT * FROM syllabus_items WHERE is_active = true`;
    const params: any[] = [];

    if (subject) {
      query += ` AND subject = $${params.length + 1}`;
      params.push(subject);
    }

    if (formLevel) {
      query += ` AND form_level = $${params.length + 1}`;
      params.push(formLevel);
    }

    query += ` ORDER BY subject, form_level, order_index`;

    const result = await db.query(query, params);
    return { syllabus: result.rows };
  });

  // Create lesson from syllabus
  fastify.post('/lessons', async (request, reply) => {
    const user = (request as any).user;
    const { 
      syllabusId, 
      title, 
      content, 
      difficulty, 
      estimatedMinutes,
      quizData,
      attachments 
    } = request.body as any;

    const cleanTitle = `${title ?? ''}`.trim();
    if (!cleanTitle || !syllabusId) {
      return reply.code(400).send({ error: 'title and syllabusId are required' });
    }

    if (!(await isActiveSyllabus(syllabusId))) {
      return reply.code(404).send({ error: 'Syllabus item not found' });
    }

    const lessonId = uuidv4();
    let lessonContent: Record<string, any>;
    try {
      lessonContent = normalizeLessonContentForAdmin(content || {});
    } catch (error) {
      if (error instanceof ExternalVideoError) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }

    try {
      await assertCanAttachMediaReferences(user, lessonContent);
    } catch (error) {
      if (isMediaAccessError(error)) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      throw error;
    }

    await withTransaction(async (client) => {
      // Create lesson
      await client.query(
        `INSERT INTO lessons (id, title, content, subject, form_level, difficulty, estimated_minutes, created_by)
         VALUES ($1, $2, $3, 
           (SELECT subject FROM syllabus_items WHERE id = $4),
           (SELECT form_level FROM syllabus_items WHERE id = $4),
           $5, $6, $7)`,
        [lessonId, cleanTitle, JSON.stringify(lessonContent), syllabusId, normalizeDifficulty(difficulty), normalizeMinutes(estimatedMinutes), user.userId]
      );

      // Add quiz if provided
      if (quizData && quizData.questions) {
        for (let i = 0; i < quizData.questions.length; i++) {
          const q = quizData.questions[i];
          const questionText = questionTextFrom(q);
          if (!questionText) continue;
          await client.query(
            `INSERT INTO quiz_questions (id, lesson_id, question_text, question_type, options, correct_answer, explanation, points, order_index)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              uuidv4(),
              lessonId,
              questionText,
              normalizeQuestionType(q.type ?? q.questionType ?? q.question_type),
              JSON.stringify(Array.isArray(q.options) ? q.options : []),
              JSON.stringify(q.correctAnswer ?? q.correct_answer ?? ''),
              q.explanation || null,
              normalizePoints(q.points),
              i,
            ]
          );
        }
      }

      // Link syllabus
      if (syllabusId) {
        await client.query(
          'INSERT INTO lesson_syllabus_links (lesson_id, syllabus_id) VALUES ($1, $2)',
          [lessonId, syllabusId]
        );
      }
    });

    return { success: true, lessonId };
  });

  // Get all lessons with filters
  fastify.get('/lessons', async (request, reply) => {
    const { subject, formLevel, difficulty, isActive, limit = 50, offset = 0 } = request.query as any;
    const params: any[] = [isActive === undefined ? true : isActive === 'true'];

    let query = `
      SELECT l.*,
             (
               SELECT si.topic
               FROM lesson_syllabus_links lsl
               JOIN syllabus_items si ON si.id = lsl.syllabus_id
               WHERE lsl.lesson_id = l.id
               ORDER BY si.order_index
               LIMIT 1
             ) as topic,
             (
               SELECT si.subtopic
               FROM lesson_syllabus_links lsl
               JOIN syllabus_items si ON si.id = lsl.syllabus_id
               WHERE lsl.lesson_id = l.id
               ORDER BY si.order_index
               LIMIT 1
             ) as subtopic,
             (
               SELECT COUNT(*)
               FROM quiz_questions qq
               WHERE qq.lesson_id = l.id AND qq.is_active = true
             ) as question_count,
             (
               SELECT COUNT(*)
               FROM classroom_lessons cl
               WHERE cl.lesson_id = l.id
             ) as assigned_classrooms
      FROM lessons l
      WHERE l.is_active = $1
    `;

    if (subject) {
      query += ` AND subject = $${params.length + 1}`;
      params.push(subject);
    }

    if (formLevel) {
      query += ` AND form_level = $${params.length + 1}`;
      params.push(formLevel);
    }

    if (difficulty) {
      query += ` AND difficulty = $${params.length + 1}`;
      params.push(difficulty);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    const user = (request as any).user;
    return { lessons: result.rows.map((lesson) => protectMediaReferences(fastify, user, lesson)) };
  });

  fastify.get('/lessons/:id', async (request, reply) => {
    const { id } = request.params as any;

    const lesson = await db.query(
      `SELECT l.*,
              (
                SELECT si.id
                FROM lesson_syllabus_links lsl
                JOIN syllabus_items si ON si.id = lsl.syllabus_id
                WHERE lsl.lesson_id = l.id
                ORDER BY si.order_index
                LIMIT 1
              ) as syllabus_id,
              (
                SELECT si.topic
                FROM lesson_syllabus_links lsl
                JOIN syllabus_items si ON si.id = lsl.syllabus_id
                WHERE lsl.lesson_id = l.id
                ORDER BY si.order_index
                LIMIT 1
              ) as topic,
              (
                SELECT si.subtopic
                FROM lesson_syllabus_links lsl
                JOIN syllabus_items si ON si.id = lsl.syllabus_id
                WHERE lsl.lesson_id = l.id
                ORDER BY si.order_index
                LIMIT 1
              ) as subtopic
       FROM lessons l
       WHERE l.id = $1`,
      [id]
    );

    if ((lesson.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Lesson not found' });
    }

    const questions = await db.query(
      `SELECT id, question_text, question_type, options, correct_answer, explanation, points, order_index
       FROM quiz_questions
       WHERE lesson_id = $1 AND is_active = true
       ORDER BY order_index ASC`,
      [id]
    );

    return { lesson: protectMediaReferences(fastify, (request as any).user, lesson.rows[0]), questions: questions.rows };
  });

  fastify.patch('/lessons/:id', async (request, reply) => {
    const { id } = request.params as any;
    const { syllabusId, title, content, difficulty, estimatedMinutes, quizData } = request.body as any;

    const existing = await db.query(
      `SELECT l.*,
              (
                SELECT syllabus_id
                FROM lesson_syllabus_links
                WHERE lesson_id = l.id
                LIMIT 1
              ) as syllabus_id
       FROM lessons l
       WHERE l.id = $1`,
      [id]
    );

    if ((existing.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Lesson not found' });
    }

    const current = existing.rows[0];
    const nextSyllabusId = syllabusId || current.syllabus_id;
    if (nextSyllabusId && !(await isActiveSyllabus(nextSyllabusId))) {
      return reply.code(404).send({ error: 'Syllabus item not found' });
    }

    let nextContent: Record<string, any>;
    try {
      nextContent = normalizeLessonContentForAdmin(content || current.content);
    } catch (error) {
      if (error instanceof ExternalVideoError) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }

    try {
      await assertCanAttachMediaReferences((request as any).user, nextContent);
    } catch (error) {
      if (isMediaAccessError(error)) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      throw error;
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE lessons
         SET title = $1,
             content = $2,
             subject = COALESCE((SELECT subject FROM syllabus_items WHERE id = $3), subject),
             form_level = COALESCE((SELECT form_level FROM syllabus_items WHERE id = $3), form_level),
             difficulty = $4,
             estimated_minutes = $5,
             updated_at = NOW()
         WHERE id = $6`,
        [
          title || current.title,
          JSON.stringify(nextContent),
          nextSyllabusId || null,
          normalizeDifficulty(difficulty, current.difficulty),
          normalizeMinutes(estimatedMinutes, current.estimated_minutes),
          id,
        ]
      );

      if (nextSyllabusId) {
        await client.query('DELETE FROM lesson_syllabus_links WHERE lesson_id = $1', [id]);
        await client.query('INSERT INTO lesson_syllabus_links (lesson_id, syllabus_id) VALUES ($1, $2)', [id, nextSyllabusId]);
      }

      if (Array.isArray(quizData?.questions)) {
        await client.query('DELETE FROM quiz_questions WHERE lesson_id = $1', [id]);

        for (let i = 0; i < quizData.questions.length; i++) {
          const q = quizData.questions[i];
          const questionText = questionTextFrom(q);
          if (!questionText) continue;
          await client.query(
            `INSERT INTO quiz_questions (id, lesson_id, question_text, question_type, options, correct_answer, explanation, points, order_index)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              uuidv4(),
              id,
              questionText,
              normalizeQuestionType(q.type ?? q.questionType ?? q.question_type),
              JSON.stringify(Array.isArray(q.options) ? q.options : []),
              JSON.stringify(q.correctAnswer ?? q.correct_answer ?? ''),
              q.explanation || null,
              normalizePoints(q.points),
              i,
            ]
          );
        }
      }
    });

    return { success: true };
  });

  fastify.delete('/lessons/:id', async (request, reply) => {
    const { id } = request.params as any;
    const result = await db.query(
      'UPDATE lessons SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );

    if ((result.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Lesson not found' });
    }

    return { success: true };
  });

  // Assign lesson to classroom
  fastify.post('/classrooms/:id/lessons', async (request, reply) => {
    const { id } = request.params as any;
    const { lessonId, dueDate, isRequired } = request.body as any;

    await db.query(
      `INSERT INTO classroom_lessons (id, classroom_id, lesson_id, assigned_by, due_date, is_required)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (classroom_id, lesson_id)
       DO UPDATE SET due_date = EXCLUDED.due_date,
                     is_required = EXCLUDED.is_required,
                     assigned_by = EXCLUDED.assigned_by`,
      [uuidv4(), id, lessonId, (request as any).user.userId, dueDate || null, isRequired !== false]
    );
    await publishLessonAssignedNotification(fastify, {
      classroomId: id,
      lessonId,
      dueDate: dueDate || null,
    });

    return { success: true };
  });

  fastify.get('/notifications/health', async () => {
    return { notifications: await ntfyHealth() };
  });

  fastify.post('/notifications/test', async (request) => {
    const body = request.body as any;
    const topic = normalizeNtfyTopic(body?.topic || ntfySmokeTopic());
    const result = await publishNtfyNotification({
      topic,
      title: body?.title || 'Tusyen notification test',
      message: body?.message || `Notification smoke test from Tusyen at ${new Date().toISOString()}`,
      tags: ['test_tube', 'tusyen'],
      priority: 'default',
      clickPath: '/',
    });

    return {
      success: result.ok,
      result,
      subscribeUrl: ntfyPublicTopicUrl(topic),
    };
  });

  // Get system health
  fastify.get('/health', async (request, reply) => {
    const dbHealthy = await db.query('SELECT 1').then(() => true).catch(() => false);
    const redisHealthy = await redis.ping().then(() => true).catch(() => false);
    const notifications = await ntfyHealth();

    const storageUsage = await db.query(`
      SELECT 
        pg_size_pretty(pg_database_size('eduapp')) as database_size,
        (SELECT COUNT(*) FROM media_files WHERE is_deleted = false) as total_files
    `);

    return {
      status: dbHealthy && redisHealthy ? 'healthy' : 'degraded',
      database: dbHealthy ? 'connected' : 'error',
      cache: redisHealthy ? 'connected' : 'error',
      notifications,
      storage: storageUsage.rows[0]
    };
  });

  // Clear cache
  fastify.post('/cache/clear', async (request, reply) => {
    const deleted = await clearRedisCacheKeys([
      'stats:student:*',
      'leaderboard:classroom:*',
    ]);
    return { success: true, message: 'Cache cleared', deleted };
  });
}

async function clearRedisCacheKeys(patterns: string[]) {
  let deleted = 0;

  for (const pattern of patterns) {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        deleted += await redis.del(...keys);
      }
    } while (cursor !== '0');
  }

  return deleted;
}

function stringOrNull(value: unknown) {
  const text = `${value ?? ''}`.trim();
  return text.length === 0 ? null : text;
}

function boundedInt(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return [
    'Join code is already in use',
    'Could not generate a unique join code',
  ].includes(message)
    ? message
    : 'Request failed';
}

function normalizeLessonContentForAdmin(value: any): Record<string, any> {
  const content = value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : { summary: `${value ?? ''}` };

  content.summary = `${content.summary ?? ''}`.trim();
  if (Array.isArray(content.blocks)) {
    content.blocks = content.blocks
      .filter((block: any) => block && typeof block === 'object')
      .map((block: any) => {
        const normalized = {
          ...block,
          type: `${block.type ?? 'text'}`.trim().toLowerCase(),
          title: `${block.title ?? ''}`.trim(),
          body: `${block.body ?? block.text ?? ''}`.trim(),
        };
        return normalized.type === 'embed'
          ? normalizeExternalVideoBlock(normalized)
          : normalized;
      });
  }

  return sanitizeLessonContent(content) as Record<string, any>;
}

function sanitizeLessonContent(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLessonContent(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.startsWith('on') ||
      ['html', 'innerhtml', 'dangerouslysetinnerhtml', 'script', 'style'].includes(normalizedKey)
    ) {
      continue;
    }
    result[key] = sanitizeLessonContent(nestedValue);
  }
  return result;
}

function sanitizeText(value: string) {
  return value
    .replace(/javascript\s*:/gi, '')
    .replace(/on[a-z]+\s*=/gi, '')
    .replace(/<\s*\/?\s*script/gi, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

async function isRole(userId: unknown, role: string) {
  const id = stringOrNull(userId);
  if (!id) return false;

  const result = await db.query(
    'SELECT id FROM users WHERE id = $1 AND role = $2 AND is_active = true',
    [id, role]
  );
  return (result.rowCount ?? 0) > 0;
}

async function isActiveSyllabus(syllabusId: unknown) {
  const id = stringOrNull(syllabusId);
  if (!id) return false;

  const result = await db.query(
    'SELECT id FROM syllabus_items WHERE id = $1 AND is_active = true',
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

function questionTextFrom(question: any) {
  return `${question?.text ?? question?.questionText ?? question?.question_text ?? ''}`.trim();
}

const lessonQuestionTypes = new Set([
  'multiple_choice',
  'true_false',
  'fill_blank',
  'matching',
  'representation_match',
  'missing_step',
  'step_order',
  'numeric',
  'diagram_label',
  'error_diagnosis',
  'prediction',
  'code_trace',
  'data_interpret',
  'scenario',
]);

function normalizeQuestionType(value: any) {
  const type = `${value ?? 'multiple_choice'}`.trim();
  return lessonQuestionTypes.has(type)
    ? type
    : 'multiple_choice';
}

function normalizeDifficulty(value: any, fallback = 'medium') {
  const difficulty = `${value ?? fallback}`.trim();
  return ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : fallback;
}

function normalizeMinutes(value: any, fallback = 15) {
  const minutes = Number(value ?? fallback);
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : fallback;
}

function normalizePoints(value: any, fallback = 1) {
  const points = Number(value ?? fallback);
  return Number.isFinite(points) && points > 0 ? Math.round(points) : fallback;
}

async function uniqueJoinCode(input?: unknown, existingClassroomId?: string) {
  let joinCode = stringOrNull(input)?.toUpperCase() ?? generateClassCode();
  let attempts = 0;

  while (attempts < 10) {
    const existing = await db.query(
      `SELECT id
       FROM classrooms
       WHERE join_code = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)`,
      [joinCode, existingClassroomId ?? null]
    );

    if ((existing.rowCount ?? 0) === 0) return joinCode;

    if (input) {
      throw new Error('Join code is already in use');
    }

    joinCode = generateClassCode();
    attempts++;
  }

  throw new Error('Could not generate a unique join code');
}
