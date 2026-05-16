import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  redisGet: vi.fn(),
  redisSetex: vi.fn(),
}));

vi.mock('../src/database', () => ({
  db: {
    query: mocks.query,
  },
}));

vi.mock('../src/redis', () => ({
  cacheGet: mocks.cacheGet,
  cacheSet: mocks.cacheSet,
  redis: {
    get: mocks.redisGet,
    setex: mocks.redisSetex,
  },
}));

vi.mock('../src/quiz/store', () => ({
  getStudentQuizSummary: vi.fn().mockResolvedValue({
    quizXpTotal: 0,
    recentSessions: [],
  }),
}));

const { progressRoutes } = await import('../src/progress/routes');

function buildApp(user: { userId: string; role: string }) {
  const app = Fastify();
  app.decorate('authenticate', async (request: any) => {
    request.user = user;
  });
  app.register(progressRoutes, { prefix: '/progress' });
  return app;
}

describe('progress routes cross-role access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks unrelated teachers from lesson progress details', async () => {
    mocks.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const app = buildApp({ userId: 'teacher-2', role: 'teacher' });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/progress/lesson/lesson-1',
    });

    expect(response.statusCode).toBe(403);
    expect(mocks.query).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('limits teacher lesson progress rows to classrooms they own', async () => {
    mocks.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ student_id: 'student-1', student_name: 'Linked Student' }],
      });

    const app = buildApp({ userId: 'teacher-1', role: 'teacher' });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/progress/lesson/lesson-1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().progress).toEqual([
      { student_id: 'student-1', student_name: 'Linked Student' },
    ]);
    expect(mocks.query.mock.calls[1][0]).toContain('c.teacher_id = $2');
    expect(mocks.query.mock.calls[1][1]).toEqual(['lesson-1', 'teacher-1']);

    await app.close();
  });

  it('limits parent lesson progress rows to linked students', async () => {
    mocks.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ student_id: 'student-1', student_name: 'Linked Student' }],
      });

    const app = buildApp({ userId: 'parent-1', role: 'parent' });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/progress/lesson/lesson-1',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().progress).toEqual([
      { student_id: 'student-1', student_name: 'Linked Student' },
    ]);
    expect(mocks.query.mock.calls[1][0]).toContain('parent_student_links');
    expect(mocks.query.mock.calls[1][1]).toEqual(['lesson-1', 'parent-1']);

    await app.close();
  });

  it('returns a cached classroom leaderboard for enrolled students', async () => {
    mocks.cacheGet.mockResolvedValueOnce(null);
    mocks.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'enrollment-1' }] })
      .mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          { student_id: 'student-1', full_name: 'Aina', total_xp: 120, completed: 4 },
          { student_id: 'student-2', full_name: 'Haziq', total_xp: 80, completed: 3 },
        ],
      });

    const app = buildApp({ userId: 'student-1', role: 'student' });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/progress/classroom/classroom-1/leaderboard',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().leaderboard[0]).toMatchObject({
      student_id: 'student-1',
      rank: 1,
      total_xp: 120,
    });
    expect(mocks.cacheSet).toHaveBeenCalledWith(
      'leaderboard:classroom:classroom-1',
      expect.objectContaining({ leaderboard: expect.any(Array) }),
      300,
    );

    await app.close();
  });

  it('returns current student achievements with earned state', async () => {
    mocks.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 'achievement-1',
          code: 'streak_7',
          name: 'Streak 7 Hari',
          description: 'Belajar 7 hari',
          icon: null,
          earned_at: '2026-05-16T00:00:00.000Z',
          is_earned: true,
        },
      ],
    });

    const app = buildApp({ userId: 'student-1', role: 'student' });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/progress/me/achievements',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().achievements).toEqual([
      expect.objectContaining({ code: 'streak_7', is_earned: true }),
    ]);

    await app.close();
  });
});
