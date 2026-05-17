import { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { db, withTransaction } from '../database';
import { cacheDelete } from '../redis';
import {
  assertCanAttachMediaReferences,
  isMediaAccessError,
  protectMediaReferences,
} from '../media-access';
import { ExternalVideoError, normalizeExternalVideoBlock } from '../external-video';

type AuthUser = {
  userId: string;
  role: 'student' | 'teacher' | 'parent' | 'admin';
};

const lessonQuestionTypes = new Set([
  'multiple_choice',
  'true_false',
  'fill_blank',
  'matching',
  'representation_match',
  'missing_step',
  'step_order',
  'numeric',
  'diagram_label',
  'error_diagnosis',
  'prediction',
  'code_trace',
  'data_interpret',
  'scenario',
]);

const pairQuestionTypes = new Set([
  'matching',
  'representation_match',
  'diagram_label',
]);

const freeTextQuestionTypes = new Set([
  'missing_step',
  'error_diagnosis',
  'prediction',
  'code_trace',
  'data_interpret',
  'scenario',
]);

const LEARNING_CATALOG_LIMIT = 200;
const LESSON_FAIL_SCORE_THRESHOLD = 60;
const HEART_REGENERATION_MINUTES = 10;
const ACHIEVEMENT_DEFINITIONS = [
  {
    code: 'streak_7',
    name: 'Streak 7 Hari',
    description: 'Belajar 7 hari berturut-turut.',
    requirementType: 'streak_days',
    requirementValue: 7,
  },
  {
    code: 'streak_30',
    name: 'Streak 30 Hari',
    description: 'Belajar 30 hari berturut-turut.',
    requirementType: 'streak_days',
    requirementValue: 30,
  },
  {
    code: 'perfect_score',
    name: 'Markah Sempurna',
    description: 'Dapat markah penuh dalam aktiviti.',
    requirementType: 'perfect_score',
    requirementValue: 100,
  },
  {
    code: 'xp_1000',
    name: '1000 XP',
    description: 'Kumpul 1000 XP.',
    requirementType: 'xp_total',
    requirementValue: 1000,
  },
  {
    code: 'xp_5000',
    name: '5000 XP',
    description: 'Kumpul 5000 XP.',
    requirementType: 'xp_total',
    requirementValue: 5000,
  },
  {
    code: 'leaderboard_top_3',
    name: 'Top 3 Leaderboard',
    description: 'Masuk tiga tempat teratas leaderboard.',
    requirementType: 'leaderboard_rank',
    requirementValue: 3,
  },
];

const lessonFields = `
  l.id,
  l.title,
  l.subject,
  l.form_level,
  l.difficulty,
  l.estimated_minutes,
  l.content,
  l.created_at,
  c.id as classroom_id,
  c.name as classroom_name,
  cl.due_date,
  cl.is_required,
  (
    SELECT si.topic
    FROM lesson_syllabus_links lsl
    JOIN syllabus_items si ON si.id = lsl.syllabus_id
    WHERE lsl.lesson_id = l.id
    ORDER BY si.order_index
    LIMIT 1
  ) as topic,
  (
    SELECT si.subtopic
    FROM lesson_syllabus_links lsl
    JOIN syllabus_items si ON si.id = lsl.syllabus_id
    WHERE lsl.lesson_id = l.id
    ORDER BY si.order_index
    LIMIT 1
  ) as subtopic,
  (
    SELECT COUNT(*)::int FROM quiz_questions qq
    WHERE qq.lesson_id = l.id AND qq.is_active = true
  ) as question_count,
  jsonb_array_length(COALESCE(l.content->'blocks', '[]'::jsonb)) as content_block_count
`;

export async function learningRoutes(fastify: FastifyInstance) {
  fastify.get('/catalog', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, _reply) => {
    const user = (request as any).user as AuthUser;
    const { subject, formLevel, difficulty, search, limit = 100, offset = 0 } = request.query as any;

    let query = `
      SELECT l.*,
             (
               SELECT si.topic
               FROM lesson_syllabus_links lsl
               JOIN syllabus_items si ON si.id = lsl.syllabus_id
               WHERE lsl.lesson_id = l.id
               ORDER BY si.order_index
               LIMIT 1
             ) as topic,
             (
               SELECT si.subtopic
               FROM lesson_syllabus_links lsl
               JOIN syllabus_items si ON si.id = lsl.syllabus_id
               WHERE lsl.lesson_id = l.id
               ORDER BY si.order_index
               LIMIT 1
             ) as subtopic,
             (
               SELECT COUNT(*) FROM quiz_questions qq
               WHERE qq.lesson_id = l.id AND qq.is_active = true
             ) as question_count
      FROM lessons l
      WHERE l.is_active = true
    `;
    const params: any[] = [];

    if (subject) {
      query += ` AND l.subject = $${params.length + 1}`;
      params.push(subject);
    }

    if (formLevel) {
      query += ` AND l.form_level = $${params.length + 1}`;
      params.push(Number(formLevel));
    }

    if (difficulty) {
      query += ` AND l.difficulty = $${params.length + 1}`;
      params.push(`${difficulty}`.trim());
    }

    const cleanSearch = `${search ?? ''}`.trim().toLowerCase();
    if (cleanSearch) {
      query += ` AND (
        LOWER(l.title) LIKE $${params.length + 1}
        OR LOWER(l.subject) LIKE $${params.length + 1}
        OR LOWER(COALESCE(l.content->>'summary', '')) LIKE $${params.length + 1}
        OR EXISTS (
          SELECT 1
          FROM lesson_syllabus_links lsl_search
          JOIN syllabus_items si_search ON si_search.id = lsl_search.syllabus_id
          WHERE lsl_search.lesson_id = l.id
            AND (
              LOWER(si_search.topic) LIKE $${params.length + 1}
              OR LOWER(COALESCE(si_search.subtopic, '')) LIKE $${params.length + 1}
            )
        )
      )`;
      params.push(`%${cleanSearch}%`);
    }

    const normalizedLimit = Math.min(
      LEARNING_CATALOG_LIMIT,
      Math.max(1, Math.floor(Number.isFinite(Number(limit)) ? Number(limit) : 100)),
    );
    const normalizedOffset = Math.max(0, Math.floor(Number.isFinite(Number(offset)) ? Number(offset) : 0));

    query += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(normalizedLimit, normalizedOffset);

    const result = await db.query(query, params);
    return { lessons: result.rows.map((lesson) => protectMediaReferences(fastify, user, lesson)) };
  });

  fastify.get('/syllabus', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const { subject, formLevel, limit = 100, offset = 0 } = request.query as any;

    let query = `
      SELECT id, subject, form_level, topic, subtopic, order_index, content, updated_at
      FROM syllabus_items
      WHERE is_active = true
    `;
    const params: any[] = [];

    if (subject) {
      query += ` AND subject = $${params.length + 1}`;
      params.push(subject);
    }

    if (formLevel) {
      query += ` AND form_level = $${params.length + 1}`;
      params.push(Number(formLevel));
    }

    query += ` ORDER BY subject, form_level, order_index LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), Number(offset));

    const result = await db.query(query, params);
    return { syllabus: result.rows };
  });

  fastify.post('/lessons', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const {
      syllabusId,
      title,
      content,
      difficulty,
      estimatedMinutes,
      quizData,
    } = request.body as any;

    if (user.role !== 'teacher' && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Only teachers and admins can create lessons' });
    }

    const cleanTitle = `${title ?? ''}`.trim();
    if (!cleanTitle || !syllabusId) {
      return reply.code(400).send({ error: 'title and syllabusId are required' });
    }

    const syllabus = await db.query(
      'SELECT id, subject, form_level FROM syllabus_items WHERE id = $1 AND is_active = true',
      [syllabusId]
    );
    if ((syllabus.rowCount ?? 0) === 0) {
      return reply.code(404).send({ error: 'Syllabus item not found' });
    }

    const lessonId = uuidv4();
    const syllabusRow = syllabus.rows[0];
    let cleanContent: Record<string, any>;
    try {
      cleanContent = normalizeContent(content);
    } catch (error) {
      if (error instanceof ExternalVideoError) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }

    try {
      await assertCanAttachMediaReferences(user, cleanContent);
    } catch (error) {
      if (isMediaAccessError(error)) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      throw error;
    }

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO lessons (id, title, content, subject, form_level, difficulty, estimated_minutes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          lessonId,
          cleanTitle,
          JSON.stringify(cleanContent),
          syllabusRow.subject,
          syllabusRow.form_level,
          normalizeDifficulty(difficulty),
          normalizeMinutes(estimatedMinutes),
          user.userId,
        ]
      );

      await client.query(
        'INSERT INTO lesson_syllabus_links (lesson_id, syllabus_id) VALUES ($1, $2)',
        [lessonId, syllabusId]
      );

      await replaceLessonQuestions(client, lessonId, quizData?.questions);
    });

    return { success: true, lessonId };
  });

  fastify.get('/authoring/lessons/:id', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as any;

    if (user.role !== 'teacher' && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Only teachers and admins can edit lessons' });
    }

    const lesson = await getAuthorableLesson(id);
    if (!lesson) {
      return reply.code(404).send({ error: 'Lesson not found' });
    }
    if (user.role !== 'admin' && lesson.created_by !== user.userId) {
      return reply.code(403).send({ error: 'You can only edit lessons you created' });
    }

    const questions = await db.query(
      `SELECT id, question_text, question_type, options, correct_answer, explanation, points, order_index
       FROM quiz_questions
       WHERE lesson_id = $1 AND is_active = true
       ORDER BY order_index ASC`,
      [id]
    );

    return { lesson: protectMediaReferences(fastify, user, lesson), questions: questions.rows };
  });

  fastify.patch('/lessons/:id', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as any;
    const { syllabusId, title, content, difficulty, estimatedMinutes, quizData } = request.body as any;

    if (user.role !== 'teacher' && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Only teachers and admins can update lessons' });
    }

    const current = await getAuthorableLesson(id);
    if (!current) {
      return reply.code(404).send({ error: 'Lesson not found' });
    }
    if (user.role !== 'admin' && current.created_by !== user.userId) {
      return reply.code(403).send({ error: 'You can only update lessons you created' });
    }

    const nextSyllabusId = syllabusId === undefined ? current.syllabus_id : syllabusId;
    let nextSubject = current.subject;
    let nextFormLevel = current.form_level;
    let nextContent: Record<string, any>;
    try {
      nextContent = content === undefined ? current.content : normalizeContent(content, current.content);
    } catch (error) {
      if (error instanceof ExternalVideoError) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }

    if (nextSyllabusId) {
      const syllabus = await db.query(
        'SELECT id, subject, form_level FROM syllabus_items WHERE id = $1 AND is_active = true',
        [nextSyllabusId]
      );
      if ((syllabus.rowCount ?? 0) === 0) {
        return reply.code(404).send({ error: 'Syllabus item not found' });
      }
      nextSubject = syllabus.rows[0].subject;
      nextFormLevel = syllabus.rows[0].form_level;
    }

    try {
      await assertCanAttachMediaReferences(user, nextContent);
    } catch (error) {
      if (isMediaAccessError(error)) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      throw error;
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE lessons
         SET title = $1,
             content = $2,
             subject = $3,
             form_level = $4,
             difficulty = $5,
             estimated_minutes = $6,
             updated_at = NOW()
         WHERE id = $7`,
        [
          `${title ?? current.title}`.trim() || current.title,
          JSON.stringify(nextContent),
          nextSubject,
          nextFormLevel,
          normalizeDifficulty(difficulty, current.difficulty),
          normalizeMinutes(estimatedMinutes, current.estimated_minutes),
          id,
        ]
      );

      await client.query('DELETE FROM lesson_syllabus_links WHERE lesson_id = $1', [id]);
      if (nextSyllabusId) {
        await client.query(
          'INSERT INTO lesson_syllabus_links (lesson_id, syllabus_id) VALUES ($1, $2)',
          [id, nextSyllabusId]
        );
      }

      if (Array.isArray(quizData?.questions)) {
        await client.query('DELETE FROM quiz_questions WHERE lesson_id = $1', [id]);
        await replaceLessonQuestions(client, id, quizData.questions);
      }
    });

    return { success: true };
  });

  fastify.delete('/lessons/:id', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as any;

    if (user.role !== 'teacher' && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Only teachers and admins can delete lessons' });
    }

    const current = await getAuthorableLesson(id);
    if (!current) {
      return reply.code(404).send({ error: 'Lesson not found' });
    }
    if (user.role !== 'admin' && current.created_by !== user.userId) {
      return reply.code(403).send({ error: 'You can only delete lessons you created' });
    }

    await db.query(
      'UPDATE lessons SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    return { success: true };
  });

  fastify.get('/lessons', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { classroomId, subject, formLevel, limit = 50, offset = 0 } = request.query as any;

    let query = '';
    const params: any[] = [user.userId];

    if (user.role === 'student') {
      query = `
        SELECT DISTINCT ${lessonFields},
               COALESCE(p.completion_percentage, 0) as completion_percentage,
               COALESCE(p.score, 0) as score,
               COALESCE(p.is_completed, false) as is_completed
        FROM classroom_enrollments ce
        JOIN classrooms c ON c.id = ce.classroom_id AND c.is_active = true
        JOIN classroom_lessons cl ON cl.classroom_id = c.id
        JOIN lessons l ON l.id = cl.lesson_id AND l.is_active = true
        LEFT JOIN progress p ON p.lesson_id = l.id AND p.student_id = $1 AND p.classroom_id = c.id
        WHERE ce.student_id = $1 AND ce.is_active = true
      `;
    } else if (user.role === 'teacher') {
      query = `
        SELECT DISTINCT ${lessonFields},
               COUNT(DISTINCT ce.student_id) FILTER (WHERE ce.is_active = true) as student_count
        FROM classrooms c
        JOIN classroom_lessons cl ON cl.classroom_id = c.id
        JOIN lessons l ON l.id = cl.lesson_id AND l.is_active = true
        LEFT JOIN classroom_enrollments ce ON ce.classroom_id = c.id
        WHERE c.teacher_id = $1 AND c.is_active = true
      `;
    } else if (user.role === 'parent') {
      query = `
        SELECT DISTINCT ${lessonFields},
               s.id as student_id,
               s.full_name as student_name,
               COALESCE(p.completion_percentage, 0) as completion_percentage,
               COALESCE(p.score, 0) as score,
               COALESCE(p.is_completed, false) as is_completed
        FROM parent_student_links psl
        JOIN users s ON s.id = psl.student_id
        JOIN classroom_enrollments ce ON ce.student_id = s.id AND ce.is_active = true
        JOIN classrooms c ON c.id = ce.classroom_id AND c.is_active = true
        JOIN classroom_lessons cl ON cl.classroom_id = c.id
        JOIN lessons l ON l.id = cl.lesson_id AND l.is_active = true
        LEFT JOIN progress p ON p.lesson_id = l.id AND p.student_id = s.id AND p.classroom_id = c.id
        WHERE psl.parent_id = $1 AND psl.is_active = true
      `;
    } else {
      query = `
        SELECT DISTINCT ${lessonFields}
        FROM lessons l
        LEFT JOIN classroom_lessons cl ON cl.lesson_id = l.id
        LEFT JOIN classrooms c ON c.id = cl.classroom_id
        WHERE l.is_active = true
      `;
    }

    if (classroomId) {
      query += ` AND c.id = $${params.length + 1}`;
      params.push(classroomId);
    }

    if (subject) {
      query += ` AND l.subject = $${params.length + 1}`;
      params.push(subject);
    }

    if (formLevel) {
      query += ` AND l.form_level = $${params.length + 1}`;
      params.push(Number(formLevel));
    }

    if (user.role === 'teacher') {
      query += `
        GROUP BY l.id, c.id, cl.id
      `;
    }

    query += ` ORDER BY cl.due_date DESC NULLS LAST, l.created_at DESC, l.title ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), Number(offset));

    const result = await db.query(query, params);
    return { lessons: result.rows.map((lesson) => protectMediaReferences(fastify, user, lesson)) };
  });

  fastify.get('/lessons/:id', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as any;
    const { classroomId } = request.query as any;

    const lesson = await getAccessibleLesson(user, id, classroomId);
    if (!lesson) {
      return reply.code(404).send({ error: 'Lesson not found or not accessible' });
    }

    const questions = await db.query(
      `SELECT id, question_text, question_type, options, explanation, points, order_index
       FROM quiz_questions
       WHERE lesson_id = $1 AND is_active = true
       ORDER BY order_index ASC`,
      [id]
    );

    let progress = null;
    if (user.role === 'student') {
      const progressWhere = lesson.classroom_id
        ? `student_id = $1 AND lesson_id = $2 AND classroom_id = $3`
        : `student_id = $1 AND lesson_id = $2 AND classroom_id IS NULL`;
      const progressParams = lesson.classroom_id
        ? [user.userId, id, lesson.classroom_id]
        : [user.userId, id];
      const result = await db.query(
        `SELECT score,
                completion_percentage,
                attempts,
                is_completed,
                content_reviewed_at,
                content_block_count,
                content_review_seconds,
                updated_at
         FROM progress
         WHERE ${progressWhere}`,
        progressParams
      );
      progress = result.rows[0] || null;
    }

    return {
      lesson: protectMediaReferences(fastify, user, lesson),
      questions: questions.rows,
      progress,
    };
  });

  fastify.post('/lessons/:id/submit', {
    onRequest: [(fastify as any).authenticate]
  }, async (request, reply) => {
    const user = (request as any).user as AuthUser;
    const { id } = request.params as any;
    const {
      classroomId,
      answers = [],
      timeSpentSeconds = 0,
      contentReviewed = false,
      contentReviewSeconds = 0,
      contentBlockCount = 0,
    } = request.body as any;

    if (user.role !== 'student') {
      return reply.code(403).send({ error: 'Only students can submit exercises' });
    }

    const lesson = await getAccessibleLesson(user, id, classroomId);
    if (!lesson) {
      return reply.code(404).send({ error: 'Lesson not found or not accessible' });
    }

    const lessonBlocks = getLessonContentBlocks(lesson.content);
    const reviewRequired = lessonBlocks.length > 0;
    const submittedContentReview = contentReviewed === true || contentReviewed === 'true';
    let previouslyReviewedContent = false;

    if (reviewRequired) {
      const progressWhere = lesson.classroom_id
        ? `student_id = $1 AND lesson_id = $2 AND classroom_id = $3`
        : `student_id = $1 AND lesson_id = $2 AND classroom_id IS NULL`;
      const progressParams = lesson.classroom_id
        ? [user.userId, id, lesson.classroom_id]
        : [user.userId, id];
      const existingProgress = await db.query(
        `SELECT content_reviewed_at, content_block_count
         FROM progress
         WHERE ${progressWhere}`,
        progressParams
      );
      const previous = existingProgress.rows[0];
      previouslyReviewedContent = Boolean(previous?.content_reviewed_at) &&
        Number(previous?.content_block_count || 0) >= lessonBlocks.length;
    }

    const hasReviewedContent = !reviewRequired || submittedContentReview || previouslyReviewedContent;

    if (!hasReviewedContent) {
      return reply.code(400).send({ error: 'Review the lesson content before submitting exercises' });
    }

    const questions = await db.query(
      `SELECT id, question_text, question_type, options, correct_answer, explanation, points, order_index
       FROM quiz_questions
       WHERE lesson_id = $1 AND is_active = true
       ORDER BY order_index ASC`,
      [id]
    );

    if (questions.rows.length === 0) {
      return reply.code(400).send({ error: 'This lesson has no exercises yet' });
    }

    const answerMap = new Map<string, any>();
    for (const item of answers as any[]) {
      if (item && item.questionId) {
        answerMap.set(item.questionId, item.answer);
      }
    }

    let earnedPoints = 0;
    let totalPoints = 0;
    let answeredQuestions = 0;
    let correctAnswers = 0;

    const detailedAnswers = questions.rows.map((question) => {
      const userAnswer = answerMap.get(question.id);
      const isAnswered = hasSubmittedAnswer(userAnswer);
      const grade = gradeLessonAnswer(
        userAnswer,
        question.correct_answer,
        question.question_type,
        question.options,
        isAnswered,
      );
      const points = Number(question.points || 1);
      const earnedPointsForQuestion = points * grade.scoreMultiplier;

      totalPoints += points;
      if (isAnswered) answeredQuestions++;
      if (grade.isCorrect) {
        correctAnswers++;
      }
      earnedPoints += earnedPointsForQuestion;

      return {
        questionId: question.id,
        question: question.question_text,
        answer: userAnswer ?? null,
        correctAnswer: question.correct_answer,
        isCorrect: grade.isCorrect,
        scoreMultiplier: grade.scoreMultiplier,
        points,
      };
    });

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const completionPercentage = questions.rows.length > 0
      ? Math.round((answeredQuestions / questions.rows.length) * 100)
      : 0;
    const isCompleted = answeredQuestions === questions.rows.length && hasReviewedContent;
    const reviewSeconds = Math.max(0, Math.round(Number(contentReviewSeconds || timeSpentSeconds || 0)));
    const reviewedAt = reviewRequired && submittedContentReview ? new Date() : null;
    const reviewedBlockCount = reviewRequired
      ? Math.max(lessonBlocks.length, Math.round(Number(contentBlockCount || 0)))
      : 0;

    let saved: { rows: any[] };
    if (lesson.classroom_id) {
      saved = await db.query(
        `INSERT INTO progress (
           id,
           student_id,
           lesson_id,
           classroom_id,
           score,
           time_spent_seconds,
           completion_percentage,
           answers,
           attempts,
           is_completed,
           content_reviewed_at,
           content_block_count,
           content_review_seconds
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10, $11, $12)
         ON CONFLICT (student_id, lesson_id, classroom_id)
         DO UPDATE SET
           score = EXCLUDED.score,
           time_spent_seconds = EXCLUDED.time_spent_seconds,
           completion_percentage = EXCLUDED.completion_percentage,
           answers = EXCLUDED.answers,
           attempts = progress.attempts + 1,
           is_completed = EXCLUDED.is_completed,
           content_reviewed_at = COALESCE(EXCLUDED.content_reviewed_at, progress.content_reviewed_at),
           content_block_count = EXCLUDED.content_block_count,
           content_review_seconds = GREATEST(progress.content_review_seconds, EXCLUDED.content_review_seconds),
           updated_at = NOW()
         RETURNING *`,
        [
          uuidv4(),
          user.userId,
          id,
          lesson.classroom_id,
          score,
          Number(timeSpentSeconds || 0),
          completionPercentage,
          JSON.stringify(detailedAnswers),
          isCompleted,
          reviewedAt,
          reviewedBlockCount,
          reviewSeconds,
        ]
      );
    } else {
      saved = await db.query(
        `INSERT INTO progress (
           id,
           student_id,
           lesson_id,
           classroom_id,
           score,
           time_spent_seconds,
           completion_percentage,
           answers,
           attempts,
           is_completed,
           content_reviewed_at,
           content_block_count,
           content_review_seconds
         )
         VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, 1, $8, $9, $10, $11)
         ON CONFLICT (student_id, lesson_id) WHERE classroom_id IS NULL
         DO UPDATE SET
           score = EXCLUDED.score,
           time_spent_seconds = EXCLUDED.time_spent_seconds,
           completion_percentage = EXCLUDED.completion_percentage,
           answers = EXCLUDED.answers,
           attempts = progress.attempts + 1,
           is_completed = EXCLUDED.is_completed,
           content_reviewed_at = COALESCE(EXCLUDED.content_reviewed_at, progress.content_reviewed_at),
           content_block_count = EXCLUDED.content_block_count,
           content_review_seconds = GREATEST(progress.content_review_seconds, EXCLUDED.content_review_seconds),
           updated_at = NOW()
         RETURNING *`,
        [
          uuidv4(),
          user.userId,
          id,
          score,
          Number(timeSpentSeconds || 0),
          completionPercentage,
          JSON.stringify(detailedAnswers),
          isCompleted,
          reviewedAt,
          reviewedBlockCount,
          reviewSeconds,
        ]
      );
    }

    await checkAndUpdateStreak(user.userId);
    await Promise.all([
      checkAndAwardAchievements(user.userId, {
        score,
        perfect: Number(score) === 100,
        streak: await getStudentStreak(user.userId),
      }),
      maybeDecrementStudentHeartsOnLessonFailure(user.userId, score, isCompleted),
    ]);

    await cacheDelete(`stats:student:${user.userId}`);

    return {
      success: true,
      result: {
        score,
        correctAnswers,
        totalQuestions: questions.rows.length,
        completionPercentage,
        isCompleted,
      },
      progress: saved.rows[0],
    };
  });
}

async function getAccessibleLesson(user: AuthUser, lessonId: string, classroomId?: string) {
  const params: any[] = [user.userId, lessonId];

  if (user.role === 'student') {
    if (classroomId) {
      const classroomResult = await db.query(
        `SELECT DISTINCT ${lessonFields},
               COALESCE(p.completion_percentage, 0) as completion_percentage,
               COALESCE(p.score, 0) as score,
               COALESCE(p.is_completed, false) as is_completed
        FROM classroom_enrollments ce
        JOIN classrooms c ON c.id = ce.classroom_id AND c.is_active = true
        JOIN classroom_lessons cl ON cl.classroom_id = c.id
        JOIN lessons l ON l.id = cl.lesson_id AND l.is_active = true
        LEFT JOIN progress p ON p.lesson_id = l.id AND p.student_id = $1 AND p.classroom_id = c.id
        WHERE ce.student_id = $1 AND ce.is_active = true AND l.id = $2 AND c.id = $3
        ORDER BY cl.due_date DESC NULLS LAST, l.created_at DESC LIMIT 1`,
        [...params, classroomId]
      );
      if (classroomResult.rows[0]) {
        return classroomResult.rows[0];
      }
    }

    const result = await db.query(
      `SELECT
         l.id,
         l.title,
         l.subject,
         l.form_level,
         l.difficulty,
         l.estimated_minutes,
         l.content,
         l.created_at,
         NULL::uuid as classroom_id,
         NULL::text as classroom_name,
         NULL::timestamptz as due_date,
         false as is_required,
         (
           SELECT si.topic
           FROM lesson_syllabus_links lsl
           JOIN syllabus_items si ON si.id = lsl.syllabus_id
           WHERE lsl.lesson_id = l.id
           ORDER BY si.order_index
           LIMIT 1
         ) as topic,
         (
           SELECT si.subtopic
           FROM lesson_syllabus_links lsl
           JOIN syllabus_items si ON si.id = lsl.syllabus_id
           WHERE lsl.lesson_id = l.id
           ORDER BY si.order_index
           LIMIT 1
         ) as subtopic,
         (
           SELECT COUNT(*)::int FROM quiz_questions qq
           WHERE qq.lesson_id = l.id AND qq.is_active = true
         ) as question_count,
         jsonb_array_length(COALESCE(l.content->'blocks', '[]'::jsonb)) as content_block_count,
         COALESCE(p.completion_percentage, 0) as completion_percentage,
         COALESCE(p.score, 0) as score,
         COALESCE(p.is_completed, false) as is_completed
      FROM lessons l
      LEFT JOIN progress p ON p.lesson_id = l.id AND p.student_id = $1 AND p.classroom_id IS NULL
      WHERE l.is_active = true AND l.id = $2
      ORDER BY l.created_at DESC LIMIT 1`,
      params
    );
    return result.rows[0] || null;
  }

  if (user.role === 'teacher') {
    let query = `
      SELECT DISTINCT ${lessonFields},
             COUNT(DISTINCT ce.student_id) FILTER (WHERE ce.is_active = true) as student_count
      FROM lessons l
      LEFT JOIN classroom_lessons cl ON cl.lesson_id = l.id
        AND EXISTS (
          SELECT 1
          FROM classrooms teacher_classrooms
          WHERE teacher_classrooms.id = cl.classroom_id
            AND teacher_classrooms.teacher_id = $1
            AND teacher_classrooms.is_active = true
        )
      LEFT JOIN classrooms c ON c.id = cl.classroom_id AND c.is_active = true
      LEFT JOIN classroom_enrollments ce ON ce.classroom_id = c.id
      WHERE l.is_active = true AND l.id = $2
    `;
    if (classroomId) {
      query += ` AND c.id = $3`;
      params.push(classroomId);
    }
    query += ` GROUP BY l.id, c.id, cl.id ORDER BY cl.due_date DESC NULLS LAST LIMIT 1`;
    const result = await db.query(query, params);
    return result.rows[0] || null;
  }

  if (user.role === 'parent') {
    let query = `
      SELECT DISTINCT ${lessonFields},
             s.id as student_id,
             s.full_name as student_name,
             COALESCE(p.completion_percentage, 0) as completion_percentage,
             COALESCE(p.score, 0) as score,
             COALESCE(p.is_completed, false) as is_completed
      FROM parent_student_links psl
      JOIN users s ON s.id = psl.student_id
      JOIN classroom_enrollments ce ON ce.student_id = s.id AND ce.is_active = true
      JOIN classrooms c ON c.id = ce.classroom_id AND c.is_active = true
      JOIN classroom_lessons cl ON cl.classroom_id = c.id
      JOIN lessons l ON l.id = cl.lesson_id AND l.is_active = true
      LEFT JOIN progress p ON p.lesson_id = l.id AND p.student_id = s.id AND p.classroom_id = c.id
      WHERE psl.parent_id = $1 AND psl.is_active = true AND l.id = $2
    `;
    if (classroomId) {
      query += ` AND c.id = $3`;
      params.push(classroomId);
    }
    query += ` ORDER BY cl.due_date DESC NULLS LAST, l.created_at DESC LIMIT 1`;
    const result = await db.query(query, params);
    return result.rows[0] || null;
  }

  let adminQuery = `
    SELECT DISTINCT ${lessonFields}
    FROM lessons l
    LEFT JOIN classroom_lessons cl ON cl.lesson_id = l.id
    LEFT JOIN classrooms c ON c.id = cl.classroom_id
    WHERE l.is_active = true AND l.id = $2
  `;
  if (classroomId) {
    adminQuery += ` AND c.id = $3`;
    params.push(classroomId);
  }
  adminQuery += ` ORDER BY cl.due_date DESC NULLS LAST, l.created_at DESC LIMIT 1`;
  const result = await db.query(adminQuery, params);
  return result.rows[0] || null;
}

async function getAuthorableLesson(lessonId: string) {
  const lesson = await db.query(
    `SELECT l.*,
            (
              SELECT syllabus_id
              FROM lesson_syllabus_links
              WHERE lesson_id = l.id
              LIMIT 1
            ) as syllabus_id,
            (
              SELECT si.topic
              FROM lesson_syllabus_links lsl
              JOIN syllabus_items si ON si.id = lsl.syllabus_id
              WHERE lsl.lesson_id = l.id
              ORDER BY si.order_index
              LIMIT 1
            ) as topic,
            (
              SELECT si.subtopic
              FROM lesson_syllabus_links lsl
              JOIN syllabus_items si ON si.id = lsl.syllabus_id
              WHERE lsl.lesson_id = l.id
              ORDER BY si.order_index
              LIMIT 1
            ) as subtopic
     FROM lessons l
     WHERE l.id = $1 AND l.is_active = true`,
    [lessonId]
  );

  return lesson.rows[0] || null;
}

async function replaceLessonQuestions(client: PoolClient, lessonId: string, questions: any): Promise<void> {
  if (!Array.isArray(questions)) return;

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i] || {};
    const text = `${question.text ?? question.questionText ?? question.question_text ?? ''}`.trim();
    if (!text) continue;

    await client.query(
      `INSERT INTO quiz_questions (id, lesson_id, question_text, question_type, options, correct_answer, explanation, points, order_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        uuidv4(),
        lessonId,
        text,
        normalizeQuestionType(question.type ?? question.questionType ?? question.question_type),
        JSON.stringify(Array.isArray(question.options) ? question.options : []),
        JSON.stringify(question.correctAnswer ?? question.correct_answer ?? ''),
        question.explanation || null,
        Number(question.points || 1),
        i,
      ]
    );
  }
}

