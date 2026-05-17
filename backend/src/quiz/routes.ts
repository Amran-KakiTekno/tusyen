import { FastifyInstance } from 'fastify';
import {
  advanceQuizSession,
  controlQuizSessionTimer,
  createQuizSession,
  deleteQuizDeck,
  duplicateQuizDeck,
  getQuizDeck,
  getSessionParticipantReview,
  getQuizSessionParticipantByToken,
  getQuizSessionById,
  getQuizSessionSnapshot,
  getStudentQuizSummary,
  joinQuizSession,
  listQuizDecks,
  listQuizSessions,
  loadQuizSessionState,
  cancelQuizSession,
  saveQuizDeck,
  startQuizSession,
  endQuizSession,
  submitQuizAnswer,
} from './store';
import { publishQuizSessionEvent } from './realtime';
import { publishQuizSessionNotification } from '../notifications';
import { config } from '../config';
import { checkRateLimit } from '../redis';

type AuthUser = {
  userId: string;
  role: 'student' | 'teacher' | 'parent' | 'admin';
};

const QUIZ_JOIN_IP_RATE_LIMIT = { max: 5, windowSeconds: 60 };
const QUIZ_JOIN_PIN_RATE_LIMIT = { max: 25, windowSeconds: 60 };

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

  fastify.post('/decks/:deckId/duplicate', {
    onRequest: [(fastify as any).authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user as AuthUser;
      const { deckId } = request.params as any;
      const deck = await duplicateQuizDeck(user, deckId);
      return { success: true, deck };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Failed to duplicate quiz deck' });
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
    try {
      const user = (request as any).user as AuthUser;
      const { classroomId } = request.params as any;
      return { sessions: await listQuizSessions(user, classroomId) };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to list sessions';
      const code = msg.includes('enrolled') || msg.includes('teacher') || msg.includes('authorized') ? 403 : 500;
      return reply.code(code).send({ error: msg });
    }
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
    const user = await resolveOptionalUser(fastify, request);

    if (participantToken) {
      const participantAccess = await canUseParticipantToken(fastify, request, sessionId, participantToken, user);
      if (!participantAccess.allowed) {
        return reply.code(participantAccess.statusCode).send({ error: participantAccess.error });
      }

      const snapshot = await loadQuizSessionState(sessionId, {
        participantToken,
        revealCorrectAnswer: false,
      });

      if (!snapshot) {
        return reply.code(404).send({ error: 'Quiz session not found' });
      }

      return { snapshot };
    }

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

  fastify.get('/sessions/:sessionId/review', {
    onRequest: [(fastify as any).authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user as AuthUser;
      const { sessionId } = request.params as any;
      const { participantToken } = request.query as any;
      if (!participantToken) {
        return reply.code(400).send({ error: 'participantToken is required' });
      }
      const review = await getSessionParticipantReview(user, sessionId, String(participantToken));
      return { review };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to load review';
      const code = msg.includes('not authorized') || msg.includes('not found') ? 403 : 500;
      return reply.code(code).send({ error: msg });
    }
  });

  fastify.post('/join', async (request, reply) => {
    const body = request.body as any;
    const user = await resolveOptionalUser(fastify, request);
    const authenticatedStudent = user && user.role === 'student' ? user : undefined;
    if (!(await enforceQuizJoinRateLimit(request, reply, body?.pin))) return;

    if (!authenticatedStudent && !config.ALLOW_GUEST_QUIZ_JOIN) {
      return reply.code(user ? 403 : 401).send({ error: 'Student authentication is required to join quiz sessions' });
    }

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

  fastify.post('/sessions/:sessionId/timer', {
    onRequest: [(fastify as any).authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user as AuthUser;
      const { sessionId } = request.params as any;
      const body = request.body as any;
      const snapshot = await controlQuizSessionTimer(user, sessionId, {
        action: body?.action,
        seconds: body?.seconds,
      });
      const publicSnapshot = await getQuizSessionSnapshot(sessionId, { revealCorrectAnswer: false });

      await publishQuizSessionEvent(sessionId, {
        type: 'QUIZ_TIMER_UPDATED',
        snapshot: publicSnapshot,
      });

      return { success: true, snapshot };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Failed to update quiz timer' });
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

  fastify.post('/sessions/:sessionId/cancel', {
    onRequest: [(fastify as any).authenticate],
  }, async (request, reply) => {
    try {
      const user = (request as any).user as AuthUser;
      const { sessionId } = request.params as any;
      const snapshot = await cancelQuizSession(user, sessionId);

      await publishQuizSessionEvent(sessionId, {
        type: 'quiz_session_cancelled',
        snapshot,
      });

      return { success: true, snapshot };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Failed to cancel quiz session' });
    }
  });

  fastify.post('/sessions/:sessionId/answers', async (request, reply) => {
    const { sessionId } = request.params as any;
    const body = request.body as any;

    try {
      if (!config.ALLOW_GUEST_QUIZ_JOIN) {
        const user = await resolveOptionalUser(fastify, request);
        const participantAccess = await canUseParticipantToken(
          fastify,
          request,
          sessionId,
          String(body.participantToken || ''),
          user
        );
        if (!participantAccess.allowed) {
          return reply.code(participantAccess.statusCode).send({ error: participantAccess.error });
        }
      }

      const result = await submitQuizAnswer({
        sessionId,
        participantToken: body.participantToken,
        ...(body.selectedOptionIndex === undefined
          ? {}
          : { selectedOptionIndex: Number(body.selectedOptionIndex) }),
        selectedAnswer: body.selectedAnswer ?? body.answer,
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

async function canUseParticipantToken(
  fastify: FastifyInstance,
  request: any,
  sessionId: string,
  participantToken: string,
  user: AuthUser | null,
) {
  const participant = await getQuizSessionParticipantByToken(sessionId, participantToken);
  if (!participant) {
    return { allowed: false, statusCode: 404, error: 'Quiz session participant not found' };
  }

  if (config.ALLOW_GUEST_QUIZ_JOIN && Boolean(participant.is_guest)) {
    return { allowed: true, statusCode: 200, error: '' };
  }

  if (!user) {
    return { allowed: false, statusCode: 401, error: 'Authentication required' };
  }

  if (user.role === 'admin') {
    return { allowed: true, statusCode: 200, error: '' };
  }

  if (participant.user_id && participant.user_id === user.userId) {
    return { allowed: true, statusCode: 200, error: '' };
  }

  if (user.role === 'teacher' && await canAccessSession(user, sessionId)) {
    return { allowed: true, statusCode: 200, error: '' };
  }

  return { allowed: false, statusCode: 403, error: 'Access denied' };
}

async function enforceQuizJoinRateLimit(request: any, reply: any, pin: unknown) {
  const normalizedPin = `${pin ?? ''}`.replace(/\D/g, '').slice(0, 6) || 'blank';
  const ipAllowed = await checkRateLimit(
    `rate:quiz:join:ip:${clientIp(request)}`,
    QUIZ_JOIN_IP_RATE_LIMIT.max,
    QUIZ_JOIN_IP_RATE_LIMIT.windowSeconds
  );
  const pinAllowed = await checkRateLimit(
    `rate:quiz:join:pin:${normalizedPin}`,
    QUIZ_JOIN_PIN_RATE_LIMIT.max,
    QUIZ_JOIN_PIN_RATE_LIMIT.windowSeconds
  );

  if (!ipAllowed || !pinAllowed) {
    reply.code(429).send({ error: 'Too many quiz join attempts. Please try again shortly.' });
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
