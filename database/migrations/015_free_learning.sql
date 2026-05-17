DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progress' AND column_name = 'classroom_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE progress ALTER COLUMN classroom_id DROP NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_student_lesson_null_classroom
  ON progress(student_id, lesson_id) WHERE classroom_id IS NULL;

COMMENT ON COLUMN progress.classroom_id IS
  'NULL = free/self-directed learning. Non-null = classroom-assigned.';
