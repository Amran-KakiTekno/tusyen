-- Live quiz tables and XP events are used by quiz rooms, summaries, and rewards.
-- Kept idempotent so existing local volumes can be upgraded safely.

CREATE TABLE IF NOT EXISTS quiz_decks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    subject VARCHAR(100) NOT NULL,
    form_level INTEGER NOT NULL CHECK (form_level IN (4, 5)),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_decks_teacher ON quiz_decks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_quiz_decks_subject ON quiz_decks(subject);
CREATE INDEX IF NOT EXISTS idx_quiz_decks_form_level ON quiz_decks(form_level);
CREATE INDEX IF NOT EXISTS idx_quiz_decks_active ON quiz_decks(is_active);

CREATE TABLE IF NOT EXISTS quiz_deck_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deck_id UUID NOT NULL REFERENCES quiz_decks(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false')),
    options JSONB NOT NULL,
    correct_answer JSONB NOT NULL,
    explanation TEXT,
    points INTEGER DEFAULT 1000,
    time_limit_seconds INTEGER DEFAULT 20,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_deck_questions_deck ON quiz_deck_questions(deck_id);
CREATE INDEX IF NOT EXISTS idx_quiz_deck_questions_order ON quiz_deck_questions(deck_id, order_index);

CREATE TABLE IF NOT EXISTS quiz_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deck_id UUID NOT NULL REFERENCES quiz_decks(id) ON DELETE CASCADE,
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pin VARCHAR(6) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'active', 'ended', 'cancelled')),
    current_question_index INTEGER NOT NULL DEFAULT -1,
    current_question_id UUID REFERENCES quiz_deck_questions(id),
    question_started_at TIMESTAMP,
    question_ends_at TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    leaderboard_snapshot JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_deck ON quiz_sessions(deck_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_classroom ON quiz_sessions(classroom_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_teacher ON quiz_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_status ON quiz_sessions(status);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_pin ON quiz_sessions(pin);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_sessions_active_classroom
    ON quiz_sessions(classroom_id)
    WHERE status IN ('lobby', 'active');

CREATE TABLE IF NOT EXISTS quiz_session_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    guest_name VARCHAR(255),
    display_name VARCHAR(255) NOT NULL,
    is_guest BOOLEAN DEFAULT true,
    join_token VARCHAR(255) NOT NULL UNIQUE,
    total_score INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    answered_count INTEGER DEFAULT 0,
    xp_awarded INTEGER DEFAULT 0,
    is_connected BOOLEAN DEFAULT true,
    joined_at TIMESTAMP DEFAULT NOW(),
    last_seen_at TIMESTAMP DEFAULT NOW(),
    left_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_participants_session ON quiz_session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_participants_user ON quiz_session_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_participants_join_token ON quiz_session_participants(join_token);

CREATE TABLE IF NOT EXISTS quiz_session_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES quiz_session_participants(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES quiz_deck_questions(id) ON DELETE CASCADE,
    selected_answer JSONB NOT NULL,
    is_correct BOOLEAN DEFAULT false,
    response_time_ms INTEGER DEFAULT 0,
    points_awarded INTEGER DEFAULT 0,
    answered_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(participant_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_answers_session ON quiz_session_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_participant ON quiz_session_answers(participant_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question ON quiz_session_answers(question_id);

CREATE TABLE IF NOT EXISTS xp_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    source_id UUID NOT NULL,
    amount INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_xp_events_user ON xp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_source ON xp_events(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_created ON xp_events(created_at DESC);
