import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { redis } from '../redis';
import {
  assertCanAttachMediaReferences,
  canonicalMediaUrl,
  isMediaAccessError,
  mediaFileIdFromUrl,
  protectMediaReferences,
} from '../media-access';
import { ExternalVideoError, normalizeExternalVideoAttachment } from '../external-video';
import { publishClassroomPostNotification } from '../notifications';

type AuthUser = {
  userId: string;
  role: 'student' | 'teacher' | 'parent' | 'admin';
};

type PostAccess = {
  id: string;
  classroom_id: string;
  author_id: string;
  teacher_id: string;
  hasAccess: boolean;
};

const allowedReactions = new Set(['like', 'love', 'insightful', 'celebrate']);
const allowedAttachmentTypes = new Set(['image', 'video', 'gif', 'file', 'embed', 'link']);

export async function feedRoutes(fastify: FastifyInstance) {
  fastify.get('/posts', {
    onRequest: [(fastify as any).authenticate]
  }, async (request) => {
    const user = (request as any).user as AuthUser;
    const { classroomId, limit = 50, offset = 0 } = request.query as any;
    const params: any[] = [user.userId];
    let query = '';

    if (user.role === 'student') {
      query = `
        ${postSelect()}
        FROM classroom_enrollments ce
        JOIN classrooms c ON c.id = ce.classroom_id AND c.is_active = true
        JOIN posts p ON p.classroom_id = c.id AND p.is_active = true
        JOIN users u ON u.id = p.author_id
        LEFT JOIN teacher_profiles tp ON tp.teacher_id = u.id
        WHERE ce.student_id = $1 AND ce.is_active = true
      `;
    } else if (user.role === 'teacher') {
      query = `
        ${postSelect()}
        FROM classrooms c
        JOIN posts p ON p.classroom_id = c.id AND p.is_active = true
        JOIN users u ON u.id = p.author_id
        LEFT JOIN teacher_profiles tp ON tp.teacher_id = u.id
        WHERE c.teacher_id = $1 AND c.is_active = true
      `;
    } else if (user.role === 'parent') {
      query = `
        ${postSelect('SELECT DISTINCT')}
        FROM parent_student_links psl
        JOIN users s ON s.id = psl.student_id
        JOIN classroom_enrollments ce ON ce.student_id = s.id AND ce.is_active = true
        JOIN classrooms c ON c.id = ce.classroom_id AND c.is_active = true
        JOIN posts p ON p.classroom_id = c.id AND p.is_active = true
        JOIN users u ON u.id = p.author_id
        LEFT JOIN teacher_profiles tp ON tp.teacher_id = u.id
        WHERE psl.parent_id = $1 AND psl.is_active = true
      `;
    } else {
      query = `
        ${postSelect()}
        FROM posts p
        JOIN classrooms c ON c.id = p.classroom_id AND c.is_active = true
        JOIN users u ON u.id = p.author_id
        LEFT JOIN teacher_profiles tp ON tp.teacher_id = u.id
        WHERE p.is_active = true
      `;
    }

    if (classroomId) {
      query += ` AND p.classroom_id = $${params.length + 1}`;
      params.push(classroomId);
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);
    query += ` ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(safeLimit, safeOffset);

    const result = await db.query(query, params);
    return { posts: result.rows.map((post) => protectMediaReferences(fastify, user, post)) };
  });

  fastify.post('/posts', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { classroomId, title, content, postType, attachments, isPinned } = request.body as any;
    const text = `${content ?? ''}`.trim();
    let normalizedAttachments: Record<string, unknown>[];
    try {
      normalizedAttachments = normalizeAttachments(attachments);
    } catch (error) {
      if (error instanceof ExternalVideoError) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }

    if (user.role !== 'teacher' && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Only teachers and admins can create posts' });
    }

    if (!classroomId || (!text && normalizedAttachments.length === 0)) {
      return reply.code(400).send({ error: 'classroomId and content or attachments are required' });
    }

    try {
      await assertCanAttachMediaReferences(user, normalizedAttachments);
    } catch (error) {
      if (isMediaAccessError(error)) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      throw error;
    }

    if (user.role !== 'admin') {
      const classroom = await db.query(
        'SELECT id FROM classrooms WHERE id = $1 AND teacher_id = $2 AND is_active = true',
        [classroomId, user.userId]
      );

      if ((classroom.rowCount ?? 0) === 0) {
        return reply.code(403).send({ error: 'Not authorized to post to this classroom' });
      }
    }

    const result = await db.query(
      `INSERT INTO posts (id, classroom_id, author_id, post_type, title, content, attachments, is_pinned)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        uuidv4(),
        classroomId,
        user.userId,
        postType || 'announcement',
        stringOrNull(title),
        text,
        JSON.stringify(normalizedAttachments),
        Boolean(isPinned),
      ]
    );

    await redis.publish(`classroom:${classroomId}`, JSON.stringify({
      type: 'NEW_POST',
      classroomId,
      postId: result.rows[0].id,
    }));
    await publishClassroomPostNotification(fastify, {
      classroomId,
      postId: result.rows[0].id,
      title: stringOrNull(title),
      content: text,
    });

    return { success: true, post: await getVisiblePost(fastify, user, result.rows[0].id) };
  });

  fastify.patch('/posts/:id', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as any;
    const { title, content, postType, attachments, isPinned } = request.body as any;
    const hasAttachments = attachments !== undefined;
    let normalizedAttachments: Record<string, unknown>[] | null = null;
    try {
      normalizedAttachments = hasAttachments ? normalizeAttachments(attachments) : null;
    } catch (error) {
      if (error instanceof ExternalVideoError) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }

    const existing = await db.query('SELECT id, classroom_id, author_id FROM posts WHERE id = $1 AND is_active = true', [id]);
    if ((existing.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Post not found' });
    }

    if (user.role !== 'admin' && existing.rows[0].author_id !== user.userId) {
      return reply.code(403).send({ error: 'Not authorized to edit this post' });
    }

    if (normalizedAttachments) {
      try {
        await assertCanAttachMediaReferences(user, normalizedAttachments);
      } catch (error) {
        if (isMediaAccessError(error)) {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    }

    await db.query(
      `UPDATE posts
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           post_type = COALESCE($3, post_type),
           is_pinned = COALESCE($4, is_pinned),
           attachments = COALESCE($5, attachments),
           updated_at = NOW()
       WHERE id = $6`,
      [
        title ?? null,
        content ?? null,
        postType ?? null,
        typeof isPinned === 'boolean' ? isPinned : null,
        hasAttachments ? JSON.stringify(normalizedAttachments) : null,
        id,
      ]
    );

    await redis.publish(`classroom:${existing.rows[0].classroom_id}`, JSON.stringify({
      type: 'POST_UPDATED',
      classroomId: existing.rows[0].classroom_id,
      postId: id,
    }));

    return { success: true, post: await getVisiblePost(fastify, user, id) };
  });

  fastify.delete('/posts/:id', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as any;

    const existing = await db.query('SELECT id, classroom_id, author_id FROM posts WHERE id = $1 AND is_active = true', [id]);
    if ((existing.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Post not found' });
    }

    if (user.role !== 'admin' && existing.rows[0].author_id !== user.userId) {
      return reply.code(403).send({ error: 'Not authorized to delete this post' });
    }

    await db.query('UPDATE posts SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
    await redis.publish(`classroom:${existing.rows[0].classroom_id}`, JSON.stringify({
      type: 'POST_DELETED',
      classroomId: existing.rows[0].classroom_id,
      postId: id,
    }));
    return { success: true };
  });

  fastify.get('/posts/:id/comments', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as any;
    const access = await loadPostAccess(user, id);

    if (!access) return reply.code(404).send({ error: 'Post not found' });
    if (!access.hasAccess) return reply.code(403).send({ error: 'Access denied' });

    const result = await db.query(
      `SELECT pc.id,
              pc.post_id,
              pc.user_id,
              pc.content,
              pc.attachments,
              pc.created_at,
              pc.updated_at,
              u.full_name as author_name,
              u.role as author_role
       FROM post_comments pc
       JOIN users u ON u.id = pc.user_id
       WHERE pc.post_id = $1 AND pc.is_deleted = false
       ORDER BY pc.created_at ASC`,
      [id]
    );

    return { comments: result.rows.map((comment) => protectMediaReferences(fastify, user, comment)) };
  });

  fastify.post('/posts/:id/comments', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as any;
    const { content, attachments } = request.body as any;
    const text = `${content ?? ''}`.trim();
    let normalizedAttachments: Record<string, unknown>[];
    try {
      normalizedAttachments = normalizeAttachments(attachments);
    } catch (error) {
      if (error instanceof ExternalVideoError) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
    const access = await loadPostAccess(user, id);

    if (!access) return reply.code(404).send({ error: 'Post not found' });
    if (!access.hasAccess) return reply.code(403).send({ error: 'Access denied' });
    if (!text && normalizedAttachments.length === 0) {
      return reply.code(400).send({ error: 'Comment cannot be empty' });
    }

    try {
      await assertCanAttachMediaReferences(user, normalizedAttachments);
    } catch (error) {
      if (isMediaAccessError(error)) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      throw error;
    }

    const result = await db.query(
      `INSERT INTO post_comments (id, post_id, user_id, content, attachments)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, post_id, user_id, content, attachments, created_at, updated_at`,
      [uuidv4(), id, user.userId, text, JSON.stringify(normalizedAttachments)]
    );

    await redis.publish(`classroom:${access.classroom_id}`, JSON.stringify({
      type: 'NEW_POST_COMMENT',
      classroomId: access.classroom_id,
      postId: id,
      commentId: result.rows[0].id,
    }));

    return { success: true, comment: protectMediaReferences(fastify, user, result.rows[0]) };
  });

  fastify.patch('/comments/:id', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as any;
    const { content, attachments } = request.body as any;
    const text = `${content ?? ''}`.trim();
    const hasAttachments = attachments !== undefined;
    let normalizedAttachments: Record<string, unknown>[] | null = null;
    try {
      normalizedAttachments = hasAttachments ? normalizeAttachments(attachments) : null;
    } catch (error) {
      if (error instanceof ExternalVideoError) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
    const comment = await loadCommentAccess(user, id);

    if (!comment) return reply.code(404).send({ error: 'Comment not found' });
    if (comment.user_id !== user.userId && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Not authorized to edit this comment' });
    }
    if (normalizedAttachments) {
      try {
        await assertCanAttachMediaReferences(user, normalizedAttachments);
      } catch (error) {
        if (isMediaAccessError(error)) {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    }
    if (!text && (!hasAttachments || normalizedAttachments?.length === 0)) {
      return reply.code(400).send({ error: 'Comment cannot be empty' });
    }

    const result = await db.query(
      `UPDATE post_comments
       SET content = $1,
           attachments = COALESCE($2, attachments),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, post_id, user_id, content, attachments, created_at, updated_at`,
      [text, hasAttachments ? JSON.stringify(normalizedAttachments) : null, id]
    );

    await redis.publish(`classroom:${comment.classroom_id}`, JSON.stringify({
      type: 'POST_COMMENT_UPDATED',
      classroomId: comment.classroom_id,
      postId: comment.post_id,
      commentId: id,
    }));

    return { success: true, comment: protectMediaReferences(fastify, user, result.rows[0]) };
  });

  fastify.delete('/comments/:id', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as any;
    const comment = await loadCommentAccess(user, id);

    if (!comment) return reply.code(404).send({ error: 'Comment not found' });
    if (!canModerateComment(user, comment)) {
      return reply.code(403).send({ error: 'Not authorized to delete this comment' });
    }

    await db.query('UPDATE post_comments SET is_deleted = true, updated_at = NOW() WHERE id = $1', [id]);
    await redis.publish(`classroom:${comment.classroom_id}`, JSON.stringify({
      type: 'POST_COMMENT_DELETED',
      classroomId: comment.classroom_id,
      postId: comment.post_id,
      commentId: id,
    }));
    return { success: true };
  });

  fastify.post('/posts/:id/reaction', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as any;
    const { reactionType = 'like' } = request.body as any;
    const normalizedReaction = `${reactionType}`.trim().toLowerCase();
    const access = await loadPostAccess(user, id);

    if (!access) return reply.code(404).send({ error: 'Post not found' });
    if (!access.hasAccess) return reply.code(403).send({ error: 'Access denied' });
    if (!allowedReactions.has(normalizedReaction)) {
      return reply.code(400).send({ error: 'Unsupported reaction type' });
    }

    await db.query(
      `INSERT INTO post_reactions (id, post_id, user_id, reaction_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (post_id, user_id)
       DO UPDATE SET reaction_type = EXCLUDED.reaction_type,
                     created_at = NOW()`,
      [uuidv4(), id, user.userId, normalizedReaction]
    );

    await redis.publish(`classroom:${access.classroom_id}`, JSON.stringify({
      type: 'POST_REACTION',
      classroomId: access.classroom_id,
      postId: id,
    }));

    return {
      success: true,
      engagement: await getPostEngagement(id, user.userId),
    };
  });

  fastify.delete('/posts/:id/reaction', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as any;
    const access = await loadPostAccess(user, id);

    if (!access) return reply.code(404).send({ error: 'Post not found' });
    if (!access.hasAccess) return reply.code(403).send({ error: 'Access denied' });

    await db.query('DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2', [id, user.userId]);

    await redis.publish(`classroom:${access.classroom_id}`, JSON.stringify({
      type: 'POST_REACTION',
      classroomId: access.classroom_id,
      postId: id,
    }));

    return {
      success: true,
      engagement: await getPostEngagement(id, user.userId),
    };
  });
}

