import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { quizRoutes } from '../src/quiz/routes';
import * as store from '../src/quiz/store';

vi.mock('../src/quiz/store', () => ({
  listQuizDecks: vi.fn(),
  saveQuizDeck: vi.fn(),
  deleteQuizDeck: vi.fn(),
  duplicateQuizDeck: vi.fn(),
  getQuizDeck: vi.fn(),
  listQuizSessions: vi.fn(),
  createQuizSession: vi.fn(),
  getQuizSessionById: vi.fn(),
  getQuizSessionParticipantByToken: vi.fn(),
  getQuizSessionSnapshot: vi.fn(),
  loadQuizSessionState: vi.fn(),
  joinQuizSession: vi.fn(),
  startQuizSession: vi.fn(),
  advanceQuizSession: vi.fn(),
  controlQuizSessionTimer: vi.fn(),
  endQuizSession: vi.fn(),
  submitQuizAnswer: vi.fn(),
  getStudentQuizSummary: vi.fn(),
}));

vi.mock('../src/quiz/realtime', () => ({
  publishQuizSessionEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/notifications', () => ({
  publishQuizSessionNotification: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('../src/config', () => ({
  config: {
    ALLOW_GUEST_QUIZ_JOIN: true,
  },
}));

vi.mock('../src/redis', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}));

const mockedStore = vi.mocked(store);

function buildApp(user?: { userId: string; role: 'student' | 'teacher' | 'parent' | 'admin' }, jwtUser?: unknown) {
  const app = Fastify();

  app.decorate('authenticate', async (request: any, reply: any) => {
    if (!user) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
    request.user = user;
  });

  app.decorate('jwt', {
    verify: vi.fn(async () => jwtUser),
  });

  app.register(quizRoutes, { prefix: '/quiz' });
  return app;
}

describe('quiz routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows teachers to save quiz decks and blocks students', async () => {
    mockedStore.saveQuizDeck.mockResolvedValue({
      id: 'deck-1',
      title: 'Speed Round',
      subject: 'Mathematics',
    } as any);

    const teacherApp = buildApp({ userId: 'teacher-1', role: 'teacher' });
    await teacherApp.ready();

    const teacherResponse = await teacherApp.inject({
      method: 'POST',
      url: '/quiz/decks',
      payload: {
        title: 'Speed Round',
        subject: 'Mathematics',
        formLevel: 4,
        questions: [
          {
            questionText: 'What is 2 + 2?',
            questionType: 'multiple_choice',
            options: ['1', '4'],
            correctAnswer: 1,
          },
        ],
      },
    });

    expect(teacherResponse.statusCode).toBe(200);
    expect(JSON.parse(teacherResponse.body).success).toBe(true);
    expect(mockedStore.saveQuizDeck).toHaveBeenCalledTimes(1);

    const studentApp = buildApp({ userId: 'student-1', role: 'student' });
    await studentApp.ready();

    const studentResponse = await studentApp.inject({
      method: 'POST',
      url: '/quiz/decks',
      payload: {
        title: 'Not allowed',
        subject: 'Science',
        formLevel: 4,
        questions: [],
      },
    });

    expect(studentResponse.statusCode).toBe(403);
  });

  it('joins as a guest without auth and as a student when authenticated', async () => {
    mockedStore.joinQuizSession.mockResolvedValue({
      session: { id: 'session-1' },
      participant: {
        id: 'participant-1',
        session_id: 'session-1',
        join_token: 'join-token-1',
        display_name: 'Guest One',
        is_guest: true,
      },
      snapshot: { session: { id: 'session-1' } },
    } as any);

    const guestApp = buildApp();
    await guestApp.ready();

    const guestResponse = await guestApp.inject({
      method: 'POST',
      url: '/quiz/join',
      payload: {
        pin: '482911',
        nickname: 'Guest One',
      },
    });

    expect(guestResponse.statusCode).toBe(200);
    expect(mockedStore.joinQuizSession).toHaveBeenCalledWith({
      pin: '482911',
      nickname: 'Guest One',
      user: undefined,
    });

    mockedStore.joinQuizSession.mockClear();

    const studentApp = buildApp(undefined, {
      userId: 'student-1',
      role: 'student',
    });
    await studentApp.ready();

    const studentResponse = await studentApp.inject({
      method: 'POST',
      url: '/quiz/join',
      headers: {
        authorization: 'Bearer student-token',
      },
      payload: {
        pin: '482911',
        nickname: 'Ignored nickname',
      },
    });

    expect(studentResponse.statusCode).toBe(200);
    expect(mockedStore.joinQuizSession).toHaveBeenCalledWith({
      pin: '482911',
      nickname: 'Ignored nickname',
      user: {
        userId: 'student-1',
        role: 'student',
      },
    });
  });

  it('rejects duplicate answers with a 400 response', async () => {
    mockedStore.submitQuizAnswer.mockRejectedValue(new Error('Participant already answered this question'));

    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/quiz/sessions/session-1/answers',
      payload: {
        participantToken: 'join-token-1',
        selectedOptionIndex: 1,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toContain('Participant already answered');
  });

  it('supports teacher deck duplication and timer controls', async () => {
    mockedStore.duplicateQuizDeck.mockResolvedValue({
      id: 'deck-copy',
      title: 'Speed Round (Copy)',
    } as any);
    mockedStore.controlQuizSessionTimer.mockResolvedValue({
      session: { id: 'session-1', status: 'active' },
    } as any);
    mockedStore.getQuizSessionSnapshot.mockResolvedValue({
      session: { id: 'session-1', status: 'active' },
    } as any);

    const app = buildApp({ userId: 'teacher-1', role: 'teacher' });
    await app.ready();

    const copyResponse = await app.inject({
      method: 'POST',
      url: '/quiz/decks/deck-1/duplicate',
    });

    expect(copyResponse.statusCode).toBe(200);
    expect(mockedStore.duplicateQuizDeck).toHaveBeenCalledWith(
      { userId: 'teacher-1', role: 'teacher' },
      'deck-1'
    );

    const timerResponse = await app.inject({
      method: 'POST',
      url: '/quiz/sessions/session-1/timer',
      payload: { action: 'add_time', seconds: 15 },
    });

    expect(timerResponse.statusCode).toBe(200);
    expect(mockedStore.controlQuizSessionTimer).toHaveBeenCalledWith(
      { userId: 'teacher-1', role: 'teacher' },
      'session-1',
      { action: 'add_time', seconds: 15 }
    );
  });
});
