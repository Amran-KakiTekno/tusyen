CREATE INDEX IF NOT EXISTS idx_progress_classroom_updated
  ON progress (classroom_id, updated_at);
