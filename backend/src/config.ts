import dotenv from 'dotenv';
dotenv.config();

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
  
  // MinIO
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || 'localhost',
  MINIO_PORT: parseInt(process.env.MINIO_PORT || '9000'),
  MINIO_USE_SSL: process.env.MINIO_USE_SSL === 'true',
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
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  JWT_EXPIRES_IN: '7d',
  
  // Sync
  SYNC_BATCH_SIZE: parseInt(process.env.SYNC_BATCH_SIZE || '100'),
  MAX_SYNC_HISTORY_DAYS: parseInt(process.env.MAX_SYNC_HISTORY_DAYS || '30')
};
