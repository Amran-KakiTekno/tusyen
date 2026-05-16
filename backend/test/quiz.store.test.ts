import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.hoisted(() => vi.fn());
const transactionMock = vi.hoisted(() => vi.fn());

vi.mock('../src/database', () => ({
  db: {
    query: queryMock,
  },
  withTransaction: transactionMock,
}));

vi.mock('../src/redis', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  },
}));

const { joinQuizSession } = await import('../src/quiz/store');

describe('quiz store', () => {
  beforeEach(() => {
    queryMock.mockReset();
    transactionMock.mockReset();
  });

  it('blocks authenticated students who are not enrolled in the quiz classroom', async () => {
    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 'session-1',
            deck_id: 'deck-1',
            classroom_id: 'classroom-1',
            status: 'lobby',
            pin: '482911',
          },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 'question-1',
            deck_id: 'deck-1',
          },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

    await expect(
      joinQuizSession({
        pin: '482911',
        user: {
          userId: 'student-1',
          role: 'student',
        },
      })
    ).rejects.toThrow('Student is not enrolled in this quiz classroom');

    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(queryMock.mock.calls[2][0]).toContain('classroom_enrollments');
    expect(queryMock.mock.calls[2][1]).toEqual(['student-1', 'classroom-1']);
  });
});
