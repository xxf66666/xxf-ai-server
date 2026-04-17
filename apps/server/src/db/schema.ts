import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const providerEnum = pgEnum('provider', ['claude', 'chatgpt']);
export const accountStatusEnum = pgEnum('account_status', [
  'active',
  'cooling',
  'rate_limited',
  'needs_reauth',
  'banned',
]);
export const planEnum = pgEnum('account_plan', ['pro', 'max5x', 'max20x', 'plus', 'pro_chatgpt']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'contributor', 'consumer']);
export const apiKeyStatusEnum = pgEnum('api_key_status', ['active', 'revoked']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('consumer'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const proxies = pgTable('proxies', {
  id: uuid('id').defaultRandom().primaryKey(),
  label: varchar('label', { length: 120 }).notNull(),
  url: text('url').notNull(),
  region: varchar('region', { length: 32 }),
  maxConcurrency: integer('max_concurrency').default(4).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  provider: providerEnum('provider').notNull(),
  ownerUserId: uuid('owner_user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  shared: boolean('shared').default(false).notNull(),
  label: varchar('label', { length: 120 }),
  plan: planEnum('plan').notNull(),
  status: accountStatusEnum('status').default('active').notNull(),

  // Token (encrypted at rest, base64 sealed JSON: {nonce,ciphertext,tag})
  oauthAccessToken: text('oauth_access_token').notNull(),
  oauthRefreshToken: text('oauth_refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),

  // 5-hour rolling window accounting
  windowStart: timestamp('window_start', { withTimezone: true }),
  windowTokensUsed: bigint('window_tokens_used', { mode: 'number' }).default(0).notNull(),

  coolingUntil: timestamp('cooling_until', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  lastProbeAt: timestamp('last_probe_at', { withTimezone: true }),
  lastProbeOk: boolean('last_probe_ok'),

  // Egress binding (null = direct)
  proxyId: uuid('proxy_id').references(() => proxies.id, { onDelete: 'set null' }),

  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  keyHash: text('key_hash').notNull().unique(),
  keyPreview: varchar('key_preview', { length: 16 }).notNull(), // "sk-xxf-…ab12"
  quotaMonthlyTokens: bigint('quota_monthly_tokens', { mode: 'number' }),
  usedMonthlyTokens: bigint('used_monthly_tokens', { mode: 'number' }).default(0).notNull(),
  status: apiKeyStatusEnum('status').default('active').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usageLog = pgTable('usage_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  provider: providerEnum('provider').notNull(),
  model: varchar('model', { length: 120 }).notNull(),
  inputTokens: integer('input_tokens').default(0).notNull(),
  outputTokens: integer('output_tokens').default(0).notNull(),
  latencyMs: integer('latency_ms').default(0).notNull(),
  status: integer('status').notNull(), // HTTP status
  errorCode: varchar('error_code', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type UsageLog = typeof usageLog.$inferSelect;
export type NewUsageLog = typeof usageLog.$inferInsert;
export type Proxy = typeof proxies.$inferSelect;
export type NewProxy = typeof proxies.$inferInsert;
