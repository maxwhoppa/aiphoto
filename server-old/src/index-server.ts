import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { v4 as uuidv4 } from 'uuid';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, desc } from 'drizzle-orm';
import { users, userImages, imageProcessingJobs, User, UserImage, ImageProcessingJob } from './lambda/schema';
import { webcrypto } from 'node:crypto';
import { Agent } from 'node:http';
import { NodeHttpHandler } from '@smithy/node-http-handler';

// Make crypto available globally for jose library
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as any;
}

// Reuse keep-alive agent for SDK performance
const keepAliveAgent = new Agent({ keepAlive: true, keepAliveMsecs: 60000, maxSockets: 50 });

// Initialize AWS clients with keep-alive agent
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  requestHandler: new NodeHttpHandler({ httpAgent: keepAliveAgent }),
});

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  requestHandler: new NodeHttpHandler({ httpAgent: keepAliveAgent }),
});

const sm = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1',
  requestHandler: new NodeHttpHandler({ httpAgent: keepAliveAgent }),
});

// Database connection and URL caching
let dbConnection: postgres.Sql | undefined;
let db: ReturnType<typeof drizzle> | undefined;
let cachedDbUrl: string | undefined;

async function getDatabaseUrl(): Promise<string> {
  if (cachedDbUrl) return cachedDbUrl;
  
  const arn = process.env.DATABASE_SECRET_ARN!;
  const host = process.env.DATABASE_HOST!;
  const port = process.env.DATABASE_PORT || '5432';
  const name = process.env.DATABASE_NAME || 'aiphoto';

  const { SecretString } = await sm.send(new GetSecretValueCommand({ SecretId: arn }));
  const secret = JSON.parse(SecretString || '{}');
  const user = secret.username;
  const pass = secret.password;

  cachedDbUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${name}`;
  return cachedDbUrl;
}

async function getDatabase() {
  if (!db || !dbConnection) {
    const url = await getDatabaseUrl();
    
    dbConnection = postgres(url, {
      max: 20,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
    
    db = drizzle(dbConnection, { schema: { users, userImages, imageProcessingJobs } });
  }
  
  return db;
}

// Cognito JWT verification setup
console.log('Cognito User Pool ID:', process.env.COGNITO_USER_POOL_ID);
console.log('Cognito Region:', process.env.COGNITO_REGION || 'us-east-1');
const cognitoIssuer = `https://cognito-idp.${process.env.COGNITO_REGION || 'us-east-1'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`;
const jwksUrl = `${cognitoIssuer}/.well-known/jwks.json`;
console.log('Cognito Issuer:', cognitoIssuer);
console.log('JWKS URL:', jwksUrl);

// Initialize JWKS lazily to handle startup
let JWKS: any = null;

async function getJWKS() {
  if (!JWKS) {
    JWKS = createRemoteJWKSet(new URL(jwksUrl));
  }
  return JWKS;
}

// JWT verification function
async function verifyJWT(token: string): Promise<{ userId: string; username: string } | null> {
  try {
    const jwks = await getJWKS();
    const { payload } = await jwtVerify(token, jwks, {
      issuer: cognitoIssuer,
    });
    
    console.log('JWT payload:', JSON.stringify(payload, null, 2));
    
    return {
      userId: payload.sub as string,
      username: (payload.username || payload['cognito:username'] || payload.email || 'unknown') as string,
    };
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

// Authentication middleware
async function authenticate(req: express.Request): Promise<{ userId: string; username: string } | null> {
  const authHeader = req.headers.authorization;
  console.log('Auth header:', authHeader ? 'Present' : 'Missing');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Invalid or missing Authorization header');
    return null;
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  console.log('Token length:', token.length);
  
  const result = await verifyJWT(token);
  console.log('JWT verification result:', result ? 'Success' : 'Failed');
  
  return result;
}

// Helper function to get or create user in database
async function getOrCreateUser(cognitoId: string, email: string): Promise<User> {
  const db = await getDatabase();
  
  // Try to find existing user
  const existingUser = await db.select().from(users).where(eq(users.cognitoId, cognitoId)).limit(1);
  
  if (existingUser.length > 0 && existingUser[0]) {
    return existingUser[0];
  }
  
  // Create new user if not found
  const newUser = await db.insert(users).values({
    cognitoId,
    email,
  }).returning();
  
  if (!newUser[0]) {
    throw new Error('Failed to create user');
  }
  
  return newUser[0];
}

// Validation schemas
const uploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1),
});

const confirmUploadSchema = z.object({
  s3Key: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.string(),
});

const processImageSchema = z.object({
  imageId: z.string().uuid(),
  prompt: z.string().min(1).max(1000),
});

const checkJobStatusSchema = z.object({
  jobId: z.string().uuid(),
});

const getUserImagesSchema = z.object({
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
});

const getUserJobsSchema = z.object({
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
});

