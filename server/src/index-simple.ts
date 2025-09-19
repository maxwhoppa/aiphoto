import Fastify from 'fastify';
import { config } from '@/utils/config-simple';

async function createServer() {
  const fastify = Fastify({
    logger: true,
  });

  // Health check route
  fastify.get('/health', async (_request, _reply) => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
    };
  });

  // Simple API route
  fastify.get('/api/status', async (_request, _reply) => {
    return {
      message: 'AI Photo Server is running',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  });

  return fastify;
}

async function startServer() {
  try {
    const server = await createServer();
    
    const address = await server.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });

    console.log(`🚀 Server listening at ${address}`);
    console.log(`📊 Health check: ${address}/health`);
    console.log(`🔗 API status: ${address}/api/status`);
    
    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if not imported
if (require.main === module) {
  startServer();
}

export { createServer, startServer };