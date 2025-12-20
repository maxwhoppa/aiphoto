import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc/root';
import { createTRPCContext } from './trpc/context';
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth';
import { config } from './utils/config';
import { logger } from './utils/logger';
import stripeWebhookRouter from './routes/stripe-webhook';
import adminRouter from './routes/admin';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: config.CORS_ORIGIN.split(',').map(origin => origin.trim()),
  credentials: true,
}));

// Stripe webhook routes MUST come before body parsing middleware
// Stripe requires the raw body for signature verification
app.use('/webhooks', stripeWebhookRouter);

// Body parsing middleware (for all other routes)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
  });
});

// Admin routes (no auth - intended for internal use via Postman)
// WARNING: In production, consider adding API key authentication
app.use('/admin', adminRouter);

// All tRPC endpoints with optional auth
app.use('/trpc', optionalAuthMiddleware, createExpressMiddleware({
  router: appRouter,
  createContext: createTRPCContext,
  onError: ({ error, path, input }) => {
    logger.error('tRPC Error:', {
      error: error.message,
      path,
      input,
      stack: error.stack,
    });
  },
}));

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Express Error:', {
    error: err.message,
    path: req.path,
    method: req.method,
    stack: err.stack,
  });

  res.status(500).json({
    error: 'Internal server error',
    message: config.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl,
  });
});

// Start server
const port = config.PORT;

app.listen(port, () => {
  logger.info(`Server running on port ${port} with auto-migrations`, {
    environment: config.NODE_ENV,
    port,
    cors: config.CORS_ORIGIN,
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

export default app;