// Helper function to validate image files
const validateImageFile = (contentType: string, fileName: string) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  
  if (!allowedTypes.includes(contentType.toLowerCase())) {
    throw new Error(`Invalid content type: ${contentType}. Allowed types: ${allowedTypes.join(', ')}`);
  }
  
  const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  if (!allowedExtensions.includes(fileExtension)) {
    throw new Error(`Invalid file extension: ${fileExtension}. Allowed extensions: ${allowedExtensions.join(', ')}`);
  }
};

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    message: 'AI Photo Server REST API',
    database: process.env.DATABASE_URL ? 'connected' : 'not configured',
    s3: process.env.S3_BUCKET_NAME ? 'connected' : 'not configured',
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'AI Photo Server REST API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    endpoints: [
      '/health', 
      '/api/upload', 
      '/api/confirm-upload', 
      '/api/process-image', 
      '/api/check-job-status', 
      '/api/get-user-images', 
      '/api/get-user-jobs'
    ],
  });
});

// Get upload URL endpoint (protected)
app.post('/api/upload', async (req, res) => {
  try {
    // Authenticate user
    const user = await authenticate(req);
    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const body = uploadSchema.parse(req.body);
    const { fileName, contentType } = body;
    
    // Validate file type
    validateImageFile(contentType, fileName);
    
    // Generate unique file key with user ID
    const fileId = uuidv4();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
    const s3Key = `uploads/${user.userId}/${fileId}${fileExtension}`;
    
    // Create presigned URL for upload
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      ContentType: contentType,
      Metadata: {
        'original-filename': fileName,
        'upload-timestamp': new Date().toISOString(),
      },
    });
    
    // Generate presigned URL (expires in 1 hour)
    const uploadUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: 3600 // 1 hour
    });
    
    console.log('Generated S3 upload URL', {
      bucket: process.env.S3_BUCKET_NAME,
      key: s3Key,
      contentType,
      originalFileName: fileName,
    });
    
    res.json({
      uploadUrl,
      s3Key,
      fileName,
      contentType,
      bucket: process.env.S3_BUCKET_NAME,
      expiresIn: 3600,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(400).json({
      error: 'Bad Request',
      message: error instanceof Error ? error.message : 'Failed to generate upload URL',
      timestamp: new Date().toISOString(),
    });
  }
});

// Confirm upload endpoint (protected)
app.post('/api/confirm-upload', async (req, res) => {
  try {
    // Authenticate user
    const user = await authenticate(req);
    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const body = confirmUploadSchema.parse(req.body);
    const { s3Key, fileName, contentType, sizeBytes } = body;
    
    console.log('Confirming upload', {
      s3Key,
      fileName,
      contentType,
      sizeBytes,
      bucket: process.env.S3_BUCKET_NAME,
    });
    
    // Try to verify the file exists in S3, but don't fail if it doesn't
    let fileExists = false;
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
      });
      
      const headResult = await s3Client.send(headCommand);
      fileExists = true;
      console.log('File verified in S3', {
        contentLength: headResult.ContentLength,
        contentType: headResult.ContentType,
        lastModified: headResult.LastModified,
      });
      
    } catch (error) {
      console.log('File not found in S3 (this is OK for testing):', s3Key);
      fileExists = false;
    }
    
    // Get or create user in database
    const dbUser = await getOrCreateUser(user.userId, user.username);
    
    // Save image to database
    const db = await getDatabase();
    const region = process.env.AWS_REGION || 'us-east-1';
    const s3Url = `https://${process.env.S3_BUCKET_NAME}.s3.${region}.amazonaws.com/${encodeURI(s3Key)}`;
    
    const newImage = await db.insert(userImages).values({
      userId: dbUser.id,
      originalFileName: fileName,
      s3Key,
      s3Url,
      contentType,
      sizeBytes,
    }).returning();
    
    if (!newImage[0]) {
      throw new Error('Failed to create image record');
    }
    
    res.json({
      imageId: newImage[0].id,
      message: fileExists ? 'Upload confirmed successfully' : 'Upload confirmed (file verification skipped for testing)',
      s3Key,
      fileName,
      contentType,
      sizeBytes: parseInt(sizeBytes),
      fileExists,
      timestamp: new Date().toISOString(),
      suggestions: [
        'Transform this into a professional headshot',
        'Create a beach vacation scene',
        'Make this a gym workout photo',
        'Convert to a rooftop city view',
      ],
    });
    
  } catch (error) {
    console.error('Error confirming upload:', error);
    res.status(400).json({
      error: 'Bad Request',
      message: error instanceof Error ? error.message : 'Failed to confirm upload',
      timestamp: new Date().toISOString(),
    });
  }
});

