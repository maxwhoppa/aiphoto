import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '@/utils/config';
import * as schema from './schema';
import { logger } from '@/utils/logger';

let connection: postgres.Sql | undefined;
let db: ReturnType<typeof drizzle> | undefined;

export function createConnection() {
  if (connection && db) {
    return { connection, db };
  }

  try {
    connection = postgres(config.DATABASE_URL, {
      max: config.NODE_ENV === 'production' ? 20 : 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });

    db = drizzle(connection, { schema });

    logger.info('Database connection established');
    
    return { connection, db };
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    throw error;
  }
}

export function getDb() {
  if (!db) {
    const result = createConnection();
    return result.db;
  }
  return db;
}

export async function closeConnection() {
  if (connection) {
    await connection.end();
    logger.info('Database connection closed');
  }
}

// Initialize connection
createConnection();

export { db };
export * from './schema';