function normalizeContent(value: any, fallback: any = {}): Record<string, any> {
  let content: Record<string, any>;
  if (value === undefined || value === null) {
    content = typeof fallback === 'object' && fallback !== null ? { ...fallback } : {};
  } else if (typeof value === 'object' && !Array.isArray(value)) {
    content = { ...value };
  } else {
    content = { summary: `${value}` };
  }

  content.summary = `${content.summary ?? ''}`.trim();
  if (Array.isArray(content.blocks)) {
    content.blocks = content.blocks
      .filter((block: any) => block && typeof block === 'object')
      .map((block: any) => normalizeContentBlock(block));
  }

  return sanitizeLessonContent(content) as Record<string, any>;
}

function getLessonContentBlocks(content: any): any[] {
  const value = typeof content === 'string' ? parseJsonObject(content) : content;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  if (!Array.isArray(value.blocks)) return [];
  return value.blocks.filter((block: any) => block && typeof block === 'object');
}

function normalizeContentBlock(block: Record<string, any>) {
  const type = `${block.type ?? 'text'}`.trim().toLowerCase();
  const allowedTypes = new Set(['section', 'text', 'image', 'video', 'gif', 'embed']);
  const normalized = {
    ...block,
    type: allowedTypes.has(type) ? type : 'text',
    title: `${block.title ?? ''}`.trim(),
    body: `${block.body ?? block.text ?? ''}`.trim(),
  };

  if (normalized.type === 'embed') {
    return normalizeExternalVideoBlock(normalized);
  }

  return normalized;
}

