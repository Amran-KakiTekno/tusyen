import { v4 as uuidv4 } from 'uuid';
import { db, withTransaction } from '../database';
import { redis } from '../redis';
import {
  buildLeaderboard,
  calculateQuestionScore,
  formatQuizParticipantDisplayName,
  generateQuizPin,
  gradeQuizAnswer,
  quizAnswerIsBlank,
  normalizeQuizQuestion,
  questionRowForClient,
  type QuizQuestionInput,
} from './logic';

type AuthUser = {
  userId: string;
  role: 'student' | 'teacher' | 'parent' | 'admin';
};

type QuizDeckUpsertInput = {
  id?: string;
  title: string;
  description?: string | null;
  subject: string;
  formLevel: number;
  questions: QuizQuestionInput[];
};

type QuizJoinInput = {
  pin: string;
  nickname?: string;
  user?: AuthUser;
};

type QuizAnswerInput = {
  sessionId: string;
  participantToken: string;
  selectedOptionIndex?: number;
  selectedAnswer?: unknown;
};

type QuizTimerAction = 'pause' | 'resume' | 'add_time';

type QuizTimerControlInput = {
  action: QuizTimerAction;
  seconds?: number;
};

const SESSION_STATE_TTL_SECONDS = 60 * 60 * 24 * 7;
const SESSION_PIN_KEY_PREFIX = 'quiz:pin:';
const SESSION_STATE_KEY_PREFIX = 'quiz:session:';
const QUIZ_FAIL_SCORE_THRESHOLD = 60;
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
const quizSessionUpdateColumns = new Set([
  'status',
  'current_question_index',
  'current_question_id',
  'question_started_at',
  'question_ends_at',
  'question_paused_at',
  'question_remaining_ms',
  'started_at',
  'ended_at',
  'leaderboard_snapshot',
]);

function stateKey(sessionId: string) {
  return `${SESSION_STATE_KEY_PREFIX}${sessionId}:state`;
}

function pinKey(pin: string) {
  return `${SESSION_PIN_KEY_PREFIX}${pin}`;
}

function normalizePin(value: string) {
  return String(value || '').replace(/\D/g, '').slice(0, 6).padStart(6, '0');
}

function isTeacherOrAdmin(user: AuthUser) {
  return user.role === 'teacher' || user.role === 'admin';
}

async function canManageDeck(user: AuthUser, deckId: string) {
  if (user.role === 'admin') return true;

  const result = await db.query('SELECT teacher_id FROM quiz_decks WHERE id = $1 AND is_active = true', [deckId]);
  return (result.rowCount ?? 0) > 0 && result.rows[0].teacher_id === user.userId;
}

async function canManageClassroom(user: AuthUser, classroomId: string) {
  if (user.role === 'admin') return true;

  const result = await db.query('SELECT teacher_id FROM classrooms WHERE id = $1 AND is_active = true', [classroomId]);
  return (result.rowCount ?? 0) > 0 && result.rows[0].teacher_id === user.userId;
}

async function canStudentJoinQuizSession(user: AuthUser, classroomId: string) {
  const result = await db.query(
    `SELECT id
     FROM classroom_enrollments
     WHERE student_id = $1 AND classroom_id = $2 AND is_active = true
     LIMIT 1`,
    [user.userId, classroomId]
  );
  return (result.rowCount ?? 0) > 0;
}

async function getActiveQuizSessionByPin(pin: string) {
  return db.query(
    `SELECT qs.*, qd.title as deck_title, qd.description as deck_description, qd.subject, qd.form_level,
            c.name as classroom_name, c.subject as classroom_subject
     FROM quiz_sessions qs
     JOIN quiz_decks qd ON qd.id = qs.deck_id
     JOIN classrooms c ON c.id = qs.classroom_id
     WHERE qs.pin = $1 AND qs.status IN ('lobby', 'active')
     LIMIT 1`,
    [normalizePin(pin)]
  );
}

async function getLatestQuizSessionByPin(pin: string) {
  return db.query(
    `SELECT qs.*, qd.title as deck_title, qd.description as deck_description, qd.subject, qd.form_level,
            c.name as classroom_name, c.subject as classroom_subject
     FROM quiz_sessions qs
     JOIN quiz_decks qd ON qd.id = qs.deck_id
     JOIN classrooms c ON c.id = qs.classroom_id
     WHERE qs.pin = $1
     ORDER BY qs.created_at DESC
     LIMIT 1`,
    [normalizePin(pin)]
  );
}

async function loadDeckQuestions(deckId: string) {
  const result = await db.query(
    `SELECT *
     FROM quiz_deck_questions
     WHERE deck_id = $1 AND is_active = true
     ORDER BY order_index ASC, created_at ASC`,
    [deckId]
  );

  return result.rows;
}

async function loadSessionRecord(sessionId: string) {
  const result = await db.query(
    `SELECT qs.*, qd.title as deck_title, qd.description as deck_description, qd.subject, qd.form_level,
            qd.teacher_id as deck_teacher_id,
            c.name as classroom_name, c.subject as classroom_subject,
            u.full_name as teacher_name
     FROM quiz_sessions qs
     JOIN quiz_decks qd ON qd.id = qs.deck_id
     JOIN classrooms c ON c.id = qs.classroom_id
     JOIN users u ON u.id = qs.teacher_id
     WHERE qs.id = $1
     LIMIT 1`,
    [sessionId]
  );

  return result.rows[0] || null;
}

async function loadParticipants(sessionId: string, limit = 50) {
  const result = await db.query(
    `SELECT qsp.*
     FROM quiz_session_participants qsp
     WHERE qsp.session_id = $1
     ORDER BY qsp.total_score DESC, qsp.correct_count DESC, qsp.answered_count ASC, qsp.display_name ASC
     LIMIT $2`,
    [sessionId, limit]
  );

  return result.rows;
}

async function loadLeaderboard(sessionId: string) {
  const participants = await loadParticipants(sessionId, 10);
  return buildLeaderboard(
    participants.map((participant) => ({
      participantId: participant.id,
      displayName: participant.display_name,
      totalScore: Number(participant.total_score || 0),
      correctCount: Number(participant.correct_count || 0),
      answeredCount: Number(participant.answered_count || 0),
      isGuest: Boolean(participant.is_guest),
      userId: participant.user_id || null,
    }))
  );
}

