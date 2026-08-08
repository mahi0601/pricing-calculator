import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Next.js convention is .env.local (not dotenv's default .env) — load it explicitly so drizzle-kit sees the same DATABASE_URL the app uses.
config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set (checked .env / .env.local)');
}

export default defineConfig({
  schema: './src/lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
