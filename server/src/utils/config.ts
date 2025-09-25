// Load .env file in development (or when NODE_ENV is undefined)
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
  const { config } = require('dotenv');
  config();
}

import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('3000'),
  
  // Database
  DATABASE_URL: z.string(),
  
  // Redis
  REDIS_URL: z.string().optional(),
  
  // AWS
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string(),
  SQS_QUEUE_URL: z.string().optional(),
  
  // Cognito
  COGNITO_USER_POOL_ID: z.string(),
  COGNITO_REGION: z.string().default('us-east-1'),
  
  // Google Gemini
  GOOGLE_GEMINI_API_KEY: z.string(),
  
  // CORS
  CORS_ORIGIN: z.string().default('*'),
});

export const config = configSchema.parse(process.env);

export type Config = z.infer<typeof configSchema>;