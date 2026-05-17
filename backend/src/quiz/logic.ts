export const QUIZ_QUESTION_TYPES = [
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
] as const;

export type QuizQuestionType = typeof QUIZ_QUESTION_TYPES[number];

const quizQuestionTypeSet = new Set<string>(QUIZ_QUESTION_TYPES);

const choiceQuestionTypes = new Set<string>([
  'multiple_choice',
  'true_false',
]);

const pairQuestionTypes = new Set<string>([
  'matching',
  'representation_match',
  'diagram_label',
]);

const freeTextQuestionTypes = new Set<string>([
  'missing_step',
  'error_diagnosis',
  'prediction',
  'code_trace',
  'data_interpret',
  'scenario',
]);

export type QuizQuestionInput = {
  text?: string;
  questionText?: string;
  type?: QuizQuestionType;
  questionType?: QuizQuestionType;
  question_type?: QuizQuestionType;
  options?: unknown;
  correctAnswer?: unknown;
  correct_answer?: unknown;
  explanation?: string | null;
  points?: number | string | null;
  timeLimitSeconds?: number | string | null;
  time_limit_seconds?: number | string | null;
};

export type QuizDeckQuestion = {
  questionText: string;
  questionType: QuizQuestionType;
  options: unknown[];
  correctAnswer: unknown;
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
  const questionType = normalizeQuizQuestionType(input.questionType ?? input.type ?? input.question_type);
  const questionText = String(input.questionText ?? input.text ?? '').trim();
  const rawPoints = Number(input.points ?? 1000);
  const rawTimeLimit = Number(input.timeLimitSeconds ?? input.time_limit_seconds ?? 20);

  if (!questionText) {
    throw new Error('Question text is required');
  }

  const options = normalizeQuizOptions(questionType, input.options);
  const correctAnswer = normalizeQuizCorrectAnswer(
    questionType,
    input.correctAnswer ?? input.correct_answer,
    options
  );

  if (choiceQuestionTypes.has(questionType)) {
    const correctAnswerIndex = optionIndex(correctAnswer, options.length);
    if (correctAnswerIndex === null) {
      throw new Error('Correct answer is out of range for the question options');
    }
  }

  return {
    questionText,
    questionType,
    options,
    correctAnswer,
    explanation: input.explanation ?? null,
    points: Number.isFinite(rawPoints) && rawPoints > 0 ? Math.round(rawPoints) : 1000,
    timeLimitSeconds: Number.isFinite(rawTimeLimit) && rawTimeLimit > 0 ? Math.round(rawTimeLimit) : 20,
    orderIndex,
  };
}

