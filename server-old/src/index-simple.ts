import Fastify from 'fastify';
import { config } from '@/utils/config-simple';
import { v4 as uuidv4 } from 'uuid';

async function createServer() {
  const fastify = Fastify({
    logger: true,
  });

  // Enable CORS for local development
  await fastify.register(import('@fastify/cors'), {
    origin: true,
    credentials: true,
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

  // Mock tRPC endpoints for local testing
  // Get upload URL
  fastify.post('/trpc/images.getUploadUrl', async (request, reply) => {
    const body = request.body as any;
    const { fileName, contentType } = body;
    
    return {
      result: {
        data: {
          json: {
            uploadUrl: `https://mock-s3-bucket.s3.amazonaws.com/upload`,
            s3Key: `uploads/demo-user/${uuidv4()}-${fileName}`,
            fields: {
              key: `uploads/demo-user/${uuidv4()}-${fileName}`,
              'Content-Type': contentType,
              policy: 'mock-policy',
              signature: 'mock-signature'
            }
          }
        }
      }
    };
  });

  // Confirm upload
  fastify.post('/trpc/images.confirmUpload', async (request, reply) => {
    const body = request.body as any;
    
    return {
      result: {
        data: {
          json: {
            imageId: uuidv4(),
            suggestions: [
              'professional headshot in business attire',
              'casual outdoor portrait with natural lighting',
              'creative artistic portrait with dramatic lighting'
            ]
          }
        }
      }
    };
  });

  // Process image
  fastify.post('/trpc/images.processImage', async (request, reply) => {
    const body = request.body as any;
    
    return {
      result: {
        data: {
          json: {
            jobId: uuidv4(),
            status: 'queued'
          }
        }
      }
    };
  });

  // Get job status
  fastify.get('/trpc/images.getJobStatus', async (request, reply) => {
    const query = request.query as any;
    
    // Simulate processing states
    const statuses = ['pending', 'processing', 'completed'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    return {
      result: {
        data: {
          json: {
            status: randomStatus,
            data: {
              processedImageUrl: randomStatus === 'completed' 
                ? `https://mock-s3-bucket.s3.amazonaws.com/processed/${uuidv4()}.jpg`
                : undefined,
              errorMessage: randomStatus === 'failed' ? 'Mock processing error' : undefined,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            updatedAt: new Date().toISOString()
          }
        }
      }
    };
  });

  // Get user images
  fastify.get('/trpc/images.getUserImages', async (request, reply) => {
    return {
      result: {
        data: {
          json: [
            {
              id: uuidv4(),
              userId: 'demo-user',
              originalFileName: 'test-photo.jpg',
              s3Key: 'uploads/demo-user/test-photo.jpg',
              s3Url: 'https://mock-s3-bucket.s3.amazonaws.com/uploads/demo-user/test-photo.jpg',
              contentType: 'image/jpeg',
              sizeBytes: '1024000',
              createdAt: new Date(),
              updatedAt: new Date(),
              downloadUrl: 'https://mock-s3-bucket.s3.amazonaws.com/uploads/demo-user/test-photo.jpg'
            }
          ]
        }
      }
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