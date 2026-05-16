import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dbQuery: vi.fn(),
  txQuery: vi.fn(),
  withTransaction: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock('../src/database', () => ({
  db: {
    query: mocks.dbQuery,
  },
  withTransaction: mocks.withTransaction,
}));

vi.mock('../src/redis', () => ({
  deleteSession: mocks.deleteSession,
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
    flushall: vi.fn().mockResolvedValue('OK'),
  },
}));

vi.mock('../src/media-access', () => ({
  assertCanAttachMediaReferences: vi.fn().mockResolvedValue(undefined),
  isMediaAccessError: vi.fn(() => false),
  protectMediaReferences: vi.fn((_fastify, _user, value) => value),
}));

vi.mock('../src/external-video', () => ({
  ExternalVideoError: class ExternalVideoError extends Error {},
  normalizeExternalVideoBlock: vi.fn((block) => block),
}));

vi.mock('../src/notifications', () => ({
  ntfyHealth: vi.fn().mockResolvedValue({ enabled: true, connected: true }),
  ntfyPublicTopicUrl: vi.fn((topic: string) => `http://localhost:2586/${topic}`),
  ntfySmokeTopic: vi.fn(() => 'test-topic'),
  normalizeNtfyTopic: vi.fn((topic: string) => topic),
  publishLessonAssignedNotification: vi.fn().mockResolvedValue({ ok: true }),
  publishNtfyNotification: vi.fn().mockResolvedValue({ ok: true }),
}));

const { adminRoutes } = await import('../src/admin/routes');

function buildApp() {
  const app = Fastify();
  app.decorate('authenticate', async (request: any) => {
    request.user = {
      userId: '1a3129d0-bb2d-434b-9e0b-c98d162fca38',
      role: 'admin',
    };
  });
  app.register(adminRoutes, { prefix: '/admin' });
  return app;
}

describe('admin routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withTransaction.mockImplementation(async (callback) =>
      callback({ query: mocks.txQuery })
    );
  });

  it('preserves optional user fields during partial updates', async () => {
    const userId = 'ce8027e5-cac6-4a5e-a3bf-9d80eee0b92e';
    mocks.dbQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: userId, role: 'teacher' }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: userId,
            email: 'teacher@test.local',
            full_name: 'Updated Teacher',
            role: 'teacher',
            phone_number: '+60123456789',
            date_of_birth: '1990-01-02',
            is_active: true,
          },
        ],
      });

    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'PATCH',
      url: `/admin/users/${userId}`,
      payload: {
        fullName: 'Updated Teacher',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.dbQuery.mock.calls[1][1]).toEqual([
      null,
      null,
      null,
      'Updated Teacher',
      false,
      null,
      false,
      null,
      null,
      userId,
    ]);
  });

  it('creates lesson questions from camelCase admin builder payloads', async () => {
    const syllabusId = 'aaf90707-bd3d-4c24-9ec0-874d1567d1ec';
    mocks.dbQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: syllabusId }] });
    mocks.txQuery.mockResolvedValue({ rowCount: 1, rows: [] });

    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/admin/lessons',
      payload: {
        syllabusId,
        title: 'Admin Builder Lesson',
        content: {
          summary: 'Admin lesson.',
        },
        difficulty: 'medium',
        estimatedMinutes: 12,
        quizData: {
          questions: [
            {
              questionText: 'What is 2 + 2?',
              questionType: 'multiple_choice',
              options: ['3', '4'],
              correctAnswer: 1,
              explanation: 'Four.',
            },
          ],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const questionInsert = mocks.txQuery.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO quiz_questions')
    );
    expect(questionInsert).toBeTruthy();
    expect(questionInsert?.[1][2]).toBe('What is 2 + 2?');
    expect(questionInsert?.[1][3]).toBe('multiple_choice');
    expect(questionInsert?.[1][6]).toBe('Four.');
  });
});
