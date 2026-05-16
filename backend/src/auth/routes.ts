import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { redis } from '../redis';
import { config } from '../config';
import {
  createPendingKeycloakLogin,
  exchangeKeycloakCode,
  keycloakLoginRedisKey,
  keycloakLoginTtlSeconds,
  keycloakPublicBaseUrl,
  KeycloakAuthError,
  parsePendingKeycloakLogin,
  requestOriginFromHeaders,
} from './keycloak';

const SALT_ROUNDS = 10;

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'role', 'fullName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          role: { type: 'string', enum: ['student', 'teacher', 'parent', 'admin'] },
          fullName: { type: 'string' },
          phoneNumber: { type: 'string' },
          dateOfBirth: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { email, password, role, fullName, phoneNumber, dateOfBirth } = request.body as any;

    // Check if email exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount && existing.rowCount > 0) {
      return reply.code(409).send({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = uuidv4();

    // Create user
    await db.query(
      `INSERT INTO users (id, email, password_hash, role, full_name, phone_number, date_of_birth, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, email, hashedPassword, role, fullName, phoneNumber || null, dateOfBirth || null, true]
    );

    // Generate JWT
    const token = fastify.jwt.sign({ 
      userId, 
      email, 
      role,
      iat: Date.now()
    }, { expiresIn: config.JWT_EXPIRES_IN });

    return {
      token,
      user: {
        id: userId,
        email,
        role,
        fullName
      }
    };
  });

  // Login
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
          deviceId: { type: 'string' } // For sync tracking
        }
      }
    }
  }, async (request, reply) => {
    const { email, password, deviceId } = request.body as any;

    // Get user
    const result = await db.query(
      'SELECT id, email, password_hash, role, full_name, is_active FROM users WHERE email = $1',
      [email]
    );

    if (result.rowCount === 0) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return reply.code(403).send({ error: 'Account deactivated' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // Update last login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Track device for sync
    if (deviceId) {
      await redis.setex(`user:device:${user.id}:${deviceId}`, 86400 * 30, JSON.stringify({
        lastLogin: Date.now(),
        deviceId
      }));
    }

    // Generate JWT
    const token = fastify.jwt.sign({ 
      userId: user.id, 
      email: user.email, 
      role: user.role,
      iat: Date.now()
    }, { expiresIn: config.JWT_EXPIRES_IN });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name
      }
    };
  });

  // Refresh token
  fastify.post('/refresh', async (request, reply) => {
    try {
      const decoded = await request.jwtVerify() as any;
      
      const result = await db.query(
        'SELECT id, email, role, full_name FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );

      if (result.rowCount === 0) {
        return reply.code(401).send({ error: 'User not found or inactive' });
      }

      const user = result.rows[0];

      const token = fastify.jwt.sign({ 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        iat: Date.now()
      }, { expiresIn: config.JWT_EXPIRES_IN });

      return { token };
    } catch (err) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
  });

  // Keycloak integration status for the Flutter client and deployment checks.
  fastify.get('/keycloak/status', async (request) => {
    const requestOrigin = requestOriginFromHeaders(request.headers as any);
    return {
      enabled: true,
      provider: 'keycloak',
      realm: config.KEYCLOAK_REALM,
      clientId: config.KEYCLOAK_CLIENT_ID,
      publicUrl: keycloakPublicBaseUrl(requestOrigin),
      callbackPath: '/keycloak-callback',
      flow: 'authorization_code_pkce',
    };
  });

  // Start Keycloak authorization-code flow. The backend owns PKCE verifier storage
  // so the Flutter web app never has to persist verifier material in browser state.
  fastify.post('/keycloak/login-url', {
    schema: {
      body: {
        type: 'object',
        required: ['redirectUri'],
        properties: {
          redirectUri: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { redirectUri } = request.body as any;
      const requestOrigin = requestOriginFromHeaders(request.headers as any);
      const login = createPendingKeycloakLogin(redirectUri, requestOrigin);
      await redis.setex(
        keycloakLoginRedisKey(login.state),
        keycloakLoginTtlSeconds(),
        JSON.stringify(login.pending)
      );

      return {
        provider: 'keycloak',
        url: login.url,
        state: login.state,
        expiresIn: login.expiresIn,
      };
    } catch (err) {
      if (err instanceof KeycloakAuthError) {
        return reply.code(err.statusCode).send({ error: err.message });
      }
      request.log.error(err);
      return reply.code(500).send({ error: 'Could not start Keycloak login' });
    }
  });

  // Complete Keycloak login and mint the same app JWT used by the existing API.
  fastify.post('/keycloak/callback', {
    schema: {
      body: {
        type: 'object',
        required: ['code', 'state', 'redirectUri'],
        properties: {
          code: { type: 'string' },
          state: { type: 'string' },
          redirectUri: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { code, state, redirectUri } = request.body as any;
    const redisKey = keycloakLoginRedisKey(state);

    try {
      const pending = parsePendingKeycloakLogin(await redis.get(redisKey));
      await redis.del(redisKey);

      const requestOrigin = requestOriginFromHeaders(request.headers as any);
      const { user } = await exchangeKeycloakCode({
        code,
        redirectUri,
        pending,
        requestOrigin,
      });

      const token = fastify.jwt.sign({
        userId: user.id,
        email: user.email,
        role: user.role,
        authProvider: 'keycloak',
        iat: Date.now()
      }, { expiresIn: config.JWT_EXPIRES_IN });

      return {
        token,
        authProvider: 'keycloak',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.full_name
        }
      };
    } catch (err) {
      await redis.del(redisKey).catch(() => undefined);
      if (err instanceof KeycloakAuthError) {
        return reply.code(err.statusCode).send({ error: err.message });
      }
      request.log.error(err);
      return reply.code(500).send({ error: 'Could not complete Keycloak login' });
    }
  });

  // Link parent to student
  fastify.post('/link-parent', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['studentId'],
        properties: {
          studentId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const user = request.user as any;
    const { studentId } = request.body as any;

    if (user.role !== 'parent') {
      return reply.code(403).send({ error: 'Only parents can link to students' });
    }

    // Verify student exists
    const student = await db.query('SELECT id FROM users WHERE id = $1 AND role = $2', [studentId, 'student']);
    if (student.rowCount === 0) {
      return reply.code(404).send({ error: 'Student not found' });
    }

    // Check if already linked
    const existing = await db.query(
      'SELECT id, is_active FROM parent_student_links WHERE parent_id = $1 AND student_id = $2',
      [user.userId, studentId]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      if (existing.rows[0].is_active) {
        return reply.code(409).send({ error: 'Already linked to this student' });
      }

      await db.query(
        'UPDATE parent_student_links SET is_active = true, created_at = NOW() WHERE id = $1',
        [existing.rows[0].id]
      );

      return { success: true, message: 'Successfully linked to student' };
    }

    // Create link
    await db.query(
      'INSERT INTO parent_student_links (id, parent_id, student_id) VALUES ($1, $2, $3)',
      [uuidv4(), user.userId, studentId]
    );

    return { success: true, message: 'Successfully linked to student' };
  });

  // Get linked students (for parents)
  fastify.get('/linked-students', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const user = request.user as any;

    if (user.role !== 'parent') {
      return reply.code(403).send({ error: 'Only parents can view linked students' });
    }

    const result = await db.query(
      `SELECT s.id, s.full_name, s.email, s.created_at,
              psl.created_at as linked_at
       FROM parent_student_links psl
       JOIN users s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND psl.is_active = true`,
      [user.userId]
    );

    return { students: result.rows };
  });

  fastify.get('/parent/alerts', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const user = request.user as any;

    if (user.role !== 'parent') {
      return reply.code(403).send({ error: 'Only parents can view alerts' });
    }

    const linked = await db.query(
      `SELECT s.id, s.full_name
       FROM parent_student_links psl
       JOIN users s ON s.id = psl.student_id
       WHERE psl.parent_id = $1
         AND psl.is_active = true
         AND s.is_active = true
       ORDER BY psl.created_at DESC`,
      [user.userId]
    );

    const alerts: any[] = [];

    for (const child of linked.rows) {
      const lowScore = await db.query(
        `SELECT l.subject,
                AVG(p.score) as avg_score
         FROM progress p
         JOIN lessons l ON l.id = p.lesson_id
         WHERE p.student_id = $1
           AND p.updated_at >= NOW() - INTERVAL '14 days'
         GROUP BY l.subject
         HAVING AVG(p.score) < 50
         ORDER BY AVG(p.score) ASC
         LIMIT 1`,
        [child.id]
      );

      if ((lowScore.rowCount ?? 0) > 0) {
        const row = lowScore.rows[0];
        const subject = row.subject || 'Subjek';
        alerts.push({
          icon: '🔴',
          title: `Prestasi ${subject} merosot`,
          desc: `Purata ${child.full_name} untuk ${subject} ialah ${Math.round(Number(row.avg_score) || 0)}% dalam 14 hari terakhir.`,
          severity: 'high',
          time: 'Hari ini',
          action: 'Hubungi Guru',
        });
      }

      const activity = await db.query(
        'SELECT MAX(updated_at) as last_activity FROM progress WHERE student_id = $1',
        [child.id]
      );
      const lastActivity = activity.rows[0]?.last_activity ? new Date(activity.rows[0].last_activity) : null;
      const inactiveMs = lastActivity ? Date.now() - lastActivity.getTime() : Number.POSITIVE_INFINITY;
      if (!lastActivity || inactiveMs > 3 * 24 * 60 * 60 * 1000) {
        alerts.push({
          icon: '🟡',
          title: 'Kehadiran log masuk rendah',
          desc: `${child.full_name} belum menunjukkan aktiviti pembelajaran yang konsisten dalam beberapa hari ini.`,
          severity: 'medium',
          time: lastActivity ? formatAlertTime(lastActivity) : 'Tiada aktiviti',
          action: 'Lihat Jadual',
        });
      }

      const streak = await db.query(
        `SELECT COUNT(DISTINCT activity_date)::int as active_days
         FROM student_streaks
         WHERE student_id = $1
           AND activity_date >= CURRENT_DATE - INTERVAL '6 days'`,
        [child.id]
      );
      if (Number(streak.rows[0]?.active_days || 0) >= 7) {
        alerts.push({
          icon: '🟢',
          title: 'Streak tujuh hari!',
          desc: `${child.full_name} berjaya belajar 7 hari berturut-turut. Tahniah!`,
          severity: 'good',
          time: 'Hari ini',
          action: null,
        });
      }

      const assignment = await db.query(
        `SELECT p.title,
                p.content,
                p.created_at,
                u.full_name as author_name
         FROM classroom_enrollments ce
         JOIN posts p
           ON p.classroom_id = ce.classroom_id
          AND p.is_active = true
          AND p.post_type = 'assignment'
         JOIN users u ON u.id = p.author_id
         WHERE ce.student_id = $1
           AND ce.is_active = true
         ORDER BY p.created_at DESC
         LIMIT 1`,
        [child.id]
      );
      if ((assignment.rowCount ?? 0) > 0) {
        const post = assignment.rows[0];
        alerts.push({
          icon: '📋',
          title: 'Kuiz Baharu Dihantar',
          desc: `${post.author_name || 'Guru'} hantar ${post.title || 'tugasan'}: ${`${post.content || ''}`.slice(0, 90)}`,
          severity: 'info',
          time: formatAlertTime(post.created_at),
          action: 'Lihat Kuiz',
        });
      }
    }

    return { alerts: alerts.slice(0, 12) };
  });

}

function formatAlertTime(value: string | Date): string {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Baru sahaja';
  if (minutes < 60) return `${minutes}m lepas`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}j lepas`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Semalam';
  return `${days} hari lepas`;
}
