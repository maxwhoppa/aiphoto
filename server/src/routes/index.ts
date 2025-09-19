import { router } from '@/trpc';
import { imagesRouter } from './images';

export const appRouter = router({
  images: imagesRouter,
});

export type AppRouter = typeof appRouter;