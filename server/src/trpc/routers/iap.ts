import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../index';
import { TRPCError } from '@trpc/server';
import fetch from 'node-fetch';
import { getDb, users, payments } from '../../db/index';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../../utils/logger';

const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const GOOGLE_PLAY_VALIDATION_URL = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

const validateAppleReceipt = async (receipt: string) => {
  try {
    // Try production first
    let response = await fetch(APPLE_PRODUCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'receipt-data': receipt,
        'password': process.env.APPLE_SHARED_SECRET, // Add this to your env
      }),
    });

    let data: any = await response.json();

    // If production fails with status 21007, try sandbox
    if (data.status === 21007) {
      response = await fetch(APPLE_SANDBOX_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          'receipt-data': receipt,
          'password': process.env.APPLE_SHARED_SECRET,
        }),
      });
      data = await response.json();
    }

    return data.status === 0;
  } catch (error) {
    logger.error('Apple receipt validation error:', error);
    return false;
  }
};

const validateGooglePlayPurchase = async (purchaseToken: string, productId: string) => {
  try {
    // This is simplified - in production you'd use Google Play Developer API
    // with proper authentication
    const packageName = 'com.dreamboat.dreamboat'; // Your app's package name

    // For now, we'll do a basic validation
    // In production, you'd verify with Google Play API
    return !!purchaseToken && !!productId;
  } catch (error) {
    logger.error('Google Play validation error:', error);
    return false;
  }
};

export const iapRouter = router({
  validatePurchase: protectedProcedure
    .input(
      z.object({
        platform: z.enum(['ios', 'android']),
        receipt: z.string(),
        productId: z.string(),
        transactionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const db = getDb();

        let isValid = false;

        if (input.platform === 'ios') {
          isValid = await validateAppleReceipt(input.receipt);
        } else if (input.platform === 'android') {
          isValid = await validateGooglePlayPurchase(input.receipt, input.productId);
        }

        if (!isValid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid purchase receipt',
          });
        }

        // Get or create user in database
        const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
        let user = userResults[0];

        if (!user) {
          const [newUser] = await db.insert(users).values({
            cognitoId: ctx.user.sub,
            email: ctx.user.email || `${ctx.user.sub}@cognito.local`,
          }).returning();
          user = newUser;
        }

        // Always create a new payment record for each purchase
        // (removed check for existing payment)

        // Store purchase in database
        const [payment] = await db.insert(payments).values({
          userId: user.id,
          transactionId: `iap_${input.platform}_${input.transactionId}`,
          amount: '9999', // $99.99 in cents
          currency: 'usd',
          redeemed: false,
          paidAt: new Date(),
        }).returning();

        logger.info('IAP purchase validated and stored', {
          paymentId: payment.id,
          userId: user.id,
          platform: input.platform,
        });

        return {
          valid: true,
          paymentId: payment.id,
          message: 'Purchase validated successfully',
        };
      } catch (error: any) {
        logger.error('IAP validation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to validate purchase',
        });
      }
    }),

  checkPurchaseStatus: protectedProcedure
    .input(
      z.object({
        transactionId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const db = getDb();

        // Get user
        const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
        const user = userResults[0];

        if (!user) {
          return {
            hasAccess: false,
            message: 'User not found',
          };
        }

        // Build query conditions
        const conditions = [eq(payments.userId, user.id)];
        if (input.transactionId) {
          conditions.push(eq(payments.transactionId, input.transactionId));
        }

        const payment = await db
          .select()
          .from(payments)
          .where(and(...conditions))
          .orderBy(desc(payments.paidAt))
          .limit(1);

        if (!payment || payment.length === 0) {
          return {
            hasAccess: false,
            message: 'No valid purchase found',
          };
        }

        return {
          hasAccess: true,
          isRedeemed: payment[0].redeemed,
          paymentId: payment[0].id,
          message: 'Valid purchase found',
        };
      } catch (error: any) {
        logger.error('Check purchase status error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to check purchase status',
        });
      }
    }),

  restorePurchases: protectedProcedure
    .input(
      z.object({
        platform: z.enum(['ios', 'android']),
        purchases: z.array(
          z.object({
            receipt: z.string(),
            productId: z.string(),
            transactionId: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const db = getDb();

        // Get user
        const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
        let user = userResults[0];

        if (!user) {
          const [newUser] = await db.insert(users).values({
            cognitoId: ctx.user.sub,
            email: ctx.user.email || `${ctx.user.sub}@cognito.local`,
          }).returning();
          user = newUser;
        }

        const validPurchases = [];

        for (const purchase of input.purchases) {
          let isValid = false;

          if (input.platform === 'ios') {
            isValid = await validateAppleReceipt(purchase.receipt);
          } else if (input.platform === 'android') {
            isValid = await validateGooglePlayPurchase(purchase.receipt, purchase.productId);
          }

          if (isValid) {
            // Check if purchase already exists
            const existingPayment = await db
              .select()
              .from(payments)
              .where(eq(payments.transactionId, purchase.transactionId))
              .limit(1);

            if (existingPayment.length === 0) {
              // Create new payment record
              const [payment] = await db.insert(payments).values({
                userId: user.id,
                transactionId: purchase.transactionId,
                amount: '9999', // $99.99 in cents
                currency: 'usd',
                redeemed: false,
                paidAt: new Date(),
              }).returning();

              validPurchases.push(payment);
            } else {
              validPurchases.push(existingPayment[0]);
            }
          }
        }

        logger.info('Purchases restored', {
          userId: user.id,
          restoredCount: validPurchases.length,
        });

        return {
          restoredCount: validPurchases.length,
          purchases: validPurchases,
          message: `Restored ${validPurchases.length} purchase(s)`,
        };
      } catch (error: any) {
        logger.error('Restore purchases error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to restore purchases',
        });
      }
    }),
});