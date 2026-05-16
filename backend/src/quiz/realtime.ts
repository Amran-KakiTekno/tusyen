import { randomUUID } from 'crypto';
import { FastifyInstance } from 'fastify';
import { redis } from '../redis';
import {
  getQuizSessionById,
  getQuizSessionSnapshot,
  markParticipantConnected,
  loadQuizSessionState,
} from './store';

type AuthUser = {
  userId: string;
  role: 'student' | 'teacher' | 'parent' | 'admin';
};

type QuizSocket = {
  send: (message: string) => void;
  close: () => void;
  readyState?: number;
  on: (event: string, handler: (...args: any[]) => void) => void;
};

type QuizBroadcastEvent = Record<string, unknown> & {
  type: string;
  snapshot?: unknown;
};

const QUIZ_CHANNEL_PREFIX = 'quiz:session:';
const QUIZ_ROOM_OPEN_STATE = 1;
const serverId = randomUUID();
const rooms = new Map<string, Set<QuizSocket>>();
const socketRooms = new WeakMap<QuizSocket, string>();
let subscriberReady = false;
let subscriptionPromise: Promise<void> | null = null;

function channelFor(sessionId: string) {
  return `${QUIZ_CHANNEL_PREFIX}${sessionId}`;
}

function envelope(sessionId: string, event: QuizBroadcastEvent) {
  return {
    ...event,
    sessionId,
    originServerId: serverId,
    timestamp: new Date().toISOString(),
  };
}

function sendJson(socket: QuizSocket, message: unknown) {
  try {
    socket.send(JSON.stringify(message));
  } catch {
    // Ignore broken sockets; close handling will clean them up.
  }
}

function cleanupSocket(sessionId: string, socket: QuizSocket) {
  const room = rooms.get(sessionId);
  if (room) {
    room.delete(socket);
    if (room.size === 0) {
      rooms.delete(sessionId);
    }
  }

  socketRooms.delete(socket);
}

function broadcastLocally(sessionId: string, event: ReturnType<typeof envelope>) {
  const room = rooms.get(sessionId);
  if (!room || room.size === 0) return;

  for (const socket of room) {
    if (socket.readyState !== undefined && socket.readyState !== QUIZ_ROOM_OPEN_STATE) {
      cleanupSocket(sessionId, socket);
      continue;
    }
    sendJson(socket, event);
  }
}

// Use a dedicated pub/sub connection for quiz broadcasts.
const subscriber = redis.duplicate();
subscriber.on('pmessage', (_pattern, channel, message) => {
  if (!channel.startsWith(QUIZ_CHANNEL_PREFIX)) return;

  try {
    const parsed = JSON.parse(message) as ReturnType<typeof envelope>;
    if (parsed.originServerId === serverId) {
      return;
    }

    broadcastLocally(channel.slice(QUIZ_CHANNEL_PREFIX.length), parsed);
  } catch {
    // Ignore malformed payloads.
  }
});

subscriber.on('error', (err) => {
  console.error('Quiz realtime subscriber error:', err);
});

async function subscribeOnce() {
  if (subscriberReady) return;
  if (subscriptionPromise) return subscriptionPromise;

  subscriptionPromise = (async () => {
    await subscriber.psubscribe(`${QUIZ_CHANNEL_PREFIX}*`);
    subscriberReady = true;
  })();

  try {
    await subscriptionPromise;
  } finally {
    subscriptionPromise = null;
  }
}

export async function publishQuizSessionEvent(sessionId: string, event: QuizBroadcastEvent) {
  const payload = envelope(sessionId, event);
  broadcastLocally(sessionId, payload);
  try {
    await subscribeOnce();
    await redis.publish(channelFor(sessionId), JSON.stringify(payload));
  } catch (error) {
    console.error('Quiz realtime publish failed:', error);
  }
}

