import { describe, expect, it } from 'vitest';
import {
  calculateQuestionScore,
  buildLeaderboard,
  normalizeQuizQuestion,
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
