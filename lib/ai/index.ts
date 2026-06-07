/**
 * lib/ai/index.ts
 * Gemini AI agent — vulnerability triage, auto-fix patch generation, report.
 * Uses GEMINI_API_KEY and GEMINI_MODEL from environment variables.
 */

import type { WebhookFinding, SeverityLevel } from "@/types"

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash"
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TriagedFinding extends WebhookFinding {
  /** Gemini-assigned severity (may override tool-reported severity). */
  triageSeverity: SeverityLevel
  /** Human-readable explanation of why this severity was assigned. */
  triageReasoning: string
  /** CWE identifier e.g. "CWE-89". */
  cweId: string
  /** OWASP Top 10 category e.g. "A03:2021 – Injection". */
  owaspCategory: string
  /** 0.0–10.0 CVSS-like score estimated by AI. */
  cvssScore: string
  /** Plain-English remediation guidance. */
  remediation: string
  /** Stable dedup hash: tool + ruleId + filePath + lineStart. */
  fingerprint: string
}

export interface AutoFixResult {
  /** unified diff patch ready to apply with `git apply`. */
  patch: string
  /** Explanation of what the fix does and why. */
  explanation: string
  /** Gemini model that produced this fix. */
  model: string
}

export interface ScanReport {
  /** Markdown-formatted security summary. */
  markdown: string
  /** Overall risk score 0–100. */
  riskScore: number
  /** Counts per severity level. */
  summary: Record<SeverityLevel, number>
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper — raw Gemini call
// ─────────────────────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.")
  }

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,        // low temp — we want deterministic security analysis
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

  if (!text) throw new Error("Gemini returned an empty response.")

  // Strip markdown code fences if present (```json ... ```)
  return text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// Fingerprint helper — stable dedup hash (no crypto dependency)
// ─────────────────────────────────────────────────────────────────────────────

function makeFingerprint(f: WebhookFinding): string {
  const raw = `${f.tool}::${f.ruleId ?? ""}::${f.filePath ?? f.targetUrl ?? ""}::${f.lineStart ?? 0}`
  // Simple djb2 hash — good enough for dedup, no Node crypto needed at edge
  let hash = 5381
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i)
    hash = hash >>> 0 // keep unsigned 32-bit
  }
  return hash.toString(16).padStart(8, "0")
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. analyzeFindings — triage a batch of raw scan findings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Takes raw findings from GitHub Actions (Semgrep / ZAP / Gitleaks etc.)
 * and returns enriched, AI-triaged findings with CWE, OWASP mapping,
 * CVSS score estimation, and remediation guidance.
 *
 * Batches up to 20 findings per Gemini call to stay within token limits.
 */