// Process image endpoint (protected)
app.post('/api/process-image', async (req, res) => {
  try {
    // Authenticate user
    const user = await authenticate(req);
    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const body = processImageSchema.parse(req.body);
    const { imageId, prompt } = body;
    
    console.log('Processing image', {
      imageId,
      prompt,
      userId: user.userId,
      username: user.username,
    });
    
    // Get or create user
    const dbUser = await getOrCreateUser(user.userId, user.username);
    
    // Generate job ID
    const jobId = uuidv4();
    
    // Send message to SQS for processing
    const sqsMessage = {
      jobId,
      userId: dbUser.id,
      imageId,
      prompt,
      createdAt: new Date().toISOString(),
    };
    
    const command = new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(sqsMessage),
    });
    
    await sqsClient.send(command);
    
    console.log('Job queued for processing', { jobId, sqsMessage });
    
    res.json({
      jobId,
      status: 'pending',
      message: 'Image processing job created successfully',
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(400).json({
      error: 'Bad Request',
      message: error instanceof Error ? error.message : 'Failed to process image',
      timestamp: new Date().toISOString(),
    });
  }
});

// Check job status endpoint (protected)
app.post('/api/check-job-status', async (req, res) => {
  try {
    // Authenticate user
    const user = await authenticate(req);
    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const body = checkJobStatusSchema.parse(req.body);
    const { jobId } = body;
    
    console.log('Checking job status', { jobId });
    
    // Simplified job status check
    console.log('Checking job status for:', { jobId, userId: user.userId });
    
    res.json({
      jobId,
      status: 'processing', // Could be: pending, processing, completed, failed
      progress: 50,
      message: 'Job is processing',
      data: {
        processedImageUrl: null,
        errorMessage: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Error checking job status:', error);
    res.status(400).json({
      error: 'Bad Request',
      message: error instanceof Error ? error.message : 'Failed to check job status',
      timestamp: new Date().toISOString(),
    });
  }
});

// Get user images endpoint (protected)
app.post('/api/get-user-images', async (req, res) => {
  try {
    // Authenticate user
    const user = await authenticate(req);
    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const body = getUserImagesSchema.parse(req.body);
    const { limit, offset } = body;
    
    console.log('Getting user images', { userId: user.userId, username: user.username, limit, offset });
    
    // Mock response for testing
    const mockImages = [
      {
        id: uuidv4(),
        userId: user.userId,
        originalFileName: 'test-photo1.jpg',
        s3Key: 'uploads/test1.jpg',
        s3Url: 'https://example.com/test1.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 123456,
        createdAt: new Date().toISOString(),
        downloadUrl: 'https://example.com/download1.jpg',
      },
      {
        id: uuidv4(),
        userId: user.userId,
        originalFileName: 'test-photo2.jpg',
        s3Key: 'uploads/test2.jpg',
        s3Url: 'https://example.com/test2.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 234567,
        createdAt: new Date().toISOString(),
        downloadUrl: 'https://example.com/download2.jpg',
      },
    ];
    
    res.json({
      images: mockImages.slice(offset, offset + limit),
      total: mockImages.length,
      limit,
      offset,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Error getting user images:', error);
    res.status(400).json({
      error: 'Bad Request',
      message: error instanceof Error ? error.message : 'Failed to get user images',
      timestamp: new Date().toISOString(),
    });
  }
});

// Get user jobs endpoint (protected)
app.post('/api/get-user-jobs', async (req, res) => {
  try {
    // Authenticate user
    const user = await authenticate(req);
    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const body = getUserJobsSchema.parse(req.body);
    const { limit, offset } = body;
    
    console.log('Getting user jobs', { userId: user.userId, username: user.username, limit, offset });
    
    // Mock response for testing
    const mockJobs = [
      {
        id: uuidv4(),
        userId: user.userId,
        originalImageUrl: 'https://example.com/original1.jpg',
        prompt: 'Transform into professional headshot',
        status: 'completed',
        processedImageUrl: 'https://example.com/processed1.jpg',
        processedImageDownloadUrl: 'https://example.com/download-processed1.jpg',
        errorMessage: null,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        userId: user.userId,
        originalImageUrl: 'https://example.com/original2.jpg',
        prompt: 'Create beach vacation scene',
        status: 'processing',
        processedImageUrl: null,
        processedImageDownloadUrl: null,
        errorMessage: null,
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    
    res.json({
      jobs: mockJobs.slice(offset, offset + limit),
      total: mockJobs.length,
      limit,
      offset,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Error getting user jobs:', error);
    res.status(400).json({
      error: 'Bad Request',
      message: error instanceof Error ? error.message : 'Failed to get user jobs',
      timestamp: new Date().toISOString(),
    });
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: error.message,
    timestamp: new Date().toISOString(),
  });
});

// Start server
const server = app.listen(Number(port), '0.0.0.0', () => {
  console.log(`AI Photo Server listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`S3 Bucket: ${process.env.S3_BUCKET_NAME || 'Not configured'}`);
  console.log(`SQS Queue: ${process.env.SQS_QUEUE_URL || 'Not configured'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    if (dbConnection) {
      dbConnection.end();
    }
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    if (dbConnection) {
      dbConnection.end();
    }
    process.exit(0);
  });
});

export default app;