import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dbQuery: vi.fn(),
  txQuery: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock('../src/database', () => ({
  db: {
    query: mocks.dbQuery,
  },
  withTransaction: mocks.withTransaction,
}));

vi.mock('../src/redis', () => ({
  cacheDelete: vi.fn(),
}));

vi.mock('../src/media-access', () => ({
  assertCanAttachMediaReferences: vi.fn().mockResolvedValue(undefined),
  isMediaAccessError: vi.fn(() => false),
  protectMediaReferences: vi.fn((_fastify, _user, value) => value),
}));

vi.mock('../src/external-video', () => ({
  ExternalVideoError: class ExternalVideoError extends Error {},
  normalizeExternalVideoBlock: vi.fn((block) => block),
}));

const { learningRoutes } = await import('../src/learning/routes');

function buildApp(user = {
  userId: '40324859-d0d7-4912-8a4c-054ce450dffc',
  role: 'teacher',
}) {
  const app = Fastify();
  app.decorate('authenticate', async (request: any) => {
    request.user = user;
  });
  app.register(learningRoutes, { prefix: '/learning' });
  return app;
}

function makeCatalogLesson(index: number, overrides: Record<string, any> = {}) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    title: `STEM Lesson ${index}`,
    subject: 'Physics',
    form_level: 4,
    difficulty: 'medium',
    estimated_minutes: 18,
    content: { summary: `STEM summary ${index}`, blocks: [] },
    topic: 'Topic',
    subtopic: 'Subtopic',
    question_count: 6,
    ...overrides,
  };
}

