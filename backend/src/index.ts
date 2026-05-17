import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from 'jsonwebtoken';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { config } from './config';
import { db } from './database';
import { redis } from './redis';
import { authRoutes } from './auth/routes';
import { classroomRoutes } from './classroom/routes';
import { syncRoutes } from './sync/routes';
import { storageRoutes } from './storage/routes';
import { whiteboardRoutes } from './whiteboard/routes';
import { progressRoutes } from './progress/routes';
import { adminRoutes } from './admin/routes';
import { learningRoutes } from './learning/routes';
import { feedRoutes } from './feed/routes';
import { quizRoutes } from './quiz/routes';
import { profileRoutes } from './profile/routes';
import { setupWebSocketHandlers } from './websocket/handlers';
import { authenticateKeycloakBearerToken, KeycloakAuthError, requestOriginFromHeaders } from './auth/keycloak';
import { accessTokenFromCookies, isAccessTokenRevoked } from './auth/session';
import { ntfyHealth } from './notifications';

const fastify = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: config.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    } : undefined
  }
});

const STUDENT_CLASSROOM_STATS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
let studentClassroomStatsRefreshTimer: NodeJS.Timeout | null = null;
let isRefreshingStudentClassroomStats = false;

async function main() {
  try {
    // Register plugins
    await fastify.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          scriptSrc: ["'self'", 'https://unpkg.com'],
          styleSrc: ["'self'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          mediaSrc: ["'self'", 'blob:', 'https:'],
          connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:'],
          frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://player.vimeo.com', 'https://www.loom.com'],
        },
      },
      hsts: config.NODE_ENV === 'production'
        ? { maxAge: 15552000, includeSubDomains: true }
        : false,
    });

    await fastify.register(cors, {
      origin: (origin, callback) => {
        if (!origin || originAllowed(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    });

    fastify.decorate('jwt', {
      sign: (payload: Record<string, unknown>, options?: { expiresIn?: string | number }) => {
        return jwt.sign(payload, config.JWT_SECRET, {
          algorithm: 'HS256',
          ...(options || {}),
        } as jwt.SignOptions);
      },
      verify: async (token: string) => {
        return jwt.verify(token, config.JWT_SECRET, {
          algorithms: ['HS256'],
        });
      },
    });

    // Shared JWT middleware for protected routes
    fastify.decorate('authenticate', async (request: any, reply: any) => {
      try {
        const token = bearerAccessToken(request.headers?.authorization)
          || accessTokenFromCookies(request.headers?.cookie);
        if (!token) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        const decoded = await fastify.jwt.verify(token);
        if (await isAccessTokenRevoked(decoded)) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
        request.user = decoded;
      } catch (err) {
        try {
          const requestOrigin = requestOriginFromHeaders(request.headers);
          const keycloakUser = await authenticateKeycloakBearerToken(
            request.headers.authorization,
            requestOrigin
          );
          if (keycloakUser) {
            request.user = keycloakUser;
            return;
          }
        } catch (keycloakErr) {
          if (keycloakErr instanceof KeycloakAuthError) {
            return reply.code(keycloakErr.statusCode).send({ error: keycloakErr.message });
          }
          request.log.error(keycloakErr);
        }
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    });

    await fastify.register(multipart, {
      limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
      }
    });

    await fastify.register(websocket);

    // Decorate with database and redis clients
    fastify.decorate('db', db);
    fastify.decorate('redis', redis);

    // Health check
    fastify.get('/health', async () => {
      const dbHealthy = await db.query('SELECT 1').then(() => true).catch(() => false);
      const redisHealthy = await redis.ping().then(() => true).catch(() => false);
      const notifications = await ntfyHealth();
      const ntfyHealthy = !notifications.enabled || notifications.connected;
      
      return {
        status: dbHealthy && redisHealthy && ntfyHealthy ? 'healthy' : 'unhealthy',
        database: dbHealthy ? 'connected' : 'disconnected',
        redis: redisHealthy ? 'connected' : 'disconnected',
        notifications,
        timestamp: new Date().toISOString()
      };
    });

    // Register routes
    await fastify.register(authRoutes, { prefix: '/auth' });
    await fastify.register(classroomRoutes, { prefix: '/classroom' });
    await fastify.register(syncRoutes, { prefix: '/sync' });
    await fastify.register(storageRoutes, { prefix: '/storage' });
    await fastify.register(whiteboardRoutes, { prefix: '/whiteboard' });
    await fastify.register(progressRoutes, { prefix: '/progress' });
    await fastify.register(adminRoutes, { prefix: '/admin' });
    await fastify.register(learningRoutes, { prefix: '/learning' });
    await fastify.register(feedRoutes, { prefix: '/feed' });
    await fastify.register(quizRoutes, { prefix: '/quiz' });
    await fastify.register(profileRoutes, { prefix: '/profile' });

    // Setup WebSocket handlers
    await setupWebSocketHandlers(fastify);

    void refreshStudentClassroomStats();
    studentClassroomStatsRefreshTimer = setInterval(() => {
      void refreshStudentClassroomStats();
    }, STUDENT_CLASSROOM_STATS_REFRESH_INTERVAL_MS);

    // Start server
    await fastify.listen({
      port: config.PORT,
      host: '0.0.0.0'
    });

    fastify.log.info(`Server listening on port ${config.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();

// Graceful shutdown
process.on('SIGTERM', async () => {
  fastify.log.info('SIGTERM received, shutting down gracefully');
  if (studentClassroomStatsRefreshTimer) {
    clearInterval(studentClassroomStatsRefreshTimer);
  }
  await fastify.close();
  await db.end();
  await redis.quit();
  process.exit(0);
});

async function refreshStudentClassroomStats() {
  if (isRefreshingStudentClassroomStats) return;

  isRefreshingStudentClassroomStats = true;
  try {
    await db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY student_classroom_stats');
  } catch (error) {
    fastify.log.error({ error }, 'Failed to refresh student_classroom_stats materialized view');
  } finally {
    isRefreshingStudentClassroomStats = false;
  }
}

function originAllowed(origin: string) {
  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    return false;
  }

  return splitCsv(config.CORS_ALLOWED_ORIGINS).some((allowed) => originMatchesAllowed(normalizedOrigin, allowed));
}

function originMatchesAllowed(origin: string, allowed: string) {
  const normalizedAllowed = allowed.replace(/\/+$/, '');
  if (normalizedAllowed === '*') return config.NODE_ENV !== 'production';
  if (!normalizedAllowed.includes('*')) return origin === normalizedAllowed;
  if (config.NODE_ENV === 'production') return false;

  try {
    const allowedUrl = new URL(normalizedAllowed.replace('*.', 'wildcard.'));
    const originUrl = new URL(origin);
    const wildcardSuffix = allowedUrl.hostname.replace('wildcard.', '.');
    return originUrl.protocol === allowedUrl.protocol && originUrl.hostname.endsWith(wildcardSuffix);
  } catch {
    return false;
  }
}

function splitCsv(value?: string | null) {
  return (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function bearerAccessToken(value: string | string[] | undefined) {
  const header = Array.isArray(value) ? value[0] : value;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
