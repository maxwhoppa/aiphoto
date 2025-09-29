import { router } from './index';
import { imagesRouter } from './routers/images';
import { healthRouter } from './routers/health';
import { paymentsRouter } from './routers/payments';

export const appRouter = router({
  images: imagesRouter,
  health: healthRouter,
  payments: paymentsRouter,
});

export type AppRouter = typeof appRouter;