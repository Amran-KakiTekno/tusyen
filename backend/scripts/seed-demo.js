const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString =
  process.env.DATABASE_URL ||
  databaseUrlFromParts();

const client = new Client({ connectionString });

async function queryOne(text, params) {
  const result = await client.query(text, params);
  return result.rows[0] || null;
}

async function ensureUser({ email, role, fullName, password = 'password123' }) {
  const existing = await queryOne('SELECT id, email, role, full_name FROM users WHERE email = $1', [email]);
  if (existing) {
    if (existing.full_name !== fullName) {
      return queryOne(
        'UPDATE users SET full_name = $2 WHERE email = $1 RETURNING id, email, role, full_name',
        [email, fullName]
      );
    }
    return existing;
  }

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
  if (existing) {
    const updated = await queryOne(
      `UPDATE syllabus_items
       SET order_index = $2,
           content = $3,
           created_by = $4,
           is_active = true,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [existing.id, orderIndex, JSON.stringify(content || {}), createdBy]
    );
    return updated.id;
  }

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
  const lessonId = existing ? (
    await queryOne(
      `UPDATE lessons
       SET content = $2,
           subject = $3,
           form_level = $4,
           difficulty = $5,
           estimated_minutes = $6,
           created_by = $7,
           is_active = true,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [
        existing.id,
        JSON.stringify(content || {}),
        subject,
        formLevel,
        difficulty || 'medium',
        estimatedMinutes || 15,
        createdBy,
      ]
    )
  ).id : (
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
    'SELECT id, question_text, order_index FROM quiz_questions WHERE lesson_id = $1 AND is_active = true ORDER BY order_index ASC',
    [lessonId]
  );

  const existingByOrder = new Map(existing.rows.map((row) => [row.order_index, row]));
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const existingQuestion = existingByOrder.get(i);

    if (existingQuestion) {
      await client.query(
        `UPDATE quiz_questions
         SET question_text = $2,
             question_type = $3,
             options = $4,
             correct_answer = $5,
             explanation = $6,
             points = $7,
             order_index = $8,
             is_active = true
         WHERE id = $1`,
        [
          existingQuestion.id,
          question.text,
          question.type || 'multiple_choice',
          JSON.stringify(question.options || []),
          JSON.stringify(question.correctAnswer),
          question.explanation || null,
          question.points || 1,
          i,
        ]
      );
    } else {
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

  await client.query(
    'UPDATE quiz_questions SET is_active = false WHERE lesson_id = $1 AND order_index >= $2',
    [lessonId, questions.length]
  );
}

async function ensureClassroom({ teacherId, name, description, subject, formLevel, joinCode, isPublic = false }) {
  const existing = await queryOne('SELECT id FROM classrooms WHERE teacher_id = $1 AND name = $2', [teacherId, name]);
  if (existing) {
    const updated = await queryOne(
      `UPDATE classrooms
       SET description = $2,
           subject = $3,
           form_level = $4,
           join_code = $5,
           is_public = $6,
           is_active = true,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [existing.id, description || null, subject, formLevel, joinCode, isPublic]
    );
    return updated.id;
  }

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
    'SELECT id FROM posts WHERE classroom_id = $1 AND COALESCE(title, \'\') = COALESCE($2, \'\') AND is_active = true',
    [classroomId, title || null]
  );
  if (existing) {
    const updated = await queryOne(
      `UPDATE posts
       SET author_id = $2,
           post_type = $3,
           content = $4,
           is_pinned = $5,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [existing.id, authorId, postType || 'announcement', content, isPinned]
    );
    return updated.id;
  }

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
  if (existing) {
    const updated = await queryOne(
      `UPDATE whiteboard_sessions
       SET teacher_id = $2,
           description = $3
       WHERE id = $1
       RETURNING id`,
      [existing.id, teacherId, description || null]
    );
    return updated.id;
  }

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
  } else {
    await client.query(
      `UPDATE quiz_decks
       SET description = $2,
           subject = $3,
           form_level = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [deckId, description || null, subject, formLevel]
    );
  }

  const existingQuestions = await client.query(
    'SELECT id, question_text, order_index FROM quiz_deck_questions WHERE deck_id = $1 AND is_active = true ORDER BY order_index ASC',
    [deckId]
  );

  const existingByOrder = new Map(existingQuestions.rows.map((row) => [row.order_index, row]));
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const existingQuestion = existingByOrder.get(i);

    if (existingQuestion) {
      await client.query(
        `UPDATE quiz_deck_questions
         SET question_text = $2,
             question_type = $3,
             options = $4,
             correct_answer = $5,
             explanation = $6,
             points = $7,
             time_limit_seconds = $8,
             order_index = $9,
             is_active = true
         WHERE id = $1`,
        [
          existingQuestion.id,
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
    } else {
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
  }

  await client.query(
    'UPDATE quiz_deck_questions SET is_active = false WHERE deck_id = $1 AND order_index >= $2',
    [deckId, questions.length]
  );

  return deckId;
}

async function ensureQuizSession({ deckId, classroomId, teacherId, pin, status = 'ended', currentQuestionIndex = 1, leaderboardSnapshot = [] }) {
  const existing = await queryOne(
    'SELECT id FROM quiz_sessions WHERE classroom_id = $1 AND pin = $2',
    [classroomId, pin]
  );

  if (existing) {
    await client.query(
      'UPDATE quiz_sessions SET leaderboard_snapshot = $2 WHERE id = $1',
      [existing.id, JSON.stringify(leaderboardSnapshot)]
    );
    return existing.id;
  }

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

  if (existing) {
    await client.query(
      'UPDATE quiz_session_participants SET guest_name = $2, display_name = $3, join_token = $4 WHERE id = $1',
      [existing.id, isGuest ? displayName : null, displayName, joinToken]
    );
    return existing.id;
  }

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

async function updateExactValue(table, column, from, to) {
  await client.query(
    `UPDATE ${table} SET ${column} = $2 WHERE ${column} = $1`,
    [from, to]
  );
}

function visibleRunSuffix(source) {
  const parts = String(source || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const randomPart = parts.length > 0 ? parts[parts.length - 1] : 'run';
  const timestampPart = [...parts].reverse().find((part) => /^\d{10,}$/.test(part));
  const timePart = timestampPart ? Math.trunc(Number(timestampPart)).toString(36).slice(-2) : '';
  return `${timePart}${randomPart}`.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() || 'RUN';
}

function withShortSuffix(label, source) {
  return `${label} ${visibleRunSuffix(source)}`;
}

function renameAttachments(attachments, name) {
  if (!Array.isArray(attachments)) return attachments || [];
  return attachments.map((attachment) => {
    if (!attachment || typeof attachment !== 'object' || Array.isArray(attachment)) return attachment;
    return { ...attachment, name };
  });
}

function scienceLessonContent(isUpdated = false) {
  return {
    summary: isUpdated
      ? 'Latihan dikemaskini dengan fokus pada tenaga dan glukosa.'
      : 'Latihan ringkas tentang respirasi sel untuk kelas Sains Tingkatan 4.',
  };
}

function graphLessonContent(isUpdated = false) {
  return isUpdated ? {
    summary: 'Ringkasan dikemaskini dengan contoh pintasan-y.',
    blocks: [
      { type: 'text', title: 'Peringatan', body: 'Semak pekali x untuk mengenal pasti kecerunan.' },
    ],
  } : {
    summary: 'Pelajar membaca konsep ringkas sebelum menjawab kuiz kecerunan.',
    blocks: [
      { type: 'section', title: 'Konsep', body: 'Kecerunan menunjukkan kadar perubahan pada garis lurus.' },
      { type: 'embed', title: 'Video Rujukan', url: 'https://youtu.be/dQw4w9WgXcQ' },
    ],
  };
}

async function refreshLegacyRegressionLabels() {
  await refreshLegacyRegressionUsers();
  await refreshLegacyTeacherProfiles();
  await refreshLegacyClassrooms();
  await refreshLegacySyllabusItems();
  await refreshLegacyLessons();
  await refreshLegacyPosts();
  await refreshLegacyPostComments();
  await refreshLegacyWhiteboards();
  await refreshLegacyQuizRows();
  await refreshLegacyMediaRows();
  await refreshLegacySyncRows();
}

async function refreshLegacyRegressionUsers() {
  const result = await client.query(`
    SELECT id, email, role, full_name
    FROM users
    WHERE full_name ILIKE 'QA Teacher %'
       OR full_name ILIKE 'QA Student %'
       OR full_name ILIKE 'QA Parent %'
       OR full_name ILIKE 'Registered Student %'
  `);

  for (const row of result.rows) {
    const source = row.full_name || row.email;
    let fullName = row.full_name;
    if (row.role === 'teacher') fullName = withShortSuffix('Cikgu Hana Rahman', source);
    if (row.role === 'parent') fullName = withShortSuffix('Puan Laila Ismail', source);
    if (row.role === 'student') {
      fullName = /^registered student\b/i.test(row.full_name)
        ? withShortSuffix('Nur Aina Zulkifli', source)
        : withShortSuffix('Nur Iman Razak', source);
    }

    if (fullName !== row.full_name) {
      await client.query('UPDATE users SET full_name = $2, updated_at = NOW() WHERE id = $1', [row.id, fullName]);
    }
  }
}

async function refreshLegacyTeacherProfiles() {
  await client.query(
    `UPDATE teacher_profiles
     SET headline = 'Cikgu Matematik KSSM Tingkatan 4',
         bio = 'Membimbing murid membina asas graf linear melalui latihan berfokus dan maklum balas cepat.',
         specialties = $1,
         credentials = 'Ijazah Pendidikan Matematik',
         location = 'Pulau Pinang',
         updated_at = NOW()
     WHERE COALESCE(headline, '') ILIKE 'QAQC Teacher%'
        OR COALESCE(bio, '') ILIKE '%Playwright%'
        OR COALESCE(credentials, '') ILIKE '%QA%'`,
    [['Matematik KSSM', 'Ulang kaji SPM']]
  );
}

async function refreshLegacyClassrooms() {
  const result = await client.query(`
    SELECT id, name, description, subject
    FROM classrooms
    WHERE name ILIKE 'Main QA Class %'
       OR name ILIKE 'Join Leave QA Class %'
       OR name ILIKE 'Admin CRUD Class %'
       OR subject ILIKE 'QAQC Mathematics %'
       OR subject ILIKE 'QAQC Science %'
       OR COALESCE(description, '') ILIKE '%Playwright%'
       OR COALESCE(description, '') ILIKE '%coverage classroom%'
  `);

  for (const row of result.rows) {
    const suffixSource = row.name || row.subject;
    let name = row.name;
    let description = row.description;
    let subject = row.subject;

    if (/^admin crud class updated\b/i.test(row.name)) {
      name = withShortSuffix('Kelas Sains 4 Bestari Tambahan', suffixSource);
    } else if (/^admin crud class\b/i.test(row.name)) {
      name = withShortSuffix('Kelas Sains 4 Bestari', suffixSource);
    } else if (/^join leave qa class\b/i.test(row.name)) {
      name = withShortSuffix('Kumpulan Latihan Graf', suffixSource);
    } else if (/^main qa class\b/i.test(row.name)) {
      name = withShortSuffix('Kelas Matematik 4 Cemerlang', suffixSource);
    }

    if (/^qaqc science\b/i.test(row.subject)) subject = withShortSuffix('Sains KSSM', row.subject);
    if (/^qaqc mathematics\b/i.test(row.subject)) subject = withShortSuffix('Matematik KSSM', row.subject);
    if (/coverage classroom/i.test(row.description || '')) {
      description = 'Kelas ulang kaji fungsi linear, graf, dan latihan kuiz mingguan.';
    }
    if (/playwright/i.test(row.description || '')) {
      description = 'Jadual ulang kaji minggu ini telah dikemaskini untuk latihan graf.';
    }

    await client.query(
      `UPDATE classrooms
       SET name = $2,
           description = $3,
           subject = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [row.id, name, description, subject]
    );
  }
}

