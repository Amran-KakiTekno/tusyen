import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { checkRateLimit, redis } from '../redis';
import { config } from '../config';
import { auditLog } from '../audit';
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
import {
  accessTokenFromCookies,
  clearAuthCookies,
  consumeRefreshToken,
  issueAuthTokens,
  refreshTokenFromCookies,
  revokeAccessToken,
  revokeRefreshToken,
  setAuthCookies,
} from './session';

const SALT_ROUNDS = 10;
const LOGIN_RATE_LIMIT = {
  max: config.AUTH_LOGIN_RATE_LIMIT_MAX,
  windowSeconds: config.AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
};
const REGISTER_RATE_LIMIT = {
  max: config.AUTH_REGISTER_RATE_LIMIT_MAX,
  windowSeconds: config.AUTH_REGISTER_RATE_LIMIT_WINDOW_SECONDS,
};
const KEYCLOAK_START_RATE_LIMIT = {
  max: config.AUTH_KEYCLOAK_START_RATE_LIMIT_MAX,
  windowSeconds: config.AUTH_KEYCLOAK_START_RATE_LIMIT_WINDOW_SECONDS,
};
const LOGIN_FAILURE_LIMIT = 10;
const LOGIN_FAILURE_WINDOW_SECONDS = 60 * 60;
const LOGIN_LOCKOUT_SECONDS = 15 * 60;

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
    const normalizedEmail = `${email ?? ''}`.trim().toLowerCase();
    if (!(await enforceRateLimit(request, reply, 'register', REGISTER_RATE_LIMIT.max, REGISTER_RATE_LIMIT.windowSeconds))) return;

    if (role === 'admin' && !config.PUBLIC_ADMIN_REGISTRATION_ENABLED) {
      return reply.code(403).send({ error: 'Public admin registration is disabled' });
    }

    // Check if email exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
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
      [userId, normalizedEmail, hashedPassword, role, fullName, phoneNumber || null, dateOfBirth || null, true]
    );

    const tokens = await issueAuthTokens(fastify, {
      id: userId,
      email: normalizedEmail,
      role,
    });
    setAuthCookies(reply, tokens);

    return {
      ...tokens,
      user: {
        id: userId,
        email: normalizedEmail,
        role,
        fullName,
        avatarUrl: null,
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
    const normalizedEmail = `${email ?? ''}`.trim().toLowerCase();
    if (!(await enforceRateLimit(request, reply, 'login:ip', LOGIN_RATE_LIMIT.max, LOGIN_RATE_LIMIT.windowSeconds))) return;
    if (!(await enforceRateLimit(
      request,
      reply,
      `login:email:${rateKeyPart(normalizedEmail)}`,
      LOGIN_RATE_LIMIT.max,
      LOGIN_RATE_LIMIT.windowSeconds
    ))) return;
    if (await isLoginLocked(normalizedEmail)) {
      return reply.code(423).send({ error: 'Account temporarily locked after repeated failed login attempts' });
    }

    // Get user
    const result = await db.query(
      'SELECT id, email, password_hash, role, full_name, avatar_url, is_active FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (result.rowCount === 0) {
      await recordLoginFailure(normalizedEmail);
      auditLog(request, 'auth.login_failed', { email: normalizedEmail, reason: 'invalid_credentials' });
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (isDemoAdminAccount(user.email, user.role) && !config.DEMO_ADMIN_LOGIN_ENABLED) {
      return reply.code(403).send({ error: 'Demo admin login is disabled on this deployment' });
    }

    if (!user.is_active) {
      return reply.code(403).send({ error: 'Account deactivated' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await recordLoginFailure(normalizedEmail);
      auditLog(request, 'auth.login_failed', { email: normalizedEmail, reason: 'invalid_credentials' });
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // Update last login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    (request as any).user = { userId: user.id, role: user.role };
    auditLog(request, 'auth.login_success', { email: user.email });

    // Track device for sync
    if (deviceId) {
      await redis.setex(`user:device:${user.id}:${deviceId}`, 86400 * 30, JSON.stringify({
        lastLogin: Date.now(),
        deviceId
      }));
    }

    await clearLoginFailures(normalizedEmail);
    const tokens = await issueAuthTokens(fastify, user);
    setAuthCookies(reply, tokens);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
        avatarUrl: user.avatar_url,
      }
    };
  });

  // Refresh token
  fastify.post('/refresh', {
    schema: {
      body: {
        type: 'object',
        properties: {
          refreshToken: { type: 'string' },
          token: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const body = (request.body || {}) as any;
      const refreshRecord = await consumeRefreshToken(
        body.refreshToken || body.token || refreshTokenFromCookies(request.headers?.cookie)
      );
      if (!refreshRecord) {
        return reply.code(401).send({ error: 'Invalid refresh token' });
      }
      
      const result = await db.query(
        'SELECT id, email, role, full_name, avatar_url FROM users WHERE id = $1 AND is_active = true',
        [refreshRecord.userId]
      );

      if (result.rowCount === 0) {
        return reply.code(401).send({ error: 'User not found or inactive' });
      }

      const user = result.rows[0];
      const tokens = await issueAuthTokens(
        fastify,
        user,
        refreshRecord.authProvider ? { authProvider: refreshRecord.authProvider } : {}
      );
      setAuthCookies(reply, tokens);

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.full_name,
          avatarUrl: user.avatar_url,
        },
      };
    } catch (err) {
      request.log.warn(err);
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }
  });

  fastify.post('/logout', async (request, reply) => {
    const body = (request.body || {}) as any;
    await revokeRefreshToken(
      body.refreshToken || body.token || refreshTokenFromCookies(request.headers?.cookie)
    ).catch((error) => request.log.warn(error));

    const accessToken = bearerAccessToken(request.headers?.authorization)
      || accessTokenFromCookies(request.headers?.cookie);
    if (accessToken) {
      try {
        const decoded = await fastify.jwt.verify(accessToken);
        (request as any).user = decoded;
        await revokeAccessToken(decoded);
      } catch {
        // Logout is idempotent; expired or malformed access tokens are already unusable.
      }
    }

    auditLog(request, 'auth.logout');
    clearAuthCookies(reply);
    return { success: true };
  });

  fastify.post('/change-password', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 }
        }
      }
    }
  }, async (request, reply) => {
    const user = request.user as any;
    const { currentPassword, newPassword } = request.body as any;

    if (`${newPassword ?? ''}`.length < 8) {
      return reply.code(400).send({ error: 'New password must be at least 8 characters' });
    }

    const result = await db.query(
      'SELECT id, password_hash, is_active FROM users WHERE id = $1',
      [user.userId]
    );

    if ((result.rowCount ?? 0) === 0 || !result.rows[0].is_active) {
      return reply.code(401).send({ error: 'User not found or inactive' });
    }

    const valid = await bcrypt.compare(`${currentPassword ?? ''}`, result.rows[0].password_hash);
    if (!valid) {
      return reply.code(401).send({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, user.userId]
    );

    return { success: true };
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
      if (!(await enforceRateLimit(
        request,
        reply,
        'keycloak-login-url',
        KEYCLOAK_START_RATE_LIMIT.max,
        KEYCLOAK_START_RATE_LIMIT.windowSeconds
      ))) return;

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

      const tokens = await issueAuthTokens(fastify, user, { authProvider: 'keycloak' });
      setAuthCookies(reply, tokens);

      return {
        ...tokens,
        authProvider: 'keycloak',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.full_name,
          avatarUrl: user.avatar_url || null,
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
        properties: {
          studentId: { type: 'string' },
          studentIdentifier: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const user = request.user as any;
    const { studentId, studentIdentifier } = request.body as any;
    const identifier = `${studentIdentifier ?? studentId ?? ''}`.trim();

    if (user.role !== 'parent') {
      return reply.code(403).send({ error: 'Only parents can link to students' });
    }

    if (!identifier) {
      return reply.code(400).send({ error: 'Student ID or email is required' });
    }

    // Verify student exists
    const student = isUuid(identifier)
      ? await db.query('SELECT id FROM users WHERE id = $1 AND role = $2', [identifier, 'student'])
      : await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND role = $2', [identifier, 'student']);
    if (student.rowCount === 0) {
      return reply.code(404).send({ error: 'Student not found' });
    }
    const linkedStudentId = student.rows[0].id;

    // Check if already linked
    const existing = await db.query(
      'SELECT id, is_active FROM parent_student_links WHERE parent_id = $1 AND student_id = $2',
      [user.userId, linkedStudentId]
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
      [uuidv4(), user.userId, linkedStudentId]
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

  fastify.delete('/linked-students/:studentId', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['studentId'],
        properties: {
          studentId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const user = request.user as any;
    const { studentId } = request.params as any;

    if (user.role !== 'parent') {
      return reply.code(403).send({ error: 'Only parents can unlink students' });
    }

    const result = await db.query(
      `UPDATE parent_student_links
       SET is_active = false
       WHERE parent_id = $1
         AND student_id = $2
         AND is_active = true
       RETURNING id`,
      [user.userId, studentId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Linked student not found' });
    }

    return { success: true };
  });

  fastify.get('/parent/alerts', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const user = request.user as any;

    if (user.role !== 'parent') {
      return reply.code(403).send({ error: 'Only parents can view alerts' });
    }

    await ensureParentAlertStatusTable();

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
          id: buildParentAlertId(child.id, 'low-score', subject),
          childId: child.id,
          icon: '🔴',
          title: `Prestasi ${subject} merosot`,
          desc: `Purata ${child.full_name} untuk ${subject} ialah ${Math.round(Number(row.avg_score) || 0)}% dalam 14 hari terakhir.`,
          severity: 'high',
          time: 'Hari ini',
          action: 'Tandai untuk tindak lanjut',
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
          id: buildParentAlertId(child.id, 'inactivity'),
          childId: child.id,
          icon: '🟡',
          title: 'Kehadiran log masuk rendah',
          desc: `${child.full_name} belum menunjukkan aktiviti pembelajaran yang konsisten dalam beberapa hari ini.`,
          severity: 'medium',
          time: lastActivity ? formatAlertTime(lastActivity) : 'Tiada aktiviti',
          action: 'Semak Kemajuan',
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
          id: buildParentAlertId(child.id, 'streak-7'),
          childId: child.id,
          icon: '🟢',
          title: 'Streak tujuh hari!',
          desc: `${child.full_name} berjaya belajar 7 hari berturut-turut. Tahniah!`,
          severity: 'good',
          time: 'Hari ini',
          action: null,
        });
      }

      const assignment = await db.query(
        `SELECT p.id,
                p.title,
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
          id: buildParentAlertId(child.id, 'assignment', post.id),
          childId: child.id,
          icon: '📋',
          title: 'Kuiz Baharu Dihantar',
          desc: `${post.author_name || 'Guru'} hantar ${post.title || 'tugasan'}: ${`${post.content || ''}`.slice(0, 90)}`,
          severity: 'info',
          time: formatAlertTime(post.created_at),
          action: 'Lihat Kuiz',
        });
      }
    }
    const visibleAlerts = alerts.slice(0, 12);
    const statuses = await getParentAlertStatuses(user.userId, visibleAlerts);

    return {
      alerts: visibleAlerts.map(alert => ({
        ...alert,
        ...(statuses.get(parentAlertStatusKey(alert.childId, alert.id)) || {}),
      }))
    };
  });

  fastify.patch('/parent/alerts/status', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['childId', 'alertId'],
        properties: {
          childId: { type: 'string', format: 'uuid' },
          alertId: { type: 'string', minLength: 1, maxLength: 240 },
          read: { type: 'boolean' },
          dismissed: { type: 'boolean' },
          followUp: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const user = request.user as any;
    const { childId, alertId, read, dismissed, followUp } = request.body as any;

    if (user.role !== 'parent') {
      return reply.code(403).send({ error: 'Only parents can update alerts' });
    }

    if (!hasParentAlertStatusUpdate({ read, dismissed, followUp })) {
      return reply.code(400).send({ error: 'At least one alert status field is required' });
    }

    if (!(await parentCanAccessChild(user.userId, childId))) {
      return reply.code(404).send({ error: 'Linked student not found' });
    }

    await ensureParentAlertStatusTable();
    const status = await upsertParentAlertStatus(user.userId, childId, alertId, { read, dismissed, followUp });

    return { success: true, status };
  });

  fastify.patch('/parent/alerts/status/bulk', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['childId', 'alertIds'],
        properties: {
          childId: { type: 'string', format: 'uuid' },
          alertIds: {
            type: 'array',
            minItems: 1,
            maxItems: 50,
            items: { type: 'string', minLength: 1, maxLength: 240 }
          },
          read: { type: 'boolean' },
          dismissed: { type: 'boolean' },
          followUp: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const user = request.user as any;
    const { childId, alertIds, read, dismissed, followUp } = request.body as any;

    if (user.role !== 'parent') {
      return reply.code(403).send({ error: 'Only parents can update alerts' });
    }

    if (!hasParentAlertStatusUpdate({ read, dismissed, followUp })) {
      return reply.code(400).send({ error: 'At least one alert status field is required' });
    }

    if (!(await parentCanAccessChild(user.userId, childId))) {
      return reply.code(404).send({ error: 'Linked student not found' });
    }

    await ensureParentAlertStatusTable();
    const uniqueAlertIds = Array.from(new Set<string>((alertIds || []).map((id: any) => `${id}`.trim()).filter(Boolean)));
    const statuses = [];

    for (const id of uniqueAlertIds) {
      statuses.push(await upsertParentAlertStatus(user.userId, childId, id, { read, dismissed, followUp }));
    }

    return { success: true, statuses };
  });

}

async function enforceRateLimit(
  request: any,
  reply: any,
  scope: string,
  maxRequests: number,
  windowSeconds: number
) {
  const key = `rate:${scope}:${clientIp(request)}`;
  const allowed = await checkRateLimit(key, maxRequests, windowSeconds);
  if (!allowed) {
    reply.code(429).send({ error: 'Too many requests. Please try again shortly.' });
    return false;
  }
  return true;
}

function clientIp(request: any) {
  const forwardedFor = firstHeader(request.headers?.['x-forwarded-for']);
  const cfConnectingIp = firstHeader(request.headers?.['cf-connecting-ip']);
  return (cfConnectingIp || forwardedFor?.split(',')[0]?.trim() || request.ip || 'unknown')
    .replace(/[^a-zA-Z0-9:._-]/g, '_')
    .slice(0, 80);
}

function firstHeader(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function rateKeyPart(value: unknown) {
  return `${value ?? ''}`.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_').slice(0, 120) || 'blank';
}

async function isLoginLocked(email: string) {
  return Boolean(await redis.get(loginLockKey(email)));
}

async function recordLoginFailure(email: string) {
  const key = loginFailureKey(email);
  const failures = await redis.incr(key);
  if (failures === 1) {
    await redis.expire(key, LOGIN_FAILURE_WINDOW_SECONDS);
  }
  if (failures >= LOGIN_FAILURE_LIMIT) {
    await redis.setex(loginLockKey(email), LOGIN_LOCKOUT_SECONDS, '1');
  }
}

async function clearLoginFailures(email: string) {
  await redis.del(loginFailureKey(email));
  await redis.del(loginLockKey(email));
}

function loginFailureKey(email: string) {
  return `auth:login:fail:${rateKeyPart(email)}`;
}

function loginLockKey(email: string) {
  return `auth:login:lock:${rateKeyPart(email)}`;
}

function bearerAccessToken(value: string | string[] | undefined) {
  const header = firstHeader(value);
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

function isDemoAdminAccount(email: string, role: string) {
  return role === 'admin' && email.toLowerCase() === 'admin@tusyen.test';
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function ensureParentAlertStatusTable() {
  await db.query(
    `CREATE TABLE IF NOT EXISTS parent_alert_statuses (
      parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      alert_id TEXT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT false,
      dismissed BOOLEAN NOT NULL DEFAULT false,
      follow_up BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (parent_id, child_id, alert_id)
    )`
  );
}

function buildParentAlertId(childId: string, type: string, value = '') {
  const cleanValue = `${value || ''}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return [childId, type, cleanValue].filter(Boolean).join(':');
}

function parentAlertStatusKey(childId: string, alertId: string) {
  return `${childId}::${alertId}`;
}

async function getParentAlertStatuses(parentId: string, alerts: any[]) {
  const statuses = new Map<string, any>();
  const childIds = Array.from(new Set(alerts.map(alert => alert.childId).filter(Boolean)));
  const alertIds = Array.from(new Set(alerts.map(alert => alert.id).filter(Boolean)));
  if (!childIds.length || !alertIds.length) return statuses;

  const result = await db.query(
    `SELECT child_id, alert_id, read, dismissed, follow_up
     FROM parent_alert_statuses
     WHERE parent_id = $1
       AND child_id = ANY($2::uuid[])
       AND alert_id = ANY($3::text[])`,
    [parentId, childIds, alertIds]
  );

  for (const row of result.rows) {
    statuses.set(parentAlertStatusKey(row.child_id, row.alert_id), {
      read: Boolean(row.read),
      dismissed: Boolean(row.dismissed),
      followUp: Boolean(row.follow_up),
      follow_up: Boolean(row.follow_up),
    });
  }

  return statuses;
}

function hasParentAlertStatusUpdate(status: any) {
  return status.read !== undefined || status.dismissed !== undefined || status.followUp !== undefined;
}

async function parentCanAccessChild(parentId: string, childId: string) {
  const result = await db.query(
    `SELECT id
     FROM parent_student_links
     WHERE parent_id = $1
       AND student_id = $2
       AND is_active = true`,
    [parentId, childId]
  );
  return (result.rowCount ?? 0) > 0;
}

async function upsertParentAlertStatus(parentId: string, childId: string, alertId: string, status: any) {
  const nextRead = status.read !== undefined ? Boolean(status.read) : null;
  const nextDismissed = status.dismissed !== undefined ? Boolean(status.dismissed) : null;
  const nextFollowUp = status.followUp !== undefined ? Boolean(status.followUp) : null;

  const result = await db.query(
    `INSERT INTO parent_alert_statuses (parent_id, child_id, alert_id, read, dismissed, follow_up, updated_at)
     VALUES ($1, $2, $3, COALESCE($4::boolean, false), COALESCE($5::boolean, false), COALESCE($6::boolean, false), NOW())
     ON CONFLICT (parent_id, child_id, alert_id)
     DO UPDATE SET read = COALESCE($4::boolean, parent_alert_statuses.read),
                   dismissed = COALESCE($5::boolean, parent_alert_statuses.dismissed),
                   follow_up = COALESCE($6::boolean, parent_alert_statuses.follow_up),
                   updated_at = NOW()
     RETURNING child_id, alert_id, read, dismissed, follow_up`,
    [parentId, childId, alertId, nextRead, nextDismissed, nextFollowUp]
  );
  const row = result.rows[0];

  return {
    childId: row.child_id,
    alertId: row.alert_id,
    read: Boolean(row.read),
    dismissed: Boolean(row.dismissed),
    followUp: Boolean(row.follow_up),
    follow_up: Boolean(row.follow_up),
  };
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
