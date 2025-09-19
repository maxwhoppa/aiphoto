import { z } from 'zod';
import { router, protectedProcedure } from '@/trpc';
import { s3Service } from '@/services/s3';
import { sqsService } from '@/services/sqs';
import { geminiService } from '@/services/gemini';
import { cacheService } from '@/services/redis';
import { getDb, userImages, imageProcessingJobs } from '@/db';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { MonitoringService } from '@/utils/monitoring';
import { NotFoundError, ValidationError } from '@/utils/errors';

const uploadPresignedUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1),
});

const processImageSchema = z.object({
  imageId: z.string().uuid(),
  prompt: z.string().min(1).max(1000),
});

const getJobStatusSchema = z.object({
  jobId: z.string().uuid(),
});

export const imagesRouter = router({
  // Get upload presigned URL
  getUploadUrl: protectedProcedure
    .input(uploadPresignedUrlSchema)
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();
      
      try {
        const { fileName, contentType } = input;
        const { userId } = ctx.user!;

        // Validate file type
        s3Service.validateImageFile(contentType, fileName);

        // Check rate limiting
        const rateLimitKey = `upload:${userId}`;
        const rateLimitResult = await cacheService.isRateLimited(rateLimitKey, 10, 3600); // 10 uploads per hour
        
        if (rateLimitResult.isLimited) {
          throw new ValidationError('Upload rate limit exceeded. Please try again later.');
        }

        // Generate presigned URL
        const result = await s3Service.createUploadPresignedUrl({
          fileName,
          contentType,
          userId,
        });

        MonitoringService.recordMetric('PresignedUrlGenerated', 1, undefined, {
          userId,
          contentType,
        });

        return result;
      } catch (error) {
        MonitoringService.captureError(error as Error, {
          operation: 'getUploadUrl',
          userId: ctx.user?.userId,
          input,
        });
        throw error;
      } finally {
        MonitoringService.recordLatency('GetUploadUrlLatency', startTime);
      }
    }),

  // Confirm upload completion and save to database
  confirmUpload: protectedProcedure
    .input(z.object({
      s3Key: z.string(),
      fileName: z.string(),
      contentType: z.string(),
      sizeBytes: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();
      
      try {
        const { s3Key, fileName, contentType, sizeBytes } = input;
        const { userId } = ctx.user!;

        // Verify the file exists in S3
        const exists = await s3Service.headObject(s3Key);
        if (!exists) {
          throw new NotFoundError('File not found in storage');
        }

        // Download and validate image content
        const imageBuffer = await s3Service.downloadBuffer(s3Key);
        const isValid = await geminiService.validateImageContent(imageBuffer);
        
        if (!isValid) {
          // Delete the invalid image from S3
          await s3Service.deleteObject(s3Key);
          throw new ValidationError('Image content is not appropriate or does not contain a clear human face');
        }

        const db = getDb();
        
        // Save to database
        const [userImage] = await db.insert(userImages).values({
          userId,
          originalFileName: fileName,
          s3Key,
          s3Url: s3Service.getPublicUrl(s3Key),
          contentType,
          sizeBytes,
        }).returning();

        // Generate prompt suggestions
        const suggestions = await geminiService.analyzeImageForPromptSuggestions(imageBuffer);

        MonitoringService.recordUploadMetrics({
          userId,
          fileSize: parseInt(sizeBytes),
          contentType,
          success: true,
          uploadTime: Date.now() - startTime,
        });

        return {
          imageId: userImage.id,
          suggestions,
        };
      } catch (error) {
        MonitoringService.recordUploadMetrics({
          userId: ctx.user!.userId,
          fileSize: parseInt(input.sizeBytes),
          contentType: input.contentType,
          success: false,
          uploadTime: Date.now() - startTime,
        });
        
        MonitoringService.captureError(error as Error, {
          operation: 'confirmUpload',
          userId: ctx.user?.userId,
          input,
        });
        throw error;
      }
    }),

  // Process image with AI
  processImage: protectedProcedure
    .input(processImageSchema)
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();
      
      try {
        const { imageId, prompt } = input;
        const { userId } = ctx.user!;

        const db = getDb();
        
        // Get the user's image
        const userImage = await db.query.userImages.findFirst({
          where: and(
            eq(userImages.id, imageId),
            eq(userImages.userId, userId)
          ),
        });

        if (!userImage) {
          throw new NotFoundError('Image not found');
        }

        // Check rate limiting for processing
        const rateLimitKey = `process:${userId}`;
        const rateLimitResult = await cacheService.isRateLimited(rateLimitKey, 5, 3600); // 5 processes per hour
        
        if (rateLimitResult.isLimited) {
          throw new ValidationError('Processing rate limit exceeded. Please try again later.');
        }

        // Create processing job
        const jobId = uuidv4();
        const [job] = await db.insert(imageProcessingJobs).values({
          id: jobId,
          userId,
          originalImageUrl: userImage.s3Url,
          prompt,
          status: 'pending',
        }).returning();

        // Queue for processing
        await sqsService.sendMessage({
          jobId,
          userId,
          originalImageS3Key: userImage.s3Key,
          prompt,
          createdAt: new Date().toISOString(),
        });

        MonitoringService.recordMetric('ImageProcessingJobCreated', 1, undefined, {
          userId,
        });

        return {
          jobId,
          status: 'queued',
        };
      } catch (error) {
        MonitoringService.captureError(error as Error, {
          operation: 'processImage',
          userId: ctx.user?.userId,
          input,
        });
        throw error;
      } finally {
        MonitoringService.recordLatency('ProcessImageLatency', startTime);
      }
    }),

  // Get job status
  getJobStatus: protectedProcedure
    .input(getJobStatusSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { jobId } = input;
        const { userId } = ctx.user!;

        // First check cache for real-time status
        const cachedStatus = await cacheService.getJobStatus(jobId);
        if (cachedStatus) {
          return cachedStatus;
        }

        // Fall back to database
        const db = getDb();
        const job = await db.query.imageProcessingJobs.findFirst({
          where: and(
            eq(imageProcessingJobs.id, jobId),
            eq(imageProcessingJobs.userId, userId)
          ),
        });

        if (!job) {
          throw new NotFoundError('Job not found');
        }

        return {
          status: job.status,
          data: {
            processedImageUrl: job.processedImageUrl,
            errorMessage: job.errorMessage,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
          },
          updatedAt: job.updatedAt.toISOString(),
        };
      } catch (error) {
        MonitoringService.captureError(error as Error, {
          operation: 'getJobStatus',
          userId: ctx.user?.userId,
          input,
        });
        throw error;
      }
    }),

  // Get user's images
  getUserImages: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const { limit, offset } = input;
        const { userId } = ctx.user!;

        const db = getDb();
        const images = await db.query.userImages.findMany({
          where: eq(userImages.userId, userId),
          limit,
          offset,
          orderBy: (userImages, { desc }) => [desc(userImages.createdAt)],
        });

        // Get download URLs for each image
        const imagesWithUrls = await Promise.all(
          images.map(async (image) => ({
            ...image,
            downloadUrl: await s3Service.createDownloadPresignedUrl({
              s3Key: image.s3Key,
              expiresIn: 3600, // 1 hour
            }),
          }))
        );

        return imagesWithUrls;
      } catch (error) {
        MonitoringService.captureError(error as Error, {
          operation: 'getUserImages',
          userId: ctx.user?.userId,
          input,
        });
        throw error;
      }
    }),

  // Get user's processing jobs
  getUserJobs: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const { limit, offset } = input;
        const { userId } = ctx.user!;

        const db = getDb();
        const jobs = await db.query.imageProcessingJobs.findMany({
          where: eq(imageProcessingJobs.userId, userId),
          limit,
          offset,
          orderBy: (imageProcessingJobs, { desc }) => [desc(imageProcessingJobs.createdAt)],
        });

        // Get download URLs for processed images
        const jobsWithUrls = await Promise.all(
          jobs.map(async (job) => ({
            ...job,
            processedImageDownloadUrl: job.processedImageUrl && job.status === 'completed'
              ? await s3Service.createDownloadPresignedUrl({
                  s3Key: job.processedImageUrl.split('/').pop()!, // Extract S3 key from URL
                  expiresIn: 3600,
                })
              : null,
          }))
        );

        return jobsWithUrls;
      } catch (error) {
        MonitoringService.captureError(error as Error, {
          operation: 'getUserJobs',
          userId: ctx.user?.userId,
          input,
        });
        throw error;
      }
    }),
});