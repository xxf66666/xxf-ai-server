CREATE TABLE "invite_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"note" varchar(120),
	"created_by_user_id" uuid,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "model_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" varchar(120) NOT NULL,
	"provider" varchar(16) NOT NULL,
	"input_mud_per_m" bigint NOT NULL,
	"output_mud_per_m" bigint NOT NULL,
	"tier" varchar(32),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_pricing_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
ALTER TABLE "usage_log" ADD COLUMN "cost_mud" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "balance_mud" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "spent_mud" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Seed: default Anthropic + OpenAI prices (micro-USD per 1M tokens).
-- Idempotent on model_id so re-seeding is safe.
INSERT INTO "model_pricing" ("model_id", "provider", "input_mud_per_m", "output_mud_per_m", "tier") VALUES
  ('claude-opus-4-7',            'claude', 15000000, 75000000, 'opus'),
  ('claude-sonnet-4-6',          'claude',  3000000, 15000000, 'sonnet'),
  ('claude-haiku-4-5-20251001',  'claude',  1000000,  5000000, 'haiku'),
  ('gpt-4o',                     'openai',  2500000, 10000000, 'flagship'),
  ('gpt-4o-mini',                'openai',   150000,   600000, 'small'),
  ('o1',                         'openai', 15000000, 60000000, 'flagship'),
  ('gpt-4-turbo',                'openai', 10000000, 30000000, 'flagship'),
  ('gpt-3.5-turbo',              'openai',   500000,  1500000, 'small')
ON CONFLICT ("model_id") DO NOTHING;
