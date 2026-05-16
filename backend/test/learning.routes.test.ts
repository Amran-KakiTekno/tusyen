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

function buildApp() {
  const app = Fastify();
  app.decorate('authenticate', async (request: any) => {
    request.user = {
      userId: '40324859-d0d7-4912-8a4c-054ce450dffc',
      role: 'teacher',
    };
  });
  app.register(learningRoutes, { prefix: '/learning' });
  return app;
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
});
