import { Logger } from '@aws-lambda-powertools/logger';
import { config } from './config';

export const logger = new Logger({
  logLevel: config.NODE_ENV === 'development' ? 'DEBUG' : 'INFO',
  serviceName: 'aiphoto-server',
  environment: config.NODE_ENV,
});

export function createLogger(context: string) {
  return logger.createChild({
    persistentLogAttributes: { context }
  });
}