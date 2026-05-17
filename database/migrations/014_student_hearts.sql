-- Persist student heart/life state used by student dashboard stats.

CREATE TABLE IF NOT EXISTS student_hearts (
    student_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_hearts INTEGER NOT NULL DEFAULT 5,
    max_hearts INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT student_hearts_max_positive_check CHECK (max_hearts > 0),
    CONSTRAINT student_hearts_current_range_check CHECK (current_hearts >= 0 AND current_hearts <= max_hearts)
);

CREATE INDEX IF NOT EXISTS idx_student_hearts_updated
    ON student_hearts(updated_at DESC);

INSERT INTO student_hearts (student_id)
SELECT id
FROM users
WHERE role = 'student'
ON CONFLICT (student_id) DO NOTHING;
