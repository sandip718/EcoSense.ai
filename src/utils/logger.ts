import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';

const logLevel = process.env.LOG_LEVEL || 'info';

// Async local storage for correlation ID
export const correlationStorage = new AsyncLocalStorage<{ correlationId: string }>();

// Custom format to include correlation ID
const correlationFormat = winston.format((info) => {
  const store = correlationStorage.getStore();
  if (store?.correlationId) {
    info.correlationId = store.correlationId;
  }
  return info;
});

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  correlationFormat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  correlationFormat(),
  winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
    const correlation = correlationId ? `[${correlationId.slice(0, 8)}]` : '';
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} ${level} ${correlation} ${message} ${metaStr}`;
  })
);

export const logger = winston.createLogger({
  level: logLevel,
  format: structuredFormat,
  defaultMeta: { 
    service: 'ecosense-ai',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    hostname: process.env.HOSTNAME || 'localhost',
    pid: process.pid,
  },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true,
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Structured logging methods
export class StructuredLogger {
  static info(message: string, meta?: any): void {
    logger.info(message, meta);
  }

  static warn(message: string, meta?: any): void {
    logger.warn(message, meta);
  }

  static error(message: string, error?: Error | any, meta?: any): void {
    const errorMeta = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...meta
    } : { error, ...meta };
    
    logger.error(message, errorMeta);
  }

  static debug(message: string, meta?: any): void {
    logger.debug(message, meta);
  }

  static http(message: string, meta?: any): void {
    logger.http(message, meta);
  }

  // Performance logging
  static performance(operation: string, duration: number, meta?: any): void {
    logger.info(`Performance: ${operation}`, {
      operation,
      duration,
      unit: 'ms',
      ...meta
    });
  }

  // Business event logging
  static businessEvent(event: string, meta?: any): void {
    logger.info(`Business Event: ${event}`, {
      eventType: 'business',
      event,
      ...meta
    });
  }

  // Security event logging
  static securityEvent(event: string, meta?: any): void {
    logger.warn(`Security Event: ${event}`, {
      eventType: 'security',
      event,
      ...meta
    });
  }

  // API call logging
  static apiCall(method: string, url: string, statusCode: number, duration: number, meta?: any): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    logger.log(level, `API Call: ${method} ${url}`, {
      eventType: 'api_call',
      method,
      url,
      statusCode,
      duration,
      unit: 'ms',
      ...meta
    });
  }

  // Database operation logging
  static dbOperation(operation: string, table: string, duration: number, meta?: any): void {
    logger.info(`DB Operation: ${operation} on ${table}`, {
      eventType: 'db_operation',
      operation,
      table,
      duration,
      unit: 'ms',
      ...meta
    });
  }

  // External service logging
  static externalService(service: string, operation: string, success: boolean, duration: number, meta?: any): void {
    const level = success ? 'info' : 'warn';
    logger.log(level, `External Service: ${service} ${operation}`, {
      eventType: 'external_service',
      service,
      operation,
      success,
      duration,
      unit: 'ms',
      ...meta
    });
  }
}

// Helper function to run code with correlation ID
export function withCorrelationId<T>(correlationId: string, fn: () => T): T {
  return correlationStorage.run({ correlationId }, fn);
}

// Helper function to get current correlation ID
export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}