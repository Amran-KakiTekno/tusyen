export type QuizQuestionType = 'multiple_choice' | 'true_false';

export type QuizQuestionInput = {
  text?: string;
  questionText?: string;
  type?: QuizQuestionType;
  questionType?: QuizQuestionType;
  options?: unknown;
  correctAnswer?: unknown;
  explanation?: string | null;
  points?: number | string | null;
  timeLimitSeconds?: number | string | null;
  time_limit_seconds?: number | string | null;
};

export type QuizDeckQuestion = {
  questionText: string;
  questionType: QuizQuestionType;
  options: string[];
  correctAnswer: { optionIndex: number };
  explanation: string | null;
  points: number;
  timeLimitSeconds: number;
  orderIndex: number;
};

export type QuizLeaderboardEntry = {
  participantId: string;
  displayName: string;
  totalScore: number;
  correctCount: number;
  answeredCount: number;
  isGuest: boolean;
  userId?: string | null;
};

export function generateQuizPin(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
}

export function normalizeQuizQuestion(input: QuizQuestionInput, orderIndex: number): QuizDeckQuestion {
  const questionType = input.questionType || input.type || 'multiple_choice';
  const questionText = String(input.questionText ?? input.text ?? '').trim();
  const rawPoints = Number(input.points ?? 1000);
  const rawTimeLimit = Number(input.timeLimitSeconds ?? input.time_limit_seconds ?? 20);

  if (!questionText) {
    throw new Error('Question text is required');
  }

  if (questionType !== 'multiple_choice' && questionType !== 'true_false') {
    throw new Error('Only multiple_choice and true_false questions are supported');
  }

  let options: string[] = [];
  let correctAnswerIndex = 0;

  if (questionType === 'true_false') {
    options = ['True', 'False'];

    if (typeof input.correctAnswer === 'boolean') {
      correctAnswerIndex = input.correctAnswer ? 0 : 1;
    } else if (typeof input.correctAnswer === 'number') {
      correctAnswerIndex = input.correctAnswer === 0 ? 0 : 1;
    } else if (typeof input.correctAnswer === 'string') {
      const normalized = input.correctAnswer.toLowerCase().trim();
      correctAnswerIndex = normalized === 'true' || normalized === '1' ? 0 : 1;
    }
  } else {
    const rawOptions = Array.isArray(input.options) ? input.options : [];
    options = rawOptions.map((option) => String(option).trim()).filter(Boolean);

    if (options.length < 2) {
      throw new Error('Multiple choice questions need at least two options');
    }

    if (typeof input.correctAnswer === 'number') {
      correctAnswerIndex = input.correctAnswer;
    } else if (typeof input.correctAnswer === 'string') {
      const answerText = input.correctAnswer.trim();
      const matchingOptionIndex = options.findIndex((option) => option.toLowerCase() === answerText.toLowerCase());
      if (matchingOptionIndex >= 0) {
        correctAnswerIndex = matchingOptionIndex;
      } else {
        const optionIndex = Number(answerText);
        if (!Number.isNaN(optionIndex)) {
          correctAnswerIndex = optionIndex;
        }
      }
    } else if (typeof input.correctAnswer === 'object' && input.correctAnswer !== null) {
      const answer = input.correctAnswer as any;
      const answerIndex = Number(answer.optionIndex ?? answer.index);
      if (!Number.isNaN(answerIndex)) {
        correctAnswerIndex = answerIndex;
      } else if (typeof answer.text === 'string' || typeof answer.value === 'string') {
        const answerText = String(answer.text ?? answer.value).trim();
        const matchingOptionIndex = options.findIndex((option) => option.toLowerCase() === answerText.toLowerCase());
        if (matchingOptionIndex >= 0) {
          correctAnswerIndex = matchingOptionIndex;
        }
      }
    }
  }

  if (!Number.isInteger(correctAnswerIndex) || correctAnswerIndex < 0 || correctAnswerIndex >= options.length) {
    throw new Error('Correct answer is out of range for the question options');
  }

  return {
    questionText,
    questionType,
    options,
    correctAnswer: { optionIndex: correctAnswerIndex },
    explanation: input.explanation ?? null,
    points: Number.isFinite(rawPoints) && rawPoints > 0 ? Math.round(rawPoints) : 1000,
    timeLimitSeconds: Number.isFinite(rawTimeLimit) && rawTimeLimit > 0 ? Math.round(rawTimeLimit) : 20,
    orderIndex,
  };
}

export function questionRowForClient(question: any, revealCorrectAnswer = false) {
  return {
    id: question.id,
    deckId: question.deck_id,
    questionText: question.question_text,
    questionType: question.question_type,
    options: asArray(question.options),
    explanation: question.explanation || null,
    points: Number(question.points || 1000),
    timeLimitSeconds: Number(question.time_limit_seconds || 20),
    orderIndex: Number(question.order_index || 0),
    ...(revealCorrectAnswer
      ? { correctAnswer: question.correct_answer }
      : {}),
  };
}

export function calculateQuestionScore(points: number, timeLimitSeconds: number, elapsedMs: number): number {
  const safePoints = Number.isFinite(points) && points > 0 ? points : 1000;
  const safeLimit = Number.isFinite(timeLimitSeconds) && timeLimitSeconds > 0 ? timeLimitSeconds : 20;
  const elapsed = Math.max(0, elapsedMs);
  const remainingRatio = Math.max(0, Math.min(1, 1 - elapsed / (safeLimit * 1000)));
  const multiplier = 0.25 + 0.75 * remainingRatio;

  return Math.max(0, Math.round(safePoints * multiplier));
}

export function buildLeaderboard(entries: QuizLeaderboardEntry[], limit = 10) {
  return entries
    .slice()
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) return right.totalScore - left.totalScore;
      if (right.correctCount !== left.correctCount) return right.correctCount - left.correctCount;
      if (left.answeredCount !== right.answeredCount) return left.answeredCount - right.answeredCount;
      return left.displayName.localeCompare(right.displayName);
    })
    .slice(0, limit)
    .map((entry, index) => ({
      rank: index + 1,
      participantId: entry.participantId,
      displayName: entry.displayName,
      totalScore: entry.totalScore,
      correctCount: entry.correctCount,
      answeredCount: entry.answeredCount,
      isGuest: entry.isGuest,
      userId: entry.userId ?? null,
    }));
}

export function formatQuizParticipantDisplayName(value: unknown, fallback = 'Player'): string {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, 40) : fallback;
}

function asArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}