async function refreshLegacySyllabusItems() {
  const result = await client.query(`
    SELECT id, subject, topic, subtopic, content
    FROM syllabus_items
    WHERE subject ILIKE 'QAQC Mathematics %'
       OR subject ILIKE 'QAQC Science %'
       OR topic ILIKE 'Admin CRUD Topic %'
       OR topic ILIKE 'Admin CRUD Topic Updated %'
       OR topic ILIKE 'Linear Functions %'
       OR COALESCE(content::text, '') ILIKE '%QA%'
       OR COALESCE(content::text, '') ILIKE '%coverage%'
  `);

  for (const row of result.rows) {
    const suffixSource = row.topic || row.subject;
    let subject = row.subject;
    let topic = row.topic;
    let subtopic = row.subtopic;
    let content = row.content;

    if (/^admin crud topic updated\b/i.test(row.topic)) {
      subject = withShortSuffix('Sains KSSM', suffixSource);
      topic = withShortSuffix('Respirasi Sel dan Tenaga', suffixSource);
      subtopic = 'Latihan berstruktur';
      content = { summary: 'Latihan dikemaskini untuk mengaitkan respirasi sel dengan penghasilan tenaga.' };
    } else if (/^admin crud topic\b/i.test(row.topic)) {
      subject = withShortSuffix('Sains KSSM', suffixSource);
      topic = withShortSuffix('Respirasi Sel', suffixSource);
      subtopic = 'Pengenalan';
      content = { summary: 'Murid mengenal pasti proses respirasi sel dan keperluan tenaga.' };
    } else if (/^linear functions\b/i.test(row.topic)) {
      subject = withShortSuffix('Matematik KSSM', suffixSource);
      topic = withShortSuffix('Fungsi Linear', suffixSource);
      subtopic = 'Kecerunan';
      content = { summary: 'Fokus kepada kecerunan, pintasan-y, dan tafsiran graf linear.' };
    } else {
      if (/^qaqc science\b/i.test(row.subject)) subject = withShortSuffix('Sains KSSM', row.subject);
      if (/^qaqc mathematics\b/i.test(row.subject)) subject = withShortSuffix('Matematik KSSM', row.subject);
    }

    await client.query(
      `UPDATE syllabus_items
       SET subject = $2,
           topic = $3,
           subtopic = $4,
           content = $5,
           updated_at = NOW()
       WHERE id = $1`,
      [row.id, subject, topic, subtopic, JSON.stringify(content || {})]
    );
  }
}

