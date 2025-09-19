import Fastify from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { registerMiddleware } from '@/middleware';
import { createContext } from '@/trpc/context';
import { appRouter } from '@/routes';
import { authMiddleware } from '@/middleware/auth';
import { MonitoringService, createRequestTracker } from '@/utils/monitoring';
import { createConnection } from '@/db';
import { createRedisConnection } from '@/services/redis';

async function createServer() {
  const fastify = Fastify({
    logger: {
      level: config.NODE_ENV === 'development' ? 'debug' : 'info',
    },
  });

  try {
    // Initialize database connection
    createConnection();
    logger.info('Database connection initialized');

    // Initialize Redis connection
    createRedisConnection();
    logger.info('Redis connection initialized');

    // Register middleware
    await registerMiddleware(fastify);

    // Request tracking middleware
    fastify.addHook('preHandler', createRequestTracker());

    // Auth middleware for protected routes
    fastify.addHook('preHandler', async (request, reply) => {
      // Skip auth for health checks and public routes
      if (request.url.includes('/health') || request.method === 'OPTIONS') {
        return;
      }

      // Skip auth for tRPC introspection in development
      if (config.NODE_ENV === 'development' && request.url.includes('trpc')) {
        return;
      }

      try {
        await authMiddleware(request, reply);
      } catch (error) {
        // Let tRPC handle auth errors for tRPC routes
        if (request.url.includes('/trpc')) {
          return;
        }
        throw error;
      }
    });

    // Register tRPC
    await fastify.register(fastifyTRPCPlugin, {
      prefix: '/trpc',
      trpcOptions: {
        router: appRouter,
        createContext,
        onError: ({ error, type, path, input, ctx }) => {
          MonitoringService.captureError(error, {
            type,
            path,
            input: JSON.stringify(input),
            userId: ctx?.user?.userId,
            requestId: ctx?.requestId,
          });
        },
      },
    });

    // Global error handler
    fastify.setErrorHandler(async (error, request, reply) => {
      const statusCode = error.statusCode || 500;
      
      MonitoringService.captureError(error, {
        url: request.url,
        method: request.method,
        statusCode,
        userId: (request as { user?: { userId?: string } }).user?.userId,
      });

      logger.error('Request error', {
        error,
        url: request.url,
        method: request.method,
        statusCode,
      });

      const response = {
        error: {
          message: statusCode >= 500 ? 'Internal server error' : error.message,
          statusCode,
        },
        requestId: request.headers['x-request-id'],
      };

      reply.status(statusCode).send(response);
    });

    return fastify;
  } catch (error) {
    logger.error('Failed to create server', { error });
    throw error;
  }
}

async function startServer() {
  try {
    const server = await createServer();
    
    const address = await server.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });

    logger.info(`Server listening at ${address}`);
    
    // Publish any pending metrics
    await MonitoringService.publishMetrics();

    return server;
  } catch (error) {
    logger.error('Failed to start server', { error });
    MonitoringService.captureError(error as Error);
    process.exit(1);
  }
}

// Start server if not imported
if (require.main === module) {
  startServer();
}

export { createServer, startServer };