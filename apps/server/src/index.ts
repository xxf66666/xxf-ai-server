import { randomUUID } from 'node:crypto';
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
    // Use a UUID for the request id. Fastify's default is an auto-
    // incrementing integer which is hard to grep across restarts and
    // harder to correlate with client-side logs.
    genReqId: (req) => {
      const incoming = req.headers['x-request-id'];
      if (typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128) {
        return incoming;
      }
      return randomUUID();
    },
  });

  // Echo the request id on every response so clients can cite it.
  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });

  // CSP: web app is SSR'd by Next.js standalone; Instrument Serif from
  // fonts.googleapis.com; recharts inlines styles → 'unsafe-inline' in
  // style-src. connect-src allows same-origin API calls only.
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'"],
        'frame-ancestors': ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Next.js static chunks trip this
  });

  // CORS: lock to our own origins. Echo origin: true + credentials true
  // was a CSRF enabler — any site with a logged-in admin could fetch
  // /admin/v1/* with the cookie.
  const allowedOrigins = Array.from(
    new Set([env.PUBLIC_WEB_URL, env.PUBLIC_API_URL].filter(Boolean)),
  );
  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
  });
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
