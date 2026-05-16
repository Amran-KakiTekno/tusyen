-- Rich social media comments and content-first lesson metadata.

ALTER TABLE posts
    ALTER COLUMN attachments SET DEFAULT '[]'::jsonb;

UPDATE posts
SET attachments = '[]'::jsonb
WHERE attachments IS NULL;

ALTER TABLE post_comments
    ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

UPDATE post_comments
SET attachments = '[]'::jsonb
WHERE attachments IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_attachments_gin
    ON posts USING GIN (attachments);

CREATE INDEX IF NOT EXISTS idx_post_comments_attachments_gin
    ON post_comments USING GIN (attachments);
