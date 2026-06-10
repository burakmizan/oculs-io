ALTER TABLE "scans" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "alert_webhook_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "alert_threshold" text DEFAULT 'critical' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scans_share_token_unique" ON "scans" USING btree ("share_token");