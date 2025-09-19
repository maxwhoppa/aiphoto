import * as Sentry from '@sentry/node';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction as ExpressNextFunction } from 'express';
import { config } from './config';
import { logger } from './logger';

// Extend Express Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
      };
    }
  }
}

// Initialize Sentry
if (config.SENTRY_DSN) {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    tracesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express(),
    ],
    beforeSend(event) {
      // Filter out sensitive information
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });
}

// AWS X-Ray Tracer
export const tracer = new Tracer({
  serviceName: 'aiphoto-server',
  captureHTTPsRequests: true,
});

// CloudWatch Metrics
export const metrics = new Metrics({
  namespace: 'AiPhoto',
  serviceName: 'aiphoto-server',
  defaultDimensions: {
    environment: config.NODE_ENV,
  },
});

export class MonitoringService {
  static captureError(error: Error, context?: Record<string, unknown>) {
    logger.error('Application error', { error, context });
    
    if (config.SENTRY_DSN) {
      Sentry.withScope(scope => {
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setTag(key, String(value));
          });
        }
        Sentry.captureException(error);
      });
    }
  }

  static captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, unknown>) {
    if (context) {
      logger[level === 'warning' ? 'warn' : level](message, context);
    } else {
      logger[level === 'warning' ? 'warn' : level](message);
    }
    
    if (config.SENTRY_DSN) {
      Sentry.withScope(scope => {
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setTag(key, String(value));
          });
        }
        Sentry.captureMessage(message, level as Sentry.SeverityLevel);
      });
    }
  }

  static recordMetric(name: string, value: number, unit: typeof MetricUnit[keyof typeof MetricUnit] = MetricUnit.Count, dimensions?: Record<string, string>) {
    metrics.addMetric(name, unit, value);
    
    if (dimensions) {
      Object.entries(dimensions).forEach(([key, value]) => {
        metrics.addDimension(key, value);
      });
    }
    
    logger.debug('Metric recorded', { name, value, unit, dimensions });
  }

  static recordLatency(name: string, startTime: number, dimensions?: Record<string, string>) {
    const latency = Date.now() - startTime;
    this.recordMetric(name, latency, MetricUnit.Milliseconds, dimensions);
    return latency;
  }

  static recordImageProcessingMetrics(data: {
    userId: string;
    processingTime: number;
    success: boolean;
    errorType?: string;
  }) {
    const { userId, processingTime, success, errorType } = data;
    
    // Record processing time
    this.recordMetric('ImageProcessingLatency', processingTime, MetricUnit.Milliseconds, {
      userId,
      success: success.toString(),
    });
    
    // Record success/failure
    this.recordMetric('ImageProcessingCount', 1, MetricUnit.Count, {
      userId,
      success: success.toString(),
      errorType: errorType || 'none',
    });
    
    if (!success && errorType) {
      this.recordMetric('ImageProcessingErrors', 1, MetricUnit.Count, {
        errorType,
      });
    }
  }

  static recordApiMetrics(data: {
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    userId?: string;
  }) {
    const { endpoint, method, statusCode, responseTime, userId } = data;
    
    // Record API request
    this.recordMetric('ApiRequests', 1, MetricUnit.Count, {
      endpoint,
      method,
      statusCode: statusCode.toString(),
      userId: userId || 'anonymous',
    });
    
    // Record API response time
    this.recordMetric('ApiResponseTime', responseTime, MetricUnit.Milliseconds, {
      endpoint,
      method,
    });
    
    // Record errors
    if (statusCode >= 400) {
      this.recordMetric('ApiErrors', 1, MetricUnit.Count, {
        endpoint,
        method,
        statusCode: statusCode.toString(),
      });
    }
  }

  static recordUploadMetrics(data: {
    userId: string;
    fileSize: number;
    contentType: string;
    success: boolean;
    uploadTime: number;
  }) {
    const { userId, fileSize, contentType, success, uploadTime } = data;
    
    this.recordMetric('FileUploads', 1, MetricUnit.Count, {
      userId,
      contentType,
      success: success.toString(),
    });
    
    this.recordMetric('FileUploadSize', fileSize, MetricUnit.Bytes, {
      userId,
      contentType,
    });
    
    this.recordMetric('FileUploadTime', uploadTime, MetricUnit.Milliseconds, {
      userId,
      contentType,
    });
  }

  static async publishMetrics() {
    try {
      metrics.publishStoredMetrics();
    } catch (error) {
      logger.error('Failed to publish metrics', { error });
    }
  }

  static async createSegment<T>(name: string, fn: () => Promise<T>): Promise<T> {
    tracer.putAnnotation('segmentName', name);
    return await fn();
  }

  static addAnnotation(key: string, value: string) {
    tracer.putAnnotation(key, value);
  }

  static addMetadata(key: string, value: unknown) {
    tracer.putMetadata(key, value);
  }
}

// Middleware for request tracking
export function createRequestTracker() {
  return (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
    const startTime = Date.now();
    const requestId = (Array.isArray(req.headers['x-request-id']) ? req.headers['x-request-id'][0] : req.headers['x-request-id']) || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add annotations for X-Ray
    MonitoringService.addAnnotation('requestId', requestId);
    MonitoringService.addAnnotation('method', req.method);
    MonitoringService.addAnnotation('path', req.path);
    
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      
      MonitoringService.recordApiMetrics({
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime,
        ...(req.user?.userId && { userId: req.user.userId }),
      });
    });
    
    next();
  };
}

export { Sentry };