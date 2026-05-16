-- Persist lesson content review state used to unlock exercise completion.

ALTER TABLE progress
    ADD COLUMN IF NOT EXISTS content_reviewed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS content_block_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS content_review_seconds INTEGER DEFAULT 0;

UPDATE progress
SET content_block_count = 0
WHERE content_block_count IS NULL;

UPDATE progress
SET content_review_seconds = 0
WHERE content_review_seconds IS NULL;

CREATE INDEX IF NOT EXISTS idx_progress_content_reviewed
    ON progress(content_reviewed_at);
