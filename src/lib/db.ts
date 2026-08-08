import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const DATABASE_URL = process.env.DATABASE_URL;

// Next.js dev mode reloads modules on every request, which would otherwise
// open a fresh connection pool each time. Cache on the global object so it
// survives hot reloads; in production each serverless instance still gets
// its own pool, reused across warm invocations.
declare global {
  var _db: PostgresJsDatabase<typeof schema> | undefined;
}

function createDb(): PostgresJsDatabase<typeof schema> {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  // prepare:false is required when DATABASE_URL points at a connection
  // pooler running in transaction mode (e.g. Neon's pooled/-pooler
  // connection string, or PgBouncer) — pooled connections can't safely
  // reuse prepared statements across requests.
  const client = postgres(DATABASE_URL, { prepare: false });
  return drizzle(client, { schema });
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!global._db) {
    global._db = createDb();
  }
  return global._db;
}
