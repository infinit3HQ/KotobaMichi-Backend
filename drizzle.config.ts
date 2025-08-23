import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// Ensure DATABASE_URL is present when running from the CLI or node.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'Missing required environment variable DATABASE_URL. Set it in your environment or add it to a .env file.'
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
});
