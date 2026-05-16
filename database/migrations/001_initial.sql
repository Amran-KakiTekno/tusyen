-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'teacher', 'parent', 'admin')),
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    date_of_birth DATE,
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- ============================================
-- PARENT-CHILD LINKS
-- ============================================
CREATE TABLE parent_student_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(parent_id, student_id)
);

CREATE INDEX idx_parent_links_parent ON parent_student_links(parent_id);
CREATE INDEX idx_parent_links_student ON parent_student_links(student_id);

-- ============================================
-- CLASSROOMS
-- ============================================
CREATE TABLE classrooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    subject VARCHAR(100) NOT NULL,
    form_level INTEGER NOT NULL CHECK (form_level IN (4, 5)),
    join_code VARCHAR(10) UNIQUE NOT NULL,
    is_public BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_classrooms_teacher ON classrooms(teacher_id);
CREATE INDEX idx_classrooms_join_code ON classrooms(join_code);
CREATE INDEX idx_classrooms_active ON classrooms(is_active);

-- ============================================
-- CLASSROOM ENROLLMENTS
-- ============================================
CREATE TABLE classroom_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP DEFAULT NOW(),
    last_active_at TIMESTAMP,
    UNIQUE(student_id, classroom_id)
);

CREATE INDEX idx_enrollments_student ON classroom_enrollments(student_id);
CREATE INDEX idx_enrollments_classroom ON classroom_enrollments(classroom_id);

-- ============================================
-- SYLLABUS (Admin-managed curriculum)
-- ============================================
CREATE TABLE syllabus_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject VARCHAR(100) NOT NULL,
    form_level INTEGER NOT NULL CHECK (form_level IN (4, 5)),
    topic VARCHAR(255) NOT NULL,
    subtopic VARCHAR(255),
    order_index INTEGER DEFAULT 0,
    content JSONB,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_syllabus_subject ON syllabus_items(subject);
CREATE INDEX idx_syllabus_form_level ON syllabus_items(form_level);
CREATE INDEX idx_syllabus_order ON syllabus_items(order_index);

-- ============================================
-- LESSONS
-- ============================================
CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content JSONB NOT NULL,
    subject VARCHAR(100) NOT NULL,
    form_level INTEGER NOT NULL CHECK (form_level IN (4, 5)),
    difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    estimated_minutes INTEGER DEFAULT 15,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_lessons_subject ON lessons(subject);
CREATE INDEX idx_lessons_form_level ON lessons(form_level);
CREATE INDEX idx_lessons_active ON lessons(is_active);

-- ============================================
-- QUIZ QUESTIONS
-- ============================================
CREATE TABLE quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'fill_blank', 'matching')),
    options JSONB,
    correct_answer JSONB NOT NULL,
    explanation TEXT,
    points INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quiz_lesson ON quiz_questions(lesson_id);

-- ============================================
-- CLASSROOM LESSONS (Assignments)
-- ============================================
CREATE TABLE classroom_lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id),
    due_date TIMESTAMP,
    is_required BOOLEAN DEFAULT true,
    assigned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(classroom_id, lesson_id)
);

CREATE INDEX idx_classroom_lessons_classroom ON classroom_lessons(classroom_id);

-- ============================================
-- SYLLABUS-LESSON LINKS
-- ============================================
CREATE TABLE lesson_syllabus_links (
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    syllabus_id UUID REFERENCES syllabus_items(id) ON DELETE CASCADE,
    PRIMARY KEY (lesson_id, syllabus_id)
);

-- ============================================
-- STUDENT PROGRESS
-- ============================================
CREATE TABLE progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id),
    classroom_id UUID REFERENCES classrooms(id),
    score DECIMAL(5,2) DEFAULT 0,
    time_spent_seconds INTEGER DEFAULT 0,
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    answers JSONB,
    attempts INTEGER DEFAULT 1,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, lesson_id, classroom_id)
);

