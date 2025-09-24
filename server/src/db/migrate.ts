import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { getDb, closeDb } from './index.js';
import { logger } from '../utils/logger.js';

async function main() {
  try {
    logger.info('Starting database migration...');
    const db = getDb();
    
    await migrate(db, { migrationsFolder: './drizzle' });
    
    logger.info('Database migration completed successfully');
  } catch (error) {
    logger.error('Database migration failed:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}