async function refreshLegacyLessons() {
  const result = await client.query(`
    SELECT id, title, content, subject
    FROM lessons
    WHERE title ILIKE 'Admin CRUD Lesson %'
       OR title ILIKE 'Admin CRUD Lesson Updated %'
       OR title ILIKE 'Teacher QA Lesson %'
       OR title ILIKE 'Teacher QA Lesson Updated %'
       OR subject ILIKE 'QAQC Mathematics %'
       OR subject ILIKE 'QAQC Science %'
       OR COALESCE(content::text, '') ILIKE '%Playwright%'
       OR COALESCE(content::text, '') ILIKE '%QA%'
  `);

  for (const row of result.rows) {
    const suffixSource = row.title || row.subject;
    let title = row.title;
    let content = row.content;
    let subject = row.subject;

    if (/^admin crud lesson updated\b/i.test(row.title)) {
      title = withShortSuffix('Latihan Respirasi Sel Lanjutan', suffixSource);
      content = scienceLessonContent(true);
      subject = withShortSuffix('Sains KSSM', suffixSource);
    } else if (/^admin crud lesson\b/i.test(row.title)) {
      title = withShortSuffix('Latihan Respirasi Sel', suffixSource);
      content = scienceLessonContent(false);
      subject = withShortSuffix('Sains KSSM', suffixSource);
    } else if (/^teacher qa lesson updated\b/i.test(row.title)) {
      title = withShortSuffix('Latihan Kecerunan Graf Lanjutan', suffixSource);
      content = graphLessonContent(true);
      subject = withShortSuffix('Matematik KSSM', suffixSource);
    } else if (/^teacher qa lesson\b/i.test(row.title)) {
      title = withShortSuffix('Latihan Kecerunan Graf', suffixSource);
      content = graphLessonContent(false);
      subject = withShortSuffix('Matematik KSSM', suffixSource);
    } else {
      if (/^qaqc science\b/i.test(row.subject)) subject = withShortSuffix('Sains KSSM', row.subject);
      if (/^qaqc mathematics\b/i.test(row.subject)) subject = withShortSuffix('Matematik KSSM', row.subject);
    }

    await client.query(
      `UPDATE lessons
       SET title = $2,
           content = $3,
           subject = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [row.id, title, JSON.stringify(content || {}), subject]
    );
  }
}

async function refreshLegacyPosts() {
  const result = await client.query(`
    SELECT id, title, content, attachments
    FROM posts
    WHERE title ILIKE 'QA Announcement %'
       OR title ILIKE 'QA Announcement Updated %'
       OR title ILIKE 'Disposable Post %'
       OR COALESCE(content, '') ILIKE '%Playwright%'
       OR COALESCE(content, '') ILIKE '%coverage%'
       OR COALESCE(attachments::text, '') ILIKE '%Reference video%'
  `);

  for (const row of result.rows) {
    const suffixSource = row.title || row.content;
    let title = row.title;
    let content = row.content;
    let attachments = row.attachments;

    if (/^qa announcement updated\b/i.test(row.title || '')) {
      title = withShortSuffix('Makluman Ulang Kaji Graf Dikemaskini', suffixSource);
      content = 'Latihan tambahan telah ditambah untuk soalan kecerunan.';
      attachments = renameAttachments(attachments, 'Video rujukan graf');
    } else if (/^qa announcement\b/i.test(row.title || '')) {
      title = withShortSuffix('Makluman Ulang Kaji Graf', suffixSource);
      content = 'Sila siapkan latihan graf linear sebelum kelas bimbingan seterusnya.';
      attachments = renameAttachments(attachments, 'Video rujukan graf');
    } else if (/^disposable post\b/i.test(row.title || '')) {
      title = withShortSuffix('Nota Sementara', suffixSource);
      content = 'Draf pengumuman yang akan dipadam selepas semakan guru.';
    }

    await client.query(
      `UPDATE posts
       SET title = $2,
           content = $3,
           attachments = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [row.id, title, content, JSON.stringify(attachments || [])]
    );
  }
}

