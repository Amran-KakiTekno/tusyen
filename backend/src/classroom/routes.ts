import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { db, withTransaction } from '../database';
import { redis } from '../redis';
import { publishLessonAssignedNotification } from '../notifications';

// Generate unique classroom code
function generateClassCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function classroomRoutes(fastify: FastifyInstance) {
  // Create classroom (Teacher only)
  fastify.post('/', {
    onRequest: [(fastify as any).authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'subject', 'formLevel'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          subject: { type: 'string' },
          formLevel: { type: 'integer', minimum: 4, maximum: 5 },
          isPublic: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const user = (request as any).user;
    const { name, description, subject, formLevel, isPublic } = request.body as any;

    if (user.role !== 'teacher' && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Only teachers can create classrooms' });
    }

    const classId = uuidv4();
    let joinCode = generateClassCode();
    
    // Ensure unique join code
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.query('SELECT id FROM classrooms WHERE join_code = $1', [joinCode]);
      if (existing.rowCount === 0) break;
      joinCode = generateClassCode();
      attempts++;
    }

    await db.query(
      `INSERT INTO classrooms (id, teacher_id, name, description, subject, form_level, join_code, is_public, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [classId, user.userId, name, description || null, subject, formLevel, joinCode, isPublic || false, true]
    );

    return {
      success: true,
      classroom: {
        id: classId,
        name,
        subject,
        formLevel,
        joinCode
      }
    };
  });

  // Get all classrooms for user
  fastify.get('/', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    let result;

    if (user.role === 'teacher') {
      result = await db.query(
        `SELECT c.*, 
                (SELECT COUNT(*)::int FROM classroom_enrollments WHERE classroom_id = c.id AND is_active = true) as student_count,
                (SELECT COUNT(*)::int FROM classroom_lessons WHERE classroom_id = c.id) as lesson_count,
                (SELECT COUNT(*)::int FROM posts WHERE classroom_id = c.id AND is_active = true) as post_count
         FROM classrooms c
         WHERE c.teacher_id = $1 AND c.is_active = true
         ORDER BY c.created_at DESC`,
        [user.userId]
      );
    } else if (user.role === 'student') {
      result = await db.query(
        `SELECT c.*, u.full_name as teacher_name,
                ce.joined_at,
                true as is_enrolled,
                (SELECT COUNT(*)::int FROM classroom_enrollments WHERE classroom_id = c.id AND is_active = true) as student_count,
                (SELECT COUNT(*)::int FROM classroom_lessons WHERE classroom_id = c.id) as lesson_count,
                (SELECT COUNT(*)::int FROM posts WHERE classroom_id = c.id AND is_active = true) as post_count
         FROM classroom_enrollments ce
         JOIN classrooms c ON c.id = ce.classroom_id
         JOIN users u ON u.id = c.teacher_id
         WHERE ce.student_id = $1 AND ce.is_active = true AND c.is_active = true
         ORDER BY ce.joined_at DESC`,
        [user.userId]
      );
    } else if (user.role === 'parent') {
      // Get classrooms of linked students
      result = await db.query(
        `SELECT DISTINCT c.*, u.full_name as teacher_name, s.full_name as student_name,
                true as is_enrolled,
                (SELECT COUNT(*)::int FROM classroom_enrollments WHERE classroom_id = c.id AND is_active = true) as student_count,
                (SELECT COUNT(*)::int FROM classroom_lessons WHERE classroom_id = c.id) as lesson_count,
                (SELECT COUNT(*)::int FROM posts WHERE classroom_id = c.id AND is_active = true) as post_count
         FROM parent_student_links psl
         JOIN classroom_enrollments ce ON ce.student_id = psl.student_id
         JOIN classrooms c ON c.id = ce.classroom_id
         JOIN users u ON u.id = c.teacher_id
         JOIN users s ON s.id = ce.student_id
         WHERE psl.parent_id = $1 AND psl.is_active = true AND ce.is_active = true AND c.is_active = true
         ORDER BY c.created_at DESC`,
        [user.userId]
      );
    } else {
      // Admin - get all
      result = await db.query(
        `SELECT c.*, u.full_name as teacher_name,
                (SELECT COUNT(*)::int FROM classroom_enrollments WHERE classroom_id = c.id AND is_active = true) as student_count,
                (SELECT COUNT(*)::int FROM classroom_lessons WHERE classroom_id = c.id) as lesson_count,
                (SELECT COUNT(*)::int FROM posts WHERE classroom_id = c.id AND is_active = true) as post_count
         FROM classrooms c
         JOIN users u ON u.id = c.teacher_id
         WHERE c.is_active = true
         ORDER BY c.created_at DESC`
      );
    }

    return { classrooms: result.rows };
  });

  // Get classroom details
  fastify.get('/:id', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as any;

    const classroom = await db.query(
      `SELECT c.*, u.full_name as teacher_name,
              (SELECT COUNT(*)::int FROM classroom_enrollments WHERE classroom_id = c.id AND is_active = true) as student_count,
              (SELECT COUNT(*)::int FROM classroom_lessons WHERE classroom_id = c.id) as lesson_count,
              (SELECT COUNT(*)::int FROM posts WHERE classroom_id = c.id AND is_active = true) as post_count
       FROM classrooms c
       JOIN users u ON u.id = c.teacher_id
       WHERE c.id = $1`,
      [id]
    );

    if (classroom.rowCount === 0) {
      return reply.code(404).send({ error: 'Classroom not found' });
    }

    const data = classroom.rows[0];

    // Check access
    const hasAccess = await checkClassroomAccess(user, id);
    if (!hasAccess) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    return { classroom: data };
  });

  // Join classroom (Student only)
  fastify.post('/:id/join', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as any;
    const { joinCode } = request.body as any;

    if (user.role !== 'student') {
      return reply.code(403).send({ error: 'Only students can join classrooms' });
    }

    // Verify classroom and join code
    const classroom = await db.query(
      'SELECT id, teacher_id, is_active FROM classrooms WHERE id = $1 AND join_code = $2',
      [id, joinCode]
    );

    if (classroom.rowCount === 0) {
      return reply.code(404).send({ error: 'Invalid classroom or join code' });
    }

    if (!classroom.rows[0].is_active) {
      return reply.code(403).send({ error: 'Classroom is inactive' });
    }

    // Check if already enrolled
    const existing = await db.query(
      'SELECT id, is_active FROM classroom_enrollments WHERE student_id = $1 AND classroom_id = $2',
      [user.userId, id]
    );

    if ((existing.rowCount ?? 0) > 0 && existing.rows[0].is_active) {
      return reply.code(409).send({ error: 'Already enrolled in this classroom' });
    }

    if ((existing.rowCount ?? 0) > 0) {
      await db.query(
        `UPDATE classroom_enrollments
         SET is_active = true, last_active_at = NOW()
         WHERE id = $1`,
        [existing.rows[0].id]
      );
    } else {
      // Enroll student
      await db.query(
        'INSERT INTO classroom_enrollments (id, student_id, classroom_id) VALUES ($1, $2, $3)',
        [uuidv4(), user.userId, id]
      );
    }

    return { success: true, message: 'Successfully joined classroom' };
  });

  // Get classroom students (Teacher/Admin only)
  fastify.get('/:id/students', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as any;

    // Check if teacher of this classroom or admin
    if (user.role !== 'admin') {
      const classroom = await db.query(
        'SELECT teacher_id FROM classrooms WHERE id = $1',
        [id]
      );
      if (classroom.rowCount === 0 || classroom.rows[0].teacher_id !== user.userId) {
        return reply.code(403).send({ error: 'Access denied' });
      }
    }

    const result = await db.query(
      `SELECT u.id, u.full_name, u.email, ce.joined_at, ce.last_active_at,
              (SELECT COUNT(*) FROM progress WHERE student_id = u.id AND classroom_id = $1) as completed_lessons
       FROM classroom_enrollments ce
       JOIN users u ON u.id = ce.student_id
       WHERE ce.classroom_id = $1 AND ce.is_active = true
       ORDER BY ce.joined_at DESC`,
      [id]
    );

    return { students: result.rows };
  });

  // Leave classroom (Student)
  fastify.post('/:id/leave', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as any;

    if (user.role !== 'student') {
      return reply.code(403).send({ error: 'Only students can leave classrooms' });
    }

    const result = await db.query(
      'UPDATE classroom_enrollments SET is_active = false WHERE student_id = $1 AND classroom_id = $2 RETURNING id',
      [user.userId, id]
    );

    if (result.rowCount === 0) {
      return reply.code(404).send({ error: 'Not enrolled in this classroom' });
    }

    return { success: true, message: 'Left classroom' };
  });

  // Delete classroom (Teacher/Admin)
  fastify.delete('/:id', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as any;

    // Check permission
    if (user.role !== 'admin') {
      const classroom = await db.query(
        'SELECT teacher_id FROM classrooms WHERE id = $1',
        [id]
      );
      if (classroom.rowCount === 0 || classroom.rows[0].teacher_id !== user.userId) {
        return reply.code(403).send({ error: 'Access denied' });
      }
    }

    await db.query('UPDATE classrooms SET is_active = false WHERE id = $1', [id]);

    return { success: true, message: 'Classroom deleted' };
  });

  fastify.patch('/:id', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as any;
    const { name, description, subject, formLevel, isPublic } = request.body as any;

    if (!(await canManageClassroom(user, id))) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    const result = await db.query(
      `UPDATE classrooms
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           subject = COALESCE($3, subject),
           form_level = COALESCE($4, form_level),
           is_public = COALESCE($5, is_public),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name || null, description || null, subject || null, formLevel || null, typeof isPublic === 'boolean' ? isPublic : null, id]
    );

    if ((result.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Classroom not found' });
    }

    return { success: true, classroom: result.rows[0] };
  });

  // Get classroom analytics (Teacher/Admin)
  fastify.get('/:id/analytics', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as any;

    // Check permission
    if (user.role !== 'admin') {
      const classroom = await db.query(
        'SELECT teacher_id FROM classrooms WHERE id = $1',
        [id]
      );
      if (classroom.rowCount === 0 || classroom.rows[0].teacher_id !== user.userId) {
        return reply.code(403).send({ error: 'Access denied' });
      }
    }

    // Get analytics
    const totalStudents = await db.query(
      'SELECT COUNT(*) FROM classroom_enrollments WHERE classroom_id = $1 AND is_active = true',
      [id]
    );

    const activeToday = await db.query(
      `SELECT COUNT(DISTINCT student_id) FROM progress 
       WHERE classroom_id = $1 AND updated_at > NOW() - INTERVAL '24 hours'`,
      [id]
    );

    const avgProgress = await db.query(
      `SELECT AVG(completion_percentage) as avg_progress
       FROM progress
       WHERE classroom_id = $1`,
      [id]
    );

    const weekly = await db.query(
      `SELECT EXTRACT(DOW FROM updated_at)::int as dow,
              COUNT(*) FILTER (WHERE is_completed)::int as count
       FROM progress
       WHERE classroom_id = $1
         AND updated_at > NOW() - INTERVAL '7 days'
       GROUP BY EXTRACT(DOW FROM updated_at)::int`,
      [id]
    );

    const weakTopics = await db.query(
      `SELECT COALESCE(si.topic, l.subject, 'Topik') as topic,
              AVG(p.score) as avg_score
       FROM progress p
       JOIN lessons l ON l.id = p.lesson_id
       LEFT JOIN lesson_syllabus_links lsl ON lsl.lesson_id = l.id
       LEFT JOIN syllabus_items si ON si.id = lsl.syllabus_id
       WHERE p.classroom_id = $1
       GROUP BY COALESCE(si.topic, l.subject, 'Topik')
       HAVING COUNT(p.id) > 0
       ORDER BY AVG(p.score) ASC NULLS LAST
       LIMIT 3`,
      [id]
    );

    const dowCounts = new Map<number, number>(
      weekly.rows.map((row) => [Number(row.dow), Number(row.count) || 0])
    );
    const weekdayMap = [
      { dow: 1, day: 'Isnin' },
      { dow: 2, day: 'Selasa' },
      { dow: 3, day: 'Rabu' },
      { dow: 4, day: 'Khamis' },
      { dow: 5, day: 'Jumaat' },
    ];

    return {
      totalStudents: parseInt(totalStudents.rows[0].count),
      activeToday: parseInt(activeToday.rows[0].count),
      averageProgress: Math.round(avgProgress.rows[0].avg_progress || 0),
      weeklyActivity: weekdayMap.map(({ dow, day }) => ({
        day,
        count: dowCounts.get(dow) || 0,
      })),
      weakTopics: weakTopics.rows.map((row) => ({
        topic: row.topic,
        avgScore: Math.round(Number(row.avg_score) || 0),
      })),
    };
  });

  fastify.get('/:id/lessons', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as any;

    if (!(await checkClassroomAccess(user, id))) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    const result = await db.query(
      `SELECT l.id, l.title, l.subject, l.form_level, l.difficulty, l.estimated_minutes,
              cl.due_date, cl.is_required, cl.assigned_at,
              (
                SELECT si.topic
                FROM lesson_syllabus_links lsl
                JOIN syllabus_items si ON si.id = lsl.syllabus_id
                WHERE lsl.lesson_id = l.id
                ORDER BY si.order_index
                LIMIT 1
              ) as topic,
              (
                SELECT COUNT(*) FROM quiz_questions qq
                WHERE qq.lesson_id = l.id AND qq.is_active = true
              ) as question_count,
              (
                SELECT COUNT(*)
                FROM progress p
                WHERE p.lesson_id = l.id AND p.classroom_id = cl.classroom_id AND p.is_completed = true
              ) as completed_students
       FROM classroom_lessons cl
       JOIN lessons l ON l.id = cl.lesson_id AND l.is_active = true
       WHERE cl.classroom_id = $1
       ORDER BY cl.due_date DESC NULLS LAST, cl.assigned_at DESC`,
      [id]
    );

    return { lessons: result.rows };
  });

  fastify.post('/:id/lessons', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as any;
    const { lessonId, dueDate, isRequired } = request.body as any;

    if (!(await canManageClassroom(user, id))) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    const lesson = await db.query('SELECT id FROM lessons WHERE id = $1 AND is_active = true', [lessonId]);
    if ((lesson.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Lesson not found' });
    }

    await db.query(
      `INSERT INTO classroom_lessons (id, classroom_id, lesson_id, assigned_by, due_date, is_required)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (classroom_id, lesson_id)
       DO UPDATE SET due_date = EXCLUDED.due_date,
                     is_required = EXCLUDED.is_required,
                     assigned_by = EXCLUDED.assigned_by`,
      [uuidv4(), id, lessonId, user.userId, dueDate || null, isRequired !== false]
    );
    await publishLessonAssignedNotification(fastify, {
      classroomId: id,
      lessonId,
      dueDate: dueDate || null,
    });

    return { success: true };
  });

  fastify.delete('/:id/lessons/:lessonId', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id, lessonId } = request.params as any;

    if (!(await canManageClassroom(user, id))) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    const result = await db.query(
      'DELETE FROM classroom_lessons WHERE classroom_id = $1 AND lesson_id = $2 RETURNING lesson_id',
      [id, lessonId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Lesson assignment not found' });
    }

    return { success: true };
  });
}

