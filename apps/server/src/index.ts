import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';

import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { registerHealth } from './api/health.js';
import { registerAnthropic } from './api/anthropic/messages.js';
import { registerAdmin } from './api/admin/index.js';
import { runMigrations } from './db/migrate.js';

async function main() {
  if (process.env.SKIP_MIGRATIONS !== '1') {
    try {
      await runMigrations();
    } catch (err) {
      logger.fatal({ err }, 'migration failed on boot');
      process.exit(1);
    }
  }

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      base: { service: 'xxf-ai-server' },
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
          : undefined,
    },
    disableRequestLogging: false,
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024, // 10 MB — room for large prompt payloads
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(sensible);

  await registerHealth(app);
  await registerAdmin(app);
  await registerAnthropic(app);

  try {
    await app.listen({ host: env.SERVER_HOST, port: env.SERVER_PORT });
    logger.info({ port: env.SERVER_PORT }, 'xxf-ai-server listening');
  } catch (err) {
    logger.fatal({ err }, 'failed to start');
    process.exit(1);
  }
}

void main();
