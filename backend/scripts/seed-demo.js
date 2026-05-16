const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString =
  process.env.DATABASE_URL ||
  `postgres://${process.env.DB_USER || 'tusyen-online'}:${process.env.DB_PASSWORD || 'tusyen-online123'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'eduapp'}`;

const client = new Client({ connectionString });

async function queryOne(text, params) {
  const result = await client.query(text, params);
  return result.rows[0] || null;
}

async function ensureUser({ email, role, fullName, password = 'password123' }) {
  const existing = await queryOne('SELECT id, email, role, full_name FROM users WHERE email = $1', [email]);
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await queryOne(
    `INSERT INTO users (id, email, password_hash, role, full_name, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id, email, role, full_name`,
    [uuidv4(), email, passwordHash, role, fullName]
  );
  return created;
}

async function ensureParentLink(parentId, studentId) {
  const existing = await queryOne(
    'SELECT id FROM parent_student_links WHERE parent_id = $1 AND student_id = $2',
    [parentId, studentId]
  );
  if (existing) return existing.id;

  const created = await queryOne(
    `INSERT INTO parent_student_links (id, parent_id, student_id, is_active)
     VALUES ($1, $2, $3, true)
     RETURNING id`,
    [uuidv4(), parentId, studentId]
  );
  return created.id;
}

async function ensureSyllabusItem({ subject, formLevel, topic, subtopic, orderIndex, content, createdBy }) {
  const existing = await queryOne(
    `SELECT id FROM syllabus_items
     WHERE subject = $1 AND form_level = $2 AND topic = $3 AND COALESCE(subtopic, '') = COALESCE($4, '')`,
    [subject, formLevel, topic, subtopic || null]
  );
  if (existing) return existing.id;

  const created = await queryOne(
    `INSERT INTO syllabus_items (id, subject, form_level, topic, subtopic, order_index, content, created_by, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
     RETURNING id`,
    [uuidv4(), subject, formLevel, topic, subtopic || null, orderIndex, JSON.stringify(content || {}), createdBy]
  );
  return created.id;
}

async function ensureLesson({ title, subject, formLevel, difficulty, estimatedMinutes, content, createdBy, syllabusId }) {
  const existing = await queryOne('SELECT id FROM lessons WHERE title = $1', [title]);
  const lessonId = existing ? existing.id : (
    await queryOne(
      `INSERT INTO lessons (id, title, content, subject, form_level, difficulty, estimated_minutes, created_by, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       RETURNING id`,
      [uuidv4(), title, JSON.stringify(content || {}), subject, formLevel, difficulty || 'medium', estimatedMinutes || 15, createdBy]
    )
  ).id;

  const link = await queryOne(
    'SELECT lesson_id FROM lesson_syllabus_links WHERE lesson_id = $1 AND syllabus_id = $2',
    [lessonId, syllabusId]
  );
  if (!link) {
    await client.query('INSERT INTO lesson_syllabus_links (lesson_id, syllabus_id) VALUES ($1, $2)', [lessonId, syllabusId]);
  }

  return lessonId;
}

