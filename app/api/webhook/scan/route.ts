import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/webhook/scan
 *
 * Receives GitHub Actions SAST/DAST scan result payloads,
 * validates the webhook signature, queues AI analysis, and
 * persists findings to AWS Aurora PostgreSQL.
 *
 * Implementation in progress — skeleton only.
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json({ message: "Webhook endpoint — coming soon." }, { status: 200 });
}
