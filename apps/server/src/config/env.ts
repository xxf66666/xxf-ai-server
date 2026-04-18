import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

// Load .env from repo root (monorepo) first, falling back to CWD for Docker runtime.
const here = dirname(fileURLToPath(import.meta.url));
const repoRootEnv = resolve(here, '../../../../.env');
if (existsSync(repoRootEnv)) {
  loadEnv({ path: repoRootEnv });
} else {
  loadEnv();
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  SERVER_HOST: z.string().default('0.0.0.0'),
  SERVER_PORT: z.coerce.number().int().positive().default(8787),
  PUBLIC_API_URL: z.string().url().default('http://localhost:8787'),
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  ADMIN_BOOTSTRAP_TOKEN: z.string().min(16).optional(),

  // Rate limit on /v1/* per API key.
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),

  // Email (SMTP). If SMTP_HOST/USER/PASS aren't all set, email
  // verification is disabled gracefully — users are marked verified on
  // register. Works with any provider (Tencent SES, QQ Exmail, Gmail,
  // SendGrid SMTP, etc.). MAIL_FROM must be a verified sender address.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('xxf-ai-server <noreply@localhost>'),

  CLAUDE_OAUTH_CLIENT_ID: z.string().optional(),
  CHATGPT_OAUTH_CLIENT_ID: z.string().optional(),
  // When "1", /v1/chat/completions dispatches gpt-*/o3* calls to a
  // real ChatGPT Plus subscriber account (requires provider=chatgpt
  // account attached). Off by default — leaves the Claude-translation
  // path intact for existing deploys.
  CHATGPT_RELAY_ENABLED: z.string().optional(),
  CHATGPT_AUTH_BASE: z.string().optional(),
  CHATGPT_UPSTREAM_BASE: z.string().optional(),
  CHATGPT_RESPONSES_PATH: z.string().optional(),

  EGRESS_PROXIES: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);
