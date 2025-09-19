import { StackContext, Api, use } from 'sst/constructs';
import { Database } from './Database';
import { Storage } from './Storage';
import { Queue } from './Queue';
import { Auth } from './Auth';

export function API({ stack }: StackContext) {
  const { database } = use(Database);
  const { imagesBucket } = use(Storage);
  const { imageProcessingQueue } = use(Queue);
  const { auth } = use(Auth);

  const api = new Api(stack, 'API', {
    defaults: {
      function: {
        environment: {
          DATABASE_URL: database.connectionString,
          S3_BUCKET_NAME: imagesBucket.bucketName,
          SQS_QUEUE_URL: imageProcessingQueue.queueUrl,
          COGNITO_USER_POOL_ID: auth.userPoolId,
          COGNITO_REGION: stack.region,
          // Production secrets from Parameter Store
          GOOGLE_GEMINI_API_KEY: stack.stage === 'prod' 
            ? `{{resolve:ssm-secure:/aiphoto/prod/google-gemini-api-key}}`
            : process.env.GOOGLE_GEMINI_API_KEY || 'placeholder_key',
          SENTRY_DSN: stack.stage === 'prod'
            ? `{{resolve:ssm-secure:/aiphoto/prod/sentry-dsn}}`
            : process.env.SENTRY_DSN || 'placeholder_sentry',
        },
        permissions: [imagesBucket, imageProcessingQueue],
        bind: [database, auth],
      },
    },
    routes: {
      'GET /health': 'src/handlers/health.handler',
      'POST /trpc/{proxy+}': 'src/handlers/trpc.handler',
      'GET /trpc/{proxy+}': 'src/handlers/trpc.handler',
    },
    cors: {
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      allowOrigins: 
        stack.stage === 'prod' 
          ? ['https://yourdomain.com'] 
          : ['http://localhost:3000', 'http://localhost:19006'],
    },
    customDomain: 
      stack.stage === 'prod' 
        ? {
            domainName: 'api.yourdomain.com',
            hostedZone: 'yourdomain.com',
          }
        : stack.stage === 'staging'
        ? {
            domainName: 'api-staging.yourdomain.com',
            hostedZone: 'yourdomain.com',
          }
        : undefined,
  });

  // Output the API endpoint
  stack.addOutputs({
    ApiEndpoint: api.url,
    CognitoUserPoolId: auth.userPoolId,
    CognitoUserPoolClientId: auth.userPoolClientId,
    S3BucketName: imagesBucket.bucketName,
  });

  return {
    api,
  };
}