function postSelect(prefix = 'SELECT') {
  return `${prefix} p.*,
          c.name as classroom_name,
          c.subject as classroom_subject,
          c.form_level as classroom_form_level,
          u.full_name as author_name,
          u.avatar_url as author_avatar_url,
          COALESCE(tp.headline, 'KSSR/KSSM classroom teacher') as author_headline,
          COALESCE((SELECT COUNT(*)::int FROM post_reactions pr WHERE pr.post_id = p.id AND pr.reaction_type = 'like'), 0) as like_count,
          COALESCE((SELECT COUNT(*)::int FROM post_comments pc WHERE pc.post_id = p.id AND pc.is_deleted = false), 0) as comment_count,
          (SELECT pr.reaction_type FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = $1 LIMIT 1) as my_reaction`;
}

async function getVisiblePost(fastify: FastifyInstance, user: AuthUser, postId: string) {
  const access = await loadPostAccess(user, postId);
  if (!access || !access.hasAccess) return null;

  const result = await db.query(
    `${postSelect()}
     FROM posts p
     JOIN classrooms c ON c.id = p.classroom_id AND c.is_active = true
     JOIN users u ON u.id = p.author_id
     LEFT JOIN teacher_profiles tp ON tp.teacher_id = u.id
     WHERE p.id = $2 AND p.is_active = true`,
    [user.userId, postId]
  );

  return result.rows[0] ? protectMediaReferences(fastify, user, result.rows[0]) : null;
}

