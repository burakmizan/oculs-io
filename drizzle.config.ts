import type { Config } from "drizzle-kit"
import { config } from "dotenv"
import { execSync } from "child_process"

config({ path: ".env.local" })

function getDbCredentials() {
  if (!process.env.AURORA_AWS_RESOURCE_ARN) {
    return { url: process.env.DATABASE_URL! }
  }

  const host = process.env.AURORA_PGHOST!
  const port = Number(process.env.AURORA_PGPORT ?? 5432)
  const user = process.env.AURORA_PGUSER!
  const region = process.env.AURORA_AWS_REGION!
  const database = process.env.AURORA_PGDATABASE!

  // Inherit the process env, but map AURORA_AWS_* to AWS_* so the CLI picks them up.
  const awsEnv: NodeJS.ProcessEnv = { ...process.env, AWS_DEFAULT_REGION: region }
  if (process.env.AURORA_AWS_ACCESS_KEY_ID) {
    awsEnv.AWS_ACCESS_KEY_ID = process.env.AURORA_AWS_ACCESS_KEY_ID
    awsEnv.AWS_SECRET_ACCESS_KEY = process.env.AURORA_AWS_SECRET_ACCESS_KEY!
  }

  try {
    const token = execSync(
      `aws rds generate-db-auth-token --hostname ${host} --port ${port} --region ${region} --username ${user}`,
      { encoding: "utf-8", env: awsEnv }
    ).trim()
    return { host, port, user, password: token, database, ssl: true }
  } catch {
    // AWS CLI not available or not configured — fall back to DATABASE_URL.
    if (process.env.DATABASE_URL) return { url: process.env.DATABASE_URL }
    throw new Error(
      "Migration failed: set DATABASE_URL or install+configure AWS CLI for IAM token generation."
    )
  }
}

export default {
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: getDbCredentials(),
} satisfies Config
