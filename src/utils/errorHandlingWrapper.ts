import { Request, Response, NextFunction } from 'express';
import { StructuredLogger } from './logger';
import { errorMonitoringService } from '../services/ErrorMonitoringService';
import { createError, AppError } from '../middleware/errorHandler';

// Wrapper for database operations with error handling
export function withDatabaseErrorHandling<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  operationName: string,
  tableName?: string
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    
    try {
      const result = await operation(...args);
      const duration = Date.now() - startTime;
      
      StructuredLogger.dbOperation(operationName, tableName || 'unknown', duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const dbError = error instanceof Error ? error : new Error(String(error));
      
      StructuredLogger.error(`Database operation failed: ${operationName}`, dbError, {
        operationName,
        tableName,
        duration,
      });

      // Record error for monitoring
      await errorMonitoringService.recordError(dbError, {
        endpoint: `db_${operationName}`,
        additionalData: { operationName, tableName, duration },
      });

      // Transform database errors to appropriate HTTP errors
      if (dbError.message.includes('duplicate key')) {
        throw createError('Resource already exists', 409, 'DUPLICATE_RESOURCE');
      } else if (dbError.message.includes('foreign key')) {
        throw createError('Referenced resource not found', 400, 'INVALID_REFERENCE');
      } else if (dbError.message.includes('connection')) {
        throw createError('Database temporarily unavailable', 503, 'DATABASE_UNAVAILABLE');
      } else {
        throw createError('Database operation failed', 500, 'DATABASE_ERROR', { originalError: dbError.message });
      }
    }
  };
}

// Wrapper for external API calls with error handling
export function withExternalApiErrorHandling<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  apiName: string,
  endpoint?: string
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    
    try {
      const result = await operation(...args);
      const duration = Date.now() - startTime;
      
      StructuredLogger.externalService(apiName, endpoint || 'unknown', true, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const apiError = error instanceof Error ? error : new Error(String(error));
      
      StructuredLogger.externalService(apiName, endpoint || 'unknown', false, duration, {
        error: apiError.message,
      });

      // Record error for monitoring
      await errorMonitoringService.recordError(apiError, {
        endpoint: `api_${apiName}`,
        additionalData: { apiName, endpoint, duration },
      });

      // Transform API errors to appropriate HTTP errors
      if (apiError.message.includes('timeout')) {
        throw createError(`${apiName} API timeout`, 504, 'API_TIMEOUT');
      } else if (apiError.message.includes('rate limit')) {
        throw createError(`${apiName} API rate limit exceeded`, 429, 'API_RATE_LIMIT');
      } else if (apiError.message.includes('unauthorized')) {
        throw createError(`${apiName} API authentication failed`, 502, 'API_AUTH_ERROR');
      } else {
        throw createError(`${apiName} API unavailable`, 503, 'API_UNAVAILABLE', { originalError: apiError.message });
      }
    }
  };
}

// Wrapper for business logic operations with error handling
export function withBusinessLogicErrorHandling<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  operationName: string,
  context?: any
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    
    try {
      const result = await operation(...args);
      const duration = Date.now() - startTime;
      
      StructuredLogger.performance(operationName, duration, context);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const businessError = error instanceof Error ? error : new Error(String(error));
      
      StructuredLogger.error(`Business logic error: ${operationName}`, businessError, {
        operationName,
        context,
        duration,
      });

      // Record error for monitoring
      await errorMonitoringService.recordError(businessError, {
        endpoint: `business_${operationName}`,
        additionalData: { operationName, context, duration },
      });

      // Re-throw if it's already an AppError, otherwise wrap it
      if ((businessError as AppError).statusCode) {
        throw businessError;
      } else {
        throw createError(`Operation failed: ${operationName}`, 500, 'BUSINESS_LOGIC_ERROR', { 
          originalError: businessError.message,
          context 
        });
      }
    }
  };
}

// Wrapper for validation operations
export function withValidationErrorHandling<T extends any[], R>(
  operation: (...args: T) => R,
  validationName: string
) {
  return (...args: T): R => {
    try {
      return operation(...args);
    } catch (error) {
      const validationError = error instanceof Error ? error : new Error(String(error));
      
      StructuredLogger.warn(`Validation failed: ${validationName}`, {
        validationName,
        error: validationError.message,
      });

      throw createError(
        `Validation failed: ${validationError.message}`,
        400,
        'VALIDATION_ERROR',
        { validationName, originalError: validationError.message }
      );
    }
  };
}

// Middleware to wrap route handlers with comprehensive error handling
export function withRouteErrorHandling(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<any>,
  routeName: string
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    
    try {
      await handler(req, res, next);
      
      // Record successful request
      await errorMonitoringService.recordSuccess();
      
      const duration = Date.now() - startTime;
      StructuredLogger.performance(`route_${routeName}`, duration, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const routeError = error instanceof Error ? error : new Error(String(error));
      
      // Record error for monitoring
      await errorMonitoringService.recordError(routeError, {
        endpoint: `${req.method} ${req.path}`,
        statusCode: (routeError as AppError).statusCode || 500,
        userId: req.user?.id,
        correlationId: req.correlationId,
        additionalData: {
          routeName,
          duration,
          query: req.query,
          params: req.params,
        },
      });
      
      next(error);
    }
  };
}

// Utility function to create standardized error responses
export function createErrorResponse(
  error: AppError,
  req: Request,
  fallbackData?: any
): any {
  const response: any = {
    success: false,
    error: {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown',
      correlationId: req.correlationId || 'unknown',
    },
  };

  // Add details in development mode
  if (process.env.NODE_ENV !== 'production' && error.details) {
    response.error.details = error.details;
  }

  // Add fallback data if available
  if (fallbackData || error.fallback) {
    response.fallback = fallbackData || error.fallback;
  }

  return response;
}

// Utility function to create standardized success responses
export function createSuccessResponse(
  data: any,
  message?: string,
  meta?: any
): any {
  return {
    success: true,
    data,
    message,
    meta,
    timestamp: new Date().toISOString(),
  };
}

// Performance monitoring decorator
export function monitorPerformance(threshold: number = 1000) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        
        if (duration > threshold) {
          StructuredLogger.warn('Slow operation detected', {
            className: target.constructor.name,
            methodName: propertyName,
            duration,
            threshold,
          });
        }
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        StructuredLogger.error(`Method ${propertyName} failed`, error, {
          className: target.constructor.name,
          methodName: propertyName,
          duration,
        });
        throw error;
      }
    };

    return descriptor;
  };
}