async function loadPostAccess(user: AuthUser, postId: string): Promise<PostAccess | null> {
  const result = await db.query(
    `SELECT p.id, p.classroom_id, p.author_id, c.teacher_id
     FROM posts p
     JOIN classrooms c ON c.id = p.classroom_id AND c.is_active = true
     WHERE p.id = $1 AND p.is_active = true`,
    [postId]
  );

  if ((result.rowCount ?? 0) === 0) return null;

  const row = result.rows[0];
  return {
    ...row,
    hasAccess: await canAccessClassroom(user, row.classroom_id, row.teacher_id),
  };
}

async function loadCommentAccess(user: AuthUser, commentId: string) {
  const result = await db.query(
    `SELECT pc.id,
            pc.post_id,
            pc.user_id,
            p.author_id as post_author_id,
            c.id as classroom_id,
            c.teacher_id
     FROM post_comments pc
     JOIN posts p ON p.id = pc.post_id AND p.is_active = true
     JOIN classrooms c ON c.id = p.classroom_id AND c.is_active = true
     WHERE pc.id = $1 AND pc.is_deleted = false`,
    [commentId]
  );

  if ((result.rowCount ?? 0) === 0) return null;

  const row = result.rows[0];
  const hasAccess = await canAccessClassroom(user, row.classroom_id, row.teacher_id);
  return hasAccess ? row : null;
}

