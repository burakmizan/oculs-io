ALTER TABLE "projects" ADD COLUMN "scan_schedule_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "scheduled_tools" scan_tool[];--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "last_scheduled_at" timestamp;