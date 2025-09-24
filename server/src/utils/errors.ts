import { TRPCError } from '@trpc/server';
import { logger } from './logger';

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export function mapToTRPCError(error: Error): TRPCError {
  logger.error('Error occurred:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });

  if (error instanceof AuthenticationError) {
    return new TRPCError({
      code: 'UNAUTHORIZED',
      message: error.message,
    });
  }

  if (error instanceof AuthorizationError) {
    return new TRPCError({
      code: 'FORBIDDEN',
      message: error.message,
    });
  }

  if (error instanceof ValidationError) {
    return new TRPCError({
      code: 'BAD_REQUEST',
      message: error.message,
    });
  }

  if (error instanceof NotFoundError) {
    return new TRPCError({
      code: 'NOT_FOUND',
      message: error.message,
    });
  }

  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
  });
}