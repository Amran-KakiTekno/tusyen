import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  redisDel: vi.fn(),
  redisGet: vi.fn(),
  redisSetex: vi.fn(),
}));

vi.mock('../src/database', () => ({
  db: {
    query: mocks.query,
  },
}));

vi.mock('../src/redis', () => ({
  redis: {
    del: mocks.redisDel,
    get: mocks.redisGet,
    setex: mocks.redisSetex,
  },
}));

vi.mock('../src/config', () => ({
  config: {
    JWT_EXPIRES_IN: '1d',
    KEYCLOAK_ENABLED: false,
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

  it('derives parent alerts from linked student activity', async () => {
    mocks.query
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
