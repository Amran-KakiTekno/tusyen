import { FastifyInstance } from 'fastify';
import { db, withTransaction } from '../database';
import { redis, getSyncQueue, clearSyncQueue } from '../redis';
import { config } from '../config';
import { protectMediaReferences } from '../media-access';

export async function syncRoutes(fastify: FastifyInstance) {
  // Push local changes to server
  fastify.post('/push', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { deviceId, operations, lastSyncAt } = request.body as any;

    const results = [];
    const errors = [];

    for (const op of operations) {
      try {
        const result = await processSyncOperation(user, deviceId, op);
        results.push({ id: op.id, status: 'success', result });
      } catch (err: any) {
        errors.push({ id: op.id, status: 'error', error: err.message });
      }
    }

    // Update sync checkpoint
    await db.query(
      `INSERT INTO device_syncs (device_id, user_id, last_sync_at, sync_token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (device_id, user_id) DO UPDATE SET
       last_sync_at = EXCLUDED.last_sync_at,
       sync_token = EXCLUDED.sync_token,
       updated_at = NOW()`,
      [deviceId, user.userId, new Date(), generateSyncToken()]
    );

    return {
      success: results.length,
      failed: errors.length,
      results,
      errors,
      serverTimestamp: new Date().toISOString()
    };
  });

  // Pull server changes to client
  fastify.post('/pull', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { deviceId, lastSyncAt, tables } = request.body as any;

    const changes: Record<string, any[]> = {};
    const syncTime = new Date();

    // Get changes for each requested table
    for (const table of tables || ['progress', 'lessons', 'posts', 'whiteboard_sessions']) {
      const tableChanges = await getTableChanges(fastify, table, user, lastSyncAt);
      changes[table] = tableChanges;
    }

    // Get any queued operations from other devices
    const otherDevices = await redis.keys(`user:device:${user.userId}:*`);
    const crossDeviceOps = [];
    for (const key of otherDevices) {
      if (!key.includes(deviceId)) {
        const ops = await getSyncQueue(key.replace('sync:queue:', ''));
        crossDeviceOps.push(...ops);
      }
    }

    return {
      changes,
      crossDeviceOperations: crossDeviceOps,
      serverTimestamp: syncTime.toISOString(),
      hasMore: false // Pagination if needed
    };
  });

  // Get sync status
  fastify.get('/status', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    
    const devices = await db.query(
      'SELECT device_id, last_sync_at, sync_token, updated_at FROM device_syncs WHERE user_id = $1',
      [user.userId]
    );

    const pendingCount = await redis.keys(`sync:queue:${user.userId}:*`).then(keys => keys.length);

    return {
      devices: devices.rows,
      pendingOperations: pendingCount,
      serverTimestamp: new Date().toISOString()
    };
  });

  // Resolve conflict (manual merge)
  fastify.post('/resolve', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { conflictId, resolution, winningValue } = request.body as any;

    await db.query(
      `UPDATE sync_conflicts 
       SET resolved = true, resolution = $1, winning_value = $2, resolved_at = NOW(), resolved_by = $3
       WHERE id = $4`,
      [resolution, JSON.stringify(winningValue), user.userId, conflictId]
    );

    return { success: true };
  });
}

async function processSyncOperation(user: any, deviceId: string, operation: any) {
  const { type, table, data, timestamp } = operation;

  switch (type) {
    case 'INSERT':
      return await handleInsert(user, table, data);
    
    case 'UPDATE':
      return await handleUpdate(user, table, data);
    
    case 'DELETE':
      return await handleDelete(user, table, data);
    
    case 'PROGRESS_UPDATE':
      return await handleProgressUpdate(user, data);
    
    default:
      throw new Error(`Unknown operation type: ${type}`);
  }
}

