import { describe, expect, it } from 'vitest';
import { answersMatch } from '../src/learning/routes';

describe('lesson answer grading', () => {
  it('accepts option text when the stored correct answer is a zero-based option index', () => {
    expect(answersMatch(
      'Reviewing content',
      '0',
      'multiple_choice',
      ['Reviewing content', 'Skipping content'],
    )).toBe(true);
  });

  it('keeps direct text, true/false, and fill-blank grading working', () => {
    expect(answersMatch('Metaphase', 'Metaphase', 'multiple_choice', ['Prophase', 'Metaphase'])).toBe(true);
    expect(answersMatch('True', 0, 'true_false', ['True', 'False'])).toBe(true);
    expect(answersMatch('gradient', 'Gradient', 'fill_blank', [])).toBe(true);
  });

  it('supports object-shaped option index answers from quiz builders', () => {
    expect(answersMatch('a > 0', { optionIndex: 1 }, 'multiple_choice', ['a < 0', 'a > 0'])).toBe(true);
  });

  it('grades STEM numeric answers with tolerance and units', () => {
    expect(answersMatch('9.81 m/s^2', '9.8 m/s^2', 'numeric', [])).toBe(true);
    expect(answersMatch('9.81 N', '9.8 m/s^2', 'numeric', [])).toBe(false);
  });

  it('grades ordered solution steps', () => {
    const steps = ['Expand brackets', 'Collect like terms', 'Solve for x'];

    expect(answersMatch(
      ['Expand brackets', 'Collect like terms', 'Solve for x'],
      '',
      'step_order',
      steps,
    )).toBe(true);
    expect(answersMatch(
      ['Solve for x', 'Collect like terms', 'Expand brackets'],
      '',
      'step_order',
      steps,
    )).toBe(false);
  });

  it('grades matching and representation-pair exercises', () => {
    const pairs = [
      { prompt: 'F = ma', answer: 'Newton second law' },
      { prompt: 'V = IR', answer: 'Ohm law' },
    ];

    expect(answersMatch(
      { 'F = ma': 'Newton second law', 'V = IR': 'Ohm law' },
      '',
      'representation_match',
      pairs,
    )).toBe(true);
  });
});