describe('learning routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withTransaction.mockImplementation(async (callback) =>
      callback({ query: mocks.txQuery })
    );
  });

  it('creates lesson questions from camelCase builder payloads', async () => {
    mocks.dbQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 'aa5a06cb-852f-46d7-9e81-81c717aefddf',
          subject: 'Mathematics',
          form_level: 4,
        },
      ],
    });
    mocks.txQuery.mockResolvedValue({ rowCount: 1, rows: [] });

    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/learning/lessons',
      payload: {
        syllabusId: 'aa5a06cb-852f-46d7-9e81-81c717aefddf',
        title: 'CamelCase Question Lesson',
        content: {
          summary: 'Question payload smoke.',
        },
        quizData: {
          questions: [
            {
              questionText: 'What is 2 + 2?',
              questionType: 'multiple_choice',
              options: ['3', '4'],
              correctAnswer: 1,
              explanation: 'Four.',
            },
          ],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const questionInsert = mocks.txQuery.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO quiz_questions')
    );
    expect(questionInsert).toBeTruthy();
    expect(questionInsert?.[1][2]).toBe('What is 2 + 2?');
    expect(questionInsert?.[1][3]).toBe('multiple_choice');
  });

  it('applies catalog search and difficulty filters for teachers', async () => {
    mocks.dbQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/learning/catalog?subject=Mathematics&formLevel=4&difficulty=easy&search=gradient',
    });

    expect(response.statusCode).toBe(200);
    const [query, params] = mocks.dbQuery.mock.calls[0];
    expect(String(query)).toContain('l.difficulty');
    expect(String(query)).toContain('LOWER(l.title)');
    expect(params).toEqual(['Mathematics', 4, 'easy', '%gradient%', 100, 0]);

    await app.close();
  });

  describe('STEM lesson catalogue', () => {
    it('exposes Form 4 STEM depth and accepts a submitted Biology answer', async () => {
      const biologyLessonId = '11111111-1111-4111-8111-111111111111';
      const biologyBlocks = [
        { type: 'section', title: 'Concept', body: 'Cells are the basic unit of life.' },
        { type: 'section', title: 'Worked example', body: 'A palisade cell has chloroplasts for photosynthesis.' },
        { type: 'section', title: 'Misconceptions', body: 'Not every cell has a cell wall.' },
        { type: 'section', title: 'Key terms', body: '| Term | Definition |\n| Cell (Sel) | Basic unit of life |' },
        { type: 'section', title: 'Mnemonic', body: 'Nucleus controls, mitochondria release energy.' },
      ];
      const form4Lessons = Array.from({ length: 60 }, (_value, index) => makeCatalogLesson(index + 1));
      const biologyLessons = Array.from({ length: 18 }, (_value, index) => makeCatalogLesson(index + 101, {
        id: index === 0 ? biologyLessonId : `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`,
        title: `Biology Lesson ${index + 1}`,
        subject: 'Biology',
        content: { summary: 'Biology summary', blocks: biologyBlocks },
      }));
      const fetchedBiologyLesson = {
        ...biologyLessons[0],
        content_block_count: biologyBlocks.length,
      };
      const detailQuestions = Array.from({ length: 6 }, (_value, index) => ({
        id: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`,
        question_text: `Biology question ${index + 1}`,
        question_type: 'multiple_choice',
        options: ['Correct', 'Distractor'],
        explanation: 'The answer follows the seeded Biology concept.',
        points: 1,
        order_index: index,
      }));
      const scoredQuestions = detailQuestions.map((question, index) => ({
        ...question,
        correct_answer: index === 0 ? { optionIndex: 0 } : { optionIndex: 1 },
      }));

      mocks.dbQuery
        .mockResolvedValueOnce({ rowCount: form4Lessons.length, rows: form4Lessons })
        .mockResolvedValueOnce({ rowCount: biologyLessons.length, rows: biologyLessons })
        .mockResolvedValueOnce({ rowCount: 1, rows: [fetchedBiologyLesson] })
        .mockResolvedValueOnce({ rowCount: detailQuestions.length, rows: detailQuestions });

      const teacherApp = buildApp();
      await teacherApp.ready();

      const form4Response = await teacherApp.inject({
        method: 'GET',
        url: '/learning/catalog?formLevel=4',
      });
      expect(form4Response.statusCode).toBe(200);
      expect(JSON.parse(form4Response.body).lessons.length).toBeGreaterThanOrEqual(60);

      const biologyCatalogResponse = await teacherApp.inject({
        method: 'GET',
        url: '/learning/catalog?subject=Biology&formLevel=4',
      });
      expect(biologyCatalogResponse.statusCode).toBe(200);
      expect(JSON.parse(biologyCatalogResponse.body).lessons.length).toBeGreaterThanOrEqual(18);

      const biologyDetailResponse = await teacherApp.inject({
        method: 'GET',
        url: `/learning/lessons/${biologyLessonId}`,
      });
      expect(biologyDetailResponse.statusCode).toBe(200);
      const biologyDetail = JSON.parse(biologyDetailResponse.body);
      expect(biologyDetail.lesson.content.blocks.length).toBeGreaterThanOrEqual(5);
      expect(biologyDetail.questions.length).toBeGreaterThanOrEqual(6);

      await teacherApp.close();

      mocks.dbQuery
        .mockResolvedValueOnce({ rowCount: 1, rows: [fetchedBiologyLesson] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rowCount: scoredQuestions.length, rows: scoredQuestions })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: '44444444-4444-4444-8444-444444444444', score: 17 }],
        })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const studentApp = buildApp({
        userId: '55555555-5555-4555-8555-555555555555',
        role: 'student',
      });
      await studentApp.ready();

      const submitResponse = await studentApp.inject({
        method: 'POST',
        url: `/learning/lessons/${biologyLessonId}/submit`,
        payload: {
          contentReviewed: true,
          contentBlockCount: biologyBlocks.length,
          answers: [
            {
              questionId: scoredQuestions[0].id,
              answer: 'Correct',
            },
          ],
        },
      });

      expect(submitResponse.statusCode).toBe(200);
      expect(JSON.parse(submitResponse.body).result.score).toBeDefined();

      await studentApp.close();
    });
  });
});
