import { FastifyInstance } from 'fastify';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { db } from '../database';
import {
  MediaAuthUser,
  MEDIA_TOKEN_QUERY_PARAM,
  canonicalMediaUrl,
  createMediaAccessUrl,
  userCanAccessMediaFile,
} from '../media-access';

// Initialize MinIO client
const minioClient = new Minio.Client({
  endPoint: config.MINIO_ENDPOINT,
  port: config.MINIO_PORT,
  useSSL: config.MINIO_USE_SSL,
  accessKey: config.MINIO_ACCESS_KEY,
  secretKey: config.MINIO_SECRET_KEY
});

export async function storageRoutes(fastify: FastifyInstance) {
  // Generate presigned URL for upload
  fastify.post('/upload-url', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { filename, contentType, bucket = 'media' } = request.body as any;

    const bucketName = bucket === 'whiteboard' ? config.MINIO_BUCKET_WHITEBOARD : config.MINIO_BUCKET_MEDIA;
    const objectName = `${user.userId}/${Date.now()}-${filename}`;

    // Generate presigned URL valid for 5 minutes
    const presignedUrl = await minioClient.presignedPutObject(bucketName, objectName, 300);

    return {
      uploadUrl: presignedUrl,
      objectName,
      bucket: bucketName,
      note: 'Direct object uploads must be registered in media_files before they can be shared.'
    };
  });

  // Generate presigned URL for download
  fastify.post('/download-url', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as MediaAuthUser;
    const { fileId, objectName, bucket = 'media' } = request.body as any;

    const bucketName = bucket === 'whiteboard' ? config.MINIO_BUCKET_WHITEBOARD : config.MINIO_BUCKET_MEDIA;
    const file = await db.query(
      `SELECT id, bucket, object_name
       FROM media_files
       WHERE is_deleted = false
         AND (($1::uuid IS NOT NULL AND id = $1::uuid) OR ($2::text IS NOT NULL AND object_name = $2::text AND bucket = $3))
       LIMIT 1`,
      [fileId || null, objectName || null, bucketName]
    );

    if ((file.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'File not found' });
    }

    const fileData = file.rows[0];
    if (!(await userCanAccessMediaFile(user, fileData.id))) {
      return reply.code(403).send({ error: 'Not authorized to download this file' });
    }

    // Generate presigned URL valid for 1 hour
    const presignedUrl = await minioClient.presignedGetObject(fileData.bucket, fileData.object_name, 3600);

    return { downloadUrl: presignedUrl };
  });

  // Direct upload (for small files)
  fastify.post('/upload', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file provided' });
    }

    const bucketField = multipartFieldValue((data as any).fields?.bucket);
    const bucketName = bucketField === 'whiteboard'
      ? config.MINIO_BUCKET_WHITEBOARD
      : config.MINIO_BUCKET_MEDIA;
    const originalName = sanitizeFilename(data.filename || 'upload.bin');
    const objectName = `${user.userId}/${Date.now()}-${originalName}`;
    const fileId = uuidv4();

    await ensureBucket(bucketName);

    // Upload to MinIO
    await minioClient.putObject(bucketName, objectName, data.file, data.file.truncated ? undefined : data.file.bytesRead, {
      'Content-Type': data.mimetype,
      'X-Upload-User': user.userId
    });

    // Store metadata in database
    await db.query(
      `INSERT INTO media_files (id, user_id, filename, original_name, mime_type, size_bytes, bucket, object_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [fileId, user.userId, objectName, originalName, data.mimetype, data.file.bytesRead, bucketName, objectName]
    );

    const mediaUrl = createMediaAccessUrl(fastify, user, fileId);

    return {
      success: true,
      id: fileId,
      fileId,
      objectName,
      url: mediaUrl,
      canonicalUrl: canonicalMediaUrl(fileId),
      isProtectedMedia: true,
      name: originalName,
      mimeType: data.mimetype,
      size: data.file.bytesRead,
      type: mediaTypeFromMime(data.mimetype),
    };
  });

  // Compatibility route for older stored URLs. It is no longer public; callers
  // must provide a signed media token or a normal Authorization bearer token.
  fastify.get('/public/:id', async (request, reply) => {
    const { id } = request.params as any;
    return streamProtectedMedia(fastify, request, reply, id);
  });

  fastify.get('/files/:id/content', async (request, reply) => {
    const { id } = request.params as any;
    return streamProtectedMedia(fastify, request, reply, id);
  });

  // List user's files
  fastify.get('/files', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { limit = 50, offset = 0 } = request.query as any;

    const result = await db.query(
      `SELECT id, filename, original_name, mime_type, size_bytes, bucket, object_name, created_at
       FROM media_files
       WHERE user_id = $1 AND is_deleted = false
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.userId, limit, offset]
    );

    return { files: result.rows };
  });

  // Delete file
  fastify.delete('/files/:id', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params as any;

    // Get file info
    const file = await db.query(
      'SELECT bucket, object_name, user_id FROM media_files WHERE id = $1',
      [id]
    );

    if (file.rowCount === 0) {
      return reply.code(404).send({ error: 'File not found' });
    }

    const fileData = file.rows[0];

    // Check ownership
    if (fileData.user_id !== user.userId && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    // Delete from MinIO
    await minioClient.removeObject(fileData.bucket, fileData.object_name);

    // Soft delete in database
    await db.query(
      'UPDATE media_files SET is_deleted = true, deleted_at = NOW() WHERE id = $1',
      [id]
    );

    return { success: true };
  });
}

