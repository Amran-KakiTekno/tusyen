-- Store traceable textbook extraction output separately from authored lessons.

CREATE TABLE IF NOT EXISTS textbook_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_key TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    form_level INTEGER NOT NULL CHECK (form_level IN (4, 5)),
    stream VARCHAR(50) NOT NULL DEFAULT 'STEM',
    language VARCHAR(20),
    source_website TEXT,
    local_dir TEXT NOT NULL,
    file_count INTEGER NOT NULL DEFAULT 0,
    page_count INTEGER NOT NULL DEFAULT 0,
    extracted_page_count INTEGER NOT NULL DEFAULT 0,
    needs_ocr_page_count INTEGER NOT NULL DEFAULT 0,
    extraction_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (extraction_status IN ('pending', 'complete', 'partial', 'needs_ocr', 'failed')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_textbook_sources_subject_form
    ON textbook_sources(subject, form_level);

CREATE INDEX IF NOT EXISTS idx_textbook_sources_stream
    ON textbook_sources(stream);

CREATE INDEX IF NOT EXISTS idx_textbook_sources_metadata_gin
    ON textbook_sources USING GIN (metadata);

CREATE TABLE IF NOT EXISTS textbook_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES textbook_sources(id) ON DELETE CASCADE,
    file_key TEXT UNIQUE NOT NULL,
    file_name TEXT NOT NULL,
    local_path TEXT NOT NULL,
    file_index INTEGER NOT NULL DEFAULT 0,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    sha256 TEXT,
    page_count INTEGER NOT NULL DEFAULT 0,
    extracted_page_count INTEGER NOT NULL DEFAULT 0,
    needs_ocr_page_count INTEGER NOT NULL DEFAULT 0,
    extraction_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (extraction_status IN ('pending', 'complete', 'partial', 'needs_ocr', 'failed')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_textbook_files_source
    ON textbook_files(source_id, file_index);

CREATE TABLE IF NOT EXISTS textbook_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES textbook_sources(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES textbook_files(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL CHECK (page_number > 0),
    global_page_number INTEGER NOT NULL CHECK (global_page_number > 0),
    text_content TEXT NOT NULL DEFAULT '',
    char_count INTEGER NOT NULL DEFAULT 0,
    image_count INTEGER NOT NULL DEFAULT 0,
    extraction_method VARCHAR(50) NOT NULL DEFAULT 'pymupdf_text',
    needs_ocr BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(file_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_textbook_pages_source_global
    ON textbook_pages(source_id, global_page_number);

CREATE INDEX IF NOT EXISTS idx_textbook_pages_needs_ocr
    ON textbook_pages(needs_ocr)
    WHERE needs_ocr = true;

CREATE INDEX IF NOT EXISTS idx_textbook_pages_text_search
    ON textbook_pages USING GIN (to_tsvector('simple', text_content));

CREATE TABLE IF NOT EXISTS textbook_lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES textbook_sources(id) ON DELETE CASCADE,
    lesson_key TEXT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    form_level INTEGER NOT NULL CHECK (form_level IN (4, 5)),
    topic TEXT NOT NULL,
    subtopic TEXT,
    topic_code VARCHAR(50),
    title TEXT NOT NULL,
    lesson_type VARCHAR(30) NOT NULL DEFAULT 'subtopic',
    order_index INTEGER NOT NULL DEFAULT 0,
    start_file_id UUID REFERENCES textbook_files(id) ON DELETE SET NULL,
    end_file_id UUID REFERENCES textbook_files(id) ON DELETE SET NULL,
    start_page_number INTEGER,
    end_page_number INTEGER,
    start_global_page_number INTEGER,
    end_global_page_number INTEGER,
    page_count INTEGER NOT NULL DEFAULT 0,
    text_content TEXT NOT NULL DEFAULT '',
    char_count INTEGER NOT NULL DEFAULT 0,
    extraction_status VARCHAR(20) NOT NULL DEFAULT 'complete'
        CHECK (extraction_status IN ('complete', 'partial', 'needs_ocr', 'failed')),
    syllabus JSONB NOT NULL DEFAULT '{}'::jsonb,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    linked_syllabus_item_id UUID REFERENCES syllabus_items(id) ON DELETE SET NULL,
    linked_lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(source_id, lesson_key)
);

CREATE INDEX IF NOT EXISTS idx_textbook_lessons_source_order
    ON textbook_lessons(source_id, order_index);

CREATE INDEX IF NOT EXISTS idx_textbook_lessons_subject_form
    ON textbook_lessons(subject, form_level);

CREATE INDEX IF NOT EXISTS idx_textbook_lessons_links
    ON textbook_lessons(linked_lesson_id, linked_syllabus_item_id);

CREATE INDEX IF NOT EXISTS idx_textbook_lessons_content_gin
    ON textbook_lessons USING GIN (content);

CREATE INDEX IF NOT EXISTS idx_textbook_lessons_text_search
    ON textbook_lessons USING GIN (to_tsvector('simple', text_content));

CREATE TABLE IF NOT EXISTS textbook_lesson_pages (
    lesson_id UUID NOT NULL REFERENCES textbook_lessons(id) ON DELETE CASCADE,
    page_id UUID NOT NULL REFERENCES textbook_pages(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (lesson_id, page_id)
);

CREATE INDEX IF NOT EXISTS idx_textbook_lesson_pages_page
    ON textbook_lesson_pages(page_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_textbook_sources_updated_at'
  ) THEN
    CREATE TRIGGER update_textbook_sources_updated_at BEFORE UPDATE ON textbook_sources
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_textbook_files_updated_at'
  ) THEN
    CREATE TRIGGER update_textbook_files_updated_at BEFORE UPDATE ON textbook_files
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_textbook_pages_updated_at'
  ) THEN
    CREATE TRIGGER update_textbook_pages_updated_at BEFORE UPDATE ON textbook_pages
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_textbook_lessons_updated_at'
  ) THEN
    CREATE TRIGGER update_textbook_lessons_updated_at BEFORE UPDATE ON textbook_lessons
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
