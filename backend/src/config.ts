import dotenv from 'dotenv';
import { randomBytes } from 'crypto';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const DEFAULT_JWT_SECRET = isProduction ? '' : randomBytes(32).toString('hex');
const defaultCorsOrigins = 'http://localhost,http://localhost:80,http://127.0.0.1,http://127.0.0.1:80';

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000'),
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://eduuser:password@localhost:5432/eduapp',
  
  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Keycloak
  KEYCLOAK_URL: process.env.KEYCLOAK_URL || 'http://localhost:8080/auth',
  KEYCLOAK_PUBLIC_URL: process.env.KEYCLOAK_PUBLIC_URL || '',
  KEYCLOAK_ISSUER_URL: process.env.KEYCLOAK_ISSUER_URL || '',
  KEYCLOAK_ALLOWED_REDIRECT_ORIGINS: process.env.KEYCLOAK_ALLOWED_REDIRECT_ORIGINS || '',
  KEYCLOAK_REALM: process.env.KEYCLOAK_REALM || 'eduapp',
  KEYCLOAK_CLIENT_ID: process.env.KEYCLOAK_CLIENT_ID || 'eduapp-api',
  KEYCLOAK_CLIENT_SECRET: process.env.KEYCLOAK_CLIENT_SECRET || '',

  // Browser access
  CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS
    || process.env.KEYCLOAK_ALLOWED_REDIRECT_ORIGINS
    || defaultCorsOrigins,
  
  // MinIO
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || 'localhost',
  MINIO_PORT: parseInt(process.env.MINIO_PORT || '9000'),
  MINIO_USE_SSL: process.env.MINIO_USE_SSL
    ? process.env.MINIO_USE_SSL === 'true'
    : isProduction,
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY || '',
  MINIO_BUCKET_MEDIA: process.env.MINIO_BUCKET_MEDIA || 'eduapp-media',
  MINIO_BUCKET_WHITEBOARD: process.env.MINIO_BUCKET_WHITEBOARD || 'eduapp-whiteboard',
  
  // Centrifugo
  CENTRIFUGO_URL: process.env.CENTRIFUGO_URL || 'http://localhost:8000',
  CENTRIFUGO_API_KEY: process.env.CENTRIFUGO_API_KEY || '',
  CENTRIFUGO_SECRET: process.env.CENTRIFUGO_SECRET || '',
  
  // NTFY
  NTFY_URL: process.env.NTFY_URL || 'http://localhost:2586',
  NTFY_PUBLIC_URL: process.env.NTFY_PUBLIC_URL || process.env.NTFY_BASE_URL || 'http://localhost:2586',
  NTFY_TOPIC_PREFIX: process.env.NTFY_TOPIC_PREFIX || 'tusyen',
  NTFY_ACCESS_TOKEN: process.env.NTFY_ACCESS_TOKEN || '',
  NTFY_USERNAME: process.env.NTFY_USERNAME || '',
  NTFY_PASSWORD: process.env.NTFY_PASSWORD || '',
  NTFY_ENABLED: process.env.NTFY_ENABLED !== 'false',
  NTFY_TIMEOUT_MS: parseInt(process.env.NTFY_TIMEOUT_MS || '2500'),
  PUBLIC_APP_URL: process.env.PUBLIC_APP_URL || '',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '1h',
  JWT_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '1h',
  JWT_REFRESH_TTL_SECONDS: parseInt(process.env.JWT_REFRESH_TTL_SECONDS || `${60 * 60 * 24 * 7}`),
  AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE
    ? process.env.AUTH_COOKIE_SECURE === 'true'
    : isProduction,
  AUTH_LOGIN_RATE_LIMIT_MAX: positiveInt(process.env.AUTH_LOGIN_RATE_LIMIT_MAX, 5),
  AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS: positiveInt(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS, 60),
  AUTH_REGISTER_RATE_LIMIT_MAX: positiveInt(process.env.AUTH_REGISTER_RATE_LIMIT_MAX, 6),
  AUTH_REGISTER_RATE_LIMIT_WINDOW_SECONDS: positiveInt(process.env.AUTH_REGISTER_RATE_LIMIT_WINDOW_SECONDS, 300),
  AUTH_KEYCLOAK_START_RATE_LIMIT_MAX: positiveInt(process.env.AUTH_KEYCLOAK_START_RATE_LIMIT_MAX, 20),
  AUTH_KEYCLOAK_START_RATE_LIMIT_WINDOW_SECONDS: positiveInt(process.env.AUTH_KEYCLOAK_START_RATE_LIMIT_WINDOW_SECONDS, 60),

  // Public demo/admin safety
  DEMO_ADMIN_LOGIN_ENABLED: process.env.DEMO_ADMIN_LOGIN_ENABLED === 'true',
  PUBLIC_ADMIN_REGISTRATION_ENABLED: process.env.PUBLIC_ADMIN_REGISTRATION_ENABLED === 'true',

  // Quiz access
  ALLOW_GUEST_QUIZ_JOIN: process.env.ALLOW_GUEST_QUIZ_JOIN === 'true',
  
  // Sync
  SYNC_BATCH_SIZE: parseInt(process.env.SYNC_BATCH_SIZE || '100'),
  MAX_SYNC_HISTORY_DAYS: parseInt(process.env.MAX_SYNC_HISTORY_DAYS || '30')
};

assertProductionConfig(config);

function assertProductionConfig(value: typeof config) {
  if (value.NODE_ENV !== 'production') return;

  const problems: string[] = [];
  if (!process.env.JWT_SECRET || value.JWT_SECRET === DEFAULT_JWT_SECRET) {
    problems.push('JWT_SECRET must be set');
  } else if (value.JWT_SECRET.length < 32) {
    problems.push('JWT_SECRET must be at least 32 characters');
  }

  for (const [name, secret] of [
    ['DATABASE_URL', value.DATABASE_URL],
    ['MINIO_SECRET_KEY', value.MINIO_SECRET_KEY],
    ['CENTRIFUGO_SECRET', value.CENTRIFUGO_SECRET],
    ['CENTRIFUGO_API_KEY', value.CENTRIFUGO_API_KEY],
    ['KEYCLOAK_CLIENT_SECRET', value.KEYCLOAK_CLIENT_SECRET],
  ] as const) {
    if (!secret || secret.includes('your_') || secret.includes('change-in-production')) {
      problems.push(`${name} must be set`);
    }
  }

  for (const origin of splitCsv(value.CORS_ALLOWED_ORIGINS)) {
    if (origin.includes('*') || origin.includes('trycloudflare.com')) {
      problems.push('CORS_ALLOWED_ORIGINS must use exact production origins');
    }
  }

  for (const origin of splitCsv(value.KEYCLOAK_ALLOWED_REDIRECT_ORIGINS)) {
    if (origin.includes('*') || origin.includes('trycloudflare.com')) {
      problems.push('KEYCLOAK_ALLOWED_REDIRECT_ORIGINS must use exact production origins');
    }
  }

  if (!value.MINIO_USE_SSL) {
    problems.push('MINIO_USE_SSL must be true in production');
  }

  if (!value.AUTH_COOKIE_SECURE) {
    problems.push('AUTH_COOKIE_SECURE must be true in production');
  }

  if (problems.length > 0) {
    throw new Error(`Production configuration is incomplete: ${problems.join('; ')}`);
  }
}

function splitCsv(value?: string | null) {
  return (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