async function canAccessClassroom(user: AuthUser, classroomId: string, teacherId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  if (user.role === 'teacher') return teacherId === user.userId;

  if (user.role === 'student') {
    const result = await db.query(
      'SELECT id FROM classroom_enrollments WHERE classroom_id = $1 AND student_id = $2 AND is_active = true',
      [classroomId, user.userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  if (user.role === 'parent') {
    const result = await db.query(
      `SELECT ce.id
       FROM parent_student_links psl
       JOIN classroom_enrollments ce ON ce.student_id = psl.student_id
       WHERE psl.parent_id = $1
         AND ce.classroom_id = $2
         AND psl.is_active = true
         AND ce.is_active = true`,
      [user.userId, classroomId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  return false;
}

function canModerateComment(user: AuthUser, comment: any) {
  return user.role === 'admin' ||
    comment.user_id === user.userId ||
    comment.post_author_id === user.userId ||
    (user.role === 'teacher' && comment.teacher_id === user.userId);
}

async function getPostEngagement(postId: string, userId: string) {
  const result = await db.query(
    `SELECT COALESCE((SELECT COUNT(*)::int FROM post_reactions WHERE post_id = $1 AND reaction_type = 'like'), 0) as like_count,
            COALESCE((SELECT COUNT(*)::int FROM post_comments WHERE post_id = $1 AND is_deleted = false), 0) as comment_count,
            (SELECT reaction_type FROM post_reactions WHERE post_id = $1 AND user_id = $2 LIMIT 1) as my_reaction`,
    [postId, userId]
  );

  return result.rows[0] ?? { like_count: 0, comment_count: 0, my_reaction: null };
}

function stringOrNull(value: unknown) {
  const text = `${value ?? ''}`.trim();
  return text.length === 0 ? null : text;
}

function normalizeAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => normalizeAttachment(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .slice(0, 10);
}

function normalizeAttachment(item: unknown): Record<string, unknown> | null {
  if (!item || typeof item !== 'object') return null;
  const input = item as Record<string, unknown>;
  const type = `${input.type ?? mediaTypeFromMime(`${input.mimeType ?? input.mime_type ?? ''}`)}`.trim().toLowerCase();
  const normalizedType = allowedAttachmentTypes.has(type) ? type : 'file';

  if (normalizedType === 'embed') {
    return normalizeExternalVideoAttachment(input);
  }

  const originalUrl = stringOrNull(input.url);
  const fileId = stringOrNull(input.fileId ?? input.file_id ?? input.id);
  const embedUrl = stringOrNull(input.embedUrl ?? input.embed_url);
  const urlFileId = originalUrl ? mediaFileIdFromUrl(originalUrl) : null;
  const effectiveFileId = fileId || urlFileId;
  const url = originalUrl && !urlFileId ? originalUrl : null;

  if (!url && !effectiveFileId && !embedUrl) return null;

  return {
    type: normalizedType,
    url: url || (effectiveFileId ? canonicalMediaUrl(effectiveFileId) : embedUrl),
    fileId: effectiveFileId || null,
    name: stringOrNull(input.name ?? input.filename ?? input.originalName) || labelForAttachment(normalizedType),
    mimeType: stringOrNull(input.mimeType ?? input.mime_type),
    size: Number(input.size ?? input.sizeBytes ?? 0) || 0,
    provider: stringOrNull(input.provider),
    embedUrl: embedUrl || null,
    thumbnailUrl: stringOrNull(input.thumbnailUrl ?? input.thumbnail_url) || null,
  };
}

function mediaTypeFromMime(mimeType: string) {
  if (mimeType.startsWith('image/gif')) return 'gif';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'file';
}

function labelForAttachment(type: string) {
  if (type === 'image') return 'Image';
  if (type === 'video') return 'Video';
  if (type === 'gif') return 'GIF';
  if (type === 'embed') return 'Embedded media';
  return 'Attachment';
}
