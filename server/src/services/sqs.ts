import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';
import { cacheService } from './redis';

const sqsClient = new SQSClient({
  region: config.AWS_REGION,
});

export interface ImageProcessingMessage {
  jobId: string;
  userId: string;
  originalImageS3Key: string;
  prompt: string;
  priority?: 'low' | 'normal' | 'high';
  retryCount?: number;
  createdAt: string;
}

export interface SQSMessage {
  messageId: string;
  receiptHandle: string;
  body: ImageProcessingMessage;
}

export class SQSService {
  private queueUrl: string;

  constructor() {
    this.queueUrl = config.SQS_QUEUE_URL;
  }

  async sendMessage(message: ImageProcessingMessage): Promise<string | undefined> {
    try {
      const messageBody = JSON.stringify(message);
      
      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: messageBody,
        MessageAttributes: {
          jobId: {
            DataType: 'String',
            StringValue: message.jobId,
          },
          userId: {
            DataType: 'String',
            StringValue: message.userId,
          },
          priority: {
            DataType: 'String',
            StringValue: message.priority || 'normal',
          },
        },
        DelaySeconds: 0,
      });

      const result = await sqsClient.send(command);
      
      logger.info('Message sent to SQS', {
        messageId: result.MessageId,
        jobId: message.jobId,
        userId: message.userId,
      });

      // Update job status in cache
      await cacheService.setJobStatus(message.jobId, 'queued', {
        queuedAt: new Date().toISOString(),
      });

      return result.MessageId;
    } catch (error) {
      logger.error('Failed to send message to SQS', {
        error,
        jobId: message.jobId,
        userId: message.userId,
      });
      throw error;
    }
  }

  async receiveMessages(maxMessages: number = 1): Promise<SQSMessage[]> {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: 20, // Long polling
        VisibilityTimeoutSeconds: 300, // 5 minutes
        MessageAttributeNames: ['All'],
      });

      const result = await sqsClient.send(command);
      
      if (!result.Messages) {
        return [];
      }

      const messages: SQSMessage[] = result.Messages.map(msg => ({
        messageId: msg.MessageId!,
        receiptHandle: msg.ReceiptHandle!,
        body: JSON.parse(msg.Body!) as ImageProcessingMessage,
      }));

      logger.debug('Received messages from SQS', {
        messageCount: messages.length,
      });

      return messages;
    } catch (error) {
      logger.error('Failed to receive messages from SQS', { error });
      throw error;
    }
  }

  async deleteMessage(receiptHandle: string): Promise<void> {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      });

      await sqsClient.send(command);
      
      logger.debug('Message deleted from SQS', { receiptHandle });
    } catch (error) {
      logger.error('Failed to delete message from SQS', {
        error,
        receiptHandle,
      });
      throw error;
    }
  }

  async sendBatchMessages(messages: ImageProcessingMessage[]): Promise<void> {
    // SQS SendMessageBatch supports up to 10 messages
    const batches = this.chunkArray(messages, 10);
    
    for (const batch of batches) {
      await Promise.all(
        batch.map(message => this.sendMessage(message))
      );
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

export class JobProcessor {
  private sqsService: SQSService;
  private isProcessing: boolean = false;

  constructor() {
    this.sqsService = new SQSService();
  }

  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      logger.warn('Job processor already running');
      return;
    }

    this.isProcessing = true;
    logger.info('Starting job processor');

    while (this.isProcessing) {
      try {
        await this.processMessages();
      } catch (error) {
        logger.error('Error in job processor loop', { error });
        // Wait before retrying
        await this.sleep(5000);
      }
    }
  }

  async stopProcessing(): Promise<void> {
    logger.info('Stopping job processor');
    this.isProcessing = false;
  }

  private async processMessages(): Promise<void> {
    const messages = await this.sqsService.receiveMessages(1);
    
    if (messages.length === 0) {
      return;
    }

    for (const message of messages) {
      try {
        await this.processMessage(message);
        await this.sqsService.deleteMessage(message.receiptHandle);
      } catch (error) {
        logger.error('Failed to process message', {
          error,
          messageId: message.messageId,
          jobId: message.body.jobId,
        });

        // Handle retry logic
        await this.handleMessageError(message, error);
      }
    }
  }

  private async processMessage(message: SQSMessage): Promise<void> {
    const { jobId, userId, originalImageS3Key, prompt } = message.body;
    
    logger.info('Processing image job', {
      jobId,
      userId,
      originalImageS3Key,
    });

    // Update status to processing
    await cacheService.setJobStatus(jobId, 'processing', {
      startedAt: new Date().toISOString(),
    });

    try {
      // Import here to avoid circular dependencies
      const { geminiService } = await import('./gemini');
      
      const result = await geminiService.processImage({
        originalImageS3Key,
        prompt,
        userId,
        jobId,
      });

      // Update status to completed
      await cacheService.setJobStatus(jobId, 'completed', {
        completedAt: new Date().toISOString(),
        result,
      });

      logger.info('Image processing job completed', {
        jobId,
        userId,
        processedImageS3Key: result.processedImageS3Key,
        processingTime: result.processingTime,
      });

    } catch (error) {
      // Update status to failed
      await cacheService.setJobStatus(jobId, 'failed', {
        failedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  private async handleMessageError(message: SQSMessage, error: unknown): Promise<void> {
    const retryCount = (message.body.retryCount || 0) + 1;
    const maxRetries = 3;

    if (retryCount <= maxRetries) {
      logger.info('Retrying message', {
        messageId: message.messageId,
        jobId: message.body.jobId,
        retryCount,
      });

      // Re-queue with retry count
      const retryMessage: ImageProcessingMessage = {
        ...message.body,
        retryCount,
      };

      await this.sqsService.sendMessage(retryMessage);
    } else {
      logger.error('Message exceeded max retries', {
        messageId: message.messageId,
        jobId: message.body.jobId,
        retryCount,
      });

      // Update job status to failed
      await cacheService.setJobStatus(message.body.jobId, 'failed', {
        failedAt: new Date().toISOString(),
        error: 'Exceeded maximum retry attempts',
        retryCount,
      });
    }

    // Delete the original message
    await this.sqsService.deleteMessage(message.receiptHandle);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const sqsService = new SQSService();
export const jobProcessor = new JobProcessor();