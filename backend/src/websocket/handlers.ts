import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { db, withTransaction } from '../database';
import { redis, setUserPresence, getClassroomPresence } from '../redis';
import { registerQuizRealtimeHandlers } from '../quiz/realtime';

const MAX_WHITEBOARD_EVENT_PAYLOAD_BYTES = 100 * 1024;

export async function setupWebSocketHandlers(fastify: FastifyInstance) {
  await registerQuizRealtimeHandlers(fastify);

  const subscriber = redis.duplicate();
  subscriber.on('pmessage', (_pattern, channel, message) => {
    const classroomId = channel.replace(/^classroom:/, '');
    try {
      sendToClassroom(classroomId, JSON.parse(message));
    } catch (error) {
      console.error('Redis classroom event parse error:', error);
    }
  });
  subscriber.on('error', (error) => {
    console.error('Redis classroom subscriber error:', error);
  });
  await subscriber.psubscribe('classroom:*');

  fastify.addHook('onClose', async () => {
    await subscriber.quit();
  });

  // WebSocket endpoint for classroom real-time
  fastify.get('/ws/classroom/:classroomId', { websocket: true }, (connection, req) => {
    const classroomId = (req.params as any).classroomId;
    const connectionId = randomUUID();
    let userId: string | null = null;
    let userRole: string | null = null;
    (connection.socket as any).__connectionId = connectionId;

    // Authenticate connection
    connection.socket.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message.toString());

        // Handle authentication
        if (data.type === 'AUTH') {
          try {
            const decoded = await fastify.jwt.verify(data.token) as any;
            userId = decoded.userId;
            userRole = decoded.role;

            // Verify classroom access
            const hasAccess = await checkClassroomAccess(decoded, classroomId);
            if (!hasAccess) {
              connection.socket.send(JSON.stringify({ type: 'ERROR', message: 'Access denied' }));
              connection.socket.close();
              return;
            }

            // Set presence
            await setUserPresence(decoded.userId, classroomId, 'online');
            addClassroomConnection(classroomId, {
              id: connectionId,
              socket: connection.socket,
              userId,
              role: userRole,
            });

            // Send confirmation
            connection.socket.send(JSON.stringify({
              type: 'AUTH_SUCCESS',
              userId,
              classroomId
            }));

            // Broadcast user joined
            await broadcastToClassroom(classroomId, {
              type: 'USER_JOINED',
              userId,
              timestamp: Date.now()
            }, connection.socket);

            // Send current presence
            const onlineUsers = await getClassroomPresence(classroomId);
            connection.socket.send(JSON.stringify({
              type: 'PRESENCE',
              onlineCount: onlineUsers.length,
              users: onlineUsers
            }));

          } catch (err) {
            connection.socket.send(JSON.stringify({ type: 'ERROR', message: 'Invalid token' }));
            connection.socket.close();
          }
          return;
        }

        // Handle whiteboard draw events
        if (!userId) {
          connection.socket.send(JSON.stringify({ type: 'ERROR', message: 'Authenticate first' }));
          return;
        }

        // Handle whiteboard draw events
        const canManageWhiteboard = userRole === 'teacher' || userRole === 'admin';
        const canDrawWhiteboard = canManageWhiteboard || userRole === 'student';

        if (data.type === 'WHITEBOARD_DRAW' && canDrawWhiteboard) {
          const event = await persistWhiteboardEvent(classroomId, userId, 'draw', {
            strokes: data.strokes,
          });
          if (!event.ok) {
            connection.socket.send(JSON.stringify({ type: 'ERROR', message: event.error }));
            return;
          }

          await broadcastToClassroom(classroomId, {
            type: 'WHITEBOARD_DRAW',
            strokes: data.strokes,
            sessionId: event.sessionId,
            sequence: event.sequence,
            userId,
            timestamp: Date.now()
          }, connection.socket);
          return;
        }

        // Handle whiteboard clear
        if (data.type === 'WHITEBOARD_CLEAR' && canManageWhiteboard) {
          const event = await persistWhiteboardEvent(classroomId, userId, 'clear', {});
          if (!event.ok) {
            connection.socket.send(JSON.stringify({ type: 'ERROR', message: event.error }));
            return;
          }

          await broadcastToClassroom(classroomId, {
            type: 'WHITEBOARD_CLEAR',
            sessionId: event.sessionId,
            sequence: event.sequence,
            userId,
            timestamp: Date.now()
          }, connection.socket);
          return;
        }

        if (data.type === 'WHITEBOARD_DRAW' || data.type === 'WHITEBOARD_CLEAR') {
          connection.socket.send(JSON.stringify({ type: 'ERROR', message: 'Only teachers can control the whiteboard' }));
          return;
        }

        // Handle chat message
        if (data.type === 'CHAT_MESSAGE') {
          // Store in database
          await db.query(
            `INSERT INTO chat_messages (id, classroom_id, user_id, message, message_type)
             VALUES (gen_random_uuid(), $1, $2, $3, 'text')`,
            [classroomId, userId, data.message]
          );

          // Broadcast
          await broadcastToClassroom(classroomId, {
            type: 'CHAT_MESSAGE',
            message: data.message,
            userId,
            timestamp: Date.now()
          }, connection.socket);
          return;
        }

        // Handle typing indicator
        if (data.type === 'TYPING') {
          await broadcastToClassroom(classroomId, {
            type: 'TYPING',
            userId,
            isTyping: data.isTyping
          }, connection.socket);
          return;
        }

        // Handle ping/pong for keepalive
        if (data.type === 'PING') {
          connection.socket.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          return;
        }

      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    // Handle disconnect
    connection.socket.on('close', async () => {
      removeClassroomConnection(classroomId, connection.socket);
      if (userId) {
        await setUserPresence(userId, classroomId, 'offline');
        await broadcastToClassroom(classroomId, {
          type: 'USER_LEFT',
          userId,
          timestamp: Date.now()
        });
      }
    });

    // Send initial welcome
    connection.socket.send(JSON.stringify({
      type: 'CONNECTED',
      message: 'Send AUTH token to join classroom'
    }));
  });

  // Global broadcast endpoint (for server-initiated messages)
  fastify.post('/broadcast/:classroomId', async (request, reply) => {
    await (fastify as any).authenticate(request, reply);
    
    const { classroomId } = request.params as any;
    const { type, payload } = request.body as any;

    await broadcastToClassroom(classroomId, { type, ...payload, timestamp: Date.now() });

    return { success: true };
  });
}