CREATE INDEX idx_progress_student ON progress(student_id);
CREATE INDEX idx_progress_lesson ON progress(lesson_id);
CREATE INDEX idx_progress_classroom ON progress(classroom_id);
CREATE INDEX idx_progress_updated ON progress(updated_at);

-- ============================================
-- STUDENT STREAKS (Gamification)
-- ============================================
CREATE TABLE student_streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    streak_count INTEGER DEFAULT 1,
    UNIQUE(student_id, activity_date)
);

CREATE INDEX idx_streaks_student ON student_streaks(student_id);
CREATE INDEX idx_streaks_date ON student_streaks(activity_date);

-- ============================================
-- WHITEBOARD SESSIONS
-- ============================================
CREATE TABLE whiteboard_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classroom_id UUID NOT NULL REFERENCES classrooms(id),
    teacher_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255),
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
    recording_path VARCHAR(500),
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP
);

CREATE INDEX idx_whiteboard_classroom ON whiteboard_sessions(classroom_id);
CREATE INDEX idx_whiteboard_status ON whiteboard_sessions(status);

-- ============================================
-- POSTS / ANNOUNCEMENTS (Social Feed)
-- ============================================
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    post_type VARCHAR(20) DEFAULT 'announcement' CHECK (post_type IN ('announcement', 'assignment', 'general')),
    title VARCHAR(255),
    content TEXT NOT NULL,
    attachments JSONB,
    is_pinned BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_posts_classroom ON posts(classroom_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);

-- ============================================
-- CHAT MESSAGES
-- ============================================
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'attachment', 'system')),
    reply_to_id UUID REFERENCES chat_messages(id),
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chat_classroom ON chat_messages(classroom_id);
CREATE INDEX idx_chat_created ON chat_messages(created_at DESC);

-- ============================================
-- MEDIA FILES
-- ============================================
CREATE TABLE media_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    filename VARCHAR(500) NOT NULL,
    original_name VARCHAR(500),
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    bucket VARCHAR(100) NOT NULL,
    object_name VARCHAR(500) NOT NULL,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_media_user ON media_files(user_id);
CREATE INDEX idx_media_deleted ON media_files(is_deleted);

-- ============================================
-- DEVICE SYNC TRACKING (Offline-first)
-- ============================================
CREATE TABLE device_syncs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_sync_at TIMESTAMP,
    sync_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(device_id, user_id)
);

CREATE INDEX idx_device_syncs_user ON device_syncs(user_id);

-- ============================================
-- SYNC CONFLICTS
-- ============================================
CREATE TABLE sync_conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    local_value JSONB,
    server_value JSONB,
    resolved BOOLEAN DEFAULT false,
    resolution VARCHAR(20) CHECK (resolution IN ('local_wins', 'server_wins', 'merged')),
    winning_value JSONB,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- STUDENT NOTES / BOOKMARKS
-- ============================================
CREATE TABLE student_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_bookmark BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notes_student ON student_notes(student_id);

-- ============================================
-- ACHIEVEMENTS / BADGES
-- ============================================
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    requirement_type VARCHAR(50) NOT NULL,
    requirement_value INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id),
    earned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- ============================================
-- TRIGGER FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classrooms_updated_at BEFORE UPDATE ON classrooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON lessons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_syllabus_updated_at BEFORE UPDATE ON syllabus_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_progress_updated_at BEFORE UPDATE ON progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MATERIALIZED VIEW FOR ANALYTICS
-- ============================================
CREATE MATERIALIZED VIEW student_classroom_stats AS
SELECT 
    p.student_id,
    p.classroom_id,
    COUNT(p.id) as total_lessons,
    COUNT(CASE WHEN p.completion_percentage >= 100 THEN 1 END) as completed_lessons,
    AVG(p.completion_percentage) as completion_percentage,
    AVG(p.score) as average_score,
    MAX(p.updated_at) as last_activity
FROM progress p
GROUP BY p.student_id, p.classroom_id;

CREATE INDEX idx_stats_student ON student_classroom_stats(student_id);
CREATE UNIQUE INDEX idx_stats_student_classroom ON student_classroom_stats(student_id, classroom_id);
