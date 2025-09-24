import { defineConfig } from 'drizzle-kit';
import { config } from './src/utils/config';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: config.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});