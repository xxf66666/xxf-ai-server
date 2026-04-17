import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';

import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { installOutboundProxy } from './utils/proxy.js';
import { redis } from './cache/redis.js';
import { registerHealth } from './api/health.js';
import { registerAnthropic } from './api/anthropic/messages.js';
import { registerOpenAI } from './api/openai/chat.js';
import { registerAdmin } from './api/admin/index.js';
import { registerConsole } from './api/console/index.js';
import { registerPublicPricing } from './api/public/pricing.js';
import { runMigrations } from './db/migrate.js';
import { startWorkers } from './workers/index.js';

async function main() {
  installOutboundProxy();

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
  await app.register(cookie);
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: 'xxf_admin_session', signed: false },
  });
  await app.register(rateLimit, {
    global: false,
    redis,
    nameSpace: 'xxf-rl:',
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      type: 'error',
      error: {
        type: 'rate_limit_error',
        message: `rate limited — retry in ${context.after}`,
      },
    }),
  });

  await registerHealth(app);
  await registerPublicPricing(app);
  await registerAdmin(app);
  await registerConsole(app);
  await registerAnthropic(app);
  await registerOpenAI(app);

  try {
    await app.listen({ host: env.SERVER_HOST, port: env.SERVER_PORT });
    logger.info({ port: env.SERVER_PORT }, 'xxf-ai-server listening');
    startWorkers();
  } catch (err) {
    logger.fatal({ err }, 'failed to start');
    process.exit(1);
  }
}

void main();
