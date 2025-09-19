import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createConnection } from './index';
import { logger } from '@/utils/logger';

async function runMigrations() {
  try {
    const { connection, db } = createConnection();
    
    logger.info('Starting database migrations...');
    
    await migrate(db, { migrationsFolder: './drizzle' });
    
    logger.info('Database migrations completed successfully');
    
    await connection.end();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', { error });
    process.exit(1);
  }
}

runMigrations();