async function ensureQuizQuestions(lessonId, questions) {
  const existing = await client.query(
    'SELECT id, question_text FROM quiz_questions WHERE lesson_id = $1 AND is_active = true ORDER BY order_index ASC',
    [lessonId]
  );

  const existingTexts = new Set(existing.rows.map((row) => row.question_text));
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    if (existingTexts.has(question.text)) continue;

    await client.query(
      `INSERT INTO quiz_questions (id, lesson_id, question_text, question_type, options, correct_answer, explanation, points, order_index, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
      [
        uuidv4(),
        lessonId,
        question.text,
        question.type || 'multiple_choice',
        JSON.stringify(question.options || []),
        JSON.stringify(question.correctAnswer),
        question.explanation || null,
        question.points || 1,
        i,
      ]
    );
  }
}

async function ensureClassroom({ teacherId, name, description, subject, formLevel, joinCode, isPublic = false }) {
  const existing = await queryOne('SELECT id FROM classrooms WHERE teacher_id = $1 AND name = $2', [teacherId, name]);
  if (existing) return existing.id;

  const created = await queryOne(
    `INSERT INTO classrooms (id, teacher_id, name, description, subject, form_level, join_code, is_public, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
     RETURNING id`,
    [uuidv4(), teacherId, name, description || null, subject, formLevel, joinCode, isPublic]
  );
  return created.id;
}

async function ensureEnrollment(studentId, classroomId) {
  const existing = await queryOne(
    'SELECT id FROM classroom_enrollments WHERE student_id = $1 AND classroom_id = $2',
    [studentId, classroomId]
  );
  if (existing) {
    await client.query(
      'UPDATE classroom_enrollments SET is_active = true, joined_at = COALESCE(joined_at, NOW()) WHERE id = $1',
      [existing.id]
    );
    return existing.id;
  }

  const created = await queryOne(
    `INSERT INTO classroom_enrollments (id, student_id, classroom_id, is_active)
     VALUES ($1, $2, $3, true)
     RETURNING id`,
    [uuidv4(), studentId, classroomId]
  );
  return created.id;
}

async function ensureAssignment(classroomId, lessonId, assignedBy, dueDate) {
  const existing = await queryOne(
    'SELECT id FROM classroom_lessons WHERE classroom_id = $1 AND lesson_id = $2',
    [classroomId, lessonId]
  );
  if (existing) return existing.id;

  const created = await queryOne(
    `INSERT INTO classroom_lessons (id, classroom_id, lesson_id, assigned_by, due_date, is_required)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id`,
    [uuidv4(), classroomId, lessonId, assignedBy, dueDate || null]
  );
  return created.id;
}

async function ensurePost({ classroomId, authorId, postType, title, content, isPinned = false }) {
  const existing = await queryOne(
    'SELECT id FROM posts WHERE classroom_id = $1 AND COALESCE(title, \'\') = COALESCE($2, \'\') AND content = $3',
    [classroomId, title || null, content]
  );
  if (existing) return existing.id;

  const created = await queryOne(
    `INSERT INTO posts (id, classroom_id, author_id, post_type, title, content, is_pinned, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)
     RETURNING id`,
    [uuidv4(), classroomId, authorId, postType || 'announcement', title || null, content, isPinned]
  );
  return created.id;
}

async function ensureTeacherProfile({ teacherId, headline, bio, specialties, credentials, yearsExperience, location, links }) {
  await client.query(
    `INSERT INTO teacher_profiles
       (teacher_id, headline, bio, specialties, credentials, years_experience, location, links)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (teacher_id)
     DO UPDATE SET headline = EXCLUDED.headline,
                   bio = EXCLUDED.bio,
                   specialties = EXCLUDED.specialties,
                   credentials = EXCLUDED.credentials,
                   years_experience = EXCLUDED.years_experience,
                   location = EXCLUDED.location,
                   links = EXCLUDED.links,
                   updated_at = NOW()`,
    [
      teacherId,
      headline || null,
      bio || null,
      specialties || [],
      credentials || null,
      yearsExperience || 0,
      location || null,
      JSON.stringify(links || {}),
    ]
  );
}

async function ensurePostReaction({ postId, userId, reactionType = 'like' }) {
  await client.query(
    `INSERT INTO post_reactions (id, post_id, user_id, reaction_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (post_id, user_id)
     DO UPDATE SET reaction_type = EXCLUDED.reaction_type,
                   created_at = NOW()`,
    [uuidv4(), postId, userId, reactionType]
  );
}

async function ensurePostComment({ postId, userId, content }) {
  const existing = await queryOne(
    'SELECT id FROM post_comments WHERE post_id = $1 AND user_id = $2 AND content = $3 AND is_deleted = false',
    [postId, userId, content]
  );
  if (existing) return existing.id;

  const created = await queryOne(
    `INSERT INTO post_comments (id, post_id, user_id, content, is_deleted)
     VALUES ($1, $2, $3, $4, false)
     RETURNING id`,
    [uuidv4(), postId, userId, content]
  );
  return created.id;
}

async function ensureWhiteboardSession({ classroomId, teacherId, title, description, status = 'active' }) {
  const existing = await queryOne(
    'SELECT id FROM whiteboard_sessions WHERE classroom_id = $1 AND title = $2 AND status = $3',
    [classroomId, title, status]
  );
  if (existing) return existing.id;

  const created = await queryOne(
    `INSERT INTO whiteboard_sessions (id, classroom_id, teacher_id, title, description, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [uuidv4(), classroomId, teacherId, title, description || null, status]
  );
  return created.id;
}

async function ensureQuizDeck({ teacherId, title, description, subject, formLevel, questions }) {
  const existing = await queryOne(
    'SELECT id FROM quiz_decks WHERE teacher_id = $1 AND title = $2 AND is_active = true',
    [teacherId, title]
  );

  const deckId = existing ? existing.id : uuidv4();

  if (!existing) {
    await client.query(
      `INSERT INTO quiz_decks (id, teacher_id, title, description, subject, form_level, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [deckId, teacherId, title, description || null, subject, formLevel]
    );
  }

  const existingQuestions = await client.query(
    'SELECT id, question_text FROM quiz_deck_questions WHERE deck_id = $1 AND is_active = true ORDER BY order_index ASC',
    [deckId]
  );

  const existingTexts = new Set(existingQuestions.rows.map((row) => row.question_text));
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    if (existingTexts.has(question.questionText)) continue;

    await client.query(
      `INSERT INTO quiz_deck_questions
         (id, deck_id, question_text, question_type, options, correct_answer, explanation, points, time_limit_seconds, order_index, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)`,
      [
        uuidv4(),
        deckId,
        question.questionText,
        question.questionType,
        JSON.stringify(question.options),
        JSON.stringify(question.correctAnswer),
        question.explanation || null,
        question.points || 1000,
        question.timeLimitSeconds || 20,
        i,
      ]
    );
  }

  return deckId;
}

async function ensureQuizSession({ deckId, classroomId, teacherId, pin, status = 'ended', currentQuestionIndex = 1, leaderboardSnapshot = [] }) {
  const existing = await queryOne(
    'SELECT id FROM quiz_sessions WHERE classroom_id = $1 AND pin = $2',
    [classroomId, pin]
  );

  if (existing) return existing.id;

  const created = await queryOne(
    `INSERT INTO quiz_sessions
       (id, deck_id, classroom_id, teacher_id, pin, status, current_question_index, started_at, question_started_at, question_ends_at, ended_at, leaderboard_snapshot)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW() - INTERVAL '4 seconds', NOW() + INTERVAL '8 seconds', NOW(), $8)
     RETURNING id`,
    [uuidv4(), deckId, classroomId, teacherId, pin, status, currentQuestionIndex, JSON.stringify(leaderboardSnapshot)]
  );

  return created.id;
}

async function ensureQuizParticipant({ sessionId, userId, displayName, totalScore, correctCount, answeredCount, xpAwarded, joinToken, isGuest = false }) {
  const existing = await queryOne(
    'SELECT id FROM quiz_session_participants WHERE session_id = $1 AND user_id = $2',
    [sessionId, userId]
  );

  if (existing) return existing.id;

  const created = await queryOne(
    `INSERT INTO quiz_session_participants
       (id, session_id, user_id, guest_name, display_name, is_guest, join_token, total_score, correct_count, answered_count, xp_awarded, is_connected, left_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, NOW())
     RETURNING id`,
    [uuidv4(), sessionId, userId, isGuest ? displayName : null, displayName, isGuest, joinToken, totalScore, correctCount, answeredCount, xpAwarded]
  );

  return created.id;
}

async function ensureQuizAnswer({ sessionId, participantId, questionId, selectedAnswer, isCorrect, responseTimeMs, pointsAwarded }) {
  const existing = await queryOne(
    'SELECT id FROM quiz_session_answers WHERE participant_id = $1 AND question_id = $2',
    [participantId, questionId]
  );
  if (existing) return existing.id;

  const created = await queryOne(
    `INSERT INTO quiz_session_answers
       (id, session_id, participant_id, question_id, selected_answer, is_correct, response_time_ms, points_awarded)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [uuidv4(), sessionId, participantId, questionId, JSON.stringify(selectedAnswer), isCorrect, responseTimeMs, pointsAwarded]
  );

  return created.id;
}

async function ensureQuizXpEvent({ userId, sourceId, amount, metadata }) {
  const existing = await queryOne(
    'SELECT id FROM xp_events WHERE user_id = $1 AND source_type = $2 AND source_id = $3',
    [userId, 'quiz_session', sourceId]
  );
  if (existing) return existing.id;

  const created = await queryOne(
    `INSERT INTO xp_events (id, user_id, source_type, source_id, amount, metadata)
     VALUES ($1, $2, 'quiz_session', $3, $4, $5)
     RETURNING id`,
    [uuidv4(), userId, sourceId, amount, JSON.stringify(metadata || {})]
  );

  return created.id;
}

async function upsertProgress({ studentId, lessonId, classroomId, score, timeSpentSeconds, completionPercentage, answers, attempts, isCompleted }) {
  await client.query(
    `INSERT INTO progress (id, student_id, lesson_id, classroom_id, score, time_spent_seconds, completion_percentage, answers, attempts, is_completed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (student_id, lesson_id, classroom_id)
     DO UPDATE SET
       score = EXCLUDED.score,
       time_spent_seconds = EXCLUDED.time_spent_seconds,
       completion_percentage = EXCLUDED.completion_percentage,
       answers = EXCLUDED.answers,
       attempts = EXCLUDED.attempts,
       is_completed = EXCLUDED.is_completed,
       updated_at = NOW()`,
    [
      uuidv4(),
      studentId,
      lessonId,
      classroomId,
      score,
      timeSpentSeconds,
      completionPercentage,
      JSON.stringify(answers || {}),
      attempts || 1,
      Boolean(isCompleted),
    ]
  );
}

async function ensureStreak(studentId, isoDate, streakCount) {
  await client.query(
    `INSERT INTO student_streaks (id, student_id, activity_date, streak_count)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (student_id, activity_date)
     DO UPDATE SET streak_count = EXCLUDED.streak_count`,
    [uuidv4(), studentId, isoDate, streakCount]
  );
}

async function main() {
  await client.connect();
  await client.query('BEGIN');

  try {
    const student = await ensureUser({ email: 'student@tusyen.test', role: 'student', fullName: 'Demo Student' });
    const teacher = await ensureUser({ email: 'teacher@tusyen.test', role: 'teacher', fullName: 'Demo Teacher' });
    const parent = await ensureUser({ email: 'parent@tusyen.test', role: 'parent', fullName: 'Demo Parent' });
    const admin = await ensureUser({ email: 'admin@tusyen.test', role: 'admin', fullName: 'Demo Admin' });

    await ensureParentLink(parent.id, student.id);
    await ensureTeacherProfile({
      teacherId: teacher.id,
      headline: 'Form 4 and Form 5 KSSM revision coach',
      bio: 'I turn heavy syllabus topics into quick practice loops: one clear idea, one classroom prompt, one quiz check. My classes focus on confidence, exam habits, and steady daily momentum.',
      specialties: ['Mathematics', 'Science', 'KSSM Form 4', 'KSSM Form 5', 'Exam drills'],
      credentials: '8 years teaching secondary students, classroom-based revision and online coaching.',
      yearsExperience: 8,
      location: 'Kuala Lumpur, Malaysia',
      links: { classroom: 'https://tusyen.local/demo-teacher' },
    });

    const syllabusItems = [];
    syllabusItems.push(await ensureSyllabusItem({
      subject: 'Mathematics',
      formLevel: 4,
      topic: 'Linear Functions',
      subtopic: 'Gradient and intercept',
      orderIndex: 1,
      content: { summary: 'Read and graph linear equations from slope-intercept form.' },
      createdBy: admin.id,
    }));
    syllabusItems.push(await ensureSyllabusItem({
      subject: 'Science',
      formLevel: 4,
      topic: 'Cell Division',
      subtopic: 'Mitosis stages',
      orderIndex: 2,
      content: { summary: 'Understand the sequence and purpose of mitosis in living things.' },
      createdBy: admin.id,
    }));
    syllabusItems.push(await ensureSyllabusItem({
      subject: 'English',
      formLevel: 5,
      topic: 'Directed Writing',
      subtopic: 'Formal email structure',
      orderIndex: 3,
      content: { summary: 'Structure concise formal responses for exam-style prompts.' },
      createdBy: admin.id,
    }));
    syllabusItems.push(await ensureSyllabusItem({
      subject: 'Sejarah',
      formLevel: 5,
      topic: 'Nationalism in Malaysia',
      subtopic: 'Key movements and leaders',
      orderIndex: 4,
      content: { summary: 'Track the major nationalism milestones that shaped independence.' },
      createdBy: admin.id,
    }));

    const mathLessonId = await ensureLesson({
      title: 'Plotting Linear Functions',
      subject: 'Mathematics',
      formLevel: 4,
      difficulty: 'medium',
      estimatedMinutes: 18,
      content: { summary: 'Convert equations into lines and read their meaning from graphs.' },
      createdBy: admin.id,
      syllabusId: syllabusItems[0],
    });
    const scienceLessonId = await ensureLesson({
      title: 'Mitosis in Action',
      subject: 'Science',
      formLevel: 4,
      difficulty: 'easy',
      estimatedMinutes: 16,
      content: { summary: 'Follow how a cell splits and why each stage matters.' },
      createdBy: admin.id,
      syllabusId: syllabusItems[1],
    });
    const englishLessonId = await ensureLesson({
      title: 'Formal Email Drill',
      subject: 'English',
      formLevel: 5,
      difficulty: 'medium',
      estimatedMinutes: 20,
      content: { summary: 'Practice tone, structure, and key points for exam writing tasks.' },
      createdBy: admin.id,
      syllabusId: syllabusItems[2],
    });
    const sejarahLessonId = await ensureLesson({
      title: 'Nationalism Milestones',
      subject: 'Sejarah',
      formLevel: 5,
      difficulty: 'hard',
      estimatedMinutes: 22,
      content: { summary: 'Review people, events, and causes across the independence timeline.' },
      createdBy: admin.id,
      syllabusId: syllabusItems[3],
    });

    await ensureQuizQuestions(mathLessonId, [
      {
        text: 'What is the gradient of y = 2x + 3?',
        options: ['2', '3', '5', '1'],
        correctAnswer: '2',
        explanation: 'The gradient is the coefficient of x.',
      },
      {
        text: 'Which point lies on the line y = 2x + 3?',
        options: ['(1, 5)', '(1, 4)', '(2, 8)', '(0, 2)'],
        correctAnswer: '(1, 5)',
      },
      {
        text: 'Match each representation of the same linear function.',
        type: 'representation_match',
        options: [
          { prompt: 'y = 2x + 3', answer: 'Gradient 2, y-intercept 3' },
          { prompt: 'x = 1 gives y = 5', answer: 'Point (1, 5)' },
        ],
        correctAnswer: {
          'y = 2x + 3': 'Gradient 2, y-intercept 3',
          'x = 1 gives y = 5': 'Point (1, 5)',
        },
        explanation: 'Equations, points, and graph features describe the same line in different forms.',
      },
      {
        text: 'Put the steps for solving y = 2x + 3 when y = 11 in order.',
        type: 'step_order',
        options: ['Substitute 11 for y', 'Subtract 3 from both sides', 'Divide both sides by 2'],
        correctAnswer: ['Substitute 11 for y', 'Subtract 3 from both sides', 'Divide both sides by 2'],
        explanation: 'Keep inverse operations in the right sequence.',
      },
      {
        text: 'If x = 4, what is y for y = 2x + 3?',
        type: 'numeric',
        options: [],
        correctAnswer: { value: 11, tolerance: 0 },
        explanation: '2(4) + 3 = 11.',
      },
    ]);

    await ensureQuizQuestions(scienceLessonId, [
      {
        text: 'Which stage of mitosis lines chromosomes up in the middle of the cell?',
        options: ['Prophase', 'Metaphase', 'Anaphase', 'Telophase'],
        correctAnswer: 'Metaphase',
      },
      {
        text: 'Mitosis produces two identical daughter cells.',
        type: 'true_false',
        options: ['True', 'False'],
        correctAnswer: 'True',
      },
      {
        text: 'Match the mitosis stage to its main event.',
        type: 'diagram_label',
        options: [
          { prompt: 'Metaphase', answer: 'Chromosomes line up in the middle' },
          { prompt: 'Anaphase', answer: 'Chromatids separate' },
        ],
        correctAnswer: {
          Metaphase: 'Chromosomes line up in the middle',
          Anaphase: 'Chromatids separate',
        },
      },
      {
        text: 'A student says mitosis creates four different cells. What is the mistake?',
        type: 'error_diagnosis',
        options: [],
        correctAnswer: 'Mitosis creates two identical daughter cells',
        explanation: 'Four genetically different cells are associated with meiosis, not mitosis.',
      },
    ]);

    await ensureQuizQuestions(englishLessonId, [
      {
        text: 'Which opening is most suitable for a formal email?',
        options: ['Hey there,', 'Dear Sir or Madam,', 'Yo team,', 'Hi bestie,'],
        correctAnswer: 'Dear Sir or Madam,',
      },
      {
        text: 'Formal emails should avoid slang.',
        type: 'true_false',
        options: ['True', 'False'],
        correctAnswer: 'True',
      },
    ]);

    await ensureQuizQuestions(sejarahLessonId, [
      {
        text: 'Which topic is closely linked to early Malaysian nationalism?',
        options: ['Independence movements', 'Photosynthesis', 'Quadratic graphs', 'Cell membranes'],
        correctAnswer: 'Independence movements',
      },
      {
        text: 'Nationalism in Malaysia was shaped by both local and regional influences.',
        type: 'true_false',
        options: ['True', 'False'],
        correctAnswer: 'True',
      },
    ]);

    const mathClassId = await ensureClassroom({
      teacherId: teacher.id,
      name: 'Form 4 Maths Boost',
      description: 'Revision-focused class for algebra and graphing.',
      subject: 'Mathematics',
      formLevel: 4,
      joinCode: 'MATH42',
    });
    const scienceClassId = await ensureClassroom({
      teacherId: teacher.id,
      name: 'Form 4 Science Lab',
      description: 'Short concept refreshers and science challenge prompts.',
      subject: 'Science',
      formLevel: 4,
      joinCode: 'SCI442',
    });
    const englishClassId = await ensureClassroom({
      teacherId: teacher.id,
      name: 'Form 5 English Sprint',
      description: 'Writing and speaking drills with quick feedback.',
      subject: 'English',
      formLevel: 5,
      joinCode: 'ENG552',
    });

    await ensureEnrollment(student.id, mathClassId);
    await ensureEnrollment(student.id, scienceClassId);
    await ensureEnrollment(student.id, englishClassId);

    await ensureAssignment(mathClassId, mathLessonId, teacher.id, '2026-05-20T10:00:00Z');
    await ensureAssignment(scienceClassId, scienceLessonId, teacher.id, '2026-05-21T10:00:00Z');
    await ensureAssignment(englishClassId, englishLessonId, teacher.id, '2026-05-22T10:00:00Z');
    await ensureAssignment(englishClassId, sejarahLessonId, teacher.id, '2026-05-24T10:00:00Z');

    const mathPostId = await ensurePost({
      classroomId: mathClassId,
      authorId: teacher.id,
      postType: 'announcement',
      title: 'Warm-up graph challenge',
      content: 'Before tomorrow, plot the line y = 2x + 3 and bring one question about gradient.',
      isPinned: true,
    });
    const sciencePostId = await ensurePost({
      classroomId: scienceClassId,
      authorId: teacher.id,
      postType: 'general',
      title: 'Mitosis recap card',
      content: 'I uploaded a quick recap card. Review each stage and come ready for a speed quiz.',
    });
    const englishPostId = await ensurePost({
      classroomId: englishClassId,
      authorId: teacher.id,
      postType: 'assignment',
      title: 'Formal email practice',
      content: 'Draft a formal email reply using the prompt from lesson 3. Keep it under 120 words.',
    });

    await ensurePostReaction({ postId: mathPostId, userId: student.id, reactionType: 'like' });
    await ensurePostReaction({ postId: sciencePostId, userId: student.id, reactionType: 'insightful' });
    await ensurePostComment({
      postId: mathPostId,
      userId: student.id,
      content: 'I plotted it and I think my question is about why the intercept starts at 3.',
    });
    await ensurePostComment({
      postId: sciencePostId,
      userId: student.id,
      content: 'Can we do one more example for metaphase vs anaphase?',
    });
    await ensurePostComment({
      postId: englishPostId,
      userId: student.id,
      content: 'Submitted my draft. I kept it under 120 words.',
    });

    await ensureWhiteboardSession({
      classroomId: mathClassId,
      teacherId: teacher.id,
      title: 'Live graph walkthrough',
      description: 'We are breaking down slope and intercept together.',
      status: 'active',
    });

    const quizDeckId = await ensureQuizDeck({
      teacherId: teacher.id,
      title: 'Math Speed Round',
      description: 'A quick live quiz for gradient and graph reading.',
      subject: 'Mathematics',
      formLevel: 4,
      questions: [
        {
          questionText: 'What is the gradient of y = 2x + 3?',
          questionType: 'multiple_choice',
          options: ['2', '3', '5', '1'],
          correctAnswer: { optionIndex: 0 },
          explanation: 'The coefficient of x gives the gradient.',
          points: 1000,
          timeLimitSeconds: 15,
        },
        {
          questionText: 'A positive gradient rises from left to right.',
          questionType: 'true_false',
          options: ['True', 'False'],
          correctAnswer: { optionIndex: 0 },
          explanation: 'Positive gradient means the line slopes upward as x increases.',
          points: 800,
          timeLimitSeconds: 10,
        },
      ],
    });

    const quizQuestions = await client.query(
      'SELECT id, question_text FROM quiz_deck_questions WHERE deck_id = $1 AND is_active = true ORDER BY order_index ASC',
      [quizDeckId]
    );
    const quizSessionId = await ensureQuizSession({
      deckId: quizDeckId,
      classroomId: mathClassId,
      teacherId: teacher.id,
      pin: '482911',
      status: 'ended',
      currentQuestionIndex: 1,
      leaderboardSnapshot: [
        {
          rank: 1,
          participantId: 'demo-participant',
          displayName: 'Demo Student',
          totalScore: 1725,
          correctCount: 2,
          answeredCount: 2,
          isGuest: false,
          userId: student.id,
        },
      ],
    });

    const participantId = await ensureQuizParticipant({
      sessionId: quizSessionId,
      userId: student.id,
      displayName: 'Demo Student',
      totalScore: 1725,
      correctCount: 2,
      answeredCount: 2,
      xpAwarded: 1725,
      joinToken: 'demo-quiz-token',
      isGuest: false,
    });

    if (quizQuestions.rows.length >= 2) {
      await ensureQuizAnswer({
        sessionId: quizSessionId,
        participantId,
        questionId: quizQuestions.rows[0].id,
        selectedAnswer: { optionIndex: 0 },
        isCorrect: true,
        responseTimeMs: 4200,
        pointsAwarded: 920,
      });

      await ensureQuizAnswer({
        sessionId: quizSessionId,
        participantId,
        questionId: quizQuestions.rows[1].id,
        selectedAnswer: { optionIndex: 0 },
        isCorrect: true,
        responseTimeMs: 6100,
        pointsAwarded: 805,
      });
    }

    await ensureQuizXpEvent({
      userId: student.id,
      sourceId: quizSessionId,
      amount: 1725,
      metadata: {
        sessionId: quizSessionId,
        deckId: quizDeckId,
        classroomId: mathClassId,
        participantId,
      },
    });

    await upsertProgress({
      studentId: student.id,
      lessonId: mathLessonId,
      classroomId: mathClassId,
      score: 82,
      timeSpentSeconds: 940,
      completionPercentage: 100,
      answers: { correct: 8, total: 10 },
      attempts: 1,
      isCompleted: true,
    });
    await upsertProgress({
      studentId: student.id,
      lessonId: scienceLessonId,
      classroomId: scienceClassId,
      score: 74,
      timeSpentSeconds: 680,
      completionPercentage: 85,
      answers: { correct: 7, total: 10 },
      attempts: 2,
      isCompleted: false,
    });
    await upsertProgress({
      studentId: student.id,
      lessonId: englishLessonId,
      classroomId: englishClassId,
      score: 91,
      timeSpentSeconds: 1080,
      completionPercentage: 100,
      answers: { correct: 9, total: 10 },
      attempts: 1,
      isCompleted: true,
    });

    await ensureStreak(student.id, '2026-05-08', 1);
    await ensureStreak(student.id, '2026-05-09', 2);
    await ensureStreak(student.id, '2026-05-10', 3);

    await client.query('COMMIT');

    const summary = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM syllabus_items) as syllabus_items,
        (SELECT COUNT(*) FROM lessons) as lessons,
        (SELECT COUNT(*) FROM classrooms WHERE is_active = true) as classrooms,
        (SELECT COUNT(*) FROM classroom_enrollments WHERE is_active = true) as enrollments,
        (SELECT COUNT(*) FROM posts WHERE is_active = true) as posts,
        (SELECT COUNT(*) FROM teacher_profiles) as teacher_profiles,
        (SELECT COUNT(*) FROM post_comments WHERE is_deleted = false) as post_comments,
        (SELECT COUNT(*) FROM post_reactions) as post_reactions,
        (SELECT COUNT(*) FROM progress) as progress_rows,
        (SELECT COUNT(*) FROM whiteboard_sessions) as whiteboard_sessions,
        (SELECT COUNT(*) FROM parent_student_links WHERE is_active = true) as parent_links,
        (SELECT COUNT(*) FROM quiz_decks WHERE is_active = true) as quiz_decks,
        (SELECT COUNT(*) FROM quiz_sessions) as quiz_sessions,
        (SELECT COUNT(*) FROM xp_events WHERE source_type = 'quiz_session') as quiz_xp_events
    `);

    console.log('Demo seed complete.');
    console.table(summary.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Demo seed failed.');
  console.error(error);
  process.exit(1);
});
