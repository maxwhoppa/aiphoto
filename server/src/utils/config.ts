import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  
  // AWS
  AWS_REGION: z.string().default('us-east-1'),
  S3_BUCKET_NAME: z.string(),
  SQS_QUEUE_URL: z.string(),
  
  // Cognito
  COGNITO_USER_POOL_ID: z.string(),
  COGNITO_REGION: z.string().default('us-east-1'),
  
  // Google Gemini
  GOOGLE_GEMINI_API_KEY: z.string(),
  
  // App Config
  CORS_ORIGIN: z.string().default('*'),
  
  // Monitoring
  SENTRY_DSN: z.string().optional(),
});

function loadConfig() {
  const result = configSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }
  
  return result.data;
}

export const config = loadConfig();
export type Config = typeof config;