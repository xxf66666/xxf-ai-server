// Stub env vars before any src/config/env.js import runs, so the zod
// schema in that module passes without a real .env file or running
// Postgres/Redis. Kept in one place so test authors don't duplicate.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'fatal';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5433/test';
process.env.REDIS_URL = 'redis://127.0.0.1:6380';
process.env.ENCRYPTION_KEY =
  '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long-xxxxxxx';
process.env.RATE_LIMIT_MAX = '60';
process.env.RATE_LIMIT_WINDOW_SECONDS = '60';
