-- Production hardening for whiteboard recordings.
-- Adds explicit recording state, durable replay events, and a link to the
-- protected media file instead of relying only on an object path.

ALTER TABLE whiteboard_sessions
  ADD COLUMN IF NOT EXISTS recording_file_id UUID REFERENCES media_files(id),
  ADD COLUMN IF NOT EXISTS recording_status VARCHAR(20) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recording_mime_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS recording_uploaded_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS recording_error TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whiteboard_sessions_recording_status_check'
  ) THEN
    ALTER TABLE whiteboard_sessions
      ADD CONSTRAINT whiteboard_sessions_recording_status_check
      CHECK (recording_status IN ('none', 'processing', 'ready', 'failed'));
  END IF;
END $$;

UPDATE whiteboard_sessions ws
SET
  recording_file_id = mf.id,
  recording_status = 'ready',
  recording_mime_type = mf.mime_type,
  recording_uploaded_at = COALESCE(ws.ended_at, ws.created_at)
FROM media_files mf
WHERE ws.recording_file_id IS NULL
  AND ws.recording_path IS NOT NULL
  AND mf.object_name = ws.recording_path
  AND mf.is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_whiteboard_recording_file
  ON whiteboard_sessions(recording_file_id)
  WHERE recording_file_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS whiteboard_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES whiteboard_sessions(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('draw', 'clear')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sequence INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_whiteboard_events_session_sequence
  ON whiteboard_events(session_id, sequence);

CREATE INDEX IF NOT EXISTS idx_whiteboard_events_classroom_created
  ON whiteboard_events(classroom_id, created_at DESC);
