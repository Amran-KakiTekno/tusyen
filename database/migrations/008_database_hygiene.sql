-- Database hygiene hardening: add indexes and guardrails used by maintenance
-- jobs and high-traffic read paths.

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_bucket_object_name_unique
  ON media_files(bucket, object_name);

CREATE INDEX IF NOT EXISTS idx_media_bucket_deleted_created
  ON media_files(bucket, is_deleted, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_student_lesson_null_classroom
  ON progress(student_id, lesson_id)
  WHERE classroom_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whiteboard_active_classroom_unique
  ON whiteboard_sessions(classroom_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_posts_feed_visible
  ON posts(classroom_id, is_active, is_pinned DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_comments_visible
  ON post_comments(post_id, is_deleted, created_at);

CREATE INDEX IF NOT EXISTS idx_lessons_content_gin
  ON lessons USING GIN (content);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_live_updated
  ON quiz_sessions(status, updated_at)
  WHERE status IN ('lobby', 'active');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_files_size_nonnegative_check'
  ) THEN
    ALTER TABLE media_files
      ADD CONSTRAINT media_files_size_nonnegative_check
      CHECK (size_bytes IS NULL OR size_bytes >= 0) NOT VALID;
  END IF;
  ALTER TABLE media_files VALIDATE CONSTRAINT media_files_size_nonnegative_check;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lessons_estimated_minutes_positive_check'
  ) THEN
    ALTER TABLE lessons
      ADD CONSTRAINT lessons_estimated_minutes_positive_check
      CHECK (estimated_minutes IS NULL OR estimated_minutes > 0) NOT VALID;
  END IF;
  ALTER TABLE lessons VALIDATE CONSTRAINT lessons_estimated_minutes_positive_check;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'progress_score_range_check'
  ) THEN
    ALTER TABLE progress
      ADD CONSTRAINT progress_score_range_check
      CHECK (score >= 0 AND score <= 100) NOT VALID;
  END IF;
  ALTER TABLE progress VALIDATE CONSTRAINT progress_score_range_check;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'progress_time_attempts_nonnegative_check'
  ) THEN
    ALTER TABLE progress
      ADD CONSTRAINT progress_time_attempts_nonnegative_check
      CHECK (time_spent_seconds >= 0 AND attempts >= 1) NOT VALID;
  END IF;
  ALTER TABLE progress VALIDATE CONSTRAINT progress_time_attempts_nonnegative_check;
END $$;
