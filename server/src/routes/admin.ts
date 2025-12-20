import express from 'express';
import { getDb, users, payments } from '../db/index';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

const router = express.Router();

// Simple admin authentication middleware
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'dreamboat-admin-2024';

router.use((req, res, next) => {
  const adminKey = req.headers['x-admin-key'];

  if (adminKey !== ADMIN_SECRET) {
    logger.warn('Unauthorized admin access attempt', {
      path: req.path,
      ip: req.ip
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
});

/**
 * Admin endpoint to upsert payment records
 *
 * POST /admin/payments/upsert
 *
 * This endpoint allows you to create or update payment records for any user.
 * Useful for granting free credits or fixing payment issues.
 *
 * Request body:
 * {
 *   userId: string (optional - use either userId or cognitoId or email)
 *   cognitoId: string (optional - use to look up user by cognito ID)
 *   email: string (optional - use to look up user by email)
 *   paymentId: string (optional - if provided, will update existing payment)
 *   transactionId: string (required for new payments)
 *   amount: string (default: "0" for free credits)
 *   currency: string (default: "usd")
 *   redeemed: boolean (default: false)
 *   paidAt: string (ISO date, default: now)
 *   redeemedAt: string | null (ISO date, default: null)
 * }
 *
 * Examples:
 *
 * Create free credit for user by email:
 * {
 *   "email": "user@example.com",
 *   "transactionId": "free_credit_2024_001",
 *   "amount": "0",
 *   "redeemed": false
 * }
 *
 * Update existing payment to unredeemed:
 * {
 *   "paymentId": "uuid-of-payment",
 *   "redeemed": false,
 *   "redeemedAt": null
 * }
 */
router.post('/payments/upsert', async (req, res) => {
  try {
    const db = getDb();
    const {
      userId,
      cognitoId,
      email,
      paymentId,
      transactionId,
      amount = '0',
      currency = 'usd',
      redeemed = false,
      paidAt,
      redeemedAt,
    } = req.body;

    logger.info('Admin upsert request', { userId, cognitoId, email, paymentId });

    // Find user
    let user;
    if (userId) {
      logger.info('Looking up user by userId', { userId });
      const userResults = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      logger.info('User lookup result', { found: userResults.length > 0 });
      user = userResults[0];
    } else if (cognitoId) {
      logger.info('Looking up user by cognitoId', { cognitoId });
      const userResults = await db.select().from(users).where(eq(users.cognitoId, cognitoId)).limit(1);
      logger.info('User lookup result', { found: userResults.length > 0 });
      user = userResults[0];
    } else if (email) {
      logger.info('Looking up user by email', { email });
      const userResults = await db.select().from(users).where(eq(users.email, email)).limit(1);
      logger.info('User lookup result', { found: userResults.length > 0 });
      user = userResults[0];
    }

    if (!user && !paymentId) {
      logger.warn('User not found', { userId, cognitoId, email });
      return res.status(400).json({
        error: 'User not found',
        message: 'Please provide a valid userId, cognitoId, or email to identify the user',
        searched: { userId, cognitoId, email },
      });
    }

    // If updating existing payment
    if (paymentId) {
      const existingPayment = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);

      if (existingPayment.length === 0) {
        return res.status(404).json({
          error: 'Payment not found',
          message: `No payment found with id: ${paymentId}`,
        });
      }

      // Build update object with only provided fields
      const updateData: any = {};
      if (transactionId !== undefined) updateData.transactionId = transactionId;
      if (amount !== undefined) updateData.amount = amount;
      if (currency !== undefined) updateData.currency = currency;
      if (redeemed !== undefined) updateData.redeemed = redeemed;
      if (paidAt !== undefined) updateData.paidAt = new Date(paidAt);
      if (redeemedAt !== undefined) updateData.redeemedAt = redeemedAt ? new Date(redeemedAt) : null;

      const [updatedPayment] = await db
        .update(payments)
        .set(updateData)
        .where(eq(payments.id, paymentId))
        .returning();

      logger.info('Admin updated payment record', {
        paymentId,
        updates: updateData,
      });

      return res.json({
        success: true,
        action: 'updated',
        payment: updatedPayment,
      });
    }

    // Creating new payment
    if (!transactionId) {
      return res.status(400).json({
        error: 'Missing transactionId',
        message: 'transactionId is required for new payment records',
      });
    }

    const [newPayment] = await db.insert(payments).values({
      userId: user!.id,
      transactionId,
      amount,
      currency,
      redeemed,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      redeemedAt: redeemedAt ? new Date(redeemedAt) : null,
    }).returning();

    logger.info('Admin created payment record', {
      paymentId: newPayment.id,
      userId: user!.id,
      transactionId,
      amount,
      redeemed,
    });

    return res.json({
      success: true,
      action: 'created',
      payment: newPayment,
    });

  } catch (error: any) {
    logger.error('Admin upsert payment error', { error: error.message, stack: error.stack });

    // Handle unique constraint violation (duplicate transactionId)
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Duplicate transactionId',
        message: 'A payment with this transactionId already exists. Use paymentId to update it instead.',
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * Get all payments for a user (admin view)
 *
 * GET /admin/payments/:identifier
 *
 * identifier can be userId, cognitoId, or email
 */
router.get('/payments/:identifier', async (req, res) => {
  try {
    const db = getDb();
    const { identifier } = req.params;

    // Try to find user by various identifiers
    let user;

    // Try as UUID first
    try {
      const userResults = await db.select().from(users).where(eq(users.id, identifier)).limit(1);
      user = userResults[0];
    } catch (e) {
      // Not a valid UUID, continue
    }

    // Try as cognitoId
    if (!user) {
      const userResults = await db.select().from(users).where(eq(users.cognitoId, identifier)).limit(1);
      user = userResults[0];
    }

    // Try as email
    if (!user) {
      const userResults = await db.select().from(users).where(eq(users.email, identifier)).limit(1);
      user = userResults[0];
    }

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: `No user found with identifier: ${identifier}`,
      });
    }

    const userPayments = await db.select().from(payments).where(eq(payments.userId, user.id));

    return res.json({
      user: {
        id: user.id,
        cognitoId: user.cognitoId,
        email: user.email,
      },
      payments: userPayments,
    });

  } catch (error: any) {
    logger.error('Admin get payments error', { error: error.message });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

export default router;