function sanitizeLessonContent(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLessonContent(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.startsWith('on') ||
      ['html', 'innerhtml', 'dangerouslysetinnerhtml', 'script', 'style'].includes(normalizedKey)
    ) {
      continue;
    }
    result[key] = sanitizeLessonContent(nestedValue);
  }
  return result;
}

function sanitizeText(value: string) {
  return value
    .replace(/javascript\s*:/gi, '')
    .replace(/on[a-z]+\s*=/gi, '')
    .replace(/<\s*\/?\s*script/gi, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

function parseJsonObject(value: string): Record<string, any> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeDifficulty(value: any, fallback = 'medium'): string {
  const difficulty = `${value ?? fallback}`.trim();
  return ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : fallback;
}

function normalizeMinutes(value: any, fallback = 15): number {
  const minutes = Number(value ?? fallback);
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : fallback;
}

function normalizeQuestionType(value: any): string {
  const type = `${value ?? 'multiple_choice'}`.trim();
  return lessonQuestionTypes.has(type)
    ? type
    : 'multiple_choice';
}

function hasSubmittedAnswer(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function gradeLessonAnswer(
  userAnswer: any,
  correctAnswer: any,
  questionType: string,
  options: any,
  isAnswered: boolean,
) {
  if (!isAnswered) {
    return { isCorrect: false, scoreMultiplier: 0 };
  }

  const normalizedType = normalizeQuestionType(questionType);
  const normalizedOptions = Array.isArray(options) ? options : [];

  if (pairQuestionTypes.has(normalizedType)) {
    const expectedPairs = answerPairs(correctAnswer);
    const expected = pairsToMap(expectedPairs.length > 0 ? expectedPairs : answerPairs(normalizedOptions));
    const submitted = pairsToMap(answerPairs(userAnswer));
    if (expected.size === 0) {
      return { isCorrect: false, scoreMultiplier: 0 };
    }

    let correctPairs = 0;
    for (const [prompt, answer] of expected.entries()) {
      if (submitted.get(prompt) === answer) {
        correctPairs += 1;
      }
    }

    const scoreMultiplier = correctPairs / expected.size;
    return {
      isCorrect: correctPairs === expected.size,
      scoreMultiplier,
    };
  }

  const isCorrect = answersMatch(userAnswer, correctAnswer, normalizedType, normalizedOptions);
  return { isCorrect, scoreMultiplier: isCorrect ? 1 : 0 };
}

async function checkAndUpdateStreak(studentId: string) {
  await db.query(
    `INSERT INTO student_streaks (student_id, activity_date, streak_count)
     VALUES (
       $1,
       CURRENT_DATE,
       COALESCE((
         SELECT CASE
           WHEN activity_date = CURRENT_DATE - INTERVAL '1 day' THEN streak_count + 1
           ELSE 1
         END
         FROM student_streaks
         WHERE student_id = $1 AND activity_date < CURRENT_DATE
         ORDER BY activity_date DESC
         LIMIT 1
       ), 1)
     )
     ON CONFLICT (student_id, activity_date)
     DO UPDATE SET streak_count = GREATEST(student_streaks.streak_count, EXCLUDED.streak_count)`,
    [studentId],
  );
}

async function checkAndAwardAchievements(
  studentId: string,
  context: { score: number; perfect: boolean; streak: number },
) {
  const totalXp = await getTotalXp(studentId);
  const leaderboardRank = await getLeaderboardRank(studentId);
  const earned = ACHIEVEMENT_DEFINITIONS.filter((achievement) => {
    if (achievement.requirementType === 'streak_days') {
      return context.streak >= achievement.requirementValue;
    }
    if (achievement.requirementType === 'perfect_score') {
      return context.perfect || context.score >= achievement.requirementValue;
    }
    if (achievement.requirementType === 'xp_total') {
      return totalXp >= achievement.requirementValue;
    }
    if (achievement.requirementType === 'leaderboard_rank') {
      return leaderboardRank !== null && leaderboardRank <= achievement.requirementValue;
    }
    return false;
  });

  for (const achievement of earned) {
    await awardAchievement(studentId, achievement);
  }
}

async function getStudentStreak(studentId: string) {
  const result = await db.query(
    `SELECT activity_date, streak_count
     FROM student_streaks
     WHERE student_id = $1
     ORDER BY activity_date DESC
     LIMIT 1`,
    [studentId],
  );

  const row = result.rows[0];
  if (!row) return 0;

  const lastActive = new Date(row.activity_date);
  lastActive.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (lastActive.getTime() !== today.getTime() && lastActive.getTime() !== yesterday.getTime()) {
    return 0;
  }

  return Math.max(0, Number(row.streak_count || 0));
}

async function maybeDecrementStudentHeartsOnLessonFailure(
  studentId: string,
  score: number,
  isCompleted: boolean,
) {
  await regenerateStudentHearts(studentId);
  if (isCompleted || Number(score) >= LESSON_FAIL_SCORE_THRESHOLD) {
    return;
  }

  await db.query(
    `UPDATE student_hearts
     SET current_hearts = GREATEST(current_hearts - 1, 0),
         updated_at = NOW()
     WHERE student_id = $1`,
    [studentId],
  );
}

async function regenerateStudentHearts(studentId: string) {
  await db.query(
    `INSERT INTO student_hearts (student_id)
     VALUES ($1)
     ON CONFLICT (student_id) DO NOTHING`,
    [studentId],
  );

  const result = await db.query(
    `SELECT current_hearts, max_hearts, updated_at
     FROM student_hearts
     WHERE student_id = $1`,
    [studentId],
  );
  const row = result.rows[0];
  if (!row) return;

  const current = Number(row.current_hearts || 0);
  const maxHearts = Number(row.max_hearts || 0);
  if (current >= maxHearts || maxHearts <= 0) return;

  const updatedAt = new Date(row.updated_at || new Date()).getTime();
  if (!Number.isFinite(updatedAt)) return;

  const elapsedMinutes = Math.floor((Date.now() - updatedAt) / 60000);
  const restored = Math.floor(elapsedMinutes / HEART_REGENERATION_MINUTES);
  if (restored <= 0) return;

  await db.query(
    `UPDATE student_hearts
     SET current_hearts = LEAST(current_hearts + $2, max_hearts),
         updated_at = NOW()
     WHERE student_id = $1`,
    [studentId, restored],
  );
}

async function getTotalXp(studentId: string) {
  const result = await db.query(
    `SELECT COALESCE(SUM(amount), 0)::int AS total_xp
     FROM xp_events
     WHERE user_id = $1`,
    [studentId],
  );
  return Number(result.rows[0]?.total_xp || 0);
}

async function getLeaderboardRank(studentId: string) {
  const result = await db.query(
    `WITH ranked AS (
       SELECT u.id,
              DENSE_RANK() OVER (ORDER BY COALESCE(SUM(xe.amount), 0) DESC, u.id ASC) AS rank
       FROM users u
       LEFT JOIN xp_events xe ON xe.user_id = u.id
       WHERE u.role = 'student' AND u.is_active = true
       GROUP BY u.id
     )
     SELECT rank
     FROM ranked
     WHERE id = $1`,
    [studentId],
  );
  const rank = Number(result.rows[0]?.rank || 0);
  return rank > 0 ? rank : null;
}

async function awardAchievement(studentId: string, achievement: typeof ACHIEVEMENT_DEFINITIONS[number]) {
  const result = await db.query(
    `INSERT INTO achievements (id, code, name, description, requirement_type, requirement_value)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (code)
     DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       requirement_type = EXCLUDED.requirement_type,
       requirement_value = EXCLUDED.requirement_value
     RETURNING id`,
    [
      uuidv4(),
      achievement.code,
      achievement.name,
      achievement.description,
      achievement.requirementType,
      achievement.requirementValue,
    ],
  );

  const achievementId = result.rows[0]?.id;
  if (!achievementId) return;

  await db.query(
    `INSERT INTO user_achievements (id, user_id, achievement_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, achievement_id) DO NOTHING`,
    [uuidv4(), studentId, achievementId],
  );
}

export function answersMatch(
  userAnswer: any,
  correctAnswer: any,
  questionType: string,
  options: any = [],
): boolean {
  const normalizedType = normalizeQuestionType(questionType);
  const normalizedOptions = Array.isArray(options) ? options : [];

  if (normalizedType === 'numeric') {
    return numericAnswersMatch(userAnswer, correctAnswer);
  }

  if (normalizedType === 'step_order') {
    return orderedAnswersMatch(userAnswer, correctAnswer, options);
  }

  if (pairQuestionTypes.has(normalizedType)) {
    return pairAnswersMatch(userAnswer, correctAnswer, options);
  }

  if (normalizedType === 'fill_blank' || freeTextQuestionTypes.has(normalizedType)) {
    return textAnswersMatch(userAnswer, correctAnswer);
  }

  if (Array.isArray(correctAnswer)) {
    const correctValues = correctAnswer
      .map((item) => normalizeCorrectAnswerValue(item, normalizedOptions))
      .sort()
      .join('|');
    return (Array.isArray(userAnswer) ? userAnswer : [userAnswer])
      .map(normalizeValue)
      .sort()
      .join('|') === correctValues;
  }

  const normalizedUserAnswer = normalizeValue(userAnswer);
  return normalizedUserAnswer === normalizeCorrectAnswerValue(correctAnswer, normalizedOptions) ||
    normalizedUserAnswer === normalizeValue(correctAnswer);
}

function textAnswersMatch(userAnswer: any, correctAnswer: any): boolean {
  const submitted = normalizeValue(userAnswer);
  if (!submitted) return false;

  const accepted = Array.isArray(correctAnswer)
    ? correctAnswer
    : `${correctAnswer ?? ''}`.split('|');

  return accepted.some((answer) => normalizeValue(answer) === submitted);
}

function numericAnswersMatch(userAnswer: any, correctAnswer: any): boolean {
  const submitted = numericAnswerFrom(userAnswer);
  const expected = numericAnswerFrom(correctAnswer);
  if (!submitted || !expected) return false;

  const tolerance = expected.tolerance ??
    Math.max(0.000001, Math.abs(expected.value) * 0.005);
  const valueMatches = Math.abs(submitted.value - expected.value) <= tolerance;
  const unitMatches = !expected.unit || submitted.unit === expected.unit;

  return valueMatches && unitMatches;
}

function numericAnswerFrom(value: any): { value: number; tolerance?: number; unit: string } | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const rawValue = (value as any).value ?? (value as any).answer ?? (value as any).correctAnswer;
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) return null;

    const rawTolerance = (value as any).tolerance ?? (value as any).margin;
    const parsedTolerance = Number(rawTolerance);

    return {
      value: parsedValue,
      tolerance: Number.isFinite(parsedTolerance) && parsedTolerance >= 0 ? parsedTolerance : undefined,
      unit: normalizeUnit((value as any).unit),
    };
  }

  const text = `${value ?? ''}`.trim();
  const match = text.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
  if (!match) return null;

  const parsedValue = Number(match[0]);
  if (!Number.isFinite(parsedValue)) return null;

  return {
    value: parsedValue,
    unit: normalizeUnit(text.replace(match[0], '')),
  };
}

