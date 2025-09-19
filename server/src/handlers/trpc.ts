import { appRouter } from '@/routes';
import { MonitoringService } from '@/utils/monitoring';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context as LambdaContext } from 'aws-lambda';
import type { Context } from '@/trpc/context';
import type { CreateAWSLambdaContextOptions } from '@trpc/server/adapters/aws-lambda';

async function createLambdaContext({ event }: CreateAWSLambdaContextOptions<APIGatewayProxyEvent>): Promise<Context> {
  const requestId = event.headers['x-request-id'] || 
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    requestId,
  };
}

export async function handler(event: APIGatewayProxyEvent, context: LambdaContext): Promise<APIGatewayProxyResult> {
  const { awsLambdaRequestHandler } = await import('@trpc/server/adapters/aws-lambda');
  
  try {
    const trpcHandler = awsLambdaRequestHandler({
      router: appRouter,
      createContext: createLambdaContext,
      onError: ({ error, type, path, input, ctx }) => {
        MonitoringService.captureError(error, {
          type,
          path,
          input: JSON.stringify(input),
          userId: ctx?.user?.userId,
          requestId: ctx?.requestId,
        });
      },
    });

    const response = await trpcHandler(event, context);
    
    return {
      statusCode: response.statusCode || 200,
      headers: response.headers || {},
      body: response.body || '',
    };
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