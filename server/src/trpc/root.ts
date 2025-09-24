import { router } from './index';
import { imagesRouter } from './routers/images';
import { healthRouter } from './routers/health';

export const appRouter = router({
  images: imagesRouter,
  health: healthRouter,
});

export type AppRouter = typeof appRouter;