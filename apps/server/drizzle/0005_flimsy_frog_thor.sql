CREATE TYPE "public"."user_status" AS ENUM('pending_verification', 'active', 'suspended');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'pending_verification' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
-- Backfill: existing users keep access (they were created before the
-- hard gate was added). Promote all to active.
UPDATE "users" SET "status" = 'active';
