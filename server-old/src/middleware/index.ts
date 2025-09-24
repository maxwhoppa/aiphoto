export { authMiddleware, optionalAuthMiddleware } from './auth';

import { FastifyInstance } from 'fastify';
import { config } from '@/utils/config';

export async function registerMiddleware(fastify: FastifyInstance) {
  // CORS
  await fastify.register(import('@fastify/cors'), {
    origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(','),
    credentials: true,
  });

  // Security headers
  await fastify.register(import('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  });

  // Rate limiting
  await fastify.register(import('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: (request, context) => {
      return {
        code: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded, retry in ${Math.round(context.ttl / 1000)} seconds`,
        expiresIn: Math.round(context.ttl / 1000),
      };
    },
  });

  // Multipart support for file uploads
  await fastify.register(import('@fastify/multipart'), {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 5,
    },
  });

  // Health check route
  fastify.get('/health', async (_request, _reply) => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
    };
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    try {
      await fastify.close();
      console.log('Server closed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}