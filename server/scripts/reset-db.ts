import { getDb, closeDb } from '../src/db/index';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { config as loadEnv } from 'dotenv';
import path from 'path';

// Load environment variables
loadEnv({ path: path.join(__dirname, '..', '.env') });

async function resetDatabase() {
  console.log('🔄 Starting database reset...');

  try {
    const db = getDb();

    // Drop all tables in the public schema
    console.log('📦 Dropping all tables...');
    await db.execute(sql`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        -- Drop all tables
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;

        -- Drop the drizzle schema and migrations table
        DROP SCHEMA IF EXISTS drizzle CASCADE;
      END $$;
    `);

    console.log('✅ All tables dropped successfully');

    // Run migrations to recreate tables
    console.log('🔨 Running migrations to recreate tables...');
    const migrationsPath = path.join(__dirname, '..', 'drizzle');
    await migrate(db, { migrationsFolder: migrationsPath });

    console.log('✅ Database reset completed successfully!');

  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  } finally {
    await closeDb();
    process.exit(0);
  }
}

// Run the reset
resetDatabase();