export function normalizeQuizQuestionType(value: unknown): QuizQuestionType {
  const type = String(value ?? 'multiple_choice').trim();
  return quizQuestionTypeSet.has(type)
    ? type as QuizQuestionType
    : 'multiple_choice';
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

export function quizAnswersMatch(
  userAnswer: unknown,
  correctAnswer: unknown,
  questionType: string,
  options: unknown = [],
): boolean {
  const normalizedType = normalizeQuizQuestionType(questionType);
  const normalizedOptions = Array.isArray(options) ? options : [];

  if (choiceQuestionTypes.has(normalizedType)) {
    return choiceAnswersMatch(userAnswer, correctAnswer, normalizedOptions);
  }

  if (normalizedType === 'numeric') {
    return numericAnswersMatch(userAnswer, correctAnswer);
  }

  if (normalizedType === 'step_order') {
    return orderedAnswersMatch(userAnswer, correctAnswer, normalizedOptions);
  }

  if (pairQuestionTypes.has(normalizedType)) {
    return pairAnswersMatch(userAnswer, correctAnswer, normalizedOptions);
  }

  if (normalizedType === 'fill_blank' || freeTextQuestionTypes.has(normalizedType)) {
    return textAnswersMatch(userAnswer, correctAnswer);
  }

  return normalizeValue(userAnswer) === normalizeValue(correctAnswer);
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

export function quizAnswerIsBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0;
  return `${value}`.trim().length === 0;
}

function normalizeQuizOptions(questionType: QuizQuestionType, value: unknown): unknown[] {
  if (questionType === 'true_false') {
    return ['True', 'False'];
  }

  if (pairQuestionTypes.has(questionType)) {
    return answerPairs(value)
      .map((pair) => ({ prompt: pair.prompt, answer: pair.answer }))
      .filter((pair) => pair.prompt.length > 0 && pair.answer.length > 0);
  }

  if (questionType === 'step_order') {
    return listFromAnswer(value);
  }

  if (!Array.isArray(value)) {
    if (questionType === 'multiple_choice') {
      return `${value ?? ''}`
        .split(',')
        .map((option) => option.trim())
        .filter((option) => option.length > 0);
    }
    return [];
  }

  return value
    .map((option) => {
      if (option && typeof option === 'object' && !Array.isArray(option)) {
        const raw = option as any;
        return raw.label ?? raw.text ?? raw.value ?? raw.answer ?? raw.step ?? option;
      }
      return option;
    })
    .filter((option) => {
      if (option === undefined || option === null) return false;
      return typeof option === 'object' || String(option).trim().length > 0;
    });
}

function normalizeQuizCorrectAnswer(questionType: QuizQuestionType, value: unknown, options: unknown[]): unknown {
  if (questionType === 'true_false') {
    if (typeof value === 'boolean') return { optionIndex: value ? 0 : 1 };
    if (typeof value === 'number') return { optionIndex: value === 0 ? 0 : 1 };

    const normalized = normalizeValue(value);
    return { optionIndex: normalized === 'true' || normalized === '1' || normalized === 'yes' ? 0 : 1 };
  }

  if (questionType === 'multiple_choice') {
    if (options.length < 2) {
      throw new Error('Multiple choice questions need at least two options');
    }

    const index = optionIndex(value, options.length);
    if (index !== null) return { optionIndex: index };

    const answerText = normalizeValue(value);
    const matchingOptionIndex = options.findIndex((option) => normalizeValue(option) === answerText);
    return { optionIndex: matchingOptionIndex >= 0 ? matchingOptionIndex : -1 };
  }

  if (pairQuestionTypes.has(questionType) && quizAnswerIsBlank(value)) {
    return pairsToObject(answerPairs(options));
  }

  if (questionType === 'step_order' && quizAnswerIsBlank(value)) {
    return optionLabelsFrom(options);
  }

  return value ?? '';
}

function choiceAnswersMatch(userAnswer: unknown, correctAnswer: unknown, options: unknown[]): boolean {
  const submittedIndex = optionIndex(userAnswer, options.length);
  const correctIndex = optionIndex(correctAnswer, options.length);
  if (submittedIndex !== null && correctIndex !== null) {
    return submittedIndex === correctIndex;
  }

  const submitted = normalizeCorrectAnswerValue(userAnswer, options);
  const correct = normalizeCorrectAnswerValue(correctAnswer, options);
  return submitted.length > 0 && submitted === correct;
}

function textAnswersMatch(userAnswer: unknown, correctAnswer: unknown): boolean {
  const submitted = normalizeValue(userAnswer);
  if (!submitted) return false;

  const accepted = Array.isArray(correctAnswer)
    ? correctAnswer
    : `${correctAnswer ?? ''}`.split('|');

  return accepted.some((answer) => normalizeValue(answer) === submitted);
}

function numericAnswersMatch(userAnswer: unknown, correctAnswer: unknown): boolean {
  const submitted = numericAnswerFrom(userAnswer);
  const expected = numericAnswerFrom(correctAnswer);
  if (!submitted || !expected) return false;

  const tolerance = expected.tolerance ??
    Math.max(0.000001, Math.abs(expected.value) * 0.005);
  const valueMatches = Math.abs(submitted.value - expected.value) <= tolerance;
  const unitMatches = !expected.unit || submitted.unit === expected.unit;

  return valueMatches && unitMatches;
}

function numericAnswerFrom(value: unknown): { value: number; tolerance?: number; unit: string } | null {
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

function orderedAnswersMatch(userAnswer: unknown, correctAnswer: unknown, options: unknown[]): boolean {
  const expected = orderedAnswerList(correctAnswer, options);
  const submitted = orderedAnswerList(userAnswer, options);

  if (expected.length === 0 || submitted.length !== expected.length) return false;
  return expected.every((item, index) => item === submitted[index]);
}

function orderedAnswerList(value: unknown, options: unknown[]): string[] {
  const optionLabels = optionLabelsFrom(options);
  const source = quizAnswerIsBlank(value) ? optionLabels : listFromAnswer(value);

  return source
    .map((item) => normalizeOrderItem(item, optionLabels))
    .filter((item) => item.length > 0);
}

function optionLabelsFrom(options: unknown): string[] {
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

function listFromAnswer(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          return `${(item as any).step ?? (item as any).text ?? (item as any).label ?? (item as any).value ?? ''}`.trim();
        }
        return `${item ?? ''}`.trim();
      })
      .filter((item) => item.length > 0);
  }

  if (value && typeof value === 'object') {
    const objectValue = value as any;
    if (Array.isArray(objectValue.order)) return listFromAnswer(objectValue.order);
    if (Array.isArray(objectValue.answers)) return listFromAnswer(objectValue.answers);
    if (Array.isArray(objectValue.value)) return listFromAnswer(objectValue.value);
  }

  return `${value ?? ''}`
    .split(/\r?\n|;|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeOrderItem(value: unknown, optionLabels: string[]): string {
  const index = optionIndex(value, optionLabels.length);
  if (index !== null) {
    return normalizeValue(optionLabels[index]);
  }

  return normalizeValue(value);
}

function pairAnswersMatch(userAnswer: unknown, correctAnswer: unknown, options: unknown[]): boolean {
  const expectedPairs = answerPairs(correctAnswer);
  const expected = pairsToMap(expectedPairs.length > 0 ? expectedPairs : answerPairs(options));
  const submitted = pairsToMap(answerPairs(userAnswer));

  if (expected.size === 0 || submitted.size !== expected.size) return false;

  for (const [prompt, answer] of expected.entries()) {
    if (submitted.get(prompt) !== answer) return false;
  }

  return true;
}

function answerPairs(value: unknown): Array<{ prompt: string; answer: string }> {
  if (Array.isArray(value)) {
    return value.flatMap((item) => answerPairs(item));
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;

    if (Array.isArray(objectValue.pairs)) return answerPairs(objectValue.pairs);
    if (
      objectValue.prompt !== undefined ||
      objectValue.answer !== undefined ||
      objectValue.left !== undefined ||
      objectValue.right !== undefined ||
      objectValue.term !== undefined ||
      objectValue.match !== undefined
    ) {
      return [{
        prompt: cleanAnswerText(objectValue.prompt ?? objectValue.left ?? objectValue.label ?? objectValue.term),
        answer: cleanAnswerText(objectValue.answer ?? objectValue.right ?? objectValue.value ?? objectValue.match),
      }].filter((pair) => pair.prompt.length > 0 && pair.answer.length > 0);
    }

    return Object.entries(objectValue)
      .map(([prompt, answer]) => ({
        prompt: cleanAnswerText(prompt),
        answer: cleanAnswerText(answer),
      }))
      .filter((pair) => pair.prompt.length > 0 && pair.answer.length > 0);
  }

  return `${value ?? ''}`
    .split(/\r?\n|;/)
    .map((line) => {
      const parts = line.split(/\s*(?:=|->|:)\s*/);
      if (parts.length < 2) return null;
      const prompt = cleanAnswerText(parts[0]);
      const answer = cleanAnswerText(parts.slice(1).join('='));
      return prompt && answer ? { prompt, answer } : null;
    })
    .filter((pair): pair is { prompt: string; answer: string } => Boolean(pair));
}

function pairsToMap(pairs: Array<{ prompt: string; answer: string }>): Map<string, string> {
  return new Map(pairs.map((pair) => [normalizeValue(pair.prompt), normalizeValue(pair.answer)]));
}

function pairsToObject(pairs: Array<{ prompt: string; answer: string }>): Record<string, string> {
  return pairs.reduce<Record<string, string>>((result, pair) => {
    result[pair.prompt] = pair.answer;
    return result;
  }, {});
}

function normalizeCorrectAnswerValue(value: unknown, options: unknown[]): string {
  const index = optionIndex(value, options.length);
  if (index !== null) {
    return normalizeValue(options[index]);
  }
  return normalizeValue(value);
}

function optionIndex(value: unknown, optionCount: number): number | null {
  if (optionCount <= 0) return null;

  let raw: unknown = value;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    raw = (raw as any).optionIndex ?? (raw as any).option_index ?? (raw as any).index;
  }

  const text = `${raw ?? ''}`.trim();
  if (!/^\d+$/.test(text)) return null;

  const index = Number(text);
  return index >= 0 && index < optionCount ? index : null;
}

function normalizeValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const objectValue = value as any;
    if (objectValue.value !== undefined) return normalizeValue(objectValue.value);
    if (objectValue.text !== undefined) return normalizeValue(objectValue.text);
    if (objectValue.answer !== undefined) return normalizeValue(objectValue.answer);
  }
  return `${value ?? ''}`.trim().toLowerCase();
}

function cleanAnswerText(value: unknown): string {
  return `${value ?? ''}`.trim();
}

function normalizeUnit(value: unknown): string {
  return `${value ?? ''}`.trim().toLowerCase().replace(/\s+/g, '');
}

function asArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value;
}
