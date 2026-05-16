import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { redis, getClassroomPresence, setUserPresence } from '../redis';
import { config } from '../config';
import { createMediaAccessUrl, protectWhiteboardSessionMedia } from '../media-access';
import { publishWhiteboardStartedNotification } from '../notifications';

const MAX_ACTIVE_WHITEBOARD_HOURS = 8;
const MAX_WHITEBOARD_RECORDING_BYTES = 100 * 1024 * 1024;
const ALLOWED_RECORDING_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
]);

export async function whiteboardRoutes(fastify: FastifyInstance) {
  // Start whiteboard session
  fastify.post('/session', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { classroomId, title, description } = request.body as any;

    // Verify user is teacher of this classroom
    const classroom = await db.query(
      'SELECT teacher_id FROM classrooms WHERE id = $1 AND is_active = true',
      [classroomId]
    );

    if (classroom.rowCount === 0) {
      return reply.code(404).send({ error: 'Classroom not found' });
    }

    if (user.role !== 'teacher' && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Only teachers can start whiteboard sessions' });
    }

    if (classroom.rows[0].teacher_id !== user.userId && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Not authorized for this classroom' });
    }

    await expireStaleWhiteboardSessions(classroomId);

    const activeSession = await db.query(
      `SELECT id, title
       FROM whiteboard_sessions
       WHERE classroom_id = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [classroomId]
    );
    if ((activeSession.rowCount ?? 0) > 0) {
      return reply.code(409).send({
        error: 'This classroom already has an active whiteboard session',
        session: activeSession.rows[0],
      });
    }

    const sessionId = uuidv4();

    await db.query(
      `INSERT INTO whiteboard_sessions (id, classroom_id, teacher_id, title, description, status)
       VALUES ($1, $2, $3, $4, $5, 'active')`,
      [sessionId, classroomId, user.userId, title || 'Untitled Session', description || null]
    );

    const createdSession = await loadWhiteboardSession(sessionId);

    // Notify students in classroom via Redis pub/sub
    await redis.publish(`classroom:${classroomId}`, JSON.stringify({
      type: 'WHITEBOARD_STARTED',
      sessionId,
      title,
      startedAt: new Date().toISOString()
    }));
    await publishWhiteboardStartedNotification(fastify, {
      classroomId,
      sessionId,
      title: title || 'Untitled Session',
    });

    return {
      success: true,
      session: createdSession ? protectWhiteboardSessionMedia(fastify, user, createdSession) : {
        id: sessionId,
        classroom_id: classroomId,
        title: title || 'Untitled Session',
        status: 'active',
      },
    };
  });

  // Get active session for classroom
  fastify.get('/session/active/:classroomId', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { classroomId } = request.params as any;

    const hasAccess = await checkClassroomAccess(user, classroomId);
    if (!hasAccess) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    await expireStaleWhiteboardSessions(classroomId);

    const session = await db.query(
      `${whiteboardSessionSelect()}
       FROM whiteboard_sessions ws
       JOIN users u ON u.id = ws.teacher_id
       LEFT JOIN media_files mf ON (
         mf.id = ws.recording_file_id
         OR (ws.recording_file_id IS NULL AND mf.object_name = ws.recording_path)
       ) AND mf.is_deleted = false
       WHERE ws.classroom_id = $1 AND ws.status = 'active'
       ORDER BY ws.created_at DESC
       LIMIT 1`,
      [classroomId]
    );

    if (session.rowCount === 0) {
      return { active: false };
    }

    const onlineUsers = await getClassroomPresence(classroomId);

    return {
      active: true,
      session: protectWhiteboardSessionMedia(fastify, user, session.rows[0]),
      onlineCount: onlineUsers.length
    };
  });

  // Join session (for viewers)
  fastify.post('/session/:id/join', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as any;

    await expireStaleWhiteboardSessions();

    const session = await db.query(
      'SELECT classroom_id FROM whiteboard_sessions WHERE id = $1 AND status = $2',
      [id, 'active']
    );

    if (session.rowCount === 0) {
      return reply.code(404).send({ error: 'Session not found or inactive' });
    }

    const { classroom_id } = session.rows[0];
    const hasAccess = await checkClassroomAccess(user, classroom_id);
    if (!hasAccess) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    // Track presence
    await setUserPresence(user.userId, classroom_id, 'online');

    // Get Centrifugo token for real-time
    const centrifugoToken = generateCentrifugoToken(user.userId);

    return {
      success: true,
      centrifugoToken,
      channel: `whiteboard:${id}`
    };
  });

  // End session
  fastify.post('/session/:id/end', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as any;

    const session = await db.query(
      'SELECT classroom_id, teacher_id FROM whiteboard_sessions WHERE id = $1',
      [id]
    );

    if (session.rowCount === 0) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    const { classroom_id, teacher_id } = session.rows[0];

    if (teacher_id !== user.userId && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    await db.query(
      "UPDATE whiteboard_sessions SET status = 'ended', ended_at = NOW() WHERE id = $1",
      [id]
    );

    const endedSession = await loadWhiteboardSession(id);

    // Notify students
    await redis.publish(`classroom:${classroom_id}`, JSON.stringify({
      type: 'WHITEBOARD_ENDED',
      sessionId: id,
      endedAt: new Date().toISOString()
    }));

    return {
      success: true,
      session: endedSession ? protectWhiteboardSessionMedia(fastify, user, endedSession) : undefined,
    };
  });

  // Attach or replace a protected recording after a session.
  fastify.post('/session/:id/recording', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as any;
    const { objectName, fileId, durationSeconds, fileSizeBytes } = request.body as any;

    const session = await db.query(
      'SELECT classroom_id, teacher_id, status FROM whiteboard_sessions WHERE id = $1',
      [id]
    );

    if (session.rowCount === 0) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    if (session.rows[0].teacher_id !== user.userId && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    if (session.rows[0].status === 'cancelled') {
      return reply.code(409).send({ error: 'Cannot attach a recording to a cancelled session' });
    }

    const recording = await resolveRecordingFile(user, objectName, fileId);
    if (!recording.ok) {
      return reply.code(recording.statusCode).send({ error: recording.error });
    }

    const safeDuration = normalizePositiveInteger(durationSeconds);
    const safeSize = normalizePositiveInteger(fileSizeBytes) || Number(recording.file.size_bytes || 0) || null;

    await db.query(
      `UPDATE whiteboard_sessions 
       SET recording_file_id = $1,
           recording_path = $2,
           duration_seconds = $3,
           file_size_bytes = $4,
           recording_mime_type = $5,
           recording_status = 'ready',
           recording_uploaded_at = NOW(),
           recording_error = NULL
       WHERE id = $6`,
      [
        recording.file.id,
        recording.file.object_name,
        safeDuration,
        safeSize,
        recording.file.mime_type,
        id,
      ]
    );

    const updatedSession = await loadWhiteboardSession(id);
    const recordingUrl = createMediaAccessUrl(fastify, user, recording.file.id);

    await redis.publish(`classroom:${session.rows[0].classroom_id}`, JSON.stringify({
      type: 'WHITEBOARD_RECORDING_READY',
      sessionId: id,
      classroomId: session.rows[0].classroom_id,
      recordingUrl,
      updatedAt: new Date().toISOString()
    }));

    return {
      success: true,
      session: updatedSession ? protectWhiteboardSessionMedia(fastify, user, updatedSession) : undefined,
      recording: {
        fileId: recording.file.id,
        objectName: recording.file.object_name,
        url: recordingUrl,
        mimeType: recording.file.mime_type,
        size: recording.file.size_bytes,
      }
    };
  });

  // Remove a recording from a session and soft-delete the underlying media file.
  fastify.delete('/session/:id/recording', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as any;

    const session = await db.query(
      'SELECT classroom_id, teacher_id, recording_file_id FROM whiteboard_sessions WHERE id = $1',
      [id]
    );

    if (session.rowCount === 0) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    if (session.rows[0].teacher_id !== user.userId && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    await db.query(
      `UPDATE whiteboard_sessions
       SET recording_file_id = NULL,
           recording_path = NULL,
           duration_seconds = NULL,
           file_size_bytes = NULL,
           recording_mime_type = NULL,
           recording_status = 'none',
           recording_uploaded_at = NULL,
           recording_error = NULL
       WHERE id = $1`,
      [id]
    );

    if (session.rows[0].recording_file_id) {
      await db.query(
        'UPDATE media_files SET is_deleted = true, deleted_at = NOW() WHERE id = $1',
        [session.rows[0].recording_file_id]
      );
    }

    await redis.publish(`classroom:${session.rows[0].classroom_id}`, JSON.stringify({
      type: 'WHITEBOARD_RECORDING_REMOVED',
      sessionId: id,
      classroomId: session.rows[0].classroom_id,
      updatedAt: new Date().toISOString(),
    }));

    const updatedSession = await loadWhiteboardSession(id);
    return {
      success: true,
      session: updatedSession ? protectWhiteboardSessionMedia(fastify, user, updatedSession) : undefined,
    };
  });

  // Replay persisted whiteboard events for a session.
  fastify.get('/session/:id/events', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as any;
    const { afterSequence = 0, limit = 1000 } = request.query as any;

    const session = await db.query(
      'SELECT classroom_id FROM whiteboard_sessions WHERE id = $1',
      [id]
    );

    if (session.rowCount === 0) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    const classroomId = session.rows[0].classroom_id;
    const hasAccess = await checkClassroomAccess(user, classroomId);
    if (!hasAccess) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 1000, 1), 5000);
    const safeAfter = Math.max(Number(afterSequence) || 0, 0);
    const events = await db.query(
      `SELECT id, session_id, classroom_id, user_id, event_type, payload, sequence, created_at
       FROM whiteboard_events
       WHERE session_id = $1 AND sequence > $2
       ORDER BY sequence ASC
       LIMIT $3`,
      [id, safeAfter, safeLimit]
    );

    return { events: events.rows };
  });

  // Get session history
  fastify.get('/sessions/:classroomId', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { classroomId } = request.params as any;
    const { limit = 20, offset = 0 } = request.query as any;

    // Check access
    const hasAccess = await checkClassroomAccess(user, classroomId);
    if (!hasAccess) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    await expireStaleWhiteboardSessions(classroomId);

    const sessions = await db.query(
      `${whiteboardSessionSelect()}
       FROM whiteboard_sessions ws
       JOIN users u ON u.id = ws.teacher_id
       LEFT JOIN media_files mf ON (
         mf.id = ws.recording_file_id
         OR (ws.recording_file_id IS NULL AND mf.object_name = ws.recording_path)
       ) AND mf.is_deleted = false
       WHERE ws.classroom_id = $1
       ORDER BY ws.created_at DESC
       LIMIT $2 OFFSET $3`,
      [classroomId, limit, offset]
    );

    return { sessions: sessions.rows.map((session) => protectWhiteboardSessionMedia(fastify, user, session)) };
  });
}

function whiteboardSessionSelect() {
  return `SELECT ws.*,
                 u.full_name as teacher_name,
                 COALESCE(ws.recording_file_id, mf.id) as recording_file_id,
                 mf.original_name as recording_name,
                 COALESCE(ws.recording_mime_type, mf.mime_type) as recording_mime_type,
                 COALESCE(ws.file_size_bytes, mf.size_bytes) as recording_size_bytes,
                 CASE WHEN mf.id IS NULL THEN NULL ELSE CONCAT('/api/storage/files/', mf.id, '/content') END as recording_url`;
}

async function resolveRecordingFile(user: any, objectName?: string, fileId?: string) {
  const params: any[] = [fileId || null, objectName || null];
  const result = await db.query(
    `SELECT id, user_id, object_name, mime_type, size_bytes, bucket
     FROM media_files
     WHERE is_deleted = false
       AND (($1::uuid IS NOT NULL AND id = $1::uuid) OR ($2::text IS NOT NULL AND object_name = $2::text))
     LIMIT 1`,
    params
  );

  if ((result.rowCount ?? 0) === 0) {
    return { ok: false as const, statusCode: 400, error: 'Recording file not found' };
  }

  const file = result.rows[0];
  if (file.user_id !== user.userId && user.role !== 'admin') {
    return { ok: false as const, statusCode: 403, error: 'Recording file is not owned by this user' };
  }

  if (file.bucket !== config.MINIO_BUCKET_WHITEBOARD) {
    return { ok: false as const, statusCode: 400, error: 'Whiteboard recordings must be uploaded to the whiteboard bucket' };
  }

  const mimeType = `${file.mime_type ?? ''}`.toLowerCase().split(';')[0].trim();
  if (!ALLOWED_RECORDING_MIME_TYPES.has(mimeType)) {
    return { ok: false as const, statusCode: 400, error: 'Recording must be an MP4, WebM, or MOV video' };
  }

  const sizeBytes = Number(file.size_bytes || 0);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false as const, statusCode: 400, error: 'Recording file is empty' };
  }

  if (sizeBytes > MAX_WHITEBOARD_RECORDING_BYTES) {
    return { ok: false as const, statusCode: 413, error: 'Recording exceeds the 100 MB upload limit' };
  }

  return { ok: true as const, file };
}

async function loadWhiteboardSession(sessionId: string) {
  const result = await db.query(
    `${whiteboardSessionSelect()}
     FROM whiteboard_sessions ws
     JOIN users u ON u.id = ws.teacher_id
     LEFT JOIN media_files mf ON (
       mf.id = ws.recording_file_id
       OR (ws.recording_file_id IS NULL AND mf.object_name = ws.recording_path)
     ) AND mf.is_deleted = false
     WHERE ws.id = $1
     LIMIT 1`,
    [sessionId]
  );

  return result.rows[0] ?? null;
}

async function expireStaleWhiteboardSessions(classroomId?: string) {
  const params: any[] = [MAX_ACTIVE_WHITEBOARD_HOURS];
  const classroomFilter = classroomId ? 'AND classroom_id = $2' : '';
  if (classroomId) params.push(classroomId);

  await db.query(
    `UPDATE whiteboard_sessions
     SET status = 'ended', ended_at = COALESCE(ended_at, NOW())
     WHERE status = 'active'
       AND created_at < NOW() - ($1::int * INTERVAL '1 hour')
       ${classroomFilter}`,
    params
  );
}

function normalizePositiveInteger(value: any) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

async function checkClassroomAccess(user: any, classroomId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  
  const result = await db.query(
    `SELECT 1
     FROM classrooms c
     WHERE c.id = $1
       AND (
         c.teacher_id = $2
         OR EXISTS (
           SELECT 1
           FROM classroom_enrollments ce
           WHERE ce.classroom_id = c.id AND ce.student_id = $2 AND ce.is_active = true
         )
         OR EXISTS (
           SELECT 1
           FROM parent_student_links psl
           JOIN classroom_enrollments ce ON ce.student_id = psl.student_id AND ce.is_active = true
           WHERE psl.parent_id = $2 AND psl.is_active = true AND ce.classroom_id = c.id
         )
       )`,
    [classroomId, user.userId]
  );
  
  return (result.rowCount ?? 0) > 0;
}

function generateCentrifugoToken(userId: string): string {
  // Simple HMAC implementation - replace with proper crypto in production
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', config.CENTRIFUGO_SECRET);
  hmac.update(userId);
  return hmac.digest('hex');
}
