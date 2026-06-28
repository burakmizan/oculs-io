import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { Signer } from "@aws-sdk/rds-signer"
import * as schema from "./schema"

function buildClient() {
  // IAM auth: active when AURORA_AWS_RESOURCE_ARN is set (Vercel/production).
  // Falls back to DATABASE_URL so local dev keeps working unchanged.
  if (process.env.AURORA_AWS_RESOURCE_ARN) {
    const signer = new Signer({
      hostname: process.env.AURORA_PGHOST!,
      port: Number(process.env.AURORA_PGPORT ?? 5432),
      username: process.env.AURORA_PGUSER!,
      region: process.env.AURORA_AWS_REGION!,
      // Use explicit static credentials when provided; otherwise the SDK
      // picks up Vercel-injected temporary credentials (AWS_ACCESS_KEY_ID /
      // AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN) via the default chain.
      ...(process.env.AURORA_AWS_ACCESS_KEY_ID && {
        credentials: {
          accessKeyId: process.env.AURORA_AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AURORA_AWS_SECRET_ACCESS_KEY!,
        },
      }),
    })

    return postgres({
      host: process.env.AURORA_PGHOST!,
      port: Number(process.env.AURORA_PGPORT ?? 5432),
      database: process.env.AURORA_PGDATABASE!,
      user: process.env.AURORA_PGUSER!,
      // Callback: token is generated fresh on each new connection.
      // Tokens are valid 15 min; max_lifetime is 300 s — no overlap risk.
      password: () => signer.getAuthToken(),
      max: 1,
      ssl: "require",
      idle_timeout: 20,
      max_lifetime: 300,
    })
  }

  return postgres(process.env.DATABASE_URL!, {
    max: 1,
    ssl: "require",
    idle_timeout: 20,
    max_lifetime: 300,
  })
}

const client = buildClient()
export const db = drizzle(client, { schema })
