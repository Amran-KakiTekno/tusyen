import Fastify from 'fastify';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  checkRateLimit: vi.fn(),
  redisDel: vi.fn(),
  redisExpire: vi.fn(),
  redisGet: vi.fn(),
  redisIncr: vi.fn(),
  redisSetex: vi.fn(),
}));

vi.mock('../src/database', () => ({
  db: {
    query: mocks.query,
  },
}));

vi.mock('../src/redis', () => ({
  checkRateLimit: mocks.checkRateLimit,
  redis: {
    del: mocks.redisDel,
    expire: mocks.redisExpire,
    get: mocks.redisGet,
    incr: mocks.redisIncr,
    setex: mocks.redisSetex,
  },
}));

vi.mock('../src/config', () => ({
  config: {
    JWT_ACCESS_EXPIRES_IN: '1h',
    JWT_EXPIRES_IN: '1d',
    JWT_REFRESH_TTL_SECONDS: 604800,
    AUTH_COOKIE_SECURE: true,
    AUTH_LOGIN_RATE_LIMIT_MAX: 5,
    AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS: 60,
    AUTH_REGISTER_RATE_LIMIT_MAX: 6,
    AUTH_REGISTER_RATE_LIMIT_WINDOW_SECONDS: 300,
    AUTH_KEYCLOAK_START_RATE_LIMIT_MAX: 20,
    AUTH_KEYCLOAK_START_RATE_LIMIT_WINDOW_SECONDS: 60,
    KEYCLOAK_ENABLED: false,
    PUBLIC_ADMIN_REGISTRATION_ENABLED: false,
    DEMO_ADMIN_LOGIN_ENABLED: false,
  },
}));

vi.mock('../src/auth/keycloak', () => ({
  createPendingKeycloakLogin: vi.fn(),
  exchangeKeycloakCode: vi.fn(),
  keycloakLoginRedisKey: vi.fn((state: string) => `kc:${state}`),
  keycloakLoginTtlSeconds: 300,
  keycloakPublicBaseUrl: vi.fn(() => 'http://keycloak.test'),
  KeycloakAuthError: class KeycloakAuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  parsePendingKeycloakLogin: vi.fn(),
  requestOriginFromHeaders: vi.fn(() => 'http://localhost'),
}));

const { authRoutes } = await import('../src/auth/routes');

function buildApp(user = { userId: '37842982-b45a-498a-aab2-0e84c4997822', role: 'parent' }) {
  const app = Fastify();
  app.decorate('authenticate', async (request: any) => {
    request.user = user;
  });
  app.decorate('jwt', {
    sign: vi.fn(() => 'test-token'),
  });
  app.register(authRoutes, { prefix: '/auth' });
  return app;
}

describe('auth parent routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue(true);
    mocks.redisIncr.mockResolvedValue(1);
    mocks.redisSetex.mockResolvedValue('OK');
  });

  it('sets httpOnly auth cookies on login', async () => {
    const hash = await bcrypt.hash('correct-password', 4);
    mocks.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: '37842982-b45a-498a-aab2-0e84c4997822',
          email: 'teacher@example.test',
          password_hash: hash,
          role: 'teacher',
          full_name: 'Cikgu Test',
          is_active: true,
        }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'teacher@example.test',
        password: 'correct-password',
      },
    });

    const cookies = response.headers['set-cookie'];
    const cookieText = Array.isArray(cookies) ? cookies.join('\n') : `${cookies}`;
    expect(response.statusCode).toBe(200);
    expect(cookieText).toContain('tusyen_access=test-token');
    expect(cookieText).toContain('tusyen_refresh=');
    expect(cookieText).toContain('HttpOnly');
    expect(cookieText).toContain('SameSite=Strict');
    expect(cookieText).toContain('Secure');
  });

  it('reactivates an inactive parent-student link instead of blocking relink', async () => {
    const studentId = '7663e515-ea19-49e9-8480-ea92e49ce3b6';
    const linkId = '432e0191-8295-45c9-85cb-b94c1aab25f8';
    mocks.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: studentId }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: linkId, is_active: false }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: linkId }] });

    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/link-parent',
      payload: { studentId },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      message: 'Successfully linked to student',
    });
    expect(mocks.query.mock.calls[2][0]).toContain('UPDATE parent_student_links SET is_active = true');
    expect(mocks.query.mock.calls[2][1]).toEqual([linkId]);
  });

  it('still rejects an already active parent-student link', async () => {
    const studentId = '7663e515-ea19-49e9-8480-ea92e49ce3b6';
    mocks.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: studentId }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'link-1', is_active: true }] });

    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/link-parent',
      payload: { studentId },
    });

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).error).toBe('Already linked to this student');
  });

  it('links a student by email identifier', async () => {
    const studentId = '7663e515-ea19-49e9-8480-ea92e49ce3b6';
    mocks.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: studentId }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/link-parent',
      payload: { studentIdentifier: 'student@example.test' },
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.query.mock.calls[0][0]).toContain('LOWER(email) = LOWER($1)');
    expect(mocks.query.mock.calls[0][1]).toEqual(['student@example.test', 'student']);
    expect(mocks.query.mock.calls[2][1]).toEqual([
      expect.any(String),
      '37842982-b45a-498a-aab2-0e84c4997822',
      studentId,
    ]);
  });

  it('lets a parent unlink an active student link', async () => {
    const studentId = '7663e515-ea19-49e9-8480-ea92e49ce3b6';
    mocks.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: '432e0191-8295-45c9-85cb-b94c1aab25f8' }],
    });

    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'DELETE',
      url: `/auth/linked-students/${studentId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
    expect(mocks.query.mock.calls[0][0]).toContain('UPDATE parent_student_links');
    expect(mocks.query.mock.calls[0][1]).toEqual([
      '37842982-b45a-498a-aab2-0e84c4997822',
      studentId,
    ]);
  });

  it('changes the current user password after verifying the old password', async () => {
    const hash = await bcrypt.hash('old-password', 4);
    mocks.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'parent-1', password_hash: hash, is_active: true }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      payload: {
        currentPassword: 'old-password',
        newPassword: 'new-password',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
    expect(mocks.query.mock.calls[1][0]).toContain('UPDATE users SET password_hash');
    await expect(bcrypt.compare('new-password', mocks.query.mock.calls[1][1][0])).resolves.toBe(true);
  });

  it('derives parent alerts from linked student activity', async () => {
    mocks.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'student-1', full_name: 'Ahmad Hafiz' }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ subject: 'Fizik', avg_score: 42 }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ last_activity: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ active_days: 7 }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          title: 'Geometri Bab 3',
          content: 'Sila lengkapkan latihan ini.',
          created_at: new Date().toISOString(),
          author_name: 'Cikgu Azman',
        }],
      })
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/auth/parent/alerts',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.alerts).toHaveLength(4);
    expect(body.alerts.map((alert: any) => alert.severity)).toEqual([
      'high',
      'medium',
      'good',
      'info',
    ]);
    expect(body.alerts[0].title).toBe('Prestasi Fizik merosot');
  });
});
