import { z } from 'zod';
import { router, protectedProcedure } from '../index';
import { getDb, feedback, users } from '../../db/index';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils/logger';

export const feedbackRouter = router({
  // Check if user has already submitted feedback
  hasSubmitted: protectedProcedure
    .query(async ({ ctx }) => {
      const db = getDb();

      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        return { hasSubmitted: false };
      }

      // Check for existing feedback
      const existingFeedback = await db.select().from(feedback).where(eq(feedback.userId, user.id)).limit(1);

      return {
        hasSubmitted: existingFeedback.length > 0,
      };
    }),

  // Submit user feedback
  submit: protectedProcedure
    .input(z.object({
      signal: z.enum(['positive', 'neutral', 'negative']),
      feedbackText: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        throw new Error('User not found');
      }

      // Insert feedback
      const [newFeedback] = await db.insert(feedback).values({
        userId: user.id,
        signal: input.signal,
        feedbackText: input.feedbackText || null,
      }).returning();

      logger.info('Feedback submitted', {
        userId: user.id,
        signal: input.signal,
        hasFeedbackText: !!input.feedbackText,
      });

      return {
        success: true,
        feedbackId: newFeedback.id,
      };
    }),
});
