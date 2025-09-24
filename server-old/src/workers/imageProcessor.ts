import { SQSEvent, SQSRecord } from 'aws-lambda';
import { geminiService } from '@/services/gemini';
import { cacheService } from '@/services/redis';
import { getDb, imageProcessingJobs } from '@/db';
import { eq } from 'drizzle-orm';
import { MonitoringService } from '@/utils/monitoring';
import { logger } from '@/utils/logger';

interface ImageProcessingMessage {
  jobId: string;
  userId: string;
  originalImageS3Key: string;
  prompt: string;
  retryCount?: number;
}

export async function handler(event: SQSEvent) {
  const results = [];

  for (const record of event.Records) {
    try {
      const result = await processRecord(record);
      results.push(result);
    } catch (error) {
      logger.error('Failed to process SQS record', {
        error,
        messageId: record.messageId,
      });
      
      results.push({
        batchItemFailures: [{ itemIdentifier: record.messageId }],
      });
    }
  }

  // Return any failed records for retry
  const failedRecords = results
    .filter(result => result.batchItemFailures)
    .flatMap(result => result.batchItemFailures);

  return {
    batchItemFailures: failedRecords,
  };
}

async function processRecord(record: SQSRecord) {
  const startTime = Date.now();
  let message: ImageProcessingMessage;

  try {
    message = JSON.parse(record.body) as ImageProcessingMessage;
  } catch (error) {
    logger.error('Invalid message format', {
      error,
      body: record.body,
      messageId: record.messageId,
    });
    
    // Don't retry invalid messages
    return { success: true };
  }

  const { jobId, userId, originalImageS3Key, prompt } = message;

  logger.info('Processing image job', {
    jobId,
    userId,
    originalImageS3Key,
    messageId: record.messageId,
  });

  try {
    const db = getDb();

    // Update job status to processing
    await db.update(imageProcessingJobs)
      .set({
        status: 'processing',
        processingStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(imageProcessingJobs.id, jobId));

    // Update cache
    await cacheService.setJobStatus(jobId, 'processing', {
      startedAt: new Date().toISOString(),
    });

    // Process the image
    const result = await geminiService.processImage({
      originalImageS3Key,
      prompt,
      userId,
      jobId,
    });

    // Update job status to completed
    await db.update(imageProcessingJobs)
      .set({
        status: 'completed',
        processedImageUrl: result.processedImageUrl,
        geminiRequestId: result.geminiRequestId ?? null,
        processingCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(imageProcessingJobs.id, jobId));

    // Update cache
    await cacheService.setJobStatus(jobId, 'completed', {
      completedAt: new Date().toISOString(),
      result,
    });

    const processingTime = Date.now() - startTime;

    // Record metrics
    MonitoringService.recordImageProcessingMetrics({
      userId,
      processingTime,
      success: true,
    });

    logger.info('Image processing completed successfully', {
      jobId,
      userId,
      processingTime,
      processedImageS3Key: result.processedImageS3Key,
    });

    return { success: true };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Image processing failed', {
      error,
      jobId,
      userId,
      processingTime,
    });

    try {
      const db = getDb();

      // Update job status to failed
      await db.update(imageProcessingJobs)
        .set({
          status: 'failed',
          errorMessage,
          processingCompletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(imageProcessingJobs.id, jobId));

      // Update cache
      await cacheService.setJobStatus(jobId, 'failed', {
        failedAt: new Date().toISOString(),
        error: errorMessage,
      });

      // Record metrics
      MonitoringService.recordImageProcessingMetrics({
        userId,
        processingTime,
        success: false,
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
      });

    } catch (updateError) {
      logger.error('Failed to update job status after error', {
        error: updateError,
        jobId,
        originalError: error,
      });
    }

    // Determine if we should retry
    const retryCount = (message.retryCount || 0) + 1;
    const maxRetries = 3;

    if (retryCount < maxRetries) {
      logger.info('Job will be retried', {
        jobId,
        retryCount,
        maxRetries,
      });
      
      // Return failure to trigger SQS retry
      return {
        batchItemFailures: [{ itemIdentifier: record.messageId }],
      };
    } else {
      logger.error('Job exceeded max retries', {
        jobId,
        retryCount,
        maxRetries,
      });
      
      // Don't retry anymore
      return { success: true };
    }
  }
}