async function streamProtectedMedia(fastify: FastifyInstance, request: any, reply: any, fileId: string) {
  const authorization = await authorizeMediaRequest(fastify, request, fileId);
  if (!authorization.allowed) {
    return reply.code(authorization.statusCode).send({ error: authorization.error });
  }

  const file = await db.query(
    `SELECT bucket, object_name, original_name, mime_type, size_bytes
     FROM media_files
     WHERE id = $1 AND is_deleted = false`,
    [fileId]
  );

  if ((file.rowCount ?? 0) === 0) {
    return reply.code(404).send({ error: 'File not found' });
  }

  const fileData = file.rows[0];
  const contentType = fileData.mime_type || 'application/octet-stream';
  const totalSize = Number(fileData.size_bytes || 0);
  const range = `${request.headers.range ?? ''}`.trim();

  reply.header('Content-Type', contentType);
  reply.header('Accept-Ranges', 'bytes');
  reply.header('Cache-Control', 'private, max-age=300');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Cross-Origin-Resource-Policy', 'same-origin');
  reply.header('Content-Disposition', `inline; filename="${contentDispositionFilename(fileData.original_name || 'media')}"`);

  if (range && totalSize > 0) {
    const parsed = parseRange(range, totalSize);
    if (!parsed) {
      reply.header('Content-Range', `bytes */${totalSize}`);
      return reply.code(416).send({ error: 'Requested range is not satisfiable' });
    }

    const length = parsed.end - parsed.start + 1;
    const stream = await (minioClient as any).getPartialObject(fileData.bucket, fileData.object_name, parsed.start, length);
    reply.code(206);
    reply.header('Content-Length', length);
    reply.header('Content-Range', `bytes ${parsed.start}-${parsed.end}/${totalSize}`);
    return reply.send(stream);
  }

  const stream = await minioClient.getObject(fileData.bucket, fileData.object_name);
  if (totalSize > 0) reply.header('Content-Length', totalSize);
  return reply.send(stream);
}

async function authorizeMediaRequest(fastify: FastifyInstance, request: any, fileId: string) {
  const mediaToken = `${request.query?.[MEDIA_TOKEN_QUERY_PARAM] ?? ''}`.trim();
  if (mediaToken) {
    try {
      const decoded = await (fastify as any).jwt.verify(mediaToken) as any;
      if (decoded?.scope === 'media:read' && decoded?.fileId === fileId) {
        return { allowed: true };
      }
      return { allowed: false, statusCode: 401, error: 'Invalid media token' };
    } catch {
      return { allowed: false, statusCode: 401, error: 'Invalid media token' };
    }
  }

  const authHeader = `${request.headers.authorization ?? ''}`;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
  if (!token) {
    return { allowed: false, statusCode: 401, error: 'Media authorization required' };
  }

  try {
    const decoded = await (fastify as any).jwt.verify(token) as any;
    const user = {
      userId: `${decoded.userId ?? ''}`,
      role: `${decoded.role ?? ''}` as MediaAuthUser['role'],
    };

    if (!user.userId || !['student', 'teacher', 'parent', 'admin'].includes(user.role)) {
      return { allowed: false, statusCode: 401, error: 'Invalid authorization token' };
    }

    const allowed = await userCanAccessMediaFile(user, fileId);
    return allowed
      ? { allowed: true }
      : { allowed: false, statusCode: 403, error: 'Not authorized to access this media' };
  } catch {
    return { allowed: false, statusCode: 401, error: 'Invalid authorization token' };
  }
}

function parseRange(range: string, totalSize: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return null;

  let start = match[1] ? Number(match[1]) : NaN;
  let end = match[2] ? Number(match[2]) : NaN;

  if (Number.isNaN(start) && Number.isNaN(end)) return null;
  if (Number.isNaN(start)) {
    const suffixLength = end;
    if (suffixLength <= 0) return null;
    start = Math.max(totalSize - suffixLength, 0);
    end = totalSize - 1;
  } else if (Number.isNaN(end)) {
    end = totalSize - 1;
  }

  if (start < 0 || end < start || start >= totalSize) return null;
  return { start, end: Math.min(end, totalSize - 1) };
}

function contentDispositionFilename(filename: string) {
  return filename.replace(/["\\\r\n]/g, '_');
}

async function ensureBucket(bucketName: string) {
  const exists = await minioClient.bucketExists(bucketName).catch(() => false);
  if (!exists) {
    await minioClient.makeBucket(bucketName, 'us-east-1');
  }
}

function sanitizeFilename(filename: string) {
  const clean = filename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  return clean.length > 0 ? clean : 'upload.bin';
}

function multipartFieldValue(field: any): string {
  const value = Array.isArray(field) ? field[0]?.value : field?.value;
  return `${value ?? ''}`.trim();
}

function mediaTypeFromMime(mimeType = '') {
  if (mimeType.startsWith('image/gif')) return 'gif';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'file';
}
