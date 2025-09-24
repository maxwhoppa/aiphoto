import { StackContext, Queue as SSTQueue, Function } from 'sst/constructs';
import { use } from 'sst/constructs';
import { Database } from './Database';
import { Storage } from './Storage';

export function Queue({ stack }: StackContext) {
  const { database } = use(Database);
  const { imagesBucket } = use(Storage);

  // Dead letter queue for failed jobs
  const deadLetterQueue = new SSTQueue(stack, 'DeadLetterQueue', {
    cdk: {
      queue: {
        retentionPeriod: {
          days: 14,
        },
      },
    },
  });

  // Main processing queue
  const imageProcessingQueue = new SSTQueue(stack, 'ImageProcessingQueue', {
    consumer: {
      function: {
        handler: 'src/workers/imageProcessor.handler',
        timeout: '15 minutes',
        memorySize: '2048 MB',
        environment: {
          DATABASE_URL: database.connectionString,
          S3_BUCKET_NAME: imagesBucket.bucketName,
        },
        permissions: [imagesBucket],
        bind: [database],
      },
      cdk: {
        eventSource: {
          batchSize: 1,
          maxBatchingWindow: {
            seconds: 5,
          },
          reportBatchItemFailures: true,
        },
      },
    },
    cdk: {
      queue: {
        visibilityTimeout: {
          minutes: 20,
        },
        retentionPeriod: {
          days: 7,
        },
        deadLetterQueue: {
          queue: deadLetterQueue.cdk.queue,
          maxReceiveCount: 3,
        },
      },
    },
  });

  // Redis for caching and session management
  const redis = new Function(stack, 'RedisCluster', {
    handler: 'src/workers/redisInit.handler',
    environment: {
      REDIS_URL: `redis://aiphoto-redis-${stack.stage}.cache.amazonaws.com:6379`,
    },
  });

  return {
    imageProcessingQueue,
    deadLetterQueue,
    redis,
  };
}