type ClassroomConnection = {
  id: string;
  socket: any;
  userId: string | null;
  role: string | null;
};

const connections = new Map<string, Set<ClassroomConnection>>();

function addClassroomConnection(classroomId: string, connection: ClassroomConnection) {
  removeClassroomConnection(classroomId, connection.socket);
  const classroomConnections = connections.get(classroomId) ?? new Set<ClassroomConnection>();
  classroomConnections.add(connection);
  connections.set(classroomId, classroomConnections);
}

function removeClassroomConnection(classroomId: string, socket: any) {
  const classroomConnections = connections.get(classroomId);
  if (!classroomConnections) return;

  for (const connection of classroomConnections) {
    if (connection.socket === socket) {
      classroomConnections.delete(connection);
      break;
    }
  }

  if (classroomConnections.size === 0) {
    connections.delete(classroomId);
  }
}

async function broadcastToClassroom(classroomId: string, message: any, excludeSocket?: any) {
  const excludeConnectionId = excludeSocket ? (excludeSocket as any).__connectionId : null;
  await redis.publish(`classroom:${classroomId}`, JSON.stringify({
    ...message,
    __excludeConnectionId: excludeConnectionId,
  }));
}

async function persistWhiteboardEvent(
  classroomId: string,
  userId: string,
  eventType: 'draw' | 'clear',
  payload: Record<string, unknown>
) {
  const payloadBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  if (payloadBytes > MAX_WHITEBOARD_EVENT_PAYLOAD_BYTES) {
    return { ok: false as const, error: 'Whiteboard event is too large' };
  }

  return withTransaction(async (client) => {
    const sessionResult = await client.query(
      `SELECT id
       FROM whiteboard_sessions
       WHERE classroom_id = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [classroomId]
    );

    if ((sessionResult.rowCount ?? 0) === 0) {
      return { ok: false as const, error: 'No active whiteboard session' };
    }

    const sessionId = sessionResult.rows[0].id;
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [sessionId]);

    const sequenceResult = await client.query(
      `SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence
       FROM whiteboard_events
       WHERE session_id = $1`,
      [sessionId]
    );
    const sequence = Number(sequenceResult.rows[0]?.next_sequence || 1);

    await client.query(
      `INSERT INTO whiteboard_events (session_id, classroom_id, user_id, event_type, payload, sequence)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [sessionId, classroomId, userId, eventType, JSON.stringify(payload), sequence]
    );

    return { ok: true as const, sessionId, sequence };
  });
}

function sendToClassroom(classroomId: string, message: any) {
  const classroomConnections = connections.get(classroomId);
  if (!classroomConnections) return;

  const { __excludeConnectionId, ...clientMessage } = message;
  const messageStr = JSON.stringify(clientMessage);

  for (const connection of classroomConnections) {
    if (connection.id === __excludeConnectionId) continue;
    if (connection.socket.readyState !== 1) {
      classroomConnections.delete(connection);
      continue;
    }
    connection.socket.send(messageStr);
  }

  if (classroomConnections.size === 0) {
    connections.delete(classroomId);
  }
}

async function checkClassroomAccess(user: any, classroomId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  
  if (user.role === 'teacher') {
    const result = await db.query(
      'SELECT id FROM classrooms WHERE id = $1 AND teacher_id = $2',
      [classroomId, user.userId]
    );
    return (result.rowCount ?? 0) > 0;
  }
  
  if (user.role === 'student') {
    const result = await db.query(
      'SELECT id FROM classroom_enrollments WHERE classroom_id = $1 AND student_id = $2 AND is_active = true',
      [classroomId, user.userId]
    );
    return (result.rowCount ?? 0) > 0;
  }
  
  if (user.role === 'parent') {
    const result = await db.query(
      `SELECT ce.id FROM parent_student_links psl
       JOIN classroom_enrollments ce ON ce.student_id = psl.student_id
       WHERE psl.parent_id = $1 AND ce.classroom_id = $2 AND psl.is_active = true AND ce.is_active = true`,
      [user.userId, classroomId]
    );
    return (result.rowCount ?? 0) > 0;
  }
  
  return false;
}
