import { FastifyInstance } from 'fastify';
import {
  advanceQuizSession,
  createQuizSession,
  deleteQuizDeck,
  getQuizDeck,
  getQuizSessionById,
  getQuizSessionSnapshot,
  getStudentQuizSummary,
  joinQuizSession,
  listQuizDecks,
  listQuizSessions,
  loadQuizSessionState,
  saveQuizDeck,
  startQuizSession,
  endQuizSession,
  submitQuizAnswer,
} from './store';
import { publishQuizSessionEvent } from './realtime';
import { publishQuizSessionNotification } from '../notifications';

type AuthUser = {
  userId: string;
  role: 'student' | 'teacher' | 'parent' | 'admin';
};

function isTeacherOrAdmin(user: AuthUser) {
  return user.role === 'teacher' || user.role === 'admin';
}

async function resolveOptionalUser(fastify: FastifyInstance, request: any): Promise<AuthUser | null> {
  const header = String(request.headers.authorization || '');
  if (!header.startsWith('Bearer ')) {
    return null;
  }

  try {
    return (await fastify.jwt.verify(header.slice(7))) as AuthUser;
  } catch {
    return null;
  }
}

async function canAccessSession(user: AuthUser, sessionId: string) {
  if (user.role === 'admin') return true;

  const session = await getQuizSessionById(sessionId);
  if (!session) return false;

  if (user.role === 'teacher') {
    return session.teacher_id === user.userId;
  }

  return false;
}

function normalizeQuizSessionResult(result: any) {
  if (result && typeof result === 'object' && 'snapshot' in result) {
    return {
      snapshot: result.snapshot ?? null,
      xpAwards: Array.isArray(result.xpAwards) ? result.xpAwards : [],
    };
  }

  return {
    snapshot: result ?? null,
    xpAwards: [],
  };
}

