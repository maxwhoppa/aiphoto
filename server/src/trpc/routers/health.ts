import { router, publicProcedure } from '../index.js';
import { getDb } from '../../db/index.js';
import { geminiService } from '../../services/gemini.js';
import { logger } from '../../utils/logger.js';

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
        await db.execute('SELECT 1');
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