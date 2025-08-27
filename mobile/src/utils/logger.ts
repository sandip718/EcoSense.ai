// Logger Utility for EcoSense.ai Mobile App
// Provides structured logging for the mobile application

interface LogLevel {
  DEBUG: 0;
  INFO: 1;
  WARN: 2;
  ERROR: 3;
}

const LOG_LEVELS: LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

class Logger {
  private currentLevel: number;
  private enableConsole: boolean;
  private enableRemoteLogging: boolean;

  constructor() {
    // Set log level based on environment
    this.currentLevel = __DEV__ ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
    this.enableConsole = __DEV__;
    this.enableRemoteLogging = !__DEV__;
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: keyof LogLevel): void {
    this.currentLevel = LOG_LEVELS[level];
  }

  /**
   * Enable or disable console logging
   */
  setConsoleLogging(enabled: boolean): void {
    this.enableConsole = enabled;
  }

  /**
   * Enable or disable remote logging
   */
  setRemoteLogging(enabled: boolean): void {
    this.enableRemoteLogging = enabled;
  }

  /**
   * Format log message with timestamp and context
   */
  private formatMessage(level: string, message: string, context?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  /**
   * Log to console if enabled
   */
  private logToConsole(level: string, message: string, context?: any): void {
    if (!this.enableConsole) return;

    const formattedMessage = this.formatMessage(level, message, context);

    switch (level) {
      case 'DEBUG':
        console.log(formattedMessage);
        break;
      case 'INFO':
        console.info(formattedMessage);
        break;
      case 'WARN':
        console.warn(formattedMessage);
        break;
      case 'ERROR':
        console.error(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }

  /**
   * Send log to remote service (placeholder implementation)
   */
  private async logToRemote(level: string, message: string, context?: any): Promise<void> {
    if (!this.enableRemoteLogging) return;

    try {
      // This would typically send logs to a service like Sentry, LogRocket, etc.
      // For now, we'll just store them locally or send to your backend
      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        context,
        platform: 'mobile',
        version: '1.0.0', // This would come from app config
      };

      // In a real implementation, you might:
      // - Send to crash reporting service
      // - Store in local database for later sync
      // - Send to your backend logging endpoint
      
      // For now, just log to console in development
      if (__DEV__) {
        console.log('Remote log:', logEntry);
      }
    } catch (error) {
      // Don't let logging errors crash the app
      console.error('Failed to send remote log:', error);
    }
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: any): void {
    if (this.currentLevel <= LOG_LEVELS.DEBUG) {
      this.logToConsole('DEBUG', message, context);
      this.logToRemote('DEBUG', message, context);
    }
  }

  /**
   * Info level logging
   */
  info(message: string, context?: any): void {
    if (this.currentLevel <= LOG_LEVELS.INFO) {
      this.logToConsole('INFO', message, context);
      this.logToRemote('INFO', message, context);
    }
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: any): void {
    if (this.currentLevel <= LOG_LEVELS.WARN) {
      this.logToConsole('WARN', message, context);
      this.logToRemote('WARN', message, context);
    }
  }

  /**
   * Error level logging
   */
  error(message: string, error?: any): void {
    if (this.currentLevel <= LOG_LEVELS.ERROR) {
      let context = error;
      
      // Extract useful information from Error objects
      if (error instanceof Error) {
        context = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      }

      this.logToConsole('ERROR', message, context);
      this.logToRemote('ERROR', message, context);
    }
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, context?: any): void {
    const message = `Performance: ${operation} took ${duration}ms`;
    this.info(message, {...context, duration, operation});
  }

  /**
   * Log user actions for analytics
   */
  userAction(action: string, context?: any): void {
    const message = `User Action: ${action}`;
    this.info(message, {...context, action, type: 'user_action'});
  }

  /**
   * Log API calls
   */
  apiCall(method: string, url: string, duration?: number, status?: number): void {
    const message = `API Call: ${method} ${url}`;
    const context = {
      method,
      url,
      duration,
      status,
      type: 'api_call',
    };
    
    if (status && status >= 400) {
      this.error(message, context);
    } else {
      this.info(message, context);
    }
  }

  /**
   * Log navigation events
   */
  navigation(from: string, to: string, params?: any): void {
    const message = `Navigation: ${from} -> ${to}`;
    this.debug(message, {from, to, params, type: 'navigation'});
  }

  /**
   * Create a child logger with additional context
   */
  child(context: any): Logger {
    const childLogger = new Logger();
    childLogger.currentLevel = this.currentLevel;
    childLogger.enableConsole = this.enableConsole;
    childLogger.enableRemoteLogging = this.enableRemoteLogging;

    // Override methods to include additional context
    const originalMethods = {
      debug: childLogger.debug.bind(childLogger),
      info: childLogger.info.bind(childLogger),
      warn: childLogger.warn.bind(childLogger),
      error: childLogger.error.bind(childLogger),
    };

    childLogger.debug = (message: string, additionalContext?: any) => {
      originalMethods.debug(message, {...context, ...additionalContext});
    };

    childLogger.info = (message: string, additionalContext?: any) => {
      originalMethods.info(message, {...context, ...additionalContext});
    };

    childLogger.warn = (message: string, additionalContext?: any) => {
      originalMethods.warn(message, {...context, ...additionalContext});
    };

    childLogger.error = (message: string, error?: any) => {
      const errorContext = error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error;
      
      originalMethods.error(message, {...context, ...errorContext});
    };

    return childLogger;
  }
}

// Create and export singleton logger instance
export const logger = new Logger();

// Export Logger class for creating child loggers
export {Logger};

export default logger;