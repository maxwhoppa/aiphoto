import { getDb } from '@/db';
import { sql } from 'drizzle-orm';
import { getRedis } from '@/services/redis';
import { logger } from '@/utils/logger';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

export async function handler(_event: APIGatewayProxyEvent, _context: Context) {
  try {
    const healthChecks = {
      database: false,
      redis: false,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    // Check database connection
    try {
      const db = getDb();
      await db.execute(sql`SELECT 1`);
      healthChecks.database = true;
    } catch (error) {
      logger.error('Database health check failed', { error });
    }

    // Check Redis connection
    try {
      const redis = getRedis();
      await redis.ping();
      healthChecks.redis = true;
    } catch (error) {
      logger.error('Redis health check failed', { error });
    }

    const isHealthy = healthChecks.database && healthChecks.redis;
    const statusCode = isHealthy ? 200 : 503;

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: isHealthy ? 'healthy' : 'unhealthy',
        checks: healthChecks,
      }),
    };
  } catch (error) {
    logger.error('Health check handler error', { error });
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'error',
        error: 'Health check failed',
      }),
    };
  }
}