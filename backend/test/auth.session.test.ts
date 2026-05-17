import { createHash } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  redisSetex: vi.fn(),
  redisDel: vi.fn(),
}));

vi.mock('../src/redis', () => ({
  redis: {
    get: mocks.redisGet,
    set: mocks.redisSet,
    setex: mocks.redisSetex,
    del: mocks.redisDel,
  },
}));

vi.mock('../src/config', () => ({
  config: {
    JWT_ACCESS_EXPIRES_IN: '1h',
    JWT_EXPIRES_IN: '1d',
    JWT_REFRESH_TTL_SECONDS: 604800,
    AUTH_COOKIE_SECURE: false,
  },
}));

const { consumeRefreshToken, revokeRefreshToken } = await import('../src/auth/session');

const refreshTokenId = '123e4567-e89b-12d3-a456-426614174000';
const refreshTokenSecret = 'abcdefghijklmnopqrstuvwxyzABCDEF012345-_';
const refreshToken = `${refreshTokenId}.${refreshTokenSecret}`;
const mainKey = `auth:refresh:${refreshTokenId}`;
const usedKey = `auth:refresh:used:${refreshTokenId}`;

const refreshRecord = {
  hash: createHash('sha256').update(refreshTokenSecret).digest('hex'),
  userId: '37842982-b45a-498a-aab2-0e84c4997822',
  email: 'teacher@example.test',
  role: 'teacher' as const,
  authProvider: 'local',
  createdAt: 1716000000000,
};

describe('auth session refresh token handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redisSet.mockResolvedValue('OK');
    mocks.redisSetex.mockResolvedValue('OK');
    mocks.redisDel.mockResolvedValue(1);
  });

  it('returns the record on the first consume when the stored hash matches', async () => {
    mocks.redisGet.mockResolvedValueOnce(JSON.stringify(refreshRecord));

    const result = await consumeRefreshToken(refreshToken);

    expect(result).toEqual(refreshRecord);
    expect(mocks.redisGet).toHaveBeenCalledWith(mainKey);
    expect(mocks.redisSetex).toHaveBeenCalledWith(usedKey, 10, JSON.stringify(refreshRecord));
    expect(mocks.redisDel).toHaveBeenCalledWith(mainKey);
  });

  it('returns the grace-window record when the main key is already gone', async () => {
    mocks.redisGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify(refreshRecord));

    const result = await consumeRefreshToken(refreshToken);

    expect(result).toEqual(refreshRecord);
    expect(mocks.redisGet).toHaveBeenNthCalledWith(1, mainKey);
    expect(mocks.redisGet).toHaveBeenNthCalledWith(2, usedKey);
    expect(mocks.redisSetex).not.toHaveBeenCalled();
    expect(mocks.redisDel).not.toHaveBeenCalled();
  });

  it('returns null once both the main and used keys are gone', async () => {
    mocks.redisGet.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const result = await consumeRefreshToken(refreshToken);

    expect(result).toBeNull();
    expect(mocks.redisGet).toHaveBeenNthCalledWith(1, mainKey);
    expect(mocks.redisGet).toHaveBeenNthCalledWith(2, usedKey);
  });

  it('revokes both the main and used refresh-token keys', async () => {
    const result = await revokeRefreshToken(refreshToken);

    expect(result).toBe(true);
    expect(mocks.redisDel).toHaveBeenCalledTimes(2);
    expect(mocks.redisDel).toHaveBeenNthCalledWith(1, mainKey);
    expect(mocks.redisDel).toHaveBeenNthCalledWith(2, usedKey);
  });
});
