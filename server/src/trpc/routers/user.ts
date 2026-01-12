import { z } from 'zod';
import { router, protectedProcedure } from '../index';
import { getDb, users, payments } from '../../db/index';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { config } from '../../utils/config';

export const userRouter = router({
  // Get current user's data
  getUserInfo: protectedProcedure
    .query(async ({ ctx }) => {
      const db = getDb();

      // Get or create user in database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      let user = userResults[0];

      if (!user) {
        const [newUser] = await db.insert(users).values({
          cognitoId: ctx.user.sub,
          email: ctx.user.email || `${ctx.user.sub}@cognito.local`,
        }).returning();
        user = newUser;

        // Grant free credit on signup if enabled
        if (config.GRANT_FREE_CREDIT_ON_SIGNUP) {
          await db.insert(payments).values({
            userId: user.id,
            transactionId: `free_signup_credit_${user.id}`,
            amount: '0',
            currency: 'usd',
            redeemed: false,
          });
          logger.info('Granted free signup credit', {
            userId: user.id,
            cognitoUserId: ctx.user.sub,
          });
        }
      }

      logger.info('Get user data', {
        cognitoUserId: ctx.user.sub,
        userId: user.id,
        hasPhoneNumber: !!user.phoneNumber,
      });

      return {
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt,
      };
    }),

  // Update user's phone number
  updatePhoneNumber: protectedProcedure
    .input(z.object({
      phoneNumber: z.string().min(1).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Get or create user in database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      let user = userResults[0];

      if (!user) {
        const [newUser] = await db.insert(users).values({
          cognitoId: ctx.user.sub,
          email: ctx.user.email || `${ctx.user.sub}@cognito.local`,
          phoneNumber: input.phoneNumber,
        }).returning();
        user = newUser;

        // Grant free credit on signup if enabled
        if (config.GRANT_FREE_CREDIT_ON_SIGNUP) {
          await db.insert(payments).values({
            userId: user.id,
            transactionId: `free_signup_credit_${user.id}`,
            amount: '0',
            currency: 'usd',
            redeemed: false,
          });
          logger.info('Granted free signup credit', {
            userId: user.id,
            cognitoUserId: ctx.user.sub,
          });
        }
      } else {
        // Update phone number
        const [updatedUser] = await db.update(users)
          .set({
            phoneNumber: input.phoneNumber,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id))
          .returning();
        user = updatedUser;
      }

      logger.info('Updated user phone number', {
        cognitoUserId: ctx.user.sub,
        userId: user.id,
      });

      return {
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt,
      };
    }),
});
