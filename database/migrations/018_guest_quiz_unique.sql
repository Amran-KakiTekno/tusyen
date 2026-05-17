CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_participants_guest_display_name_session
  ON quiz_session_participants (session_id, display_name)
  WHERE user_id IS NULL;