async function refreshLegacyPostComments() {
  const result = await client.query(`
    SELECT id, content, attachments
    FROM post_comments
    WHERE content ILIKE '%Playwright%'
       OR COALESCE(attachments::text, '') ILIKE '%Comment video%'
  `);

  for (const row of result.rows) {
    const content = /^updated/i.test(row.content || '')
      ? 'Saya sudah betulkan jawapan selepas semak video ulang kaji.'
      : 'Saya sudah cuba soalan pertama dan akan semak semula pintasan-y.';
    const attachments = renameAttachments(row.attachments, 'Video ulang kaji');

    await client.query(
      `UPDATE post_comments
       SET content = $2,
           attachments = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [row.id, content, JSON.stringify(attachments)]
    );
  }
}

async function refreshLegacyWhiteboards() {
  const result = await client.query(`
    SELECT id, title, description
    FROM whiteboard_sessions
    WHERE title ILIKE 'Whiteboard QA %'
       OR COALESCE(description, '') ILIKE '%Playwright%'
  `);

  for (const row of result.rows) {
    await client.query(
      `UPDATE whiteboard_sessions
       SET title = $2,
           description = $3
       WHERE id = $1`,
      [
        row.id,
        withShortSuffix('Papan Putih Graf Linear', row.title),
        'Sesi papan putih untuk membina graf dan menanda pintasan-y.',
      ]
    );
  }
}

async function refreshLegacyQuizRows() {
  const decks = await client.query(`
    SELECT id, title, description, subject
    FROM quiz_decks
    WHERE title ILIKE 'QA Speed Round %'
       OR title ILIKE 'QA Speed Round Updated %'
       OR subject ILIKE 'QAQC Mathematics %'
       OR subject ILIKE 'QAQC Science %'
       OR COALESCE(description, '') ILIKE '%Playwright%'
  `);

  for (const row of decks.rows) {
    const suffixSource = row.title || row.subject;
    const isUpdated = /^qa speed round updated\b/i.test(row.title || '');
    const title = /^qa speed round\b/i.test(row.title || '')
      ? withShortSuffix(isUpdated ? 'Kuiz Pantas Graf Linear Dikemaskini' : 'Kuiz Pantas Graf Linear', suffixSource)
      : row.title;
    const description = /playwright/i.test(row.description || '')
      ? 'Kuiz pantas untuk semak kefahaman kecerunan dan pintasan.'
      : row.description;
    let subject = row.subject;
    if (/^qaqc science\b/i.test(row.subject)) subject = withShortSuffix('Sains KSSM', row.subject);
    if (/^qaqc mathematics\b/i.test(row.subject)) subject = withShortSuffix('Matematik KSSM', row.subject);

    await client.query(
      `UPDATE quiz_decks
       SET title = $2,
           description = $3,
           subject = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [row.id, title, description, subject]
    );
  }

  const participants = await client.query(`
    SELECT id, guest_name, display_name
    FROM quiz_session_participants
    WHERE display_name ILIKE 'Guest %'
       OR guest_name ILIKE 'Guest %'
       OR display_name = 'Ignored for authenticated student'
       OR guest_name = 'Ignored for authenticated student'
  `);

  for (const row of participants.rows) {
    const source = row.display_name || row.guest_name;
    const displayName = /^guest\b/i.test(source || '')
      ? withShortSuffix('Tetamu', source)
      : 'Nur Iman Razak';
    await client.query(
      `UPDATE quiz_session_participants
       SET guest_name = CASE WHEN is_guest THEN $2 ELSE NULL END,
           display_name = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [row.id, displayName]
    );
  }
}

async function refreshLegacyMediaRows() {
  const result = await client.query(`
    SELECT id, original_name
    FROM media_files
    WHERE original_name ILIKE 'qaqc-%.txt'
       OR original_name ILIKE 'whiteboard-%.webm'
  `);

  for (const row of result.rows) {
    const sourceName = String(row.original_name || '').replace(/\.[^.]+$/, '');
    const originalName = /^whiteboard-/i.test(row.original_name)
      ? `rakaman-graf-${visibleRunSuffix(sourceName)}.webm`
      : `nota-graf-${visibleRunSuffix(sourceName)}.txt`;
    await client.query('UPDATE media_files SET original_name = $2 WHERE id = $1', [row.id, originalName]);
  }
}

async function refreshLegacySyncRows() {
  const result = await client.query(`
    SELECT id, user_id, device_id
    FROM device_syncs
    WHERE device_id ILIKE 'playwright-%'
  `);

  for (const row of result.rows) {
    let deviceId = `tablet-pelajar-${visibleRunSuffix(row.device_id)}`;
    const existing = await queryOne(
      'SELECT id FROM device_syncs WHERE user_id = $1 AND device_id = $2 AND id <> $3',
      [row.user_id, deviceId, row.id]
    );
    if (existing) deviceId = `${deviceId}${String(row.id).replace(/-/g, '').slice(0, 2).toUpperCase()}`;

    await client.query(
      'UPDATE device_syncs SET device_id = $2, updated_at = NOW() WHERE id = $1',
      [row.id, deviceId]
    );
  }
}

async function refreshLegacySeedLabels() {
  const legacy = (...parts) => parts.join(' ');
  const legacyDemo = 'Demo';
  const exactReplacements = [
    ['users', 'full_name', legacy(legacyDemo, 'Student'), 'Nur Aisyah Rahman'],
    ['users', 'full_name', legacy(legacyDemo, 'Teacher'), 'Cikgu Farah Aziz'],
    ['users', 'full_name', legacy(legacyDemo, 'Parent'), 'Encik Azlan Rahman'],
    ['users', 'full_name', legacy(legacyDemo, 'Admin'), 'Puan Nabila Hassan'],
    ['lessons', 'title', legacy('Plotting', 'Linear', 'Functions'), 'Kecerunan dan Pintasan Graf Linear'],
    ['lessons', 'title', legacy('Mitosis', 'in', 'Action'), 'Mitosis dalam Sel'],
    ['lessons', 'title', legacy('Formal', 'Email', 'Drill'), 'Penulisan Emel Formal SPM'],
    ['lessons', 'title', 'Karangan Emel Formal SPM', 'Penulisan Emel Formal SPM'],
    ['lessons', 'title', legacy('Nationalism', 'Milestones'), 'Perkembangan Nasionalisme di Tanah Melayu'],
    ['lessons', 'title', 'Garis Masa Nasionalisme', 'Perkembangan Nasionalisme di Tanah Melayu'],
    ['classrooms', 'name', legacy('Form', '4', 'Maths', 'Boost'), 'Tingkatan 4 Matematik Fokus'],
    ['classrooms', 'name', legacy('Form', '4', 'Science', 'Lab'), 'Tingkatan 4 Sains Eksperimen'],
    ['classrooms', 'name', legacy('Form', '5', 'English', 'Sprint'), 'Tingkatan 5 Bahasa Inggeris SPM'],
    ['posts', 'title', legacy('Warm-up', 'graph', 'challenge'), 'Cabaran graf sebelum kelas'],
    ['posts', 'title', legacy('Mitosis', 'recap', 'card'), 'Kad ulang kaji mitosis'],
    ['posts', 'title', legacy('Formal', 'email', 'practice'), 'Latihan emel formal'],
    ['whiteboard_sessions', 'title', legacy('Live', 'graph', 'walkthrough'), 'Bengkel graf secara langsung'],
    ['quiz_decks', 'title', legacy('Math', 'Speed', 'Round'), 'Kuiz Pantas Kecerunan'],
  ];

  for (const [table, column, from, to] of exactReplacements) {
    await updateExactValue(table, column, from, to);
  }

  await client.query(`
    UPDATE syllabus_items
    SET subject = 'Matematik',
        topic = 'Fungsi Linear',
        subtopic = 'Kecerunan dan pintasan-y'
    WHERE subject = ANY($1)
      AND topic = ANY($2)
  `, [['Mathematics', 'Matematik'], [legacy('Linear', 'Functions'), 'Fungsi Linear KSSM', 'Fungsi Linear']]);
  await client.query(`
    UPDATE syllabus_items
    SET subject = 'Sains',
        topic = 'Pembahagian Sel',
        subtopic = 'Peringkat mitosis'
    WHERE subject = ANY($1)
      AND topic = ANY($2)
  `, [['Science', 'Sains'], [legacy('Cell', 'Division'), 'Pembahagian Sel']]);
  await client.query(`
    UPDATE syllabus_items
    SET subject = 'Bahasa Inggeris',
        topic = 'Penulisan Terarah SPM',
        subtopic = 'Format emel formal'
    WHERE subject = ANY($1)
      AND topic = ANY($2)
  `, [['English', 'Bahasa Inggeris'], [legacy('Directed', 'Writing'), legacy('Directed', 'Writing', 'SPM'), 'Penulisan Terarah SPM']]);
  await client.query(`
    UPDATE syllabus_items
    SET subject = 'Sejarah',
        topic = 'Nasionalisme di Tanah Melayu',
        subtopic = 'Gerakan dan tokoh utama'
    WHERE subject = 'Sejarah'
      AND topic = ANY($1)
  `, [[legacy('Nationalism', 'in', 'Malaysia'), 'Nasionalisme di Tanah Melayu']]);

  await refreshLegacyRegressionLabels();
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is disabled in production');
  }

  await client.connect();
  await client.query('BEGIN');

  try {
    const student = await ensureUser({ email: 'student@tusyen.test', role: 'student', fullName: 'Nur Aisyah Rahman' });
    const teacher = await ensureUser({ email: 'teacher@tusyen.test', role: 'teacher', fullName: 'Cikgu Farah Aziz' });
    const parent = await ensureUser({ email: 'parent@tusyen.test', role: 'parent', fullName: 'Encik Azlan Rahman' });
    const admin = await ensureUser({ email: 'admin@tusyen.test', role: 'admin', fullName: 'Puan Nabila Hassan' });

    await refreshLegacySeedLabels();

    await ensureParentLink(parent.id, student.id);
    await ensureTeacherProfile({
      teacherId: teacher.id,
      headline: 'Cikgu KSSM Tingkatan 4 dan 5',
      bio: 'Saya bantu murid membina keyakinan melalui penerangan ringkas, latihan berpandu, dan kuiz pantas. Setiap kelas fokus pada tabiat belajar yang konsisten dan persediaan SPM yang realistik.',
      specialties: ['Matematik KSSM', 'Sains KSSM', 'Ulang kaji SPM', 'Latihan berfokus'],
      credentials: '8 tahun mengajar murid sekolah menengah dan kelas ulang kaji dalam talian.',
      yearsExperience: 8,
      location: 'Kuala Lumpur, Malaysia',
      links: { classroom: 'https://tusyen.local/cikgu-farah-aziz' },
    });

    const seedDemoLessons = process.env.SEED_DEMO_LESSONS === 'true';
    let mathLessonId;
    let scienceLessonId;
    let englishLessonId;
    let sejarahLessonId;

    if (seedDemoLessons) {
    const syllabusItems = [];
    syllabusItems.push(await ensureSyllabusItem({
      subject: 'Matematik',
      formLevel: 4,
      topic: 'Fungsi Linear',
      subtopic: 'Kecerunan dan pintasan-y',
      orderIndex: 1,
      content: { summary: 'Membaca persamaan garis lurus dan melukis graf daripada bentuk kecerunan-pintasan.' },
      createdBy: admin.id,
    }));
    syllabusItems.push(await ensureSyllabusItem({
      subject: 'Sains',
      formLevel: 4,
      topic: 'Pembahagian Sel',
      subtopic: 'Peringkat mitosis',
      orderIndex: 2,
      content: { summary: 'Memahami urutan mitosis dan kepentingannya kepada organisma hidup.' },
      createdBy: admin.id,
    }));
    syllabusItems.push(await ensureSyllabusItem({
      subject: 'Bahasa Inggeris',
      formLevel: 5,
      topic: 'Penulisan Terarah SPM',
      subtopic: 'Format emel formal',
      orderIndex: 3,
      content: { summary: 'Menyusun jawapan emel formal yang padat untuk soalan peperiksaan.' },
      createdBy: admin.id,
    }));
    syllabusItems.push(await ensureSyllabusItem({
      subject: 'Sejarah',
      formLevel: 5,
      topic: 'Nasionalisme di Tanah Melayu',
      subtopic: 'Gerakan dan tokoh utama',
      orderIndex: 4,
      content: { summary: 'Meneliti peristiwa dan tokoh yang membentuk perjuangan kemerdekaan.' },
      createdBy: admin.id,
    }));

    mathLessonId = await ensureLesson({
      title: 'Kecerunan dan Pintasan Graf Linear',
      subject: 'Matematik',
      formLevel: 4,
      difficulty: 'medium',
      estimatedMinutes: 18,
      content: { summary: 'Menukar persamaan linear kepada graf dan mentafsir maksud kecerunan serta pintasan.' },
      createdBy: admin.id,
      syllabusId: syllabusItems[0],
    });
    scienceLessonId = await ensureLesson({
      title: 'Mitosis dalam Sel',
      subject: 'Sains',
      formLevel: 4,
      difficulty: 'easy',
      estimatedMinutes: 16,
      content: { summary: 'Mengikuti proses pembahagian sel dan fungsi setiap peringkat mitosis.' },
      createdBy: admin.id,
      syllabusId: syllabusItems[1],
    });
    englishLessonId = await ensureLesson({
      title: 'Penulisan Emel Formal SPM',
      subject: 'Bahasa Inggeris',
      formLevel: 5,
      difficulty: 'medium',
      estimatedMinutes: 20,
      content: { summary: 'Melatih nada, format, dan isi utama untuk tugasan penulisan peperiksaan.' },
      createdBy: admin.id,
      syllabusId: syllabusItems[2],
    });
    sejarahLessonId = await ensureLesson({
      title: 'Perkembangan Nasionalisme di Tanah Melayu',
      subject: 'Sejarah',
      formLevel: 5,
      difficulty: 'hard',
      estimatedMinutes: 22,
      content: { summary: 'Mengulang kaji tokoh, peristiwa, dan faktor dalam perkembangan nasionalisme.' },
      createdBy: admin.id,
      syllabusId: syllabusItems[3],
    });

    await ensureQuizQuestions(mathLessonId, [
      {
        text: 'Berapakah kecerunan bagi y = 2x + 3?',
        options: ['2', '3', '5', '1'],
        correctAnswer: '2',
        explanation: 'Kecerunan ialah pekali bagi x.',
      },
      {
        text: 'Titik manakah terletak pada garis y = 2x + 3?',
        options: ['(1, 5)', '(1, 4)', '(2, 8)', '(0, 2)'],
        correctAnswer: '(1, 5)',
      },
      {
        text: 'Padankan setiap perwakilan bagi fungsi linear yang sama.',
        type: 'representation_match',
        options: [
          { prompt: 'y = 2x + 3', answer: 'Kecerunan 2, pintasan-y 3' },
          { prompt: 'x = 1 menghasilkan y = 5', answer: 'Titik (1, 5)' },
        ],
        correctAnswer: {
          'y = 2x + 3': 'Kecerunan 2, pintasan-y 3',
          'x = 1 menghasilkan y = 5': 'Titik (1, 5)',
        },
        explanation: 'Persamaan, titik, dan ciri graf boleh menerangkan garis yang sama dalam bentuk berbeza.',
      },
      {
        text: 'Susun langkah menyelesaikan y = 2x + 3 apabila y = 11.',
        type: 'step_order',
        options: ['Gantikan y dengan 11', 'Tolak 3 pada kedua-dua belah', 'Bahagi kedua-dua belah dengan 2'],
        correctAnswer: ['Gantikan y dengan 11', 'Tolak 3 pada kedua-dua belah', 'Bahagi kedua-dua belah dengan 2'],
        explanation: 'Operasi songsang perlu dibuat mengikut urutan yang betul.',
      },
      {
        text: 'Jika x = 4, apakah nilai y bagi y = 2x + 3?',
        type: 'numeric',
        options: [],
        correctAnswer: { value: 11, tolerance: 0 },
        explanation: '2(4) + 3 = 11.',
      },
    ]);

    await ensureQuizQuestions(scienceLessonId, [
      {
        text: 'Peringkat mitosis manakah menyusun kromosom di tengah sel?',
        options: ['Profasa', 'Metafasa', 'Anafasa', 'Telofasa'],
        correctAnswer: 'Metafasa',
      },
      {
        text: 'Mitosis menghasilkan dua sel anak yang seiras.',
        type: 'true_false',
        options: ['Betul', 'Salah'],
        correctAnswer: 'Betul',
      },
      {
        text: 'Padankan peringkat mitosis dengan peristiwa utamanya.',
        type: 'diagram_label',
        options: [
          { prompt: 'Metafasa', answer: 'Kromosom tersusun di tengah sel' },
          { prompt: 'Anafasa', answer: 'Kromatid berpisah' },
        ],
        correctAnswer: {
          Metafasa: 'Kromosom tersusun di tengah sel',
          Anafasa: 'Kromatid berpisah',
        },
      },
      {
        text: 'Seorang murid menyatakan mitosis menghasilkan empat sel berbeza. Apakah kesilapannya?',
        type: 'error_diagnosis',
        options: [],
        correctAnswer: 'Mitosis menghasilkan dua sel anak yang seiras',
        explanation: 'Empat sel yang berbeza secara genetik dikaitkan dengan meiosis, bukan mitosis.',
      },
    ]);

    await ensureQuizQuestions(englishLessonId, [
      {
        text: 'Pembukaan manakah paling sesuai untuk emel formal Bahasa Inggeris?',
        options: ['Hey there,', 'Dear Sir or Madam,', 'Yo team,', 'Hi bestie,'],
        correctAnswer: 'Dear Sir or Madam,',
      },
      {
        text: 'Emel formal perlu mengelakkan bahasa slanga.',
        type: 'true_false',
        options: ['Betul', 'Salah'],
        correctAnswer: 'Betul',
      },
    ]);

    await ensureQuizQuestions(sejarahLessonId, [
      {
        text: 'Topik manakah berkait rapat dengan nasionalisme awal di Tanah Melayu?',
        options: ['Gerakan kemerdekaan', 'Fotosintesis', 'Graf kuadratik', 'Membran sel'],
        correctAnswer: 'Gerakan kemerdekaan',
      },
      {
        text: 'Nasionalisme di Tanah Melayu dipengaruhi oleh faktor tempatan dan serantau.',
        type: 'true_false',
        options: ['Betul', 'Salah'],
        correctAnswer: 'Betul',
      },
    ]);
    }

    const mathClassId = await ensureClassroom({
      teacherId: teacher.id,
      name: 'Tingkatan 4 Matematik Fokus',
      description: 'Kelas ulang kaji algebra dan graf dengan latihan mingguan.',
      subject: 'Matematik',
      formLevel: 4,
      joinCode: 'MATH42',
    });
    const scienceClassId = await ensureClassroom({
      teacherId: teacher.id,
      name: 'Tingkatan 4 Sains Eksperimen',
      description: 'Penerangan konsep ringkas bersama cabaran Sains KSSM.',
      subject: 'Sains',
      formLevel: 4,
      joinCode: 'SCI442',
    });
    const englishClassId = await ensureClassroom({
      teacherId: teacher.id,
      name: 'Tingkatan 5 Bahasa Inggeris SPM',
      description: 'Latihan penulisan dan komunikasi dengan maklum balas pantas.',
      subject: 'Bahasa Inggeris',
      formLevel: 5,
      joinCode: 'ENG552',
    });

    await ensureEnrollment(student.id, mathClassId);
    await ensureEnrollment(student.id, scienceClassId);
    await ensureEnrollment(student.id, englishClassId);

    if (seedDemoLessons) {
      await ensureAssignment(mathClassId, mathLessonId, teacher.id, '2026-05-20T10:00:00Z');
      await ensureAssignment(scienceClassId, scienceLessonId, teacher.id, '2026-05-21T10:00:00Z');
      await ensureAssignment(englishClassId, englishLessonId, teacher.id, '2026-05-22T10:00:00Z');
      await ensureAssignment(englishClassId, sejarahLessonId, teacher.id, '2026-05-24T10:00:00Z');
    }

    const mathPostId = await ensurePost({
      classroomId: mathClassId,
      authorId: teacher.id,
      postType: 'announcement',
      title: 'Cabaran graf sebelum kelas',
      content: 'Sebelum kelas esok, lukis graf y = 2x + 3 dan bawa satu soalan tentang kecerunan.',
      isPinned: true,
    });
    const sciencePostId = await ensurePost({
      classroomId: scienceClassId,
      authorId: teacher.id,
      postType: 'general',
      title: 'Kad ulang kaji mitosis',
      content: 'Cikgu telah muat naik kad ulang kaji. Semak setiap peringkat dan bersedia untuk kuiz pantas.',
    });
    const englishPostId = await ensurePost({
      classroomId: englishClassId,
      authorId: teacher.id,
      postType: 'assignment',
      title: 'Latihan emel formal',
      content: 'Sediakan draf emel formal berdasarkan tugasan pelajaran 3. Pastikan jawapan bawah 120 patah perkataan.',
    });

    await ensurePostReaction({ postId: mathPostId, userId: student.id, reactionType: 'like' });
    await ensurePostReaction({ postId: sciencePostId, userId: student.id, reactionType: 'insightful' });
    await ensurePostComment({
      postId: mathPostId,
      userId: student.id,
      content: 'Saya sudah lukis graf. Soalan saya tentang sebab pintasan-y bermula pada 3.',
    });
    await ensurePostComment({
      postId: sciencePostId,
      userId: student.id,
      content: 'Boleh cikgu buat satu lagi contoh beza metafasa dengan anafasa?',
    });
    await ensurePostComment({
      postId: englishPostId,
      userId: student.id,
      content: 'Saya sudah hantar draf dan pastikan kurang daripada 120 patah perkataan.',
    });

    await ensureWhiteboardSession({
      classroomId: mathClassId,
      teacherId: teacher.id,
      title: 'Bengkel graf secara langsung',
      description: 'Kelas membina graf linear dan membaca kecerunan bersama-sama.',
      status: 'active',
    });

    const quizDeckId = await ensureQuizDeck({
      teacherId: teacher.id,
      title: 'Kuiz Pantas Kecerunan',
      description: 'Kuiz langsung untuk membaca graf dan mengenal pasti kecerunan.',
      subject: 'Matematik',
      formLevel: 4,
      questions: [
        {
          questionText: 'Berapakah kecerunan bagi y = 2x + 3?',
          questionType: 'multiple_choice',
          options: ['2', '3', '5', '1'],
          correctAnswer: { optionIndex: 0 },
          explanation: 'Pekali bagi x menunjukkan nilai kecerunan.',
          points: 1000,
          timeLimitSeconds: 15,
        },
        {
          questionText: 'Kecerunan positif menaik dari kiri ke kanan.',
          questionType: 'true_false',
          options: ['Betul', 'Salah'],
          correctAnswer: { optionIndex: 0 },
          explanation: 'Kecerunan positif bermaksud garis menaik apabila nilai x bertambah.',
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
          participantId: student.id,
          displayName: 'Nur Aisyah Rahman',
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
      displayName: 'Nur Aisyah Rahman',
      totalScore: 1725,
      correctCount: 2,
      answeredCount: 2,
      xpAwarded: 1725,
      joinToken: 'aisyah-quiz-token',
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

    if (seedDemoLessons) {
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
    }

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

function databaseUrlFromParts() {
  if (!process.env.DB_PASSWORD) {
    throw new Error('DATABASE_URL or DB_PASSWORD must be set');
  }

  return `postgres://${process.env.DB_USER || 'eduuser'}:${process.env.DB_PASSWORD}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'eduapp'}`;
}
