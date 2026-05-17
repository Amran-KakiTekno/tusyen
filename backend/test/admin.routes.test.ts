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
    mocks.dbQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    mocks.txQuery.mockResolvedValue({ rowCount: 0, rows: [] });
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
        role: 'admin',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.dbQuery.mock.calls[1][1]).toEqual([
      null,
      null,
      'admin',
      'Updated Teacher',
      false,
      null,
      false,
      null,
      null,
      userId,
    ]);
  });

  it('manually enrolls a student into a classroom', async () => {
    const classroomId = '11111111-1111-4111-8111-111111111111';
    const studentId = '22222222-2222-4222-8222-222222222222';
    mocks.dbQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: studentId }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: classroomId }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: `/admin/classrooms/${classroomId}/enroll`,
      payload: { studentId },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
    const enrollmentInsert = mocks.dbQuery.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO classroom_enrollments')
    );
    expect(enrollmentInsert?.[1]).toEqual([
      expect.any(String),
      studentId,
      classroomId,
    ]);

    await app.close();
  });

  it('creates and deactivates parent-student links', async () => {
    const parentId = '33333333-3333-4333-8333-333333333333';
    const studentId = '44444444-4444-4444-8444-444444444444';
    const linkId = '55555555-5555-4555-8555-555555555555';
    mocks.dbQuery
      .mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          { id: parentId, role: 'parent' },
          { id: studentId, role: 'student' },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: linkId, parent_id: parentId, student_id: studentId, is_active: true }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: linkId }] });

    const app = buildApp();
    await app.ready();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/admin/parent-links',
      payload: { parentId, studentId },
    });
    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json().link).toMatchObject({
      id: linkId,
      parent_id: parentId,
      student_id: studentId,
    });

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/admin/parent-links/${linkId}`,
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toEqual({ success: true });
    expect(mocks.dbQuery.mock.calls.some((call) =>
      String(call[0]).includes('UPDATE parent_student_links SET is_active = false')
    )).toBe(true);

    await app.close();
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
