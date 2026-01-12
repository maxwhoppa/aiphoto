import { router } from './index';
import { imagesRouter } from './routers/images';
import { healthRouter } from './routers/health';
import { paymentsRouter } from './routers/payments';
import { authRouter } from './routers/auth';
import { iapRouter } from './routers/iap';
import { userRouter } from './routers/user';
import { feedbackRouter } from './routers/feedback';

export const appRouter = router({
  images: imagesRouter,
  health: healthRouter,
  payments: paymentsRouter,
  auth: authRouter,
  iap: iapRouter,
  user: userRouter,
  feedback: feedbackRouter,
});

export type AppRouter = typeof appRouter;