function orderedAnswersMatch(userAnswer: any, correctAnswer: any, options: any): boolean {
  const expected = orderedAnswerList(correctAnswer, options);
  const submitted = orderedAnswerList(userAnswer, options);

  if (expected.length === 0 || submitted.length !== expected.length) return false;
  return expected.every((item, index) => item === submitted[index]);
}

function orderedAnswerList(value: any, options: any): string[] {
  const optionLabels = optionLabelsFrom(options);
  const source = isBlankAnswer(value) ? optionLabels : listFromAnswer(value);

  return source
    .map((item) => normalizeOrderItem(item, optionLabels))
    .filter((item) => item.length > 0);
}

function optionLabelsFrom(options: any): string[] {
  if (!Array.isArray(options)) return [];

  return options
    .map((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return `${(item as any).step ?? (item as any).text ?? (item as any).label ?? (item as any).value ?? ''}`;
      }
      return `${item ?? ''}`;
    })
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function listFromAnswer(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const objectValue = value as any;
    if (Array.isArray(objectValue.order)) return objectValue.order;
    if (Array.isArray(objectValue.answers)) return objectValue.answers;
    if (Array.isArray(objectValue.value)) return objectValue.value;
  }

  return `${value ?? ''}`
    .split(/\r?\n|;|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeOrderItem(value: any, optionLabels: string[]): string {
  let raw = value;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    raw = (raw as any).step ?? (raw as any).text ?? (raw as any).label ?? (raw as any).value;
  }

  const index = optionIndex(raw, optionLabels.length);
  if (index !== null) {
    return normalizeValue(optionLabels[index]);
  }

  return normalizeValue(raw);
}