async function handleInsert(user: any, table: string, data: any) {
  // Validate table name to prevent injection
  const allowedTables = ['progress', 'student_notes', 'bookmarks'];
  if (!allowedTables.includes(table)) {
    throw new Error('Invalid table for insert');
  }

  return await withTransaction(async (client) => {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map((_, i) => `$${i + 1}`).join(', ');
    const values = Object.values(data);

    const result = await client.query(
      `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    return result.rows[0];
  });
}

async function handleUpdate(user: any, table: string, data: any) {
  const allowedTables = ['progress', 'student_notes', 'bookmarks', 'users'];
  if (!allowedTables.includes(table)) {
    throw new Error('Invalid table for update');
  }

  const { id, ...updates } = data;

  // Verify ownership
  if (table === 'progress') {
    const existing = await db.query('SELECT student_id FROM progress WHERE id = $1', [id]);
    if (existing.rowCount === 0 || existing.rows[0].student_id !== user.userId) {
      throw new Error('Not authorized to update this record');
    }
  }

  const setClause = Object.keys(updates)
    .map((key, i) => `${key} = $${i + 2}`)
    .join(', ');
  const values = [id, ...Object.values(updates)];

  const result = await db.query(
    `UPDATE ${table} SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    values
  );

  return result.rows[0];
}

async function handleDelete(user: any, table: string, data: any) {
  const { id } = data;
  
  // Soft delete for most tables
  await db.query(`UPDATE ${table} SET is_deleted = true, deleted_at = NOW() WHERE id = $1`, [id]);
  
  return { id, deleted: true };
}

async function handleProgressUpdate(user: any, data: any) {
  const { lessonId, classroomId, score, timeSpentSeconds, completionPercentage, answers } = data;

  return await withTransaction(async (client) => {
    // Check for existing progress
    const existing = await client.query(
      'SELECT id FROM progress WHERE student_id = $1 AND lesson_id = $2',
      [user.userId, lessonId]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      // Update
      const result = await client.query(
        `UPDATE progress 
         SET score = GREATEST(score, $3),
             time_spent_seconds = time_spent_seconds + $4,
             completion_percentage = GREATEST(completion_percentage, $5),
             answers = $6,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [existing.rows[0].id, lessonId, score, timeSpentSeconds, completionPercentage, JSON.stringify(answers)]
      );
      return result.rows[0];
    } else {
      // Insert
      const result = await client.query(
        `INSERT INTO progress (id, student_id, lesson_id, classroom_id, score, time_spent_seconds, completion_percentage, answers)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [user.userId, lessonId, classroomId, score, timeSpentSeconds, completionPercentage, JSON.stringify(answers)]
      );
      return result.rows[0];
    }
  });
}

async function getTableChanges(fastify: FastifyInstance, table: string, user: any, since: string) {
  const sinceDate = since ? new Date(since) : new Date(0);

  switch (table) {
    case 'progress':
      if (user.role === 'student') {
        return await db.query(
          `SELECT * FROM progress WHERE student_id = $1 AND updated_at > $2`,
          [user.userId, sinceDate]
        ).then(r => r.rows.map((row) => protectMediaReferences(fastify, user, row)));
      } else if (user.role === 'parent') {
        return await db.query(
          `SELECT p.* FROM progress p
           JOIN parent_student_links psl ON psl.student_id = p.student_id
           WHERE psl.parent_id = $1 AND p.updated_at > $2 AND psl.is_active = true`,
          [user.userId, sinceDate]
        ).then(r => r.rows.map((row) => protectMediaReferences(fastify, user, row)));
      }
      break;
    
    case 'lessons':
      // Get lessons for enrolled classrooms
      return await db.query(
        `SELECT DISTINCT l.* FROM lessons l
         JOIN classroom_lessons cl ON cl.lesson_id = l.id
         JOIN classroom_enrollments ce ON ce.classroom_id = cl.classroom_id
         WHERE ce.student_id = $1 AND ce.is_active = true AND l.updated_at > $2`,
        [user.userId, sinceDate]
      ).then(r => r.rows.map((row) => protectMediaReferences(fastify, user, row)));
    
    case 'posts':
      // Get posts for classrooms user has access to
      return await db.query(
        `SELECT p.* FROM posts p
         JOIN classrooms c ON c.id = p.classroom_id
         LEFT JOIN classroom_enrollments ce ON ce.classroom_id = c.id AND ce.student_id = $1
         WHERE (c.teacher_id = $1 OR ce.student_id = $1) AND p.created_at > $2`,
        [user.userId, sinceDate]
      ).then(r => r.rows.map((row) => protectMediaReferences(fastify, user, row)));
  }

  return [];
}

function generateSyncToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