async function canManageClassroom(user: any, classroomId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  if (user.role !== 'teacher') return false;

  const result = await db.query(
    'SELECT id FROM classrooms WHERE id = $1 AND teacher_id = $2',
    [classroomId, user.userId]
  );
  return (result.rowCount ?? 0) > 0;
}

async function checkClassroomAccess(user: any, classroomId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  if (user.role === 'teacher') {
    const result = await db.query(
      'SELECT id FROM classrooms WHERE id = $1 AND teacher_id = $2',
      [classroomId, user.userId]
    );
    return (result.rowCount ?? 0) > 0;
  }
  if (user.role === 'student') {
    const result = await db.query(
      'SELECT id FROM classroom_enrollments WHERE classroom_id = $1 AND student_id = $2 AND is_active = true',
      [classroomId, user.userId]
    );
    return (result.rowCount ?? 0) > 0;
  }
  if (user.role === 'parent') {
    // Check if any linked student is enrolled
    const result = await db.query(
      `SELECT ce.id FROM parent_student_links psl
       JOIN classroom_enrollments ce ON ce.student_id = psl.student_id
       WHERE psl.parent_id = $1 AND ce.classroom_id = $2 AND psl.is_active = true AND ce.is_active = true`,
      [user.userId, classroomId]
    );
    return (result.rowCount ?? 0) > 0;
  }
  return false;
}
