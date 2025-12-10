import { z } from 'zod';
import { router, protectedProcedure } from '../index';
import { getDb, users, payments, generations } from '../../db/index';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { config } from '../../utils/config';
import Stripe from 'stripe';

// Initialize Stripe with your secret key
const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
});

export const paymentsRouter = router({
  // Always create a new checkout session (no more unredeemed payment checks)
  getOrCreateCheckout: protectedProcedure
    .mutation(async ({ ctx }) => {
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
      }

      // Create new Stripe checkout session
      const amount = 9999; // $99.99 in cents

      try {
        // Create a real Stripe checkout session
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: 'DreamBoat AI - Photo Generation',
                  description: 'Generate AI-enhanced photos for your dating profile',
                },
                unit_amount: amount,
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${config.APP_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${config.APP_URL}/payment-cancelled`,
          metadata: {
            userId: user.id,
            cognitoUserId: ctx.user.sub,
          },
        });

        logger.info('Created new Stripe checkout session', {
          cognitoUserId: ctx.user.sub,
          userId: user.id,
          sessionId: session.id,
          amount,
        });

        return {
          hasUnredeemedPayment: false,
          paymentId: null,
          checkoutUrl: session.url,
          sessionId: session.id,
          message: 'New checkout session created'
        };

      } catch (error) {
        logger.error('Failed to create checkout session', {
          cognitoUserId: ctx.user.sub,
          error,
        });
        throw new Error('Failed to create payment session');
      }
    }),

  // Mark payment as redeemed when user generates photos
  redeemPayment: protectedProcedure
    .input(z.object({
      paymentId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        throw new Error('User not found');
      }

      // Get the payment and verify ownership
      const paymentResults = await db
        .select()
        .from(payments)
        .where(and(
          eq(payments.id, input.paymentId),
          eq(payments.userId, user.id)
        ))
        .limit(1);

      const payment = paymentResults[0];

      if (!payment) {
        throw new Error('Payment not found or does not belong to user');
      }

      if (payment.redeemed) {
        throw new Error('Payment has already been redeemed');
      }

      // Mark payment as redeemed
      const [updatedPayment] = await db
        .update(payments)
        .set({
          redeemed: true,
          redeemedAt: new Date(),
        })
        .where(eq(payments.id, input.paymentId))
        .returning();

      logger.info('Payment redeemed for photo generation', {
        paymentId: input.paymentId,
        cognitoUserId: ctx.user.sub,
        userId: user.id,
      });

      return {
        success: true,
        payment: {
          id: updatedPayment.id,
          redeemed: updatedPayment.redeemed,
          redeemedAt: updatedPayment.redeemedAt,
        },
      };
    }),

  // Check if user has access (unredeemed payment)
  checkAccess: protectedProcedure
    .query(async ({ ctx }) => {
      const db = getDb();

      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        return {
          hasAccess: false,
          paymentId: null,
          message: 'User not found'
        };
      }

      // Check for unredeemed payment
      const unredeemedPayments = await db
        .select()
        .from(payments)
        .where(and(
          eq(payments.userId, user.id),
          eq(payments.redeemed, false)
        ))
        .orderBy(desc(payments.paidAt))
        .limit(1);

      if (unredeemedPayments.length > 0) {
        const payment = unredeemedPayments[0];
        return {
          hasAccess: true,
          paymentId: payment.id,
          paidAt: payment.paidAt,
          amount: payment.amount,
          message: 'User has access to generate photos'
        };
      }

      return {
        hasAccess: false,
        paymentId: null,
        message: 'No unredeemed payment found. Please purchase access.'
      };
    }),

  // Check generation status
  checkGenerationStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const db = getDb();

      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        return {
          isGenerating: false,
          generationStatus: null,
          paymentId: null,
          message: 'User not found'
        };
      }

      // Check for any generation with in_progress status
      const activeGenerations = await db
        .select()
        .from(generations)
        .where(and(
          eq(generations.userId, user.id),
          eq(generations.generationStatus, 'in_progress')
        ))
        .orderBy(desc(generations.createdAt))
        .limit(1);

      if (activeGenerations.length > 0) {
        const generation = activeGenerations[0];
        return {
          isGenerating: true,
          generationStatus: generation.generationStatus,
          generationId: generation.id,
          paymentId: generation.paymentId,
          totalImages: generation.totalImages,
          completedImages: generation.completedImages,
          scenarios: JSON.parse(generation.scenarios),
          createdAt: generation.createdAt,
          message: 'Generation in progress'
        };
      }

      return {
        isGenerating: false,
        generationStatus: null,
        generationId: null,
        paymentId: null,
        message: 'No active generation found'
      };
    }),

  // Get payment history (all payments, redeemed and unredeemed)
  getPaymentHistory: protectedProcedure
    .query(async ({ ctx }) => {
      const db = getDb();
      
      // Get user from database
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      const user = userResults[0];

      if (!user) {
        return [];
      }

      const userPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.userId, user.id))
        .orderBy(desc(payments.paidAt));

      return userPayments.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        redeemed: payment.redeemed,
        paidAt: payment.paidAt,
        redeemedAt: payment.redeemedAt,
      }));
    }),

  // Create a manual payment record (for testing only - remove in production)
  createManualPayment: protectedProcedure
    .input(z.object({
      amount: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Only allow in development
      if (config.NODE_ENV === 'production') {
        throw new Error('Manual payments are not allowed in production');
      }

      // Get or create user
      const userResults = await db.select().from(users).where(eq(users.cognitoId, ctx.user.sub)).limit(1);
      let user = userResults[0];

      if (!user) {
        const [newUser] = await db.insert(users).values({
          cognitoId: ctx.user.sub,
          email: ctx.user.email || `${ctx.user.sub}@cognito.local`,
        }).returning();
        user = newUser;
      }

      // Create manual payment record
      const [payment] = await db.insert(payments).values({
        userId: user.id,
        transactionId: `manual_test_${Date.now()}`,
        amount: (input.amount || 9999).toString(),
        currency: 'usd',
        redeemed: false,
        paidAt: new Date(),
      }).returning();

      logger.info('Manual payment created for testing', {
        paymentId: payment.id,
        cognitoUserId: ctx.user.sub,
        amount: payment.amount,
      });

      return {
        success: true,
        payment: {
          id: payment.id,
          amount: payment.amount,
          redeemed: payment.redeemed,
        },
      };
    }),
});