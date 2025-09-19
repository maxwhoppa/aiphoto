import { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { AuthContext } from '@/types';
import { logger } from '@/utils/logger';

export interface Context {
  user?: AuthContext;
  requestId: string;
}

export async function createContext({
  req,
  res,
}: CreateFastifyContextOptions): Promise<Context> {
  const requestId = req.headers['x-request-id'] as string || 
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Add request ID to response headers for tracking
  res.header('x-request-id', requestId);

  logger.info('Request received', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
  });

  return {
    requestId,
    // User will be set by auth middleware
  };
}