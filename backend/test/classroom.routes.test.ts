import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dbQuery: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock('../src/database', () => ({
  db: {
    query: mocks.dbQuery,
  },
  withTransaction: mocks.withTransaction,
}));

vi.mock('../src/redis', () => ({
  redis: {
    publish: vi.fn(),
  },
}));

vi.mock('../src/notifications', () => ({
  publishLessonAssignedNotification: vi.fn().mockResolvedValue({ ok: true }),
}));

const { classroomRoutes } = await import('../src/classroom/routes');

function buildApp(user = { userId: 'admin-1', role: 'admin' }) {
  const app = Fastify();
  app.decorate('authenticate', async (request: any) => {
    request.user = user;
  });
  app.register(classroomRoutes, { prefix: '/classroom' });
  return app;
}

describe('classroom analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes weekly activity and weak topics in analytics response', async () => {
    mocks.dbQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '28' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: '3' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ avg_progress: 72, progress_count: 9 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ count: 2 }] })
      .mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          { dow: 1, count: 5 },
          { dow: 3, count: 2 },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ topic: 'Geometri', avg_score: 45 }],
      });

    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/classroom/classroom-1/analytics',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      totalStudents: 28,
      activeToday: 3,
      averageProgress: 72,
      progressCount: 9,
      atRiskCount: 2,
      weeklyActivity: [
        { day: 'Isnin', count: 5 },
        { day: 'Selasa', count: 0 },
        { day: 'Rabu', count: 2 },
        { day: 'Khamis', count: 0 },
        { day: 'Jumaat', count: 0 },
      ],
      weakTopics: [{ topic: 'Geometri', avgScore: 45 }],
    });

    await app.close();
  });

  it('lets a teacher remove an active student from their roster', async () => {
    mocks.dbQuery
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'classroom-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'enrollment-1' }] });

    const app = buildApp({ userId: 'teacher-1', role: 'teacher' });
    await app.ready();

    const response = await app.inject({
      method: 'DELETE',
      url: '/classroom/classroom-1/students/student-1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ success: true });
    expect(String(mocks.dbQuery.mock.calls[1][0])).toContain('UPDATE classroom_enrollments');
    expect(mocks.dbQuery.mock.calls[1][1]).toEqual(['classroom-1', 'student-1']);

    await app.close();
  });
});