export async function registerQuizRealtimeHandlers(fastify: FastifyInstance) {
  try {
    await subscribeOnce();
  } catch (error) {
    console.error('Quiz realtime subscription failed:', error);
  }

  fastify.get('/ws/quiz/:sessionId', { websocket: true }, (connection, req) => {
    const sessionId = (req.params as any).sessionId as string;
    const socket = connection.socket as unknown as QuizSocket;
    let authenticated = false;
    let participantToken: string | null = null;
    let user: AuthUser | null = null;

    const joinRoom = () => {
      const room = rooms.get(sessionId) ?? new Set<QuizSocket>();
      room.add(socket);
      rooms.set(sessionId, room);
      socketRooms.set(socket, sessionId);
    };

    const sendState = async () => {
      if (!authenticated) return;

      if (participantToken) {
        const snapshot = await loadQuizSessionState(sessionId, {
          participantToken,
          revealCorrectAnswer: false,
        });
        sendJson(socket, { type: 'QUIZ_STATE', snapshot });
        return;
      }

      const snapshot = await getQuizSessionSnapshot(sessionId, { revealCorrectAnswer: true });
      sendJson(socket, { type: 'QUIZ_STATE', snapshot });
    };

    socket.on('message', async (raw: string) => {
      try {
        const data = JSON.parse(raw.toString());

        if (data.type === 'PING') {
          sendJson(socket, { type: 'PONG', timestamp: new Date().toISOString() });
          return;
        }

        if (data.type === 'AUTH') {
          if (data.participantToken) {
            const participant = await markParticipantConnected(sessionId, String(data.participantToken), true);
            if (!participant) {
              sendJson(socket, { type: 'ERROR', message: 'Invalid participant token' });
              socket.close();
              return;
            }

            participantToken = String(data.participantToken);
            authenticated = true;
            joinRoom();

            sendJson(socket, {
              type: 'AUTH_SUCCESS',
              role: 'participant',
              participantId: participant.id,
              sessionId,
            });
            await sendState();
            return;
          }

          if (!data.token) {
            sendJson(socket, { type: 'ERROR', message: 'Missing auth token' });
            socket.close();
            return;
          }

          const decoded = (await fastify.jwt.verify(String(data.token))) as AuthUser;
          const session = await getQuizSessionById(sessionId);
          if (!session) {
            sendJson(socket, { type: 'ERROR', message: 'Quiz session not found' });
            socket.close();
            return;
          }

          if (decoded.role !== 'admin' && decoded.role !== 'teacher') {
            sendJson(socket, { type: 'ERROR', message: 'Teacher access required' });
            socket.close();
            return;
          }

          if (decoded.role !== 'admin' && session.teacher_id !== decoded.userId) {
            sendJson(socket, { type: 'ERROR', message: 'Access denied' });
            socket.close();
            return;
          }

          user = decoded;
          authenticated = true;
          joinRoom();

          sendJson(socket, {
            type: 'AUTH_SUCCESS',
            role: decoded.role,
            sessionId,
          });
          await sendState();
          return;
        }

        if (!authenticated) {
          sendJson(socket, { type: 'ERROR', message: 'Authenticate first' });
          return;
        }
      } catch (error) {
        sendJson(socket, { type: 'ERROR', message: 'Quiz websocket message failed' });
      }
    });

    socket.on('close', async () => {
      cleanupSocket(sessionId, socket);

      if (participantToken) {
        await markParticipantConnected(sessionId, participantToken, false);
        const snapshot = await getQuizSessionSnapshot(sessionId, {
          participantToken,
          revealCorrectAnswer: false,
        });
        await publishQuizSessionEvent(sessionId, {
          type: 'QUIZ_PARTICIPANT_LEFT',
          participantToken,
          snapshot,
        });
      }
    });

    sendJson(socket, {
      type: 'CONNECTED',
      sessionId,
      message: 'Send AUTH with a teacher token or participant token to join the quiz room.',
    });
  });
}
