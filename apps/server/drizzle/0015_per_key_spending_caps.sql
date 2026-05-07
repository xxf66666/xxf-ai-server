-- Per-API-key spending caps. micro-USD, NULL = no cap. Three windows
-- are tracked independently in Redis. Reject (402) BEFORE upstream
-- call once any window would exceed its cap. OfoxAI parity feature.
ALTER TABLE "api_keys" ADD COLUMN "daily_cap_mud" bigint;
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "weekly_cap_mud" bigint;
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "monthly_cap_mud" bigint;
