-- Composite index to speed up parent progress queries filtered by classroom
CREATE INDEX IF NOT EXISTS idx_progress_classroom_student
  ON progress (classroom_id, student_id);