async function buildSessionResults(sessionId: string, questions: any[], participants: any[]) {
  const answerStats = await db.query(
    `SELECT question_id,
            COUNT(*)::int as answer_count,
            COUNT(*) FILTER (WHERE is_correct = true)::int as correct_count,
            COALESCE(ROUND(AVG(response_time_ms)), 0)::int as average_response_time_ms
     FROM quiz_session_answers
     WHERE session_id = $1
     GROUP BY question_id`,
    [sessionId]
  );

  const statsByQuestion = new Map(answerStats.rows.map((row) => [row.question_id, row]));
  const participantCount = participants.length;
  const totalPossibleAnswers = participantCount * questions.length;
  const totalAnswers = answerStats.rows.reduce((sum, row) => sum + Number(row.answer_count || 0), 0);
  const totalCorrect = answerStats.rows.reduce((sum, row) => sum + Number(row.correct_count || 0), 0);

  return {
    summary: {
      participantCount,
      questionCount: questions.length,
      totalAnswers,
      totalCorrect,
      averageAccuracy: totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0,
      completionRate: totalPossibleAnswers > 0 ? Math.round((totalAnswers / totalPossibleAnswers) * 100) : 0,
    },
    questionAccuracy: questions.map((question, index) => {
      const row = statsByQuestion.get(question.id) || {};
      const answerCount = Number((row as any).answer_count || 0);
      const correctCount = Number((row as any).correct_count || 0);
      return {
        questionId: question.id,
        questionText: question.question_text,
        orderIndex: Number(question.order_index ?? index),
        answerCount,
        correctCount,
        noAnswerCount: Math.max(0, participantCount - answerCount),
        accuracy: answerCount > 0 ? Math.round((correctCount / answerCount) * 100) : 0,
        averageResponseMs: Number((row as any).average_response_time_ms || 0),
      };
    }),
    topPerformers: buildLeaderboard(
      participants.map((participant) => ({
        participantId: participant.id,
        displayName: participant.display_name,
        totalScore: Number(participant.total_score || 0),
        correctCount: Number(participant.correct_count || 0),
        answeredCount: Number(participant.answered_count || 0),
        isGuest: Boolean(participant.is_guest),
        userId: participant.user_id || null,
      })),
      5
    ),
  };
}

async function storeSessionState(sessionId: string, state: Record<string, unknown>) {
  await redis.setex(stateKey(sessionId), SESSION_STATE_TTL_SECONDS, JSON.stringify(state));
}

