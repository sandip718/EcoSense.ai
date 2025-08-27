# Error Handling and Logging System

This document describes the comprehensive error handling and logging system implemented for EcoSense.ai.

## Overview

The error handling and logging system provides:

- **Centralized error handling** with structured error responses
- **Correlation ID tracking** for request tracing across services
- **Structured logging** with multiple log levels and contexts
- **Error monitoring and alerting** with configurable rules
- **Circuit breaker pattern** for graceful degradation of external services
- **Health check endpoints** for monitoring system status
- **Performance monitoring** with slow operation detection

## Components

### 1. Structured Logging (`src/utils/logger.ts`)

Enhanced Winston-based logging system with correlation ID support and structured formats.

#### Features:
- Correlation ID tracking using AsyncLocalStorage
- Multiple log levels (error, warn, info, debug, http)
- Structured JSON logging for production
- Colorized console output for development
- Log rotation with size limits
- Performance, business event, and security event logging

#### Usage:
```typescript
import { StructuredLogger } from '../utils/logger';

// Basic logging
StructuredLogger.info('User logged in', { userId: '123' });
StructuredLogger.error('Database error', error, { operation: 'getUserById' });

// Specialized logging
StructuredLogger.performance('api_call', 150, { endpoint: '/api/users' });
StructuredLogger.businessEvent('user_registration', { userId: '123' });
StructuredLogger.securityEvent('failed_login', { ip: '192.168.1.1' });
```

### 2. Error Handling Middleware (`src/middleware/errorHandler.ts`)

Centralized error handling with correlation IDs and structured error responses.

#### Features:
- Correlation ID middleware for request tracking
- Structured error responses with fallback data support
- Different error types (validation, not found, rate limit, API unavailable)
- Async error wrapper for route handlers
- Production-safe error messages

#### Usage:
```typescript
import { 
  createError, 
  createValidationError, 
  asyncHandler 
} from '../middleware/errorHandler';

// Create custom errors
throw createError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
throw createValidationError('Invalid input', validationErrors);

// Wrap async route handlers
router.get('/users', asyncHandler(async (req, res) => {
  const users = await getUsersFromDatabase();
  res.json(users);
}));
```

### 3. Request Logging (`src/middleware/requestLogger.ts`)

Comprehensive request/response logging with performance monitoring.

#### Features:
- Request/response logging with correlation IDs
- API usage tracking
- User action tracking
- Security event tracking
- Performance monitoring for slow requests
- Header sanitization for security

#### Usage:
```typescript
import { requestLogger } from '../middleware/requestLogger';

// Apply to all routes
app.use(requestLogger.requestLoggerMiddleware);
app.use(requestLogger.apiUsageTracker);
app.use(requestLogger.securityEventTracker);

// Track specific user actions
router.post('/upload', requestLogger.userActionTracker('image_upload'), handler);
```

### 4. Health Check System (`src/middleware/healthCheck.ts`)

Comprehensive health monitoring for all system components.

#### Features:
- Database connection health
- Redis connection health
- Memory and disk usage monitoring
- Configurable health checks
- Kubernetes-compatible endpoints (readiness, liveness)
- Periodic health check execution

#### Endpoints:
- `GET /health` - Comprehensive health check
- `GET /health/readiness` - Kubernetes readiness probe
- `GET /health/liveness` - Kubernetes liveness probe

#### Usage:
```typescript
import { healthCheckService } from '../middleware/healthCheck';

// Register custom health check
healthCheckService.registerCheck('custom_service', async () => {
  // Custom health check logic
  return {
    status: 'healthy',
    lastChecked: new Date().toISOString(),
    responseTime: 100,
  };
});
```

### 5. Error Monitoring Service (`src/services/ErrorMonitoringService.ts`)

Real-time error monitoring with alerting capabilities.

#### Features:
- Error metrics collection (count, rate, types)
- Configurable alert rules
- Alert cooldown periods
- Error categorization by endpoint and type
- Redis-based metrics storage

#### Usage:
```typescript
import { errorMonitoringService } from '../services/ErrorMonitoringService';

// Record error for monitoring
await errorMonitoringService.recordError(error, {
  endpoint: '/api/users',
  statusCode: 500,
  userId: 'user123',
  correlationId: 'corr123',
});

// Get error metrics
const metrics = await errorMonitoringService.getErrorMetrics();

// Add custom alert rule
errorMonitoringService.addAlertRule({
  id: 'custom_alert',
  name: 'Custom Alert',
  condition: 'error_rate',
  threshold: 0.05, // 5%
  timeWindow: 300, // 5 minutes
  enabled: true,
  cooldownPeriod: 600, // 10 minutes
});
```

### 6. Graceful Degradation Service (`src/services/GracefulDegradationService.ts`)

Circuit breaker pattern implementation for external service calls.

#### Features:
- Circuit breaker with configurable thresholds
- Fallback data support
- Cache integration for fallback data
- Multiple circuit breaker instances
- Automatic recovery attempts

#### Usage:
```typescript
import { gracefulDegradationService } from '../services/GracefulDegradationService';

// Call external API with fallback
const result = await gracefulDegradationService.callOpenAQApi(
  async () => {
    return await fetchFromOpenAQ();
  },
  'openaq_cache_key'
);

if (result.success) {
  // Use primary data
  return result.data;
} else if (result.fallback) {
  // Use fallback data
  return result.fallback.data;
} else {
  // Handle complete failure
  throw new Error('Service unavailable');
}
```

### 7. Error Handling Wrappers (`src/utils/errorHandlingWrapper.ts`)

Utility functions for wrapping different types of operations with error handling.