export async function analyzeFindings(
  findings: WebhookFinding[],
): Promise<TriagedFinding[]> {
  if (findings.length === 0) return []

  const BATCH_SIZE = 20
  const results: TriagedFinding[] = []

  for (let i = 0; i < findings.length; i += BATCH_SIZE) {
    const batch = findings.slice(i, i + BATCH_SIZE)

    const prompt = `
You are a senior application security engineer. Analyze the following security scan findings and enrich each one.

For EACH finding, return a JSON object with these exact fields:
- triageSeverity: one of "critical" | "high" | "medium" | "low" | "info"
- triageReasoning: 1-2 sentence explanation of the severity assignment
- cweId: CWE identifier string like "CWE-89" (empty string if unknown)
- owaspCategory: OWASP Top 10 2021 category like "A03:2021 – Injection" (empty string if not applicable)
- cvssScore: estimated CVSS 3.1 base score as string like "8.1" (empty string if unknown)
- remediation: specific actionable remediation steps in 2-4 sentences

Respond with a JSON array of exactly ${batch.length} objects, one per finding, in the same order as the input.
Do NOT include any text outside the JSON array.

INPUT FINDINGS:
${JSON.stringify(batch, null, 2)}
`

    let parsed: Array<{
      triageSeverity: SeverityLevel
      triageReasoning: string
      cweId: string
      owaspCategory: string
      cvssScore: string
      remediation: string
    }>

    try {
      const raw = await callGemini(prompt)
      parsed = JSON.parse(raw)
    } catch (err) {
      console.error("[ai] analyzeFindings batch parse error:", err)
      // Fallback: pass through findings with original severity unchanged
      parsed = batch.map((f) => ({
        triageSeverity: f.severity,
        triageReasoning: "AI triage unavailable — using tool-reported severity.",
        cweId: f.cweId ?? "",
        owaspCategory: f.owaspCategory ?? "",
        cvssScore: f.cvssScore ?? "",
        remediation: "Refer to tool documentation for remediation guidance.",
      }))
    }

    batch.forEach((finding, idx) => {
      const enriched = parsed[idx] ?? {
        triageSeverity: finding.severity,
        triageReasoning: "Triage data missing for this index.",
        cweId: "",
        owaspCategory: "",
        cvssScore: "",
        remediation: "",
      }
      results.push({
        ...finding,
        triageSeverity: enriched.triageSeverity,
        triageReasoning: enriched.triageReasoning,
        cweId: enriched.cweId || finding.cweId || "",
        owaspCategory: enriched.owaspCategory || finding.owaspCategory || "",
        cvssScore: enriched.cvssScore || finding.cvssScore || "",
        remediation: enriched.remediation,
        fingerprint: makeFingerprint(finding),
      })
    })
  }

  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. generateAutoFix — produce a unified diff patch for one finding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a ready-to-apply unified diff patch for the given finding.
 * Requires `codeSnippet` to be present for best results.
 */
export async function generateAutoFix(
  finding: TriagedFinding,
): Promise<AutoFixResult> {
  const prompt = `
You are a senior software security engineer. Generate a code fix for the following security vulnerability.

VULNERABILITY DETAILS:
- Title: ${finding.title}
- Tool: ${finding.tool}
- Severity: ${finding.triageSeverity}
- CWE: ${finding.cweId || "Unknown"}
- OWASP: ${finding.owaspCategory || "N/A"}
- File: ${finding.filePath ?? "N/A"}
- Lines: ${finding.lineStart ?? "?"}–${finding.lineEnd ?? "?"}
- Description: ${finding.description ?? "No description provided."}
- Remediation guidance: ${finding.remediation}
${finding.codeSnippet ? `\nVULNERABLE CODE:\n\`\`\`\n${finding.codeSnippet}\n\`\`\`` : ""}

Respond with a JSON object containing:
- patch: a unified diff string (--- a/file\\n+++ b/file\\n@@ ... @@\\n-old\\n+new). If no code snippet was provided, write a conceptual patch showing the pattern to fix.
- explanation: 2-4 sentences explaining what the fix does and why it resolves the vulnerability.

Do NOT include any text outside the JSON object.
`

  try {
    const raw = await callGemini(prompt)
    const parsed = JSON.parse(raw) as { patch: string; explanation: string }
    return {
      patch: parsed.patch ?? "",
      explanation: parsed.explanation ?? "",
      model: GEMINI_MODEL,
    }
  } catch (err) {
    console.error("[ai] generateAutoFix error:", err)
    return {
      patch: "",
      explanation: "Auto-fix generation failed. Please remediate manually.",
      model: GEMINI_MODEL,
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. generateReport — produce a Markdown security summary for a scan
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a Markdown security report summarising all findings for a scan.
 * Suitable for posting as a GitHub PR comment or emailing to the team.
 */
export async function generateReport(
  repository: string,
  branch: string,
  findings: TriagedFinding[],
): Promise<ScanReport> {
  // Build summary counts
  const summary: Record<SeverityLevel, number> = {
    critical: 0, high: 0, medium: 0, low: 0, info: 0,
  }
  for (const f of findings) summary[f.triageSeverity]++

  // Weighted risk score: critical=10, high=7, medium=4, low=1, info=0
  const weights: Record<SeverityLevel, number> = {
    critical: 10, high: 7, medium: 4, low: 1, info: 0,
  }
  const rawScore = Object.entries(summary).reduce(
    (acc, [sev, count]) => acc + weights[sev as SeverityLevel] * count, 0,
  )
  const riskScore = Math.min(100, Math.round(rawScore))

  if (findings.length === 0) {
    return {
      markdown: `## ✅ Security Scan — No Findings\n\nNo vulnerabilities were detected in \`${repository}\` on branch \`${branch}\`.`,
      riskScore: 0,
      summary,
    }
  }

  const topFindings = findings
    .sort((a, b) => weights[b.triageSeverity] - weights[a.triageSeverity])
    .slice(0, 10)

  const prompt = `
You are a senior application security engineer writing a security scan report.

SCAN DETAILS:
- Repository: ${repository}
- Branch: ${branch}
- Total findings: ${findings.length}
- Risk score: ${riskScore}/100
- Severity breakdown: ${JSON.stringify(summary)}

TOP FINDINGS (up to 10):
${JSON.stringify(topFindings.map(f => ({
  title: f.title,
  severity: f.triageSeverity,
  tool: f.tool,
  cwe: f.cweId,
  file: f.filePath ?? f.targetUrl ?? "N/A",
  remediation: f.remediation,
})), null, 2)}

Write a professional Markdown security report with:
1. An executive summary (2-3 sentences)
2. A severity breakdown table
3. Top 3 critical/high issues with brief remediation notes
4. A next-steps section

Keep it concise and actionable. Use Markdown formatting.
Respond with a JSON object: { "markdown": "<full markdown report string>" }
Do NOT include any text outside the JSON object.
`

  try {
    const raw = await callGemini(prompt)
    const parsed = JSON.parse(raw) as { markdown: string }
    return { markdown: parsed.markdown ?? "", riskScore, summary }
  } catch (err) {
    console.error("[ai] generateReport error:", err)
    const fallback = `## Security Scan Report\n\n**Repository:** ${repository} · **Branch:** ${branch}\n\n**Risk Score:** ${riskScore}/100\n\n| Severity | Count |\n|---|---|\n${Object.entries(summary).map(([s, c]) => `| ${s} | ${c} |`).join("\n")}\n\n*AI report generation failed — please review findings manually.*`
    return { markdown: fallback, riskScore, summary }
  }
}