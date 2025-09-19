import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  
  // Optional for development
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  S3_BUCKET_NAME: z.string().optional(),
  SQS_QUEUE_URL: z.string().optional(),
  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_REGION: z.string().default('us-east-1'),
  GOOGLE_GEMINI_API_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().default('*'),
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