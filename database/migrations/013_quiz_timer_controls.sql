-- Live quiz teacher timer controls.
ALTER TABLE quiz_sessions
  ADD COLUMN IF NOT EXISTS question_paused_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS question_remaining_ms INTEGER;

