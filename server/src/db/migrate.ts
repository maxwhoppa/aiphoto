import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import path from 'path';

// Load .env file in development (or when NODE_ENV is undefined)
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
  const { config } = require('dotenv');
  config();
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required for migrations');
    process.exit(1);
  }

  console.log('Starting database migration...');
  
  // Create connection just for migrations
  const migrationClient = postgres(databaseUrl, { max: 1 });
  const db = drizzle(migrationClient);
  
  try {
    const migrationsFolder = path.resolve(__dirname, '../../drizzle');
    console.log(`Running migrations from: ${migrationsFolder}`);
    
    await migrate(db, { migrationsFolder });
    
    console.log('Database migration completed successfully');
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

if (require.main === module) {
  main();
}