#### Features:
- Database operation wrappers
- External API call wrappers
- Business logic wrappers
- Validation wrappers
- Route handler wrappers
- Performance monitoring decorators

#### Usage:
```typescript
import { 
  withDatabaseErrorHandling,
  withExternalApiErrorHandling,
  withBusinessLogicErrorHandling 
} from '../utils/errorHandlingWrapper';

// Wrap database operations
const getUserById = withDatabaseErrorHandling(
  async (id: string) => {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  },
  'getUserById',
  'users'
);

// Wrap external API calls
const fetchWeatherData = withExternalApiErrorHandling(
  async (location: string) => {
    return await weatherAPI.getWeather(location);
  },
  'WeatherAPI',
  '/weather'
);
```

## Configuration

### Environment Variables

```bash
# Logging
LOG_LEVEL=info                    # Log level (error, warn, info, debug)
NODE_ENV=production              # Environment (affects error detail exposure)

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ecosense_ai
DB_USER=postgres
DB_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Application
PORT=3000
```

### Alert Rules Configuration

Default alert rules are configured in `ErrorMonitoringService`:

```typescript
{
  id: 'high_error_rate',
  name: 'High Error Rate',
  condition: 'error_rate',
  threshold: 0.1,        // 10% error rate
  timeWindow: 300,       // 5 minutes
  cooldownPeriod: 600,   // 10 minutes
}
```

### Circuit Breaker Configuration

Default circuit breaker settings:

```typescript
{
  failureThreshold: 5,      // Failures before opening circuit
  recoveryTimeout: 60000,   // 1 minute recovery timeout
  monitoringPeriod: 300000, // 5 minutes monitoring period
}
```

## API Endpoints

### Health Check Endpoints

- `GET /health` - Comprehensive health check
- `GET /health/readiness` - Readiness probe
- `GET /health/liveness` - Liveness probe

### Monitoring Endpoints

- `GET /api/monitoring/errors` - Error metrics
- `GET /api/monitoring/alerts` - Recent alerts
- `POST /api/monitoring/alerts/:id/acknowledge` - Acknowledge alert
- `GET /api/monitoring/alert-rules` - Alert rules
- `POST /api/monitoring/alert-rules` - Add alert rule
- `DELETE /api/monitoring/alert-rules/:id` - Remove alert rule
- `GET /api/monitoring/circuit-breakers` - Circuit breaker stats
- `GET /api/monitoring/dashboard` - Monitoring dashboard data

## Error Response Format

All API errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input provided",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req-123",
    "correlationId": "corr-456",
    "details": {
      "validationErrors": [
        {
          "field": "email",
          "message": "Invalid email format"
        }
      ]
    }
  },
  "fallback": {
    "data": {...},
    "source": "cache",
    "lastUpdated": "2024-01-15T10:25:00.000Z"
  }
}
```

## Log Format

Structured logs include:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "error",
  "message": "Database operation failed",
  "correlationId": "corr-456",
  "service": "ecosense-ai",
  "version": "1.0.0",
  "environment": "production",
  "hostname": "api-server-1",
  "pid": 1234,
  "error": {
    "name": "DatabaseError",
    "message": "Connection timeout",
    "stack": "..."
  },
  "context": {
    "operation": "getUserById",
    "userId": "user123",
    "duration": 5000
  }
}
```

## Best Practices

### Error Handling
1. Always use structured error creation functions
2. Include correlation IDs in all error contexts
3. Provide fallback data when possible
4. Use appropriate HTTP status codes
5. Sanitize error messages in production

### Logging
1. Use correlation IDs for request tracing
2. Include relevant context in log messages
3. Use appropriate log levels
4. Avoid logging sensitive information
5. Use structured logging for better searchability

### Monitoring
1. Set up appropriate alert thresholds
2. Monitor error rates and patterns
3. Use circuit breakers for external services
4. Implement health checks for all components
5. Track performance metrics

### Performance
1. Use async error handling wrappers
2. Implement timeouts for external calls
3. Monitor slow operations
4. Use caching for fallback data
5. Implement graceful degradation

## Testing

Run the error handling tests:

```bash
# Basic functionality test
npx ts-node src/test-basic-error-handling.ts

# Comprehensive test (requires running services)
npx ts-node src/test-error-handling-logging.ts
```

## Integration

The error handling and logging system is automatically integrated into the main application through middleware and service initialization in `src/index.ts`.

Key integration points:
- Correlation ID middleware
- Request logging middleware
- Error handling middleware
- Health check service startup
- Error monitoring service initialization
- Graceful shutdown handling

## Troubleshooting

### Common Issues

1. **Correlation IDs not appearing in logs**
   - Ensure `correlationIdMiddleware` is applied before other middleware
   - Check that `withCorrelationId` is used for async operations

2. **Circuit breakers not working**
   - Verify Redis connection is working
   - Check circuit breaker configuration
   - Ensure fallback functions are provided

3. **Health checks failing**
   - Check database and Redis connections
   - Verify health check service is started
   - Review health check configuration

4. **Alerts not triggering**
   - Check alert rule configuration
   - Verify error monitoring service is recording errors
   - Check Redis for metrics storage

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm start
```

This will provide detailed information about:
- Request/response cycles
- Error handling flows
- Circuit breaker state changes
- Health check results
- Performance metrics

## Future Enhancements

Potential improvements:
- Integration with external monitoring services (Datadog, New Relic)
- Distributed tracing with OpenTelemetry
- Advanced anomaly detection
- Custom dashboard for monitoring
- Slack/email alert notifications
- Metrics export to Prometheus
- Log aggregation with ELK stack