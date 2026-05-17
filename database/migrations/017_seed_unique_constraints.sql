-- Unique constraints required for idempotent seed ON CONFLICT clauses
ALTER TABLE syllabus_items
  ADD CONSTRAINT uq_syllabus_subject_form_topic_subtopic
  UNIQUE (subject, form_level, topic, subtopic);

ALTER TABLE lessons
  ADD CONSTRAINT uq_lesson_title_subject_form
  UNIQUE (title, subject, form_level);

ALTER TABLE quiz_questions
  ADD CONSTRAINT uq_question_lesson_order
  UNIQUE (lesson_id, order_index);
