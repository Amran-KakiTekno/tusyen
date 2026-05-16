const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString =
  process.env.DATABASE_URL ||
  `postgres://${process.env.DB_USER || 'tusyen-online'}:${process.env.DB_PASSWORD || 'tusyen-online123'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'eduapp'}`;

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const aggressive = args.has('--aggressive');
const orphanGraceHours = aggressive
  ? 0
  : Number(process.env.DB_HYGIENE_ORPHAN_MEDIA_GRACE_HOURS ?? 24);
const staleSessionHours = Number(process.env.DB_HYGIENE_STALE_SESSION_HOURS ?? 8);

const client = new Client({ connectionString });

async function main() {
  await client.connect();
  const report = {
    dryRun,
    aggressive,
    orphanGraceHours,
    staleSessionHours,
    startedAt: new Date().toISOString(),
    before: await collectHealthMetrics(),
    changes: {},
    warnings: [],
  };

  try {
    await client.query('BEGIN');

    report.changes.normalizedPostAttachments = await normalizeJsonRows({
      table: 'posts',
      idColumn: 'id',
      jsonColumn: 'attachments',
      selectSql: 'SELECT id, attachments FROM posts WHERE attachments IS NOT NULL',
      normalize: normalizeAttachmentList,
      warnings: report.warnings,
    });

    report.changes.normalizedCommentAttachments = await normalizeJsonRows({
      table: 'post_comments',
      idColumn: 'id',
      jsonColumn: 'attachments',
      selectSql: 'SELECT id, attachments FROM post_comments WHERE attachments IS NOT NULL',
      normalize: normalizeAttachmentList,
      warnings: report.warnings,
    });

    report.changes.normalizedLessonContent = await normalizeJsonRows({
      table: 'lessons',
      idColumn: 'id',
      jsonColumn: 'content',
      selectSql: 'SELECT id, content FROM lessons WHERE content IS NOT NULL',
      normalize: normalizeLessonContent,
      warnings: report.warnings,
    });

    report.changes.postsAttachmentsDefaulted = await update(
      "UPDATE posts SET attachments = '[]'::jsonb WHERE attachments IS NULL"
    );
    report.changes.commentsAttachmentsDefaulted = await update(
      "UPDATE post_comments SET attachments = '[]'::jsonb WHERE attachments IS NULL"
    );
    report.changes.staleWhiteboardsEnded = await update(
      `UPDATE whiteboard_sessions
       SET status = 'ended', ended_at = COALESCE(ended_at, NOW())
       WHERE status = 'active'
         AND created_at < NOW() - ($1::int * INTERVAL '1 hour')`,
      [staleSessionHours]
    );
    report.changes.staleQuizSessionsClosed = await update(
      `UPDATE quiz_sessions
       SET status = CASE WHEN status = 'active' THEN 'ended' ELSE 'cancelled' END,
           ended_at = COALESCE(ended_at, NOW()),
           updated_at = NOW()
       WHERE status IN ('lobby', 'active')
         AND updated_at < NOW() - ($1::int * INTERVAL '1 hour')`,
      [staleSessionHours]
    );
    report.changes.recordingStatusReconciled = await update(
      `UPDATE whiteboard_sessions
       SET recording_status = CASE
             WHEN recording_file_id IS NULL AND recording_path IS NULL THEN 'none'
             WHEN recording_status IS NULL OR recording_status = 'none' THEN 'ready'
             ELSE recording_status
           END
       WHERE recording_status IS NULL
          OR (recording_file_id IS NULL AND recording_path IS NULL AND recording_status <> 'none')
          OR ((recording_file_id IS NOT NULL OR recording_path IS NOT NULL) AND recording_status = 'none')`
    );
    report.changes.progressClamped = await update(
      `UPDATE progress
       SET score = LEAST(GREATEST(score, 0), 100),
           time_spent_seconds = GREATEST(time_spent_seconds, 0),
           attempts = GREATEST(attempts, 1),
           completion_percentage = LEAST(GREATEST(completion_percentage, 0), 100),
           content_block_count = GREATEST(content_block_count, 0),
           content_review_seconds = GREATEST(content_review_seconds, 0)
       WHERE score < 0 OR score > 100
          OR time_spent_seconds < 0
          OR attempts < 1
          OR completion_percentage < 0 OR completion_percentage > 100
          OR content_block_count < 0
          OR content_review_seconds < 0`
    );
    report.changes.orphanMediaSoftDeleted = await update(
      `UPDATE media_files mf
       SET is_deleted = true, deleted_at = NOW()
       WHERE mf.is_deleted = false
         AND mf.created_at < NOW() - ($1::int * INTERVAL '1 hour')
         AND NOT EXISTS (
           SELECT 1 FROM posts p
           WHERE COALESCE(p.attachments::text, '') LIKE '%' || mf.id::text || '%'
              OR COALESCE(p.attachments::text, '') LIKE '%' || mf.object_name || '%'
         )
         AND NOT EXISTS (
           SELECT 1 FROM post_comments pc
           WHERE COALESCE(pc.attachments::text, '') LIKE '%' || mf.id::text || '%'
              OR COALESCE(pc.attachments::text, '') LIKE '%' || mf.object_name || '%'
         )
         AND NOT EXISTS (
           SELECT 1 FROM lessons l
           WHERE COALESCE(l.content::text, '') LIKE '%' || mf.id::text || '%'
              OR COALESCE(l.content::text, '') LIKE '%' || mf.object_name || '%'
         )
         AND NOT EXISTS (
           SELECT 1 FROM whiteboard_sessions ws
           WHERE ws.recording_file_id = mf.id OR ws.recording_path = mf.object_name
         )`,
      [orphanGraceHours]
    );

    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
      await refreshAnalytics(report);
      await client.query('ANALYZE');
    }

    report.after = await collectHealthMetrics();
    report.finishedAt = new Date().toISOString();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

async function update(sql, params = []) {
  if (dryRun) {
    const count = await countRowsForUpdate(sql, params).catch(() => null);
    return { wouldAffect: count };
  }
  const result = await client.query(sql, params);
  return result.rowCount;
}

async function countRowsForUpdate(sql, params) {
  const match = /\bWHERE\b([\s\S]*)$/i.exec(sql);
  if (!match) return null;
  const targetMatch = /^\s*UPDATE\s+([a-z_]+)(?:\s+([a-z_]+))?/i.exec(sql);
  if (!targetMatch) return null;
  const table = targetMatch[1];
  const alias = targetMatch[2] && targetMatch[2].toLowerCase() !== 'set'
    ? ` ${targetMatch[2]}`
    : '';
  const where = match[1].replace(/\bRETURNING\b[\s\S]*$/i, '');
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}${alias} WHERE ${where}`, params);
  return result.rows[0]?.count ?? null;
}

async function normalizeJsonRows({ table, idColumn, jsonColumn, selectSql, normalize, warnings }) {
  const result = await client.query(selectSql);
  let changed = 0;
  for (const row of result.rows) {
    const current = row[jsonColumn];
    const next = normalize(current, row, warnings);
    if (stableStringify(current) === stableStringify(next)) continue;
    changed++;
    if (!dryRun) {
      await client.query(
        `UPDATE ${table} SET ${jsonColumn} = $1::jsonb WHERE ${idColumn} = $2`,
        [JSON.stringify(next), row[idColumn]]
      );
    }
  }
  return dryRun ? { wouldAffect: changed } : changed;
}

async function refreshAnalytics(report) {
  try {
    await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY student_classroom_stats');
    report.changes.studentClassroomStatsRefreshed = 'concurrently';
  } catch {
    await client.query('REFRESH MATERIALIZED VIEW student_classroom_stats');
    report.changes.studentClassroomStatsRefreshed = 'blocking';
  }
}

async function collectHealthMetrics() {
  const result = await client.query(`
    SELECT 'duplicate_user_emails' AS metric, COUNT(*)::int AS value FROM (SELECT lower(email) FROM users GROUP BY lower(email) HAVING COUNT(*) > 1) d
    UNION ALL SELECT 'duplicate_active_enrollments', COUNT(*)::int FROM (SELECT classroom_id, student_id FROM classroom_enrollments WHERE is_active = true GROUP BY classroom_id, student_id HAVING COUNT(*) > 1) d
    UNION ALL SELECT 'duplicate_active_parent_links', COUNT(*)::int FROM (SELECT parent_id, student_id FROM parent_student_links WHERE is_active = true GROUP BY parent_id, student_id HAVING COUNT(*) > 1) d
    UNION ALL SELECT 'duplicate_classroom_lessons', COUNT(*)::int FROM (SELECT classroom_id, lesson_id FROM classroom_lessons GROUP BY classroom_id, lesson_id HAVING COUNT(*) > 1) d
    UNION ALL SELECT 'duplicate_progress_rows', COUNT(*)::int FROM (SELECT student_id, lesson_id, classroom_id FROM progress GROUP BY student_id, lesson_id, classroom_id HAVING COUNT(*) > 1) d
    UNION ALL SELECT 'active_whiteboard_sessions', COUNT(*)::int FROM whiteboard_sessions WHERE status = 'active'
    UNION ALL SELECT 'stale_active_whiteboard_sessions', COUNT(*)::int FROM whiteboard_sessions WHERE status = 'active' AND created_at < NOW() - ($1::int * INTERVAL '1 hour')
    UNION ALL SELECT 'live_quiz_sessions', COUNT(*)::int FROM quiz_sessions WHERE status IN ('lobby', 'active')
    UNION ALL SELECT 'stale_live_quiz_sessions', COUNT(*)::int FROM quiz_sessions WHERE status IN ('lobby', 'active') AND updated_at < NOW() - ($1::int * INTERVAL '1 hour')
    UNION ALL SELECT 'soft_deleted_media_files', COUNT(*)::int FROM media_files WHERE is_deleted = true
    UNION ALL SELECT 'orphan_media_not_referenced', COUNT(*)::int FROM media_files mf WHERE mf.is_deleted = false AND NOT EXISTS (SELECT 1 FROM posts p WHERE COALESCE(p.attachments::text, '') LIKE '%' || mf.id::text || '%' OR COALESCE(p.attachments::text, '') LIKE '%' || mf.object_name || '%') AND NOT EXISTS (SELECT 1 FROM post_comments pc WHERE COALESCE(pc.attachments::text, '') LIKE '%' || mf.id::text || '%' OR COALESCE(pc.attachments::text, '') LIKE '%' || mf.object_name || '%') AND NOT EXISTS (SELECT 1 FROM lessons l WHERE COALESCE(l.content::text, '') LIKE '%' || mf.id::text || '%' OR COALESCE(l.content::text, '') LIKE '%' || mf.object_name || '%') AND NOT EXISTS (SELECT 1 FROM whiteboard_sessions ws WHERE ws.recording_file_id = mf.id OR ws.recording_path = mf.object_name)
    UNION ALL SELECT 'invalid_embed_posts', COUNT(*)::int FROM posts p, jsonb_array_elements(COALESCE(p.attachments, '[]'::jsonb)) a WHERE a->>'type' = 'embed' AND COALESCE(a->>'provider', '') NOT IN ('youtube','vimeo','loom')
    UNION ALL SELECT 'invalid_embed_comments', COUNT(*)::int FROM post_comments pc, jsonb_array_elements(COALESCE(pc.attachments, '[]'::jsonb)) a WHERE a->>'type' = 'embed' AND COALESCE(a->>'provider', '') NOT IN ('youtube','vimeo','loom')
    UNION ALL SELECT 'invalid_embed_lesson_blocks', COUNT(*)::int FROM lessons l, jsonb_array_elements(COALESCE(l.content->'blocks', '[]'::jsonb)) b WHERE b->>'type' = 'embed' AND COALESCE(b->>'provider', '') NOT IN ('youtube','vimeo','loom')
  `, [staleSessionHours]);

  return Object.fromEntries(result.rows.map((row) => [row.metric, row.value]));
}

function normalizeAttachmentList(value, row, warnings) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== 'object') return item;
    if (`${item.type ?? ''}`.toLowerCase() !== 'embed') return item;
    const info = externalVideoInfo(item.url || item.embedUrl || item.embed_url);
    if (!info) {
      warnings.push(`Unsupported embed on attachment row ${row.id}`);
      return item;
    }
    return normalizeEmbedRecord(item, info, item.name || item.title || `${info.providerName} video`);
  });
}

function normalizeLessonContent(value, row, warnings) {
  const content = value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : { summary: `${value ?? ''}` };
  if (!Array.isArray(content.blocks)) return content;

  content.blocks = content.blocks.map((block) => {
    if (!block || typeof block !== 'object') return block;
    if (`${block.type ?? ''}`.toLowerCase() !== 'embed') return block;
    const info = externalVideoInfo(block.url || block.embedUrl || block.embed_url);
    if (!info) {
      warnings.push(`Unsupported embed on lesson ${row.id}`);
      return block;
    }
    return normalizeEmbedRecord(block, info, block.title || `${info.providerName} video`);
  });
  return content;
}

function normalizeEmbedRecord(input, info, title) {
  return {
    ...input,
    type: 'embed',
    title: input.title,
    name: input.name || title,
    url: info.originalUrl,
    embedUrl: info.embedUrl,
    provider: info.provider,
    providerName: info.providerName,
    providerVideoId: info.videoId,
    thumbnailUrl: info.thumbnailUrl,
    mimeType: 'text/html',
    size: Number(input.size || 0) || 0,
  };
}

function externalVideoInfo(rawUrl) {
  const url = parseExternalUrl(rawUrl);
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (isYouTubeHost(host)) return youtubeInfo(url, host);
  if (isVimeoHost(host)) return vimeoInfo(url);
  if (isLoomHost(host)) return loomInfo(url);
  return null;
}

function parseExternalUrl(rawUrl) {
  const text = `${rawUrl ?? ''}`.trim();
  if (!text || text.length > 2048) return null;
  try {
    const url = new URL(text);
    if (url.username || url.password) return null;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.protocol = 'https:';
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function youtubeInfo(url, host) {
  const segments = url.pathname.split('/').filter(Boolean);
  let videoId = null;
  if (host === 'youtu.be') {
    videoId = segments[0] || null;
  } else if (segments[0] === 'watch') {
    videoId = url.searchParams.get('v');
  } else if (['embed', 'shorts', 'live'].includes(segments[0]) && segments[1]) {
    videoId = segments[1];
  }
  videoId = cleanVideoId(videoId, /^[A-Za-z0-9_-]{11}$/);
  if (!videoId) return null;
  const startSeconds = youtubeStartSeconds(url);
  const embedQuery = new URLSearchParams({ rel: '0' });
  if (startSeconds > 0) embedQuery.set('start', `${startSeconds}`);
  const original = new URL('https://www.youtube.com/watch');
  original.searchParams.set('v', videoId);
  if (startSeconds > 0) original.searchParams.set('t', `${startSeconds}s`);
  return {
    provider: 'youtube',
    providerName: 'YouTube',
    videoId,
    originalUrl: original.toString(),
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?${embedQuery.toString()}`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

function vimeoInfo(url) {
  const segments = url.pathname.split('/').filter(Boolean);
  const videoId = segments.find((segment) => /^\d+$/.test(segment));
  if (!videoId) return null;
  const hashIndex = segments.indexOf(videoId) + 1;
  const hash = cleanVideoId(url.searchParams.get('h') || segments[hashIndex], /^[A-Za-z0-9]+$/);
  const query = hash ? `?h=${encodeURIComponent(hash)}` : '';
  return {
    provider: 'vimeo',
    providerName: 'Vimeo',
    videoId,
    originalUrl: `https://vimeo.com/${videoId}${hash ? `/${hash}` : ''}`,
    embedUrl: `https://player.vimeo.com/video/${videoId}${query}`,
    thumbnailUrl: null,
  };
}

function loomInfo(url) {
  const segments = url.pathname.split('/').filter(Boolean);
  let videoId = null;
  for (let index = 0; index < segments.length; index++) {
    if ((segments[index] === 'share' || segments[index] === 'embed') && segments[index + 1]) {
      videoId = segments[index + 1];
      break;
    }
  }
  videoId = cleanVideoId(videoId || segments[segments.length - 1], /^[A-Za-z0-9_-]+$/);
  if (!videoId) return null;
  return {
    provider: 'loom',
    providerName: 'Loom',
    videoId,
    originalUrl: `https://www.loom.com/share/${videoId}`,
    embedUrl: `https://www.loom.com/embed/${videoId}`,
    thumbnailUrl: `https://cdn.loom.com/sessions/thumbnails/${videoId}-with-play.gif`,
  };
}

function isYouTubeHost(host) {
  return ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be'].includes(host);
}

function isVimeoHost(host) {
  return ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host);
}

function isLoomHost(host) {
  return ['loom.com', 'www.loom.com'].includes(host);
}

function cleanVideoId(value, pattern) {
  const id = `${value ?? ''}`.trim();
  return id && pattern.test(id) ? id : null;
}

function youtubeStartSeconds(url) {
  const raw = url.searchParams.get('start') || url.searchParams.get('t') || '';
  if (!raw) return 0;
  if (/^\d+s?$/i.test(raw)) {
    return Math.min(Number.parseInt(raw.replace(/s$/i, ''), 10), 12 * 60 * 60);
  }
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(raw);
  if (!match) return 0;
  return Math.min(
    (Number.parseInt(match[1] || '0', 10) * 3600) +
      (Number.parseInt(match[2] || '0', 10) * 60) +
      Number.parseInt(match[3] || '0', 10),
    12 * 60 * 60
  );
}

function stableStringify(value) {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortDeep(value[key]);
      return acc;
    }, {});
}

main().catch((error) => {
  console.error('Database hygiene failed.');
  console.error(error);
  process.exit(1);
});
