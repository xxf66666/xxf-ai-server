import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';

import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { registerHealth } from './api/health.js';

async function main() {
  const app = Fastify({ logger, disableRequestLogging: false, trustProxy: true });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(sensible);

  await registerHealth(app);

  // Phase P1+: await registerAnthropic(app);
  // Phase P3+: await registerAdmin(app);
  // Phase P4+: await registerOpenAI(app);

  try {
    await app.listen({ host: env.SERVER_HOST, port: env.SERVER_PORT });
    logger.info({ port: env.SERVER_PORT }, 'xxf-ai-server listening');
  } catch (err) {
    logger.fatal({ err }, 'failed to start');
    process.exit(1);
  }
}

void main();
