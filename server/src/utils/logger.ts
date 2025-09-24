import winston from 'winston';
import { config } from './config.js';

const logger = winston.createLogger({
  level: config.NODE_ENV === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    config.NODE_ENV === 'development'
      ? winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      : winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

export { logger };