async function readSessionState(sessionId: string) {
  const raw = await redis.get(stateKey(sessionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function touchSessionPin(pin: string, sessionId: string) {
  await redis.setex(pinKey(pin), SESSION_STATE_TTL_SECONDS, sessionId);
}

async function clearSessionPin(pin: string) {
  await redis.del(pinKey(pin));
}

function buildQuestionSnapshot(question: any, revealCorrectAnswer: boolean) {
  if (!question) return null;
  return {
    ...questionRowForClient(question, revealCorrectAnswer),
    correctAnswer: revealCorrectAnswer ? question.correct_answer : undefined,
  };
}

async function updateSessionRows(sessionId: string, updates: Record<string, unknown>) {
  const keys = Object.keys(updates);
  if (keys.length === 0) return;
  for (const key of keys) {
    if (!quizSessionUpdateColumns.has(key)) {
      throw new Error('Invalid quiz session update field');
    }
  }
  const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
  const values = [sessionId, ...keys.map((key) => updates[key])];

  await db.query(
    `UPDATE quiz_sessions SET ${setClause}, updated_at = NOW() WHERE id = $1`,
    values
  );
}

async function findParticipantByToken(sessionId: string, joinToken: string) {
  const result = await db.query(
    `SELECT *
     FROM quiz_session_participants
     WHERE session_id = $1 AND join_token = $2
     LIMIT 1`,
    [sessionId, joinToken]
  );

  return result.rows[0] || null;
}

async function getQuestionForSession(sessionId: string) {
  const session = await loadSessionRecord(sessionId);
  if (!session) return null;

  const questions = await loadDeckQuestions(session.deck_id);
  const currentIndex = Number(session.current_question_index ?? -1);
  const currentQuestion = currentIndex >= 0 ? questions[currentIndex] || null : null;

  return {
    session,
    questions,
    currentQuestion,
  };
}

async function ensureTeacherCanAccessSession(user: AuthUser, sessionRecord: any) {
  if (!sessionRecord) {
    throw new Error('Quiz session not found');
  }

  if (user.role === 'admin') {
    return;
  }

  if (user.role === 'teacher' && sessionRecord.teacher_id === user.userId) {
    return;
  }

  throw new Error('Not authorized for this quiz session');
}

async function ensureTeacherCanAccessClassroomSession(user: AuthUser, classroomId: string) {
  if (!(await canManageClassroom(user, classroomId))) {
    throw new Error('Not authorized for this classroom');
  }
}

async function createSessionSnapshot(sessionId: string, viewer?: { participantToken?: string | null; revealCorrectAnswer?: boolean }) {
  const session = await loadSessionRecord(sessionId);
  if (!session) {
    return null;
  }

  const questions = await loadDeckQuestions(session.deck_id);
  const currentIndex = Number(session.current_question_index ?? -1);
  const currentQuestion = currentIndex >= 0 ? questions[currentIndex] || null : null;
  const participants = await loadParticipants(sessionId);
  const leaderboard = await loadLeaderboard(sessionId);
  const isEnded = session.status === 'ended' || session.status === 'cancelled';
  const results = isEnded ? await buildSessionResults(sessionId, questions, participants) : null;

  let participant: any = null;
  if (viewer?.participantToken) {
    participant = await findParticipantByToken(sessionId, viewer.participantToken);
    if (!participant) {
      return null;
    }
  }

  return {
    session: {
      id: session.id,
      deckId: session.deck_id,
      classroomId: session.classroom_id,
      classroomName: session.classroom_name,
      classroomSubject: session.classroom_subject,
      teacherId: session.teacher_id,
      teacherName: session.teacher_name,
      pin: session.pin,
      status: session.status,
      currentQuestionIndex: currentIndex,
      currentQuestionId: session.current_question_id,
      questionStartedAt: session.question_started_at,
      questionEndsAt: session.question_ends_at,
      questionPausedAt: session.question_paused_at || null,
      questionRemainingMs: session.question_remaining_ms === null || session.question_remaining_ms === undefined
        ? null
        : Number(session.question_remaining_ms),
      startedAt: session.started_at,
      endedAt: session.ended_at,
      deckTitle: session.deck_title,
      deckDescription: session.deck_description,
      subject: session.subject,
      formLevel: session.form_level,
      participantsCount: participants.length,
    },
    deck: {
      id: session.deck_id,
      title: session.deck_title,
      description: session.deck_description,
      subject: session.subject,
      formLevel: session.form_level,
      questionCount: questions.length,
    },
    currentQuestion: buildQuestionSnapshot(currentQuestion, Boolean(viewer?.revealCorrectAnswer || session.status === 'ended')),
    leaderboard,
    results,
    participant: participant
      ? {
          id: participant.id,
          sessionId: participant.session_id,
          userId: participant.user_id,
          displayName: participant.display_name,
          isGuest: participant.is_guest,
          totalScore: Number(participant.total_score || 0),
          correctCount: Number(participant.correct_count || 0),
          answeredCount: Number(participant.answered_count || 0),
          xpAwarded: Number(participant.xp_awarded || 0),
          isConnected: participant.is_connected,
        }
      : null,
  };
}

export async function listQuizDecks(user: AuthUser) {
  if (!isTeacherOrAdmin(user)) {
    return [];
  }

  if (user.role === 'admin') {
    const result = await db.query(
      `SELECT d.*,
              COUNT(q.id) FILTER (WHERE q.is_active = true) as question_count,
              COUNT(DISTINCT qs.id) as session_count
       FROM quiz_decks d
       LEFT JOIN quiz_deck_questions q ON q.deck_id = d.id
       LEFT JOIN quiz_sessions qs ON qs.deck_id = d.id
       WHERE d.is_active = true
       GROUP BY d.id
       ORDER BY d.updated_at DESC, d.created_at DESC`
    );
    return result.rows;
  }

  const result = await db.query(
    `SELECT d.*,
            COUNT(q.id) FILTER (WHERE q.is_active = true) as question_count,
            COUNT(DISTINCT qs.id) as session_count
     FROM quiz_decks d
     LEFT JOIN quiz_deck_questions q ON q.deck_id = d.id
     LEFT JOIN quiz_sessions qs ON qs.deck_id = d.id
     WHERE d.teacher_id = $1 AND d.is_active = true
     GROUP BY d.id
     ORDER BY d.updated_at DESC, d.created_at DESC`,
    [user.userId]
  );

  return result.rows;
}

export async function getQuizDeck(user: AuthUser, deckId: string) {
  const deck = await db.query(
    `SELECT *
     FROM quiz_decks
     WHERE id = $1 AND is_active = true
     LIMIT 1`,
    [deckId]
  );

  if (deck.rowCount === 0) {
    return null;
  }

  const data = deck.rows[0];
  if (user.role !== 'admin' && data.teacher_id !== user.userId) {
    throw new Error('Not authorized for this quiz deck');
  }

  const questions = await loadDeckQuestions(deckId);

  return {
    ...data,
    questions: questions.map((question) => ({
      id: question.id,
      questionText: question.question_text,
      questionType: question.question_type,
      options: question.options,
      correctAnswer: question.correct_answer,
      explanation: question.explanation,
      points: Number(question.points || 1000),
      timeLimitSeconds: Number(question.time_limit_seconds || 20),
      orderIndex: Number(question.order_index || 0),
    })),
  };
}

export async function saveQuizDeck(user: AuthUser, input: QuizDeckUpsertInput) {
  if (!isTeacherOrAdmin(user)) {
    throw new Error('Only teachers can manage quiz decks');
  }

  const questions = (input.questions || []).map((question, index) => normalizeQuizQuestion(question, index));
  const deckId = input.id || uuidv4();

  await withTransaction(async (client) => {
    if (input.id) {
      const existing = await client.query('SELECT teacher_id FROM quiz_decks WHERE id = $1 AND is_active = true', [deckId]);
      if (existing.rowCount === 0) {
        throw new Error('Quiz deck not found');
      }

      if (user.role !== 'admin' && existing.rows[0].teacher_id !== user.userId) {
        throw new Error('Not authorized for this quiz deck');
      }

      await client.query(
        `UPDATE quiz_decks
         SET title = $1, description = $2, subject = $3, form_level = $4, updated_at = NOW()
         WHERE id = $5`,
        [input.title.trim(), input.description || null, input.subject.trim(), input.formLevel, deckId]
      );

      await client.query('DELETE FROM quiz_deck_questions WHERE deck_id = $1', [deckId]);
    } else {
      await client.query(
        `INSERT INTO quiz_decks (id, teacher_id, title, description, subject, form_level, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [deckId, user.userId, input.title.trim(), input.description || null, input.subject.trim(), input.formLevel]
      );
    }

    for (const question of questions) {
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
          question.explanation,
          question.points,
          question.timeLimitSeconds,
          question.orderIndex,
        ]
      );
    }
  });

  return getQuizDeck(user, deckId);
}

export async function deleteQuizDeck(user: AuthUser, deckId: string) {
  if (!isTeacherOrAdmin(user)) {
    throw new Error('Only teachers can manage quiz decks');
  }

  const existing = await db.query('SELECT teacher_id FROM quiz_decks WHERE id = $1 AND is_active = true', [deckId]);
  if (existing.rowCount === 0) {
    throw new Error('Quiz deck not found');
  }

  if (user.role !== 'admin' && existing.rows[0].teacher_id !== user.userId) {
    throw new Error('Not authorized for this quiz deck');
  }

  await db.query('UPDATE quiz_decks SET is_active = false, updated_at = NOW() WHERE id = $1', [deckId]);
  return true;
}

export async function duplicateQuizDeck(user: AuthUser, deckId: string) {
  if (!isTeacherOrAdmin(user)) {
    throw new Error('Only teachers can manage quiz decks');
  }

  const source = await getQuizDeck(user, deckId);
  if (!source) {
    throw new Error('Quiz deck not found');
  }

  return saveQuizDeck(user, {
    title: `${source.title} (Copy)`,
    description: source.description || null,
    subject: source.subject,
    formLevel: Number(source.form_level ?? source.formLevel),
    questions: (source.questions || []).map((question: any) => ({
      questionText: question.questionText,
      questionType: question.questionType,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      points: question.points,
      timeLimitSeconds: question.timeLimitSeconds,
    })),
  });
}

export async function listQuizSessions(user: AuthUser, classroomId: string) {
  if (isTeacherOrAdmin(user)) {
    await ensureTeacherCanAccessClassroomSession(user, classroomId);

    const result = await db.query(
      `SELECT qs.*,
              qd.title as deck_title,
              qd.subject as deck_subject,
              qd.form_level as deck_form_level,
              COUNT(DISTINCT qsp.id) as participant_count,
              COUNT(DISTINCT qsa.id) as answer_count
       FROM quiz_sessions qs
       JOIN quiz_decks qd ON qd.id = qs.deck_id
       LEFT JOIN quiz_session_participants qsp ON qsp.session_id = qs.id
       LEFT JOIN quiz_session_answers qsa ON qsa.session_id = qs.id
       WHERE qs.classroom_id = $1
       GROUP BY qs.id, qd.id
       ORDER BY qs.created_at DESC`,
      [classroomId]
    );

    return result.rows;
  }

  if (user.role !== 'student') {
    throw new Error('Not enrolled in this classroom');
  }

  const enrolled = await db.query(
    `SELECT id FROM classroom_students
     WHERE classroom_id = $1 AND student_id = $2 AND is_active = true`,
    [classroomId, user.userId]
  );
  if ((enrolled.rowCount ?? 0) === 0) {
    throw new Error('Not enrolled in this classroom');
  }

  const result = await db.query(
    `SELECT qs.id, qs.pin, qs.status, qs.started_at, qs.current_question_index,
            qs.created_at, qd.title as deck_title, qd.subject
       FROM quiz_sessions qs
       JOIN quiz_decks qd ON qd.id = qs.deck_id
       WHERE qs.classroom_id = $1
         AND qs.status IN ('waiting', 'lobby', 'active')
       ORDER BY qs.created_at DESC
       LIMIT 10`,
    [classroomId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    pin: row.pin,
    status: row.status,
    deckTitle: row.deck_title,
    subject: row.subject,
    startedAt: row.started_at,
    currentQuestionIndex: Number(row.current_question_index ?? 0),
    createdAt: row.created_at,
  }));
}

export async function getSessionParticipantReview(
  user: AuthUser,
  sessionId: string,
  participantToken: string,
) {
  const sessionResult = await db.query(
    `SELECT qs.id, qs.status, qs.deck_id, qs.classroom_id, qs.teacher_id
     FROM quiz_sessions qs
     WHERE qs.id = $1`,
    [sessionId]
  );
  if (sessionResult.rowCount === 0) throw new Error('Session not found');
  const session = sessionResult.rows[0];
  if (session.status !== 'ended') throw new Error('Session is not yet ended');

  let participantId: string;
  if (isTeacherOrAdmin(user)) {
    const pResult = await db.query(
      `SELECT id FROM quiz_session_participants
       WHERE session_id = $1 AND join_token = $2`,
      [sessionId, participantToken]
    );
    if (pResult.rowCount === 0) throw new Error('Participant not found');
    participantId = pResult.rows[0].id;
  } else {
    const pResult = await db.query(
      `SELECT id FROM quiz_session_participants
       WHERE session_id = $1 AND join_token = $2 AND user_id = $3`,
      [sessionId, participantToken, user.userId]
    );
    if (pResult.rowCount === 0) throw new Error('Participant not found or not authorized');
    participantId = pResult.rows[0].id;
  }

  const questionsResult = await db.query(
    `SELECT q.id, q.question_text, q.question_type, q.options, q.correct_answer, q.explanation, q.order_index
     FROM quiz_deck_questions q
     WHERE q.deck_id = $1
     ORDER BY q.order_index`,
    [session.deck_id]
  );

  const answersResult = await db.query(
    `SELECT question_id, selected_answer, is_correct, response_time_ms
     FROM quiz_session_answers
     WHERE session_id = $1 AND participant_id = $2`,
    [sessionId, participantId]
  );
  const answersByQuestion = new Map(answersResult.rows.map((row) => [row.question_id, row]));

  return questionsResult.rows.map((question, index) => {
    const answer = answersByQuestion.get(question.id);
    const options = normalizeReviewOptions(question.options);
    return {
      orderIndex: Number(question.order_index ?? index),
      questionText: question.question_text,
      questionType: question.question_type,
      selectedAnswer: answer ? answerTextForReview(answer.selected_answer, options) : null,
      correctAnswer: answerTextForReview(question.correct_answer, options),
      isCorrect: Boolean(answer?.is_correct),
      didAnswer: Boolean(answer),
      explanation: question.explanation ?? null,
      responseTimeMs: Number(answer?.response_time_ms ?? 0),
    };
  });
}

function normalizeReviewOptions(rawOptions: unknown): unknown[] {
  if (Array.isArray(rawOptions)) return rawOptions;
  if (!rawOptions) return [];
  if (typeof rawOptions === 'string') {
    try {
      const parsed = JSON.parse(rawOptions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function answerTextForReview(rawAnswer: unknown, options: unknown[]) {
  const answer = normalizeReviewAnswer(rawAnswer);
  if (answer === null || answer === undefined || answer === '') return null;

  const index =
    typeof answer === 'object' && !Array.isArray(answer)
      ? Number((answer as any).optionIndex ?? (answer as any).selectedOptionIndex)
      : Number(answer);

  if (Number.isInteger(index) && index >= 0 && index < options.length) {
    return optionTextForReview(options[index]);
  }

  return typeof answer === 'object' ? JSON.stringify(answer) : String(answer);
}

function normalizeReviewAnswer(rawAnswer: unknown): any {
  if (rawAnswer === null || rawAnswer === undefined) return null;
  if (typeof rawAnswer !== 'string') return rawAnswer;
  const trimmed = rawAnswer.trim();
  if (!trimmed) return '';
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function optionTextForReview(option: unknown) {
  if (option === null || option === undefined) return null;
  if (typeof option === 'object') {
    const value = option as any;
    return String(value.text ?? value.label ?? value.value ?? JSON.stringify(option));
  }
  return String(option);
}

export async function createQuizSession(user: AuthUser, input: { classroomId: string; deckId: string }) {
  if (!isTeacherOrAdmin(user)) {
    throw new Error('Only teachers can start quiz sessions');
  }

  const classroom = await db.query(
    'SELECT id, teacher_id, name, subject, form_level FROM classrooms WHERE id = $1 AND is_active = true',
    [input.classroomId]
  );

  if (classroom.rowCount === 0) {
    throw new Error('Classroom not found');
  }

  if (user.role !== 'admin' && classroom.rows[0].teacher_id !== user.userId) {
    throw new Error('Not authorized for this classroom');
  }

  const deck = await db.query(
    'SELECT * FROM quiz_decks WHERE id = $1 AND is_active = true',
    [input.deckId]
  );

  if (deck.rowCount === 0) {
    throw new Error('Quiz deck not found');
  }

  if (user.role !== 'admin' && deck.rows[0].teacher_id !== user.userId) {
    throw new Error('Not authorized for this quiz deck');
  }

  const questions = await loadDeckQuestions(input.deckId);
  if (questions.length === 0) {
    throw new Error('Quiz deck needs at least one question');
  }

  const activeSession = await db.query(
    `SELECT id
     FROM quiz_sessions
     WHERE classroom_id = $1 AND status IN ('lobby', 'active')
     LIMIT 1`,
    [input.classroomId]
  );

  if ((activeSession.rowCount ?? 0) > 0) {
    throw new Error('A quiz session is already active for this classroom');
  }

  let pin = generateQuizPin();
  for (let attempts = 0; attempts < 10; attempts++) {
    const existing = await db.query(
      `SELECT id
       FROM quiz_sessions
       WHERE pin = $1 AND status IN ('lobby', 'active')
       LIMIT 1`,
      [pin]
    );

    if (existing.rowCount === 0) break;
    pin = generateQuizPin();
  }

  const sessionId = uuidv4();
  const result = await db.query(
    `INSERT INTO quiz_sessions
       (id, deck_id, classroom_id, teacher_id, pin, status, current_question_index, leaderboard_snapshot)
     VALUES ($1, $2, $3, $4, $5, 'lobby', -1, $6)
     RETURNING *`,
    [
      sessionId,
      input.deckId,
      input.classroomId,
      user.userId,
      pin,
      JSON.stringify([]),
    ]
  );

  await touchSessionPin(pin, sessionId);
  await storeSessionState(sessionId, {
    sessionId,
    status: 'lobby',
    pin,
    classroomId: input.classroomId,
    deckId: input.deckId,
    currentQuestionIndex: -1,
    questionStartedAt: null,
    questionEndsAt: null,
  });

  return {
    session: result.rows[0],
    classroom: classroom.rows[0],
    deck: deck.rows[0],
    questionCount: questions.length,
  };
}

export async function joinQuizSession(input: QuizJoinInput) {
  const pin = normalizePin(input.pin);
  const sessionResult = await getActiveQuizSessionByPin(pin);
  if (sessionResult.rowCount === 0) {
    const latestSession = await getLatestQuizSessionByPin(pin);
    const latestStatus = latestSession.rows[0]?.status;
    if (latestStatus === 'ended' || latestStatus === 'cancelled') {
      throw new Error('Quiz session has ended');
    }
    throw new Error('Invalid quiz PIN');
  }

  const session = sessionResult.rows[0];
  const questions = await loadDeckQuestions(session.deck_id);
  if (questions.length === 0) {
    throw new Error('Quiz session has no questions');
  }

  if (input.user && input.user.role === 'student') {
    if (!(await canStudentJoinQuizSession(input.user, session.classroom_id))) {
      throw new Error('Student is not enrolled in this quiz classroom');
    }

    const existingParticipant = await db.query(
      `SELECT *
       FROM quiz_session_participants
       WHERE session_id = $1 AND user_id = $2
       LIMIT 1`,
      [session.id, input.user.userId]
    );

    if ((existingParticipant.rowCount ?? 0) > 0) {
      await db.query(
        `UPDATE quiz_session_participants
         SET is_connected = true, last_seen_at = NOW(), left_at = NULL, updated_at = NOW()
         WHERE id = $1`,
        [existingParticipant.rows[0].id]
      );

      const snapshot = await createSessionSnapshot(session.id, { participantToken: existingParticipant.rows[0].join_token });
      return {
        session,
        participant: existingParticipant.rows[0],
        snapshot,
      };
    }

    const userResult = await db.query('SELECT full_name FROM users WHERE id = $1 AND role = $2', [input.user.userId, 'student']);
    const displayName = formatQuizParticipantDisplayName(userResult.rows[0]?.full_name, 'Student');
    const joinToken = uuidv4();

    const participantResult = await db.query(
      `INSERT INTO quiz_session_participants
         (id, session_id, user_id, guest_name, display_name, is_guest, join_token, is_connected)
       VALUES ($1, $2, $3, NULL, $4, false, $5, true)
       RETURNING *`,
      [uuidv4(), session.id, input.user.userId, displayName, joinToken]
    );

    const snapshot = await createSessionSnapshot(session.id, { participantToken: participantResult.rows[0].join_token });
    return {
      session,
      participant: participantResult.rows[0],
      snapshot,
    };
  }

  const nickname = formatQuizParticipantDisplayName(input.nickname, 'Guest');
  if (!nickname.trim()) {
    throw new Error('Nickname is required');
  }

  const joinToken = uuidv4();
  const participantResult = await db.query(
    `INSERT INTO quiz_session_participants
       (id, session_id, user_id, guest_name, display_name, is_guest, join_token, is_connected)
     VALUES ($1, $2, NULL, $3, $4, true, $5, true)
     RETURNING *`,
    [uuidv4(), session.id, nickname, nickname, joinToken]
  );

  const snapshot = await createSessionSnapshot(session.id, { participantToken: participantResult.rows[0].join_token });
  return {
    session,
    participant: participantResult.rows[0],
    snapshot,
  };
}

export async function getQuizSessionSnapshot(sessionId: string, options?: { participantToken?: string | null; revealCorrectAnswer?: boolean }) {
  return createSessionSnapshot(sessionId, options);
}

export async function getQuizSessionById(sessionId: string) {
  return loadSessionRecord(sessionId);
}

export async function getQuizSessionParticipantByToken(sessionId: string, participantToken: string) {
  return findParticipantByToken(sessionId, participantToken);
}

export async function getQuizSessionQuestions(sessionId: string) {
  const session = await loadSessionRecord(sessionId);
  if (!session) return null;
  return loadDeckQuestions(session.deck_id);
}

export async function getQuizSessionFromPin(pin: string) {
  const result = await getActiveQuizSessionByPin(pin);
  return result.rows[0] || null;
}

export async function startQuizSession(user: AuthUser, sessionId: string) {
  const session = await loadSessionRecord(sessionId);
  if (!session) {
    throw new Error('Quiz session not found');
  }

  await ensureTeacherCanAccessSession(user, session);

  if (session.status !== 'lobby') {
    throw new Error('Quiz session is already running or finished');
  }

  const questions = await loadDeckQuestions(session.deck_id);
  if (questions.length === 0) {
    throw new Error('Quiz deck needs at least one question');
  }

  const firstQuestion = questions[0];
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + Number(firstQuestion.time_limit_seconds || 20) * 1000);

  await db.query(
    `UPDATE quiz_sessions
     SET status = 'active',
         current_question_index = 0,
         current_question_id = $2,
         question_started_at = $3,
         question_ends_at = $4,
         question_paused_at = NULL,
         question_remaining_ms = NULL,
         started_at = COALESCE(started_at, NOW()),
         updated_at = NOW()
     WHERE id = $1`,
    [sessionId, firstQuestion.id, startedAt, endsAt]
  );

  await storeSessionState(sessionId, {
    sessionId,
    status: 'active',
    pin: session.pin,
    classroomId: session.classroom_id,
    deckId: session.deck_id,
    currentQuestionIndex: 0,
    currentQuestionId: firstQuestion.id,
    questionStartedAt: startedAt.toISOString(),
    questionEndsAt: endsAt.toISOString(),
    questionPausedAt: null,
    questionRemainingMs: null,
  });

  return createSessionSnapshot(sessionId, { revealCorrectAnswer: true });
}

export async function advanceQuizSession(user: AuthUser, sessionId: string) {
  const session = await loadSessionRecord(sessionId);
  if (!session) {
    throw new Error('Quiz session not found');
  }

  await ensureTeacherCanAccessSession(user, session);

  if (session.status !== 'active') {
    throw new Error('Quiz session is not active');
  }

  const questions = await loadDeckQuestions(session.deck_id);
  const currentIndex = Number(session.current_question_index ?? -1);
  const nextIndex = currentIndex + 1;

  if (nextIndex >= questions.length) {
    return endQuizSession(user, sessionId);
  }

  const nextQuestion = questions[nextIndex];
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + Number(nextQuestion.time_limit_seconds || 20) * 1000);

  await db.query(
    `UPDATE quiz_sessions
     SET current_question_index = $2,
         current_question_id = $3,
         question_started_at = $4,
         question_ends_at = $5,
         question_paused_at = NULL,
         question_remaining_ms = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [sessionId, nextIndex, nextQuestion.id, startedAt, endsAt]
  );

  await storeSessionState(sessionId, {
    sessionId,
    status: 'active',
    pin: session.pin,
    classroomId: session.classroom_id,
    deckId: session.deck_id,
    currentQuestionIndex: nextIndex,
    currentQuestionId: nextQuestion.id,
    questionStartedAt: startedAt.toISOString(),
    questionEndsAt: endsAt.toISOString(),
    questionPausedAt: null,
    questionRemainingMs: null,
  });

  return createSessionSnapshot(sessionId, { revealCorrectAnswer: true });
}

export async function controlQuizSessionTimer(user: AuthUser, sessionId: string, input: QuizTimerControlInput) {
  const session = await loadSessionRecord(sessionId);
  if (!session) {
    throw new Error('Quiz session not found');
  }

  await ensureTeacherCanAccessSession(user, session);

  if (session.status !== 'active') {
    throw new Error('Quiz session is not active');
  }

  if (!session.current_question_id || !session.question_started_at) {
    throw new Error('No active question');
  }

  const action = String(input.action || '').trim() as QuizTimerAction;
  const questions = await loadDeckQuestions(session.deck_id);
  const currentQuestion = questions.find((question) => question.id === session.current_question_id);
  if (!currentQuestion) {
    throw new Error('Current question not found');
  }

  const now = new Date();
  const paused = Boolean(session.question_paused_at);
  const rawTimeLimitSeconds = Number(currentQuestion.time_limit_seconds || 20);
  const timeLimitMs = (Number.isFinite(rawTimeLimitSeconds) && rawTimeLimitSeconds > 0 ? rawTimeLimitSeconds : 20) * 1000;

  if (action === 'pause') {
    if (!paused) {
      const endsAt = session.question_ends_at ? new Date(session.question_ends_at) : now;
      const remainingMs = Math.max(0, endsAt.getTime() - now.getTime());
      await db.query(
        `UPDATE quiz_sessions
         SET question_paused_at = $2,
             question_remaining_ms = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [sessionId, now, remainingMs]
      );
    }
  } else if (action === 'resume') {
    if (paused) {
      const remainingMs = Math.max(0, Number(session.question_remaining_ms || 0));
      const newEndsAt = new Date(now.getTime() + remainingMs);
      const elapsedBeforePauseMs = Math.max(0, Math.min(timeLimitMs, timeLimitMs - remainingMs));
      const adjustedStartedAt = new Date(now.getTime() - elapsedBeforePauseMs);
      await db.query(
        `UPDATE quiz_sessions
         SET question_started_at = $2,
             question_ends_at = $3,
             question_paused_at = NULL,
             question_remaining_ms = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [sessionId, adjustedStartedAt, newEndsAt]
      );
    }
  } else if (action === 'add_time') {
    const rawSeconds = Number(input.seconds || 15);
    const seconds = Math.min(300, Math.max(1, Number.isFinite(rawSeconds) ? rawSeconds : 15));
    const incrementMs = Math.round(seconds * 1000);

    if (paused) {
      const remainingMs = Math.max(0, Number(session.question_remaining_ms || 0)) + incrementMs;
      await db.query(
        `UPDATE quiz_sessions
         SET question_remaining_ms = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [sessionId, remainingMs]
      );
    } else {
      const currentEndsAt = session.question_ends_at ? new Date(session.question_ends_at) : now;
      const baseTime = Math.max(currentEndsAt.getTime(), now.getTime());
      const newEndsAt = new Date(baseTime + incrementMs);
      await db.query(
        `UPDATE quiz_sessions
         SET question_ends_at = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [sessionId, newEndsAt]
      );
    }
  } else {
    throw new Error('Invalid timer action');
  }

  const snapshot = await createSessionSnapshot(sessionId, { revealCorrectAnswer: true });
  if (snapshot) {
    await storeSessionState(sessionId, {
      sessionId,
      status: snapshot.session.status,
      pin: snapshot.session.pin,
      classroomId: snapshot.session.classroomId,
      deckId: snapshot.session.deckId,
      currentQuestionIndex: snapshot.session.currentQuestionIndex,
      currentQuestionId: snapshot.session.currentQuestionId,
      questionStartedAt: snapshot.session.questionStartedAt,
      questionEndsAt: snapshot.session.questionEndsAt,
      questionPausedAt: snapshot.session.questionPausedAt,
      questionRemainingMs: snapshot.session.questionRemainingMs,
      endedAt: snapshot.session.endedAt || null,
    });
  }

  return snapshot;
}

export async function endQuizSession(user: AuthUser, sessionId: string) {
  const session = await loadSessionRecord(sessionId);
  if (!session) {
    throw new Error('Quiz session not found');
  }

  await ensureTeacherCanAccessSession(user, session);

  if (session.status === 'ended' || session.status === 'cancelled') {
    return createSessionSnapshot(sessionId, { revealCorrectAnswer: true });
  }

  const participants = await db.query(
    `SELECT qsp.*, u.role
     FROM quiz_session_participants qsp
     LEFT JOIN users u ON u.id = qsp.user_id
     WHERE qsp.session_id = $1
     ORDER BY qsp.total_score DESC, qsp.correct_count DESC, qsp.answered_count ASC, qsp.display_name ASC`,
    [sessionId]
  );

  const questionCount = (await loadDeckQuestions(session.deck_id)).length;
  const xpAwards: Array<{ userId: string; amount: number }> = [];

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE quiz_sessions
       SET status = 'ended',
           ended_at = NOW(),
           leaderboard_snapshot = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [sessionId, JSON.stringify(buildLeaderboard(
        participants.rows.map((participant: any) => ({
          participantId: participant.id,
          displayName: participant.display_name,
          totalScore: Number(participant.total_score || 0),
          correctCount: Number(participant.correct_count || 0),
          answeredCount: Number(participant.answered_count || 0),
          isGuest: Boolean(participant.is_guest),
          userId: participant.user_id || null,
        }))
      ))]
    );

    for (const participant of participants.rows) {
      if (!participant.user_id || participant.role !== 'student') continue;

      const amount = Number(participant.total_score || 0);
      xpAwards.push({ userId: participant.user_id, amount });

      await client.query(
        `INSERT INTO xp_events (id, user_id, source_type, source_id, amount, metadata)
         VALUES ($1, $2, 'quiz_session', $3, $4, $5)
         ON CONFLICT (user_id, source_type, source_id) DO NOTHING`,
        [
          uuidv4(),
          participant.user_id,
          sessionId,
          amount,
          JSON.stringify({
            sessionId,
            deckId: session.deck_id,
            classroomId: session.classroom_id,
            participantId: participant.id,
            totalScore: amount,
          }),
        ]
      );

      await client.query(
        `UPDATE quiz_session_participants
         SET xp_awarded = $2,
             is_connected = false,
             left_at = COALESCE(left_at, NOW()),
             updated_at = NOW()
         WHERE id = $1`,
        [participant.id, amount]
      );
    }

    await client.query(
      `UPDATE quiz_session_participants
       SET is_connected = false,
           left_at = COALESCE(left_at, NOW()),
           updated_at = NOW()
       WHERE session_id = $1 AND left_at IS NULL`,
      [sessionId]
    );
  });

  const snapshot = await createSessionSnapshot(sessionId, { revealCorrectAnswer: true });
  await storeSessionState(sessionId, {
    sessionId,
    status: 'ended',
    pin: session.pin,
    classroomId: session.classroom_id,
    deckId: session.deck_id,
    currentQuestionIndex: Number(session.current_question_index ?? -1),
    currentQuestionId: session.current_question_id,
    questionStartedAt: session.question_started_at,
    questionEndsAt: session.question_ends_at,
    questionPausedAt: null,
    questionRemainingMs: null,
    endedAt: new Date().toISOString(),
  });

  await Promise.all(participants.rows.map(async (participant: any) => {
    if (!participant.user_id || participant.role !== 'student') return;

    const answeredCount = Number(participant.answered_count || 0);
    const correctCount = Number(participant.correct_count || 0);
    const completed = questionCount > 0 && answeredCount >= questionCount;
    const score = questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0;

    await Promise.all([
      checkAndAwardAchievements(participant.user_id, {
        score,
        perfect: completed && score === 100,
        streak: await getStudentStreak(participant.user_id),
      }),
      maybeDecrementStudentHeartsOnQuizFailure(participant.user_id, score, completed),
    ]);
  }));

  return {
    snapshot,
    xpAwards,
  };
}

export async function cancelQuizSession(user: AuthUser, sessionId: string) {
  const session = await loadSessionRecord(sessionId);
  if (!session) {
    throw new Error('Quiz session not found');
  }

  await ensureTeacherCanAccessSession(user, session);

  if (session.status === 'ended' || session.status === 'cancelled') {
    return createSessionSnapshot(sessionId, { revealCorrectAnswer: true });
  }

  const participants = await db.query(
    `SELECT qsp.*
     FROM quiz_session_participants qsp
     WHERE qsp.session_id = $1
     ORDER BY qsp.total_score DESC, qsp.correct_count DESC, qsp.answered_count ASC, qsp.display_name ASC`,
    [sessionId]
  );

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE quiz_sessions
       SET status = 'cancelled',
           ended_at = NOW(),
           leaderboard_snapshot = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [sessionId, JSON.stringify(buildLeaderboard(
        participants.rows.map((participant: any) => ({
          participantId: participant.id,
          displayName: participant.display_name,
          totalScore: Number(participant.total_score || 0),
          correctCount: Number(participant.correct_count || 0),
          answeredCount: Number(participant.answered_count || 0),
          isGuest: Boolean(participant.is_guest),
          userId: participant.user_id || null,
        }))
      ))]
    );

    await client.query(
      `UPDATE quiz_session_participants
       SET is_connected = false,
           left_at = COALESCE(left_at, NOW()),
           updated_at = NOW()
       WHERE session_id = $1`,
      [sessionId]
    );
  });

  await clearSessionPin(session.pin);
  await redis.del(stateKey(sessionId));

  const snapshot = await createSessionSnapshot(sessionId, { revealCorrectAnswer: true });
  if (snapshot) {
    await storeSessionState(sessionId, {
      sessionId,
      status: snapshot.session.status,
      pin: snapshot.session.pin,
      classroomId: snapshot.session.classroomId,
      deckId: snapshot.session.deckId,
      currentQuestionIndex: snapshot.session.currentQuestionIndex,
      currentQuestionId: snapshot.session.currentQuestionId,
      questionStartedAt: snapshot.session.questionStartedAt,
      questionEndsAt: snapshot.session.questionEndsAt,
      questionPausedAt: snapshot.session.questionPausedAt,
      questionRemainingMs: snapshot.session.questionRemainingMs,
      endedAt: snapshot.session.endedAt || new Date().toISOString(),
    });
  }

  return snapshot;
}

