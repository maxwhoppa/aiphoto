import { router } from './index.js';
import { imagesRouter } from './routers/images.js';
import { healthRouter } from './routers/health.js';

export const appRouter = router({
  images: imagesRouter,
  health: healthRouter,
});

export type AppRouter = typeof appRouter;