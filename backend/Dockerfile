FROM node:20-alpine

WORKDIR /app

# Install dependencies (including dev dependencies for build)
COPY backend/package*.json ./
RUN npm ci

# Copy source
COPY backend .
COPY database/migrations /database/migrations

# Build TypeScript
RUN npm run build

# Remove dev dependencies for production
RUN npm prune --omit=dev

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Apply pending database migrations, then start the application
CMD ["sh", "-c", "node scripts/migrate.js && node dist/index.js"]
