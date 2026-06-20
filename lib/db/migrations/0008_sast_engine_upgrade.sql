-- SAST engine upgrade: exploitability scoring, cross-tool correlation,
-- and per-scan tech-stack profile. Written idempotently (IF NOT EXISTS /
-- guarded CREATE TYPE) so it applies cleanly on databases whose live schema
-- has drifted from the migration snapshots.

DO $$ BEGIN
  CREATE TYPE "public"."exploitability" AS ENUM('high', 'medium', 'low');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD COLUMN IF NOT EXISTS "exploitability" "public"."exploitability";--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD COLUMN IF NOT EXISTS "correlation_group" text;--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD COLUMN IF NOT EXISTS "correlation_label" text;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN IF NOT EXISTS "tech_stack" jsonb;
