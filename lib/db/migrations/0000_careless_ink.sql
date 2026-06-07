CREATE TYPE "public"."confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."fix_status" AS ENUM('none', 'generating', 'suggested', 'applied', 'failed');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('pending', 'queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."scan_tool" AS ENUM('semgrep', 'codeql', 'sonarscanner', 'horusec', 'bearer', 'nodejsscan', 'bandit', 'gosec', 'trivy', 'gitleaks', 'owasp_zap', 'nuclei', 'nmap_vulners', 'nikto', 'wapiti', 'sqlmap', 'arachni', 'dirsearch', 'testssl', 'wpscan');--> statement-breakpoint
CREATE TYPE "public"."scan_trigger" AS ENUM('manual', 'webhook', 'schedule');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('critical', 'high', 'medium', 'low', 'info');--> statement-breakpoint
CREATE TYPE "public"."tool_category" AS ENUM('sast', 'dast', 'secrets', 'infra');--> statement-breakpoint
CREATE TYPE "public"."vulnerability_status" AS ENUM('open', 'in_review', 'resolved', 'dismissed', 'false_positive');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"repo_full_name" text NOT NULL,
	"repo_url" text,
	"target_url" text,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"branch" text DEFAULT 'main' NOT NULL,
	"commit_sha" text,
	"tools" scan_tool[] NOT NULL,
	"status" "scan_status" DEFAULT 'pending' NOT NULL,
	"trigger" "scan_trigger" DEFAULT 'manual' NOT NULL,
	"summary" jsonb,
	"vulnerabilities_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"image" text,
	"password_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vulnerabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"tool" "scan_tool" NOT NULL,
	"category" "tool_category" NOT NULL,
	"rule_id" text,
	"title" text NOT NULL,
	"description" text,
	"severity" "severity" DEFAULT 'medium' NOT NULL,
	"confidence" "confidence",
	"cwe_id" text,
	"owasp_category" text,
	"cvss_score" text,
	"file_path" text,
	"line_start" integer,
	"line_end" integer,
	"target_url" text,
	"code_snippet" text,
	"remediation" text,
	"ai_fix_patch" text,
	"ai_fix_explanation" text,
	"ai_fix_model" text,
	"fix_status" "fix_status" DEFAULT 'none' NOT NULL,
	"fix_applied_at" timestamp,
	"status" "vulnerability_status" DEFAULT 'open' NOT NULL,
	"references" text[],
	"fingerprint" text,
	"raw" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scans" ADD CONSTRAINT "scans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scans" ADD CONSTRAINT "scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vulnerabilities" ADD CONSTRAINT "vulnerabilities_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vulnerabilities" ADD CONSTRAINT "vulnerabilities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vulnerabilities" ADD CONSTRAINT "vulnerabilities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "projects_user_repo_unique" ON "projects" USING btree ("user_id","repo_full_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_user_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scans_project_idx" ON "scans" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scans_user_idx" ON "scans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scans_status_idx" ON "scans" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vuln_scan_idx" ON "vulnerabilities" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vuln_project_idx" ON "vulnerabilities" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vuln_user_idx" ON "vulnerabilities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vuln_severity_idx" ON "vulnerabilities" USING btree ("severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vuln_status_idx" ON "vulnerabilities" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vuln_fingerprint_idx" ON "vulnerabilities" USING btree ("fingerprint");