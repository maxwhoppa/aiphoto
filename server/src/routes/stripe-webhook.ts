import express from 'express';
import { getDb, users, payments } from '../db/index';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
});

const router = express.Router();

// Stripe webhook endpoint - must use raw body
router.post('/stripe/webhook', 
  express.raw({ type: 'application/json' }), 
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    
    if (!sig) {
      logger.error('Missing Stripe signature header');
      return res.status(400).send('Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
      // Verify the webhook signature
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        config.STRIPE_WEBHOOK_SECRET
      );
      
    } catch (err: any) {
      logger.error('Webhook signature verification failed', { error: err.message });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const db = getDb();

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        logger.info('Processing checkout.session.completed', {
          sessionId: session.id,
          paymentStatus: session.payment_status,
          metadata: session.metadata,
        });

        // Only process if payment was successful
        if (session.payment_status !== 'paid') {
          logger.warn('Session completed but payment not confirmed', {
            sessionId: session.id,
            paymentStatus: session.payment_status,
          });
          return res.json({ received: true, action: 'skipped' });
        }

        // Extract metadata
        const userId = session.metadata?.userId;
        const cognitoUserId = session.metadata?.cognitoUserId;

        if (!userId) {
          logger.error('No userId in session metadata', {
            sessionId: session.id,
            metadata: session.metadata,
          });
          return res.status(400).send('Invalid session metadata');
        }

        try {
          // Check if payment already exists (idempotency)
          const existingPayments = await db
            .select()
            .from(payments)
            .where(eq(payments.stripeSessionId, session.id))
            .limit(1);

          if (existingPayments.length > 0) {
            logger.info('Payment already recorded, skipping', {
              sessionId: session.id,
              paymentId: existingPayments[0].id,
            });
            return res.json({ 
              received: true, 
              action: 'already_recorded',
              paymentId: existingPayments[0].id 
            });
          }

          // Verify user exists
          const userRecord = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

          if (userRecord.length === 0) {
            logger.error('User not found for payment', {
              userId,
              cognitoUserId,
              sessionId: session.id,
            });
            return res.status(400).send('User not found');
          }

          // Create payment record
          const [payment] = await db.insert(payments).values({
            userId,
            stripeSessionId: session.id,
            amount: session.amount_total ? session.amount_total.toString() : '9999', // Amount in cents
            currency: session.currency || 'usd',
            redeemed: false,
            paidAt: new Date(),
          }).returning();

          logger.info('Payment recorded successfully', {
            paymentId: payment.id,
            userId,
            cognitoUserId,
            sessionId: session.id,
            amount: payment.amount,
          });

          res.json({ 
            received: true, 
            action: 'payment_recorded',
            paymentId: payment.id 
          });
        } catch (error) {
          logger.error('Failed to record payment', {
            sessionId: session.id,
            error,
          });
          res.status(500).send('Failed to process payment');
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        logger.info('Checkout session expired', {
          sessionId: session.id,
        });
        res.json({ received: true, action: 'session_expired' });
        break;
      }

      case 'payment_intent.succeeded': {
        // Additional payment confirmation if needed
        const paymentIntent = event.data.object;
        logger.info('Payment intent succeeded', {
          paymentIntentId: paymentIntent.id,
        });
        res.json({ received: true, action: 'payment_confirmed' });
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        logger.warn('Payment failed', {
          paymentIntentId: paymentIntent.id,
          failureMessage: paymentIntent.last_payment_error?.message,
        });
        res.json({ received: true, action: 'payment_failed' });
        break;
      }

      default:
        logger.info('Unhandled webhook event type', {
          type: event.type,
        });
        res.json({ received: true, action: 'unhandled' });
    }
  }
);

export default router;