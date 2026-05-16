import Redis from 'ioredis';
import { config } from './config';

export const redis = new Redis(config.REDIS_URL);

// Session management
export async function setSession(sessionId: string, data: any, ttl: number = 86400) {
  await redis.setex(`session:${sessionId}`, ttl, JSON.stringify(data));
}

export async function getSession(sessionId: string) {
  const data = await redis.get(`session:${sessionId}`);
  return data ? JSON.parse(data) : null;
}

export async function deleteSession(sessionId: string) {
  await redis.del(`session:${sessionId}`);
}

// Rate limiting
export async function checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }
  return current <= maxRequests;
}

// Real-time presence (who's online in classroom)
export async function setUserPresence(userId: string, classroomId: string, status: 'online' | 'offline') {
  const key = `presence:classroom:${classroomId}`;
  if (status === 'online') {
    await redis.hset(key, userId, JSON.stringify({ timestamp: Date.now() }));
    await redis.expire(key, 300); // 5 minute TTL
  } else {
    await redis.hdel(key, userId);
  }
}

export async function getClassroomPresence(classroomId: string): Promise<string[]> {
  const key = `presence:classroom:${classroomId}`;
  const users = await redis.hkeys(key);
  return users;
}

// Cache helpers
export async function cacheGet<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function cacheSet(key: string, data: any, ttl: number = 3600) {
  await redis.setex(key, ttl, JSON.stringify(data));
}

export async function cacheDelete(key: string) {
  await redis.del(key);
}

// Sync queue for offline-first
export async function queueSync(deviceId: string, operation: any) {
  const key = `sync:queue:${deviceId}`;
  await redis.lpush(key, JSON.stringify({
    ...operation,
    queuedAt: Date.now()
  }));
  await redis.expire(key, 86400 * 7); // 7 days
}

export async function getSyncQueue(deviceId: string): Promise<any[]> {
  const key = `sync:queue:${deviceId}`;
  const items = await redis.lrange(key, 0, -1);
  return items.map(item => JSON.parse(item));
}

export async function clearSyncQueue(deviceId: string) {
  await redis.del(`sync:queue:${deviceId}`);
}
