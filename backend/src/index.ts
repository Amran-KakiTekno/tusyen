import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
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

async function main() {
  try {
    // Register plugins
    await fastify.register(cors, {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization']
    });

    await fastify.register(jwt, {
      secret: config.JWT_SECRET
    });

    // Shared JWT middleware for protected routes
    fastify.decorate('authenticate', async (request: any, reply: any) => {
      try {
        const decoded = await request.jwtVerify();
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
  await fastify.close();
  await db.end();
  await redis.quit();
  process.exit(0);
});
