import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { createContext } from '@/trpc/context';
import { appRouter } from '@/routes';
import { MonitoringService } from '@/utils/monitoring';
import { authMiddleware } from '@/middleware/auth';

export async function handler(event: any, context: any) {
  const { FastifyAdapter } = await import('@trpc/server/adapters/aws-lambda');
  
  try {
    const adapter = FastifyAdapter({
      router: appRouter,
      createContext,
      onError: ({ error, type, path, input, ctx }) => {
        MonitoringService.captureError(error, {
          type,
          path,
          input,
          userId: ctx?.user?.userId,
          requestId: ctx?.requestId,
        });
      },
    });

    // Apply auth middleware to protected routes
    adapter.server.addHook('preHandler', async (request, reply) => {
      // Skip auth for health checks and public routes
      if (request.url?.includes('health') || request.method === 'OPTIONS') {
        return;
      }

      try {
        await authMiddleware(request, reply);
      } catch (error) {
        // Auth errors are handled by the middleware
      }
    });

    const response = await adapter.handler(event, context);
    
    return response;
  } catch (error) {
    MonitoringService.captureError(error as Error, {
      operation: 'trpc-handler',
      event: JSON.stringify(event, null, 2),
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}