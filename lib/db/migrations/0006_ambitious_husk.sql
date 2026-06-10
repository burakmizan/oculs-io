ALTER TABLE "projects" ADD COLUMN "scan_frequency" text DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "scan_hour_utc" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "scan_day_of_week" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "gate_threshold" text DEFAULT 'critical' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "auto_fix_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "badge_public" boolean DEFAULT true NOT NULL;