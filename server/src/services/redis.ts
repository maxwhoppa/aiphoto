import Redis from 'ioredis';
import { config } from '@/utils/config';
import { logger } from '@/utils/logger';

let redis: Redis | null = null;

export function createRedisConnection(): Redis {
  if (redis) {
    return redis;
  }

  try {
    redis = new Redis(config.REDIS_URL, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    redis.on('connect', () => {
      logger.info('Redis connected');
    });

    redis.on('error', (error) => {
      logger.error('Redis connection error', { error });
    });

    redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    return redis;
  } catch (error) {
    logger.error('Failed to create Redis connection', { error });
    throw error;
  }
}

export function getRedis(): Redis {
  if (!redis) {
    return createRedisConnection();
  }
  return redis;
}

export class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = getRedis();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error', { error, key });
      return null;
    }
  }

  async set(key: string, value: string | number | boolean | object, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      
      return true;
    } catch (error) {
      logger.error('Cache set error', { error, key });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error', { error, key });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { error, key });
      return false;
    }
  }

  async increment(key: string, ttlSeconds?: number): Promise<number> {
    try {
      const value = await this.redis.incr(key);
      
      if (ttlSeconds && value === 1) {
        await this.redis.expire(key, ttlSeconds);
      }
      
      return value;
    } catch (error) {
      logger.error('Cache increment error', { error, key });
      throw error;
    }
  }

  async setWithLock(
    key: string, 
    value: string | number | boolean | object, 
    ttlSeconds: number = 300,
    lockTimeoutMs: number = 5000
  ): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const lockValue = `${Date.now()}_${Math.random()}`;
    
    try {
      // Try to acquire lock
      const acquired = await this.redis.set(
        lockKey, 
        lockValue, 
        'PX', 
        lockTimeoutMs, 
        'NX'
      );
      
      if (!acquired) {
        logger.debug('Failed to acquire cache lock', { key });
        return false;
      }

      // Set the actual value
      await this.set(key, value, ttlSeconds);
      
      // Release lock
      await this.redis.del(lockKey);
      
      return true;
    } catch (error) {
      logger.error('Cache set with lock error', { error, key });
      
      // Try to release lock on error
      try {
        await this.redis.del(lockKey);
      } catch (releaseError) {
        logger.error('Failed to release cache lock', { error: releaseError, key });
      }
      
      return false;
    }
  }

  // Rate limiting
  async isRateLimited(
    identifier: string, 
    limit: number, 
    windowSeconds: number
  ): Promise<{ isLimited: boolean; remaining: number; resetTime: number }> {
    const key = `rate_limit:${identifier}`;
    
    try {
      const current = await this.increment(key, windowSeconds);
      const ttl = await this.redis.ttl(key);
      
      const isLimited = current > limit;
      const remaining = Math.max(0, limit - current);
      const resetTime = Date.now() + (ttl * 1000);
      
      return { isLimited, remaining, resetTime };
    } catch (error) {
      logger.error('Rate limit check error', { error, identifier });
      // On error, allow the request
      return { isLimited: false, remaining: limit, resetTime: Date.now() };
    }
  }

  // Session management for job status tracking
  async setJobStatus(
    jobId: string, 
    status: string, 
    data?: Record<string, any>,
    ttlSeconds: number = 3600
  ): Promise<void> {
    const key = `job_status:${jobId}`;
    const jobData = {
      status,
      data,
      updatedAt: new Date().toISOString(),
    };
    
    await this.set(key, jobData, ttlSeconds);
  }

  async getJobStatus(jobId: string): Promise<{
    status: string;
    data?: Record<string, any>;
    updatedAt: string;
  } | null> {
    const key = `job_status:${jobId}`;
    return await this.get(key);
  }

  async deleteJobStatus(jobId: string): Promise<void> {
    const key = `job_status:${jobId}`;
    await this.del(key);
  }
}

export const cacheService = new CacheService();

export async function closeRedisConnection(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    logger.info('Redis connection closed');
  }
}