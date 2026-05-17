import { describe, expect, it } from 'vitest';
import {
  calculateQuestionScore,
  buildLeaderboard,
  normalizeQuizQuestion,
  quizAnswersMatch,
} from '../src/quiz/logic';

describe('quiz logic', () => {
  it('normalizes multiple choice questions', () => {
    const question = normalizeQuizQuestion(
      {
        questionText: 'What is 2 + 2?',
        questionType: 'multiple_choice',
        options: ['1', '4', '3'],
        correctAnswer: 1,
        points: 1000,
        timeLimitSeconds: 20,
      },
      0
    );

    expect(question.questionText).toBe('What is 2 + 2?');
    expect(question.questionType).toBe('multiple_choice');
    expect(question.options).toEqual(['1', '4', '3']);
    expect(question.correctAnswer).toEqual({ optionIndex: 1 });
  });

  it('accepts answer text before treating numeric strings as option indexes', () => {
    const question = normalizeQuizQuestion(
      {
        questionText: 'What is 2 + 2?',
        questionType: 'multiple_choice',
        options: ['1', '4', '3'],
        correctAnswer: '4',
      },
      0
    );

    expect(question.correctAnswer).toEqual({ optionIndex: 1 });
  });

  it('normalizes STEM-style quiz questions', () => {
    const question = normalizeQuizQuestion(
      {
        questionText: 'Estimate gravitational acceleration.',
        questionType: 'numeric',
        correctAnswer: '9.8 m/s^2',
        points: 750,
      },
      2
    );

    expect(question.questionType).toBe('numeric');
    expect(question.correctAnswer).toBe('9.8 m/s^2');
    expect(question.options).toEqual([]);
    expect(question.orderIndex).toBe(2);
  });

  it('grades non-choice quiz answers with lesson-style semantics', () => {
    expect(quizAnswersMatch('9.81 m/s^2', '9.8 m/s^2', 'numeric', [])).toBe(true);
    expect(quizAnswersMatch(
      ['Expand brackets', 'Collect like terms', 'Solve for x'],
      '',
      'step_order',
      ['Expand brackets', 'Collect like terms', 'Solve for x'],
    )).toBe(true);
    expect(quizAnswersMatch(
      { 'F = ma': 'Newton second law', 'V = IR': 'Ohm law' },
      '',
      'representation_match',
      [
        { prompt: 'F = ma', answer: 'Newton second law' },
        { prompt: 'V = IR', answer: 'Ohm law' },
      ],
    )).toBe(true);
  });

  it('applies speed scoring within the expected range', () => {
    expect(calculateQuestionScore(1000, 20, 0)).toBe(1000);
    expect(calculateQuestionScore(1000, 20, 10_000)).toBeGreaterThan(250);
    expect(calculateQuestionScore(1000, 20, 20_000)).toBe(250);
  });

  it('orders the leaderboard by score and accuracy', () => {
    const leaderboard = buildLeaderboard([
      {
        participantId: 'b',
        displayName: 'Beta',
        totalScore: 900,
        correctCount: 2,
        answeredCount: 2,
        isGuest: false,
      },
      {
        participantId: 'a',
        displayName: 'Alpha',
        totalScore: 900,
        correctCount: 3,
        answeredCount: 3,
        isGuest: false,
      },
      {
        participantId: 'c',
        displayName: 'Gamma',
        totalScore: 700,
        correctCount: 4,
        answeredCount: 4,
        isGuest: true,
      },
    ]);

    expect(leaderboard.map((entry) => entry.participantId)).toEqual(['a', 'b', 'c']);
  });
});
