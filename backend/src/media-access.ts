import { FastifyInstance } from 'fastify';
import { db } from './database';

export type MediaAuthUser = {
  userId: string;
  role: 'student' | 'teacher' | 'parent' | 'admin';
};

export const MEDIA_TOKEN_QUERY_PARAM = 'mediaToken';
export const MEDIA_TOKEN_TTL_SECONDS = 15 * 60;

const mediaScope = 'media:read';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mediaPathPattern = /\/api\/storage\/(?:public|files)\/([0-9a-f-]{36})(?:\/content)?/i;

export class MediaAccessError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export function isMediaAccessError(error: unknown): error is MediaAccessError {
  return error instanceof MediaAccessError;
}

export function createMediaAccessUrl(
  fastify: FastifyInstance,
  user: MediaAuthUser,
  fileId: string
) {
  const token = (fastify as any).jwt.sign(
    {
      scope: mediaScope,
      fileId,
      userId: user.userId,
      role: user.role,
    },
    { expiresIn: MEDIA_TOKEN_TTL_SECONDS }
  );

  return `/api/storage/files/${encodeURIComponent(fileId)}/content?${MEDIA_TOKEN_QUERY_PARAM}=${encodeURIComponent(token)}`;
}

export function canonicalMediaUrl(fileId: string) {
  return `/api/storage/files/${encodeURIComponent(fileId)}/content`;
}

export function protectMediaReferences<T>(
  fastify: FastifyInstance,
  user: MediaAuthUser,
  value: T
): T {
  if (Array.isArray(value)) {
    return value.map((item) => protectMediaReferences(fastify, user, item)) as T;
  }

  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value;

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(input)) {
    output[key] = protectMediaReferences(fastify, user, child);
  }

  const fileId = mediaFileIdFromRecord(input);
  if (fileId) {
    output.fileId = fileId;
    output.url = createMediaAccessUrl(fastify, user, fileId);
    output.isProtectedMedia = true;
    output.mediaUrlExpiresInSeconds = MEDIA_TOKEN_TTL_SECONDS;
  }

  return output as T;
}

export function protectWhiteboardSessionMedia<T extends Record<string, unknown>>(
  fastify: FastifyInstance,
  user: MediaAuthUser,
  session: T
): T {
  const protectedSession = protectMediaReferences(fastify, user, session) as Record<string, unknown>;
  const recordingFileId = stringOrNull(session.recording_file_id);
  if (recordingFileId && uuidPattern.test(recordingFileId)) {
    protectedSession.recording_file_id = recordingFileId;
    protectedSession.recording_url = createMediaAccessUrl(fastify, user, recordingFileId);
    protectedSession.recording_url_expires_in_seconds = MEDIA_TOKEN_TTL_SECONDS;
  }
  return protectedSession as T;
}

export function extractMediaFileIdsFromValue(value: unknown): string[] {
  const ids = new Set<string>();
  collectMediaFileIds(value, ids);
  return [...ids];
}

export async function assertCanAttachMediaReferences(user: MediaAuthUser, value: unknown) {
  const fileIds = extractMediaFileIdsFromValue(value);
  if (fileIds.length === 0) return;

  const result = await db.query(
    `SELECT id, user_id
     FROM media_files
     WHERE id = ANY($1::uuid[]) AND is_deleted = false`,
    [fileIds]
  );

  const found = new Set(result.rows.map((row) => `${row.id}`));
  const missing = fileIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new MediaAccessError(400, 'One or more media files were not found');
  }

  if (user.role === 'admin') return;

  const unauthorized = result.rows.find((row) => row.user_id !== user.userId);
  if (unauthorized) {
    throw new MediaAccessError(403, 'You can only attach media that you uploaded');
  }
}