export async function submitQuizAnswer(input: QuizAnswerInput) {
  const session = await loadSessionRecord(input.sessionId);
  if (!session) {
    throw new Error('Quiz session not found');
  }

  if (session.status !== 'active') {
    throw new Error('Quiz session is not active');
  }

  const questionPaused = Boolean(session.question_paused_at);
  if (!session.question_started_at || (!session.question_ends_at && !questionPaused) || !session.current_question_id) {
    throw new Error('No active question');
  }

  const participant = await findParticipantByToken(input.sessionId, input.participantToken);
  if (!participant) {
    throw new Error('Participant not found');
  }

  if (!participant.is_connected) {
    await db.query(
      `UPDATE quiz_session_participants
       SET is_connected = true, last_seen_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [participant.id]
    );
  }

  const questions = await loadDeckQuestions(session.deck_id);
  const currentQuestion = questions.find((question) => question.id === session.current_question_id) || null;
  if (!currentQuestion) {
    throw new Error('Current question not found');
  }

  const now = new Date();
  const startedAt = new Date(session.question_started_at);
  const endsAt = session.question_ends_at ? new Date(session.question_ends_at) : now;

  if (!questionPaused && now.getTime() > endsAt.getTime()) {
    throw new Error('Question time expired');
  }

  const options = Array.isArray(currentQuestion.options) ? currentQuestion.options : [];
  const hasSelectedOptionIndex = input.selectedOptionIndex !== undefined && input.selectedOptionIndex !== null;
  const submittedAnswer = hasSelectedOptionIndex
    ? { optionIndex: Number(input.selectedOptionIndex) }
    : input.selectedAnswer;

  if (quizAnswerIsBlank(submittedAnswer)) {
    throw new Error('Selected answer is required');
  }

  if (hasSelectedOptionIndex) {
    const selectedIndex = Number(input.selectedOptionIndex);
    if (!Number.isInteger(selectedIndex)) {
      throw new Error('Selected answer must be an option index');
    }

    if (selectedIndex < 0 || selectedIndex >= options.length) {
      throw new Error('Selected answer is out of range');
    }
  }

  const correctAnswerIndex = Number(currentQuestion.correct_answer?.optionIndex ?? -1);
  const grade = gradeQuizAnswer(
    submittedAnswer,
    currentQuestion.correct_answer,
    currentQuestion.question_type,
    options,
  );
  const isCorrect = grade.isCorrect;
  const rawAnswerTimeLimitSeconds = Number(currentQuestion.time_limit_seconds || 20);
  const timeLimitMs = (Number.isFinite(rawAnswerTimeLimitSeconds) && rawAnswerTimeLimitSeconds > 0
    ? rawAnswerTimeLimitSeconds
    : 20) * 1000;
  const elapsedMs = questionPaused
    ? Math.max(0, timeLimitMs - Math.max(0, Number(session.question_remaining_ms || 0)))
    : Math.max(0, now.getTime() - startedAt.getTime());
  const baseScore = calculateQuestionScore(
    Number(currentQuestion.points || 1000),
    Number(currentQuestion.time_limit_seconds || 20),
    elapsedMs,
  );
  const pointsAwarded = Math.round(baseScore * grade.scoreMultiplier);

  const insertResult = await withTransaction(async (client) => {
    const answerResult = await client.query(
      `INSERT INTO quiz_session_answers
         (id, session_id, participant_id, question_id, selected_answer, is_correct, response_time_ms, points_awarded)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (participant_id, question_id) DO NOTHING
       RETURNING *`,
      [
        uuidv4(),
        input.sessionId,
        participant.id,
        currentQuestion.id,
        JSON.stringify(submittedAnswer),
        isCorrect,
        elapsedMs,
        pointsAwarded,
      ]
    );

    if (answerResult.rowCount === 0) {
      throw new Error('Participant already answered this question');
    }

    const updatedParticipant = await client.query(
      `UPDATE quiz_session_participants
       SET total_score = total_score + $2,
           correct_count = correct_count + $3,
           answered_count = answered_count + 1,
           last_seen_at = NOW(),
           is_connected = true,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [participant.id, pointsAwarded, isCorrect ? 1 : 0]
    );

    return {
      answer: answerResult.rows[0],
      participant: updatedParticipant.rows[0],
    };
  });

  const snapshot = await createSessionSnapshot(input.sessionId, {
    participantToken: participant.join_token,
    revealCorrectAnswer: false,
  });

  return {
    ...insertResult,
    snapshot,
    currentQuestion: buildQuestionSnapshot(currentQuestion, false),
    correctAnswerIndex,
    isCorrect,
    pointsAwarded,
    elapsedMs,
  };
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

