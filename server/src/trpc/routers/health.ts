import { router, publicProcedure } from '../index';
import { getDb } from '../../db/index';
import { geminiService } from '../../services/gemini';
import { logger } from '../../utils/logger';
import { sql } from 'drizzle-orm';

export const healthRouter = router({
  // Public health check
  check: publicProcedure
    .query(async () => {
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          database: false,
          gemini: false,
        },
      };

      // Check database
      try {
        const db = getDb();
        await db.execute(sql`SELECT 1`);
        health.services.database = true;
      } catch (error) {
        logger.error('Database health check failed', error);
        health.status = 'degraded';
      }

      // Check Gemini service
      try {
        health.services.gemini = await geminiService.healthCheck();
        if (!health.services.gemini && health.status === 'ok') {
          health.status = 'degraded';
        }
      } catch (error) {
        logger.error('Gemini health check failed', error);
        health.status = 'degraded';
      }

      return health;
    }),

});