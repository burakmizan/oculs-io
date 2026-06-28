ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "scan_schedule_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "scheduled_tools" scan_tool[];--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "last_scheduled_at" timestamp;