import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  SERVER_HOST: z.string().default('0.0.0.0'),
  SERVER_PORT: z.coerce.number().int().positive().default(8787),
  PUBLIC_API_URL: z.string().url().default('http://localhost:8787'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),

  CLAUDE_OAUTH_CLIENT_ID: z.string().optional(),
  CHATGPT_OAUTH_CLIENT_ID: z.string().optional(),

  EGRESS_PROXIES: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);
