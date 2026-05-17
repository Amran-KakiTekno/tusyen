DELETE FROM quiz_questions WHERE lesson_id IN (SELECT id FROM lessons);
DELETE FROM progress WHERE lesson_id IN (SELECT id FROM lessons);
DELETE FROM classroom_lessons WHERE lesson_id IN (SELECT id FROM lessons);
DELETE FROM lesson_syllabus_links WHERE lesson_id IN (SELECT id FROM lessons);
DELETE FROM lessons;
DELETE FROM syllabus_items;
