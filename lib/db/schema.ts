/**
 * Drizzle ORM schema definitions (stub)
 *
 * Tables to define:
 *   - projects      (id, name, repo_url, owner_id, created_at)
 *   - scans         (id, project_id, status, triggered_at, completed_at)
 *   - findings      (id, scan_id, severity, title, file_path, line, cwe, description)
 *   - auto_fixes    (id, finding_id, patch, applied_at, ai_model)
 *   - users         (id, email, tier, created_at)
 */

export {};
