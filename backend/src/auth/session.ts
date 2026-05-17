import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { redis } from '../redis';

type AuthRole = 'student' | 'teacher' | 'parent' | 'admin';

type TokenUser = {
  id?: string;
  userId?: string;
  email: string;
  role: AuthRole;
  full_name?: string;
  fullName?: string;
};

type RefreshTokenRecord = {
  hash: string;
  userId: string;
  email: string;
  role: AuthRole;
  authProvider?: string;
  createdAt: number;
};

const ACCESS_REVOKED_PREFIX = 'auth:access:revoked:';
const REFRESH_PREFIX = 'auth:refresh:';
const ACCESS_COOKIE_NAME = 'tusyen_access';
const REFRESH_COOKIE_NAME = 'tusyen_refresh';

export function accessTokenExpiresIn() {
  return (config as any).JWT_ACCESS_EXPIRES_IN || config.JWT_EXPIRES_IN || '1h';
}

export function accessTokenExpiresInSeconds() {
  return durationToSeconds(accessTokenExpiresIn(), 60 * 60);
}

export function refreshTokenTtlSeconds() {
  const ttl = Number((config as any).JWT_REFRESH_TTL_SECONDS);
  return Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : 60 * 60 * 24 * 7;
}

export async function issueAuthTokens(
  fastify: any,
  user: TokenUser,
  extraClaims: Record<string, unknown> = {},
) {
  const userId = user.userId || user.id;
  if (!userId) {
    throw new Error('Cannot issue auth token without a user id');
  }

  const accessJti = uuidv4();
  const token = fastify.jwt.sign({
    userId,
    email: user.email,
    role: user.role,
    ...extraClaims,
    jti: accessJti,
    iat: Math.floor(Date.now() / 1000),
  }, { expiresIn: accessTokenExpiresIn() });

  const refreshToken = await createRefreshToken({
    userId,
    email: user.email,
    role: user.role,
    authProvider: typeof extraClaims.authProvider === 'string' ? extraClaims.authProvider : undefined,
  });

  return {
    token,
    accessToken: token,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: accessTokenExpiresInSeconds(),
    refreshExpiresIn: refreshTokenTtlSeconds(),
  };
}

export function setAuthCookies(
  reply: any,
  tokens: { token: string; refreshToken: string; expiresIn?: number; refreshExpiresIn?: number },
) {
  reply.header('Set-Cookie', [
    serializeCookie(ACCESS_COOKIE_NAME, tokens.token, tokens.expiresIn || accessTokenExpiresInSeconds()),
    serializeCookie(REFRESH_COOKIE_NAME, tokens.refreshToken, tokens.refreshExpiresIn || refreshTokenTtlSeconds()),
  ]);
}

export function clearAuthCookies(reply: any) {
  reply.header('Set-Cookie', [
    serializeCookie(ACCESS_COOKIE_NAME, '', 0),
    serializeCookie(REFRESH_COOKIE_NAME, '', 0),
  ]);
}

export function accessTokenFromCookies(cookieHeader: unknown) {
  return cookieValue(cookieHeader, ACCESS_COOKIE_NAME);
}

export function refreshTokenFromCookies(cookieHeader: unknown) {
  return cookieValue(cookieHeader, REFRESH_COOKIE_NAME);
}

export async function consumeRefreshToken(refreshToken: unknown): Promise<RefreshTokenRecord | null> {
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed) return null;

  const key = refreshKey(parsed.id);
  const usedKey = `${REFRESH_PREFIX}used:${parsed.id}`;
  const raw = await redis.get(key);
  if (!raw) {
    const usedRaw = await redis.get(usedKey);
    if (!usedRaw) return null;
    try {
      return JSON.parse(usedRaw) as RefreshTokenRecord;
    } catch {
      await redis.del(usedKey);
      return null;
    }
  }

  let record: RefreshTokenRecord;
  try {
    record = JSON.parse(raw) as RefreshTokenRecord;
  } catch {
    await redis.del(key);
    return null;
  }

  if (!hashesMatch(record.hash, tokenHash(parsed.secret))) {
    return null;
  }

  await redis.setex(usedKey, 10, JSON.stringify(record));
  await redis.del(key);
  return record;
}

export async function revokeRefreshToken(refreshToken: unknown) {
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed) return false;
  await Promise.all([
    redis.del(refreshKey(parsed.id)),
    redis.del(`${REFRESH_PREFIX}used:${parsed.id}`),
  ]);
  return true;
}

export async function revokeAccessToken(decoded: any) {
  const jti = `${decoded?.jti ?? ''}`.trim();
  const exp = Number(decoded?.exp);
  if (!jti || !Number.isFinite(exp)) return false;

  const ttl = Math.max(0, Math.floor(exp - Date.now() / 1000));
  if (ttl <= 0) return false;

  await redis.setex(`${ACCESS_REVOKED_PREFIX}${jti}`, ttl, '1');
  return true;
}

export async function isAccessTokenRevoked(decoded: any) {
  const jti = `${decoded?.jti ?? ''}`.trim();
  if (!jti) return false;
  return Boolean(await redis.get(`${ACCESS_REVOKED_PREFIX}${jti}`));
}

async function createRefreshToken(record: Omit<RefreshTokenRecord, 'hash' | 'createdAt'>) {
  const id = uuidv4();
  const secret = randomBytes(32).toString('base64url');
  await redis.setex(refreshKey(id), refreshTokenTtlSeconds(), JSON.stringify({
    ...record,
    hash: tokenHash(secret),
    createdAt: Date.now(),
  }));
  return `${id}.${secret}`;
}

function parseRefreshToken(value: unknown): { id: string; secret: string } | null {
  const [id, secret] = `${value ?? ''}`.split('.');
  if (!id || !secret || !/^[0-9a-f-]{36}$/i.test(id) || secret.length < 32) {
    return null;
  }
  return { id, secret };
}

function refreshKey(id: string) {
  return `${REFRESH_PREFIX}${id}`;
}

function tokenHash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function hashesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function serializeCookie(name: string, value: string, maxAgeSeconds: number) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];

  if (maxAgeSeconds <= 0) {
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  }

  if (config.AUTH_COOKIE_SECURE) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function cookieValue(cookieHeader: unknown, name: string) {
  const raw = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : `${cookieHeader ?? ''}`;
  for (const cookie of raw.split(';')) {
    const trimmed = cookie.trim();
    if (!trimmed.startsWith(`${name}=`)) continue;
    const encoded = trimmed.slice(name.length + 1);
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }
  return null;
}

function durationToSeconds(value: string, fallback: number) {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);

  const match = value.match(/^(\d+)\s*([smhd])$/i);
  if (!match) return fallback;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return amount * multiplier;
}
