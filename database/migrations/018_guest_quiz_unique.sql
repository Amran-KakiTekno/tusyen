-- Prevent duplicate guest entries per session (guest rows have NULL user_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_participants_guest_name_session
  ON quiz_session_participants (session_id, guest_name)
  WHERE user_id IS NULL AND guest_name IS NOT NULL;
