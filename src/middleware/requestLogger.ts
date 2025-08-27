import { Request, Response, NextFunction } from 'express';
import { StructuredLogger, withCorrelationId } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface RequestLogData {
  correlationId: string;
  requestId: string;
  method: string;
  url: string;
  path: string;
  query: any;
  headers: any;
  userAgent?: string;
  ip: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  responseSize?: number;
  error?: any;
}

// Middleware to log all requests with correlation ID
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const correlationId = req.correlationId || uuidv4();
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  // Ensure correlation ID is set
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('x-request-id', requestId);

  const requestData: RequestLogData = {
    correlationId,
    requestId,
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    headers: sanitizeHeaders(req.headers),
    userAgent: req.get('User-Agent'),
    ip: getClientIp(req),
    userId: req.user?.id,
    startTime,
  };

  // Log incoming request
  withCorrelationId(correlationId, () => {
    StructuredLogger.http('Incoming request', {
      eventType: 'request_start',
      ...requestData,
    });
  });

  // Capture response data
  const originalSend = res.send;
  let responseSize = 0;

  res.send = function(data: any) {
    if (data) {
      responseSize = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data.toString());
    }
    return originalSend.call(this, data);
  };

  // Log response when finished
  res.on('finish', () => {
    const endTime = Date.now();
    const duration = endTime - startTime;

    const responseData = {
      ...requestData,
      endTime,
      duration,
      statusCode: res.statusCode,
      responseSize,
    };

    withCorrelationId(correlationId, () => {
      const level = res.statusCode >= 400 ? 'warn' : 'info';
      StructuredLogger.apiCall(req.method, req.url, res.statusCode, duration, {
        eventType: 'request_complete',
        ...responseData,
      });

      // Log slow requests
      if (duration > 1000) {
        StructuredLogger.warn('Slow request detected', {
          eventType: 'slow_request',
          ...responseData,
          threshold: 1000,
        });
      }
    });
  });

  // Log errors
  res.on('error', (error) => {
    withCorrelationId(correlationId, () => {
      StructuredLogger.error('Response error', error, {
        eventType: 'response_error',
        ...requestData,
      });
    });
  });

  // Continue with correlation ID context
  withCorrelationId(correlationId, () => {
    next();
  });
}

// Middleware to track API endpoint usage
export function apiUsageTracker(req: Request, res: Response, next: NextFunction): void {
  const endpoint = `${req.method} ${req.route?.path || req.path}`;
  
  res.on('finish', () => {
    StructuredLogger.businessEvent('api_endpoint_usage', {
      endpoint,
      method: req.method,
      path: req.route?.path || req.path,
      statusCode: res.statusCode,
      userId: req.user?.id,
      userAgent: req.get('User-Agent'),
      ip: getClientIp(req),
    });
  });

  next();
}

// Middleware to track user actions
export function userActionTracker(action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      if (res.statusCode < 400 && req.user?.id) {
        StructuredLogger.businessEvent('user_action', {
          action,
          userId: req.user.id,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          timestamp: new Date().toISOString(),
        });
      }
    });

    next();
  };
}

// Middleware to track security events
export function securityEventTracker(req: Request, res: Response, next: NextFunction): void {
  // Track failed authentication attempts
  if (req.path.includes('/auth/') && res.statusCode === 401) {
    StructuredLogger.securityEvent('failed_authentication', {
      path: req.path,
      ip: getClientIp(req),
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });
  }

  // Track suspicious activity
  if (res.statusCode === 429) {
    StructuredLogger.securityEvent('rate_limit_exceeded', {
      path: req.path,
      ip: getClientIp(req),
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });
  }

  // Track access to sensitive endpoints
  const sensitiveEndpoints = ['/admin', '/api/users', '/api/auth'];
  if (sensitiveEndpoints.some(endpoint => req.path.startsWith(endpoint))) {
    StructuredLogger.securityEvent('sensitive_endpoint_access', {
      path: req.path,
      method: req.method,
      userId: req.user?.id,
      ip: getClientIp(req),
      statusCode: res.statusCode,
      timestamp: new Date().toISOString(),
    });
  }

  next();
}

// Performance monitoring middleware
export function performanceMonitor(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

    // Log performance metrics for slow requests or high memory usage
    if (duration > 500 || Math.abs(memoryDelta) > 10 * 1024 * 1024) { // 500ms or 10MB
      StructuredLogger.performance('request_performance', duration, {
        endpoint: `${req.method} ${req.path}`,
        memoryDelta,
        startMemory: startMemory.heapUsed,
        endMemory: endMemory.heapUsed,
        statusCode: res.statusCode,
      });
    }
  });

  next();
}

// Helper functions
function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers };
  // Remove sensitive headers
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-access-token',
  ];
  
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

function getClientIp(req: Request): string {
  return (
    req.headers['x-forwarded-for'] as string ||
    req.headers['x-real-ip'] as string ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

// Export middleware functions
export const requestLogger = {
  requestLoggerMiddleware,
  apiUsageTracker,
  userActionTracker,
  securityEventTracker,
  performanceMonitor,
};