-- Split billable input into three: fresh input, cache read, cache creation.
-- Anthropic charges these at vastly different rates (read is 10% of input,
-- creation is 125%), and our previous flat-rate billing over-charged
-- cache-heavy Claude Code sessions by 5-10x.
ALTER TABLE "usage_log" ADD COLUMN "cache_read_tokens" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "usage_log" ADD COLUMN "cache_creation_tokens" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Cache pricing per model. NULL means "no caching support" → fall back
-- to flat input rate.
ALTER TABLE "model_pricing" ADD COLUMN "cache_read_mud_per_m" bigint;
--> statement-breakpoint
ALTER TABLE "model_pricing" ADD COLUMN "cache_creation_mud_per_m" bigint;
--> statement-breakpoint
-- Seed default rates for every existing model. Anthropic's public ratio
-- (10% / 125%) works as a reasonable approximation for the GPT-5 family
-- too — since those requests translate onto Claude upstream, the
-- underlying cost is Claude-shaped anyway.
UPDATE "model_pricing"
   SET "cache_read_mud_per_m"     = ROUND(input_mud_per_m * 0.10)::bigint,
       "cache_creation_mud_per_m" = ROUND(input_mud_per_m * 1.25)::bigint
 WHERE "cache_read_mud_per_m" IS NULL;
