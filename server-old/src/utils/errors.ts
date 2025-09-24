import { TRPCError } from '@trpc/server';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

export function mapToTRPCError(error: unknown): TRPCError {
  if (error instanceof AppError) {
    const codeMap: Record<string, TRPCError['code']> = {
      'VALIDATION_ERROR': 'BAD_REQUEST',
      'AUTHENTICATION_ERROR': 'UNAUTHORIZED',
      'AUTHORIZATION_ERROR': 'FORBIDDEN',
      'NOT_FOUND_ERROR': 'NOT_FOUND',
    };
    
    return new TRPCError({
      code: codeMap[error.code] || 'INTERNAL_SERVER_ERROR',
      message: error.message,
    });
  }
  
  if (error instanceof Error) {
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message,
    });
  }
  
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
}