import { router } from './index';
import { imagesRouter } from './routers/images';
import { healthRouter } from './routers/health';
import { paymentsRouter } from './routers/payments';
import { authRouter } from './routers/auth';

export const appRouter = router({
  images: imagesRouter,
  health: healthRouter,
  payments: paymentsRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;