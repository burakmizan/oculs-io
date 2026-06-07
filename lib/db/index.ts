import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL!

// max: 1 prevents connection pool exhaustion in serverless/edge cold starts
const client = postgres(connectionString, {
  max: 1,
  ssl: "require",
  idle_timeout: 20,
  max_lifetime: 300,
})

export const db = drizzle(client, { schema })