function pairAnswersMatch(userAnswer: any, correctAnswer: any, options: any): boolean {
  const expectedPairs = answerPairs(correctAnswer);
  const expected = pairsToMap(expectedPairs.length > 0 ? expectedPairs : answerPairs(options));
  const submitted = pairsToMap(answerPairs(userAnswer));

  if (expected.size === 0 || submitted.size !== expected.size) return false;

  for (const [prompt, answer] of expected.entries()) {
    if (submitted.get(prompt) !== answer) return false;
  }

  return true;
}

function answerPairs(value: any): Array<{ prompt: string; answer: string }> {
  if (Array.isArray(value)) {
    return value.flatMap((item) => answerPairs(item));
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, any>;

    if (Array.isArray(objectValue.pairs)) return answerPairs(objectValue.pairs);
    if (objectValue.prompt !== undefined || objectValue.answer !== undefined) {
      return [{
        prompt: normalizeValue(objectValue.prompt ?? objectValue.left ?? objectValue.label ?? objectValue.term),
        answer: normalizeValue(objectValue.answer ?? objectValue.right ?? objectValue.value ?? objectValue.match),
      }].filter((pair) => pair.prompt.length > 0 && pair.answer.length > 0);
    }

    return Object.entries(objectValue)
      .map(([prompt, answer]) => ({
        prompt: normalizeValue(prompt),
        answer: normalizeValue(answer),
      }))
      .filter((pair) => pair.prompt.length > 0 && pair.answer.length > 0);
  }

  return `${value ?? ''}`
    .split(/\r?\n|;/)
    .map((item) => pairFromString(item))
    .filter((pair): pair is { prompt: string; answer: string } => pair !== null);
}

