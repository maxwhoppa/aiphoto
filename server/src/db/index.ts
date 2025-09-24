import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { config } from '../utils/config.js';

let connection: postgres.Sql<{}> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!db) {
    if (!connection) {
      connection = postgres(config.DATABASE_URL, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      });
    }
    
    db = drizzle(connection, { schema });
  }
  
  return db;
}

export async function closeDb() {
  if (connection) {
    await connection.end();
    connection = null;
    db = null;
  }
}

export * from './schema.js';