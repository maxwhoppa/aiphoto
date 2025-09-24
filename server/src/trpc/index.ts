import { initTRPC } from '@trpc/server';
import { Context } from './context.js';
import { mapToTRPCError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const t = initTRPC.context<Context>().create({
  errorFormatter: ({ shape, error }) => {
    logger.error('tRPC Error', {
      code: error.code,
      message: error.message,
      stack: error.stack,
    });

    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.code === 'BAD_REQUEST' && error.cause ? error.cause : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Auth middleware
const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw mapToTRPCError(new Error('Authentication required'));
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthenticated);