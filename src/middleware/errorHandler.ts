import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
  details?: any;
  correlationId?: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
    correlationId: string;
  };
  fallback?: {
    data: any;
    source: string;
    lastUpdated: string;
  };
}

// Middleware to add correlation ID to requests
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}

// Enhanced error handler with structured logging and correlation IDs
export function errorHandler(
  error: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  const correlationId = req.correlationId || 'unknown';
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  // Determine error code
  const errorCode = error.code || getErrorCodeFromStatus(statusCode);

  // Structure error details for logging
  const errorDetails = {
    correlationId,
    requestId,
    error: {
      name: error.name,
      message: error.message,
      code: errorCode,
      statusCode,
      stack: error.stack,
      isOperational: error.isOperational || false,
      details: error.details,
    },
    request: {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      headers: sanitizeHeaders(req.headers),
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id,
    },
    timestamp: new Date().toISOString(),
  };

  // Log error with appropriate level
  if (statusCode >= 500) {
    logger.error('Server error occurred', errorDetails);
  } else if (statusCode >= 400) {
    logger.warn('Client error occurred', errorDetails);
  } else {
    logger.info('Error handled', errorDetails);
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: {
      code: errorCode,
      message: process.env.NODE_ENV === 'production' ? getSafeErrorMessage(statusCode) : message,
      timestamp: new Date().toISOString(),
      requestId,
      correlationId,
    },
  };

  // Add details in development mode
  if (process.env.NODE_ENV !== 'production' && error.details) {
    errorResponse.error.details = error.details;
  }

  // Add fallback data if available
  if (error.fallback) {
    errorResponse.fallback = error.fallback;
  }

  res.status(statusCode).json(errorResponse);
}

// Async error wrapper for route handlers
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Create structured error with correlation ID
export function createError(
  message: string,
  statusCode = 500,
  code?: string,
  details?: any,
  fallback?: any
): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  error.code = code || getErrorCodeFromStatus(statusCode);
  error.details = details;
  error.fallback = fallback;
  return error;
}

// Create API unavailable error with fallback data
export function createApiUnavailableError(
  apiName: string,
  fallbackData?: any,
  lastUpdated?: Date
): AppError {
  const error = createError(
    `${apiName} API is currently unavailable`,
    503,
    'API_UNAVAILABLE',
    { apiName }
  );

  if (fallbackData) {
    error.fallback = {
      data: fallbackData,
      source: 'cache',
      lastUpdated: lastUpdated?.toISOString() || new Date().toISOString(),
    };
  }

  return error;
}

// Create validation error
export function createValidationError(
  message: string,
  validationErrors: any[]
): AppError {
  return createError(
    message,
    400,
    'VALIDATION_ERROR',
    { validationErrors }
  );
}

// Create not found error
export function createNotFoundError(resource: string, id?: string): AppError {
  const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
  return createError(message, 404, 'NOT_FOUND', { resource, id });
}

// Create rate limit error
export function createRateLimitError(limit: number, windowMs: number): AppError {
  return createError(
    'Rate limit exceeded',
    429,
    'RATE_LIMIT_EXCEEDED',
    { limit, windowMs }
  );
}

// Helper functions
function getErrorCodeFromStatus(statusCode: number): string {
  const codes: { [key: number]: string } = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'RATE_LIMIT_EXCEEDED',
    500: 'INTERNAL_SERVER_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'GATEWAY_TIMEOUT',
  };
  return codes[statusCode] || 'UNKNOWN_ERROR';
}

function getSafeErrorMessage(statusCode: number): string {
  const messages: { [key: number]: string } = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return messages[statusCode] || 'An error occurred';
}

function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers };
  // Remove sensitive headers
  delete sanitized.authorization;
  delete sanitized.cookie;
  delete sanitized['x-api-key'];
  return sanitized;
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      user?: { id: string; email: string };
    }
  }
}