async function maybeDecrementStudentHeartsOnQuizFailure(
  studentId: string,
  score: number,
  isCompleted: boolean,
) {
  await regenerateStudentHearts(studentId);
  if (isCompleted || Number(score) >= QUIZ_FAIL_SCORE_THRESHOLD) {
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

export async function markParticipantConnected(sessionId: string, participantToken: string, connected: boolean) {
  const participant = await findParticipantByToken(sessionId, participantToken);
  if (!participant) return null;

  await db.query(
    `UPDATE quiz_session_participants
     SET is_connected = $2,
         last_seen_at = NOW(),
         left_at = CASE WHEN $2 = false THEN COALESCE(left_at, NOW()) ELSE NULL END,
         updated_at = NOW()
     WHERE id = $1`,
    [participant.id, connected]
  );

  return participant;
}

export async function getStudentQuizSummary(viewer: AuthUser, studentId: string) {
  const canView = await canViewStudentQuizSummary(viewer, studentId);
  if (!canView) {
    throw new Error('Not authorized to view this student\'s quiz history');
  }

  const xpResult = await db.query(
    `SELECT COALESCE(SUM(amount), 0) as quiz_xp_total
     FROM xp_events
     WHERE user_id = $1 AND source_type = 'quiz_session'`,
    [studentId]
  );

  const sessions = await db.query(
    `SELECT qsp.id as participant_id,
            qsp.join_token,
            qsp.display_name,
            qsp.total_score,
            qsp.correct_count,
            qsp.answered_count,
            qsp.xp_awarded,
            qsp.is_guest,
            qsp.joined_at,
            qsp.left_at,
            qs.id as session_id,
            qs.pin,
            qs.status,
            qs.started_at,
            qs.ended_at,
            qs.created_at,
            qd.title as deck_title,
            qd.subject as deck_subject,
            qd.form_level as deck_form_level,
            c.name as classroom_name
     FROM quiz_session_participants qsp
     JOIN quiz_sessions qs ON qs.id = qsp.session_id
     JOIN quiz_decks qd ON qd.id = qs.deck_id
     JOIN classrooms c ON c.id = qs.classroom_id
     WHERE qsp.user_id = $1
     ORDER BY qs.created_at DESC
     LIMIT 10`,
    [studentId]
  );

  return {
    quizXpTotal: Number(xpResult.rows[0]?.quiz_xp_total || 0),
    recentSessions: sessions.rows.map((row) => ({
      participantId: row.participant_id,
      sessionId: row.session_id,
      joinToken: row.join_token,
      displayName: row.display_name,
      totalScore: Number(row.total_score || 0),
      correctCount: Number(row.correct_count || 0),
      answeredCount: Number(row.answered_count || 0),
      xpAwarded: Number(row.xp_awarded || 0),
      isGuest: Boolean(row.is_guest),
      pin: row.pin,
      status: row.status,
      deckTitle: row.deck_title,
      deckSubject: row.deck_subject,
      deckFormLevel: row.deck_form_level,
      classroomName: row.classroom_name,
      joinedAt: row.joined_at,
      leftAt: row.left_at,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      createdAt: row.created_at,
    })),
  };
}

async function canViewStudentQuizSummary(user: AuthUser, studentId: string) {
  if (user.role === 'admin') return true;
  if (user.userId === studentId) return true;

  if (user.role === 'parent') {
    const result = await db.query(
      `SELECT id FROM parent_student_links
       WHERE parent_id = $1 AND student_id = $2 AND is_active = true`,
      [user.userId, studentId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  if (user.role === 'teacher') {
    const result = await db.query(
      `SELECT ce.id
       FROM classroom_enrollments ce
       JOIN classrooms c ON c.id = ce.classroom_id
       WHERE c.teacher_id = $1 AND ce.student_id = $2 AND ce.is_active = true AND c.is_active = true`,
      [user.userId, studentId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  return false;
}

export async function getQuizSessionStateFromRedis(sessionId: string) {
  return readSessionState(sessionId);
}

export async function loadQuizSessionState(sessionId: string, viewer?: { participantToken?: string | null; revealCorrectAnswer?: boolean }) {
  const cached = await readSessionState(sessionId);
  if (cached) {
    return createSessionSnapshot(sessionId, viewer);
  }

  const snapshot = await createSessionSnapshot(sessionId, viewer);
  if (snapshot) {
    await storeSessionState(sessionId, {
      sessionId,
      status: snapshot.session.status,
      pin: snapshot.session.pin,
      classroomId: snapshot.session.classroomId,
      deckId: snapshot.session.deckId,
      currentQuestionIndex: snapshot.session.currentQuestionIndex,
      currentQuestionId: snapshot.session.currentQuestionId,
      questionStartedAt: snapshot.session.questionStartedAt,
      questionEndsAt: snapshot.session.questionEndsAt,
      endedAt: snapshot.session.endedAt || null,
    });
  }

  return snapshot;
}

export async function saveLoadedSessionPin(sessionId: string, pin: string) {
  await touchSessionPin(pin, sessionId);
}

export async function clearLoadedSessionPin(pin: string) {
  await clearSessionPin(pin);
}

export async function loadQuizSessionMeta(sessionId: string) {
  return getQuestionForSession(sessionId);
}