function pairFromString(value: string): { prompt: string; answer: string } | null {
  const parts = value.split(/\s*(?:=|->|:)\s*/);
  if (parts.length < 2) return null;

  const prompt = normalizeValue(parts[0]);
  const answer = normalizeValue(parts.slice(1).join('='));
  return prompt && answer ? { prompt, answer } : null;
}

function pairsToMap(pairs: Array<{ prompt: string; answer: string }>): Map<string, string> {
  return new Map(pairs.map((pair) => [pair.prompt, pair.answer]));
}

function normalizeCorrectAnswerValue(value: any, options: any[]): string {
  const index = optionIndex(value, options.length);
  if (index !== null) {
    return normalizeValue(options[index]);
  }
  return normalizeValue(value);
}

function optionIndex(value: any, optionCount: number): number | null {
  if (optionCount <= 0) return null;

  let raw: unknown = value;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    raw = (raw as any).optionIndex ?? (raw as any).option_index;
  }

  const text = `${raw ?? ''}`.trim();
  if (!/^\d+$/.test(text)) return null;

  const index = Number(text);
  return index >= 0 && index < optionCount ? index : null;
}

function normalizeValue(value: any): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `${value ?? ''}`.trim().toLowerCase();
}

function normalizeUnit(value: any): string {
  return `${value ?? ''}`.trim().toLowerCase().replace(/\s+/g, '');
}

function isBlankAnswer(value: any): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return `${value}`.trim().length === 0;
}