export async function userCanAccessMediaFile(user: MediaAuthUser, fileId: string): Promise<boolean> {
  if (!uuidPattern.test(fileId)) return false;

  const result = await db.query(
    `WITH requested_file AS (
       SELECT id, user_id, object_name
       FROM media_files
       WHERE id = $1 AND is_deleted = false
     )
     SELECT EXISTS (
       SELECT 1
       FROM requested_file f
       WHERE f.user_id = $2
          OR $3 = 'admin'
          OR EXISTS (
            SELECT 1
            FROM posts p
            JOIN classrooms c ON c.id = p.classroom_id AND c.is_active = true
            WHERE p.is_active = true
              AND COALESCE(p.attachments::text, '') LIKE $4
              AND (
                ($3 = 'teacher' AND c.teacher_id = $2)
                OR ($3 = 'student' AND EXISTS (
                  SELECT 1
                  FROM classroom_enrollments ce
                  WHERE ce.classroom_id = c.id
                    AND ce.student_id = $2
                    AND ce.is_active = true
                ))
                OR ($3 = 'parent' AND EXISTS (
                  SELECT 1
                  FROM parent_student_links psl
                  JOIN classroom_enrollments ce ON ce.student_id = psl.student_id AND ce.is_active = true
                  WHERE psl.parent_id = $2
                    AND psl.is_active = true
                    AND ce.classroom_id = c.id
                ))
              )
          )
          OR EXISTS (
            SELECT 1
            FROM post_comments pc
            JOIN posts p ON p.id = pc.post_id AND p.is_active = true
            JOIN classrooms c ON c.id = p.classroom_id AND c.is_active = true
            WHERE pc.is_deleted = false
              AND COALESCE(pc.attachments::text, '') LIKE $4
              AND (
                ($3 = 'teacher' AND c.teacher_id = $2)
                OR ($3 = 'student' AND EXISTS (
                  SELECT 1
                  FROM classroom_enrollments ce
                  WHERE ce.classroom_id = c.id
                    AND ce.student_id = $2
                    AND ce.is_active = true
                ))
                OR ($3 = 'parent' AND EXISTS (
                  SELECT 1
                  FROM parent_student_links psl
                  JOIN classroom_enrollments ce ON ce.student_id = psl.student_id AND ce.is_active = true
                  WHERE psl.parent_id = $2
                    AND psl.is_active = true
                    AND ce.classroom_id = c.id
                ))
              )
          )
          OR EXISTS (
            SELECT 1
            FROM lessons l
            WHERE l.is_active = true
              AND COALESCE(l.content::text, '') LIKE $4
              AND (
                l.created_by = $2
                OR ($3 = 'teacher' AND EXISTS (
                  SELECT 1
                  FROM classroom_lessons cl
                  JOIN classrooms c ON c.id = cl.classroom_id AND c.is_active = true
                  WHERE cl.lesson_id = l.id AND c.teacher_id = $2
                ))
                OR ($3 = 'student' AND EXISTS (
                  SELECT 1
                  FROM classroom_lessons cl
                  JOIN classroom_enrollments ce ON ce.classroom_id = cl.classroom_id AND ce.is_active = true
                  JOIN classrooms c ON c.id = cl.classroom_id AND c.is_active = true
                  WHERE cl.lesson_id = l.id AND ce.student_id = $2
                ))
                OR ($3 = 'parent' AND EXISTS (
                  SELECT 1
                  FROM classroom_lessons cl
                  JOIN classroom_enrollments ce ON ce.classroom_id = cl.classroom_id AND ce.is_active = true
                  JOIN classrooms c ON c.id = cl.classroom_id AND c.is_active = true
                  JOIN parent_student_links psl ON psl.student_id = ce.student_id AND psl.is_active = true
                  WHERE cl.lesson_id = l.id AND psl.parent_id = $2
                ))
              )
          )
          OR EXISTS (
            SELECT 1
            FROM whiteboard_sessions ws
            JOIN classrooms c ON c.id = ws.classroom_id AND c.is_active = true
            WHERE (ws.recording_file_id = f.id OR ws.recording_path = f.object_name)
              AND (
                ($3 = 'teacher' AND c.teacher_id = $2)
                OR ($3 = 'student' AND EXISTS (
                  SELECT 1
                  FROM classroom_enrollments ce
                  WHERE ce.classroom_id = c.id
                    AND ce.student_id = $2
                    AND ce.is_active = true
                ))
                OR ($3 = 'parent' AND EXISTS (
                  SELECT 1
                  FROM parent_student_links psl
                  JOIN classroom_enrollments ce ON ce.student_id = psl.student_id AND ce.is_active = true
                  WHERE psl.parent_id = $2
                    AND psl.is_active = true
                    AND ce.classroom_id = c.id
                ))
              )
          )
     ) as allowed`,
    [fileId, user.userId, user.role, `%${fileId}%`]
  );

  return Boolean(result.rows[0]?.allowed);
}

export function mediaFileIdFromRecord(input: Record<string, unknown>) {
  const direct = stringOrNull(input.fileId ?? input.file_id);
  if (direct && uuidPattern.test(direct)) return direct;

  const urlFileId = mediaFileIdFromUrl(stringOrNull(input.url) || stringOrNull(input.recording_url) || '');
  if (urlFileId) return urlFileId;

  return null;
}

export function mediaFileIdFromUrl(url: string) {
  if (!url) return null;
  const match = mediaPathPattern.exec(url);
  return match?.[1] && uuidPattern.test(match[1]) ? match[1] : null;
}

function collectMediaFileIds(value: unknown, ids: Set<string>) {
  if (Array.isArray(value)) {
    for (const item of value) collectMediaFileIds(item, ids);
    return;
  }

  if (!value || typeof value !== 'object') return;

  const input = value as Record<string, unknown>;
  const fileId = mediaFileIdFromRecord(input);
  if (fileId) ids.add(fileId);

  for (const child of Object.values(input)) {
    if (child && typeof child === 'object') {
      collectMediaFileIds(child, ids);
    }
  }
}

function stringOrNull(value: unknown) {
  const text = `${value ?? ''}`.trim();
  return text.length === 0 || text === 'null' ? null : text;
}