export async function quizRoutes(fastify: FastifyInstance) {
  fastify.get('/decks', {
    onRequest: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    return { decks: await listQuizDecks(user) };
  });

  fastify.post('/decks', {
    onRequest: [(fastify as any).authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user as AuthUser;
      if (!isTeacherOrAdmin(user)) {
        return reply.code(403).send({ error: 'Only teachers can manage quiz decks' });
      }

      const body = request.body as any;
      const deck = await saveQuizDeck(user, {
        id: body.id,
        title: body.title,
        description: body.description ?? null,
        subject: body.subject,
        formLevel: Number(body.formLevel),
        questions: Array.isArray(body.questions) ? body.questions : [],
      });

      return { success: true, deck };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Failed to save quiz deck' });
    }
  });

  fastify.get('/decks/:deckId', {
    onRequest: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { deckId } = request.params as any;
    const deck = await getQuizDeck(user, deckId);
    if (!deck) {
      return reply.code(404).send({ error: 'Quiz deck not found' });
    }
    return { deck };
  });

  fastify.patch('/decks/:deckId', {
    onRequest: [(fastify as any).authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user as AuthUser;
      const { deckId } = request.params as any;
      const body = request.body as any;

      const deck = await saveQuizDeck(user, {
        id: deckId,
        title: body.title,
        description: body.description ?? null,
        subject: body.subject,
        formLevel: Number(body.formLevel),
        questions: Array.isArray(body.questions) ? body.questions : [],
      });

      return { success: true, deck };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Failed to save quiz deck' });
    }
  });

  fastify.delete('/decks/:deckId', {
    onRequest: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { deckId } = request.params as any;
    await deleteQuizDeck(user, deckId);
    return { success: true };
  });

  fastify.get('/classrooms/:classroomId/sessions', {
    onRequest: [(fastify as any).authenticate],
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { classroomId } = request.params as any;
    return { sessions: await listQuizSessions(user, classroomId) };
  });

  fastify.post('/sessions', {
    onRequest: [(fastify as any).authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user as AuthUser;
      if (!isTeacherOrAdmin(user)) {
        return reply.code(403).send({ error: 'Only teachers can start quiz sessions' });
      }

      const body = request.body as any;
      const result = await createQuizSession(user, {
        classroomId: body.classroomId,
        deckId: body.deckId,
      });

      const snapshot = await getQuizSessionSnapshot(result.session.id, { revealCorrectAnswer: false });
      if (snapshot) {
        await publishQuizSessionEvent(result.session.id, {
          type: 'QUIZ_LOBBY_CREATED',
          snapshot,
        });
      }
      await publishQuizSessionNotification(fastify, {
        classroomId: result.session.classroom_id,
        classroomName: result.classroom?.name,
        deckTitle: result.deck?.title,
        pin: result.session.pin,
        status: 'lobby',
      });

      return { success: true, ...result, snapshot };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Failed to create quiz session' });
    }
  });

  fastify.get('/sessions/:sessionId/state', async (request, reply) => {
    const { sessionId } = request.params as any;
    const participantToken = String((request.query as any)?.participantToken || '').trim() || null;

    if (participantToken) {
      const snapshot = await loadQuizSessionState(sessionId, {
        participantToken,
        revealCorrectAnswer: false,
      });

      if (!snapshot) {
        return reply.code(404).send({ error: 'Quiz session not found' });
      }

      return { snapshot };
    }

    const user = await resolveOptionalUser(fastify, request);
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    const allowed = await canAccessSession(user, sessionId);
    if (!allowed) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    const snapshot = await loadQuizSessionState(sessionId, { revealCorrectAnswer: true });
    if (!snapshot) {
      return reply.code(404).send({ error: 'Quiz session not found' });
    }

    return { snapshot };
  });

  fastify.post('/join', async (request, reply) => {
    const body = request.body as any;
    const user = await resolveOptionalUser(fastify, request);
    const authenticatedStudent = user && user.role === 'student' ? user : undefined;

    try {
      const result = await joinQuizSession({
        pin: body.pin,
        nickname: body.nickname,
        user: authenticatedStudent,
      });

      if (result.snapshot) {
        await publishQuizSessionEvent(result.session.id, {
          type: 'QUIZ_PARTICIPANT_JOINED',
          participant: {
            id: result.participant.id,
            displayName: result.participant.display_name,
            isGuest: Boolean(result.participant.is_guest),
          },
          snapshot: result.snapshot,
        });
      }

      return {
        success: true,
        session: result.session,
        participant: {
          id: result.participant.id,
          sessionId: result.participant.session_id,
          joinToken: result.participant.join_token,
          displayName: result.participant.display_name,
          isGuest: Boolean(result.participant.is_guest),
        },
        snapshot: result.snapshot,
      };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Failed to join quiz session' });
    }
  });

  fastify.post('/sessions/:sessionId/start', {
    onRequest: [(fastify as any).authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user as AuthUser;
      const { sessionId } = request.params as any;
      const result = await startQuizSession(user, sessionId);
      const snapshot = await getQuizSessionSnapshot(sessionId, { revealCorrectAnswer: false });

      if (snapshot) {
        await publishQuizSessionEvent(sessionId, {
          type: 'QUIZ_SESSION_STARTED',
          snapshot,
        });
        await publishQuizSessionNotification(fastify, {
          classroomId: snapshot.session.classroomId,
          classroomName: snapshot.session.classroomName,
          deckTitle: snapshot.session.deckTitle,
          pin: snapshot.session.pin,
          status: 'started',
        });
      }

      return { success: true, snapshot: result };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Failed to start quiz session' });
    }
  });

  fastify.post('/sessions/:sessionId/advance', {
    onRequest: [(fastify as any).authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user as AuthUser;
      const { sessionId } = request.params as any;
      const result = normalizeQuizSessionResult(await advanceQuizSession(user, sessionId));
      const currentStatus = String(result.snapshot?.session?.status || '');

      if (currentStatus === 'ended') {
        await publishQuizSessionEvent(sessionId, {
          type: 'QUIZ_SESSION_ENDED',
          snapshot: result.snapshot,
        });
      } else {
        const snapshot = await getQuizSessionSnapshot(sessionId, { revealCorrectAnswer: false });
        await publishQuizSessionEvent(sessionId, {
          type: 'QUIZ_QUESTION_STARTED',
          snapshot,
        });
      }

      return { success: true, snapshot: result.snapshot };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Failed to advance quiz session' });
    }
  });

  fastify.post('/sessions/:sessionId/end', {
    onRequest: [(fastify as any).authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user as AuthUser;
      const { sessionId } = request.params as any;
      const result = normalizeQuizSessionResult(await endQuizSession(user, sessionId));

      await publishQuizSessionEvent(sessionId, {
        type: 'QUIZ_SESSION_ENDED',
        snapshot: result.snapshot,
        xpAwards: result.xpAwards,
      });

      return { success: true, ...result };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Failed to end quiz session' });
    }
  });

  fastify.post('/sessions/:sessionId/answers', async (request, reply) => {
    const { sessionId } = request.params as any;
    const body = request.body as any;

    try {
      const result = await submitQuizAnswer({
        sessionId,
        participantToken: body.participantToken,
        selectedOptionIndex: Number(body.selectedOptionIndex),
      });

      await publishQuizSessionEvent(sessionId, {
        type: 'QUIZ_LEADERBOARD_UPDATED',
        snapshot: result.snapshot,
      });

      return {
        success: true,
        answer: result.answer,
        participant: result.participant,
        currentQuestion: result.currentQuestion,
        isCorrect: result.isCorrect,
        pointsAwarded: result.pointsAwarded,
        elapsedMs: result.elapsedMs,
        snapshot: result.snapshot,
      };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Failed to submit quiz answer' });
    }
  });

  fastify.get('/students/:studentId/summary', {
    onRequest: [(fastify as any).authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user as AuthUser;
      const { studentId } = request.params as any;
      return { summary: await getStudentQuizSummary(user, studentId) };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Failed to load quiz summary' });
    }
  });

  fastify.get('/me/summary', {
    onRequest: [(fastify as any).authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user as AuthUser;
      return { summary: await getStudentQuizSummary(user, user.userId) };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Failed to load quiz summary' });
    }
  });
}
