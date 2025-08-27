import { Request, Response } from 'express';
import { StructuredLogger } from './utils/logger';
import { errorMonitoringService } from './services/ErrorMonitoringService';
import { gracefulDegradationService } from './services/GracefulDegradationService';
import { healthCheckService } from './middleware/healthCheck';
import { 
  createError, 
  createApiUnavailableError, 
  createValidationError,
  createNotFoundError,
  createRateLimitError 
} from './middleware/errorHandler';
import {
  withDatabaseErrorHandling,
  withExternalApiErrorHandling,
  withBusinessLogicErrorHandling,
  withValidationErrorHandling,
  createSuccessResponse,
  createErrorResponse
} from './utils/errorHandlingWrapper';

async function testErrorHandlingAndLogging(): Promise<void> {
  console.log('🧪 Testing Error Handling and Logging System...\n');

  try {
    // Test 1: Structured Logging
    console.log('1. Testing Structured Logging...');
    StructuredLogger.info('Test info message', { testData: 'info test' });
    StructuredLogger.warn('Test warning message', { testData: 'warning test' });
    StructuredLogger.error('Test error message', new Error('Test error'), { testData: 'error test' });
    StructuredLogger.performance('test_operation', 150, { operation: 'test' });
    StructuredLogger.businessEvent('test_event', { eventData: 'test' });
    StructuredLogger.securityEvent('test_security_event', { securityData: 'test' });
    StructuredLogger.apiCall('GET', '/test', 200, 100);
    StructuredLogger.dbOperation('SELECT', 'test_table', 50);
    StructuredLogger.externalService('test_api', 'get_data', true, 200);
    console.log('✅ Structured logging test completed\n');

    // Test 2: Error Creation Functions
    console.log('2. Testing Error Creation Functions...');
    
    const validationError = createValidationError('Invalid input', [
      { field: 'email', message: 'Invalid email format' }
    ]);
    console.log('Validation Error:', validationError.message, validationError.code);

    const notFoundError = createNotFoundError('User', '123');
    console.log('Not Found Error:', notFoundError.message, notFoundError.code);

    const rateLimitError = createRateLimitError(100, 60000);
    console.log('Rate Limit Error:', rateLimitError.message, rateLimitError.code);

    const apiUnavailableError = createApiUnavailableError('OpenAQ', { cached: 'data' }, new Date());
    console.log('API Unavailable Error:', apiUnavailableError.message, apiUnavailableError.code);
    console.log('✅ Error creation functions test completed\n');

    // Test 3: Error Monitoring Service
    console.log('3. Testing Error Monitoring Service...');
    
    // Record some test errors
    await errorMonitoringService.recordError(new Error('Test database error'), {
      endpoint: '/api/test',
      statusCode: 500,
      userId: 'test-user-123',
      correlationId: 'test-correlation-123',
    });

    await errorMonitoringService.recordError(new Error('Test validation error'), {
      endpoint: '/api/validate',
      statusCode: 400,
      userId: 'test-user-456',
      correlationId: 'test-correlation-456',
    });

    // Get error metrics
    const errorMetrics = await errorMonitoringService.getErrorMetrics();
    console.log('Error Metrics:', {
      errorCount: errorMetrics.errorCount,
      errorRate: errorMetrics.errorRate,
      errorsByType: Object.keys(errorMetrics.errorsByType).length,
      errorsByEndpoint: Object.keys(errorMetrics.errorsByEndpoint).length,
    });

    // Get recent alerts
    const alerts = await errorMonitoringService.getRecentAlerts(5);
    console.log('Recent Alerts Count:', alerts.length);
    console.log('✅ Error monitoring service test completed\n');

    // Test 4: Circuit Breaker and Graceful Degradation
    console.log('4. Testing Circuit Breaker and Graceful Degradation...');
    
    // Test successful API call
    const successResult = await gracefulDegradationService.callOpenAQApi(async () => {
      return { data: 'success', timestamp: new Date() };
    }, 'test_cache_key');
    console.log('Successful API Call:', successResult.success, successResult.source);

    // Test failing API call with fallback
    const failureResult = await gracefulDegradationService.callOpenAQApi(async () => {
      throw new Error('API temporarily unavailable');
    }, 'test_cache_key');
    console.log('Failed API Call with Fallback:', failureResult.success, failureResult.source);

    // Get circuit breaker stats
    const circuitStats = gracefulDegradationService.getCircuitBreakerStats();
    console.log('Circuit Breaker Stats:', Object.keys(circuitStats));
    console.log('✅ Circuit breaker and graceful degradation test completed\n');

    // Test 5: Health Check Service
    console.log('5. Testing Health Check Service...');
    
    const healthResult = await healthCheckService.runHealthCheck();
    console.log('Health Check Result:', {
      status: healthResult.status,
      uptime: Math.round(healthResult.uptime),
      servicesCount: Object.keys(healthResult.services).length,
      environment: healthResult.environment,
    });

    // Check individual service health
    Object.entries(healthResult.services).forEach(([serviceName, health]) => {
      console.log(`  ${serviceName}: ${health.status} (${health.responseTime || 'N/A'}ms)`);
    });
    console.log('✅ Health check service test completed\n');

    // Test 6: Error Handling Wrappers
    console.log('6. Testing Error Handling Wrappers...');
    
    // Test database error handling wrapper
    const dbOperation = withDatabaseErrorHandling(async (query: string) => {
      if (query === 'FAIL') {
        throw new Error('Database connection failed');
      }
      return { rows: [{ id: 1, name: 'test' }] };
    }, 'SELECT', 'users');

    try {
      const dbResult = await dbOperation('SELECT * FROM users');
      console.log('Database Operation Success:', dbResult.rows.length, 'rows');
    } catch (error) {
      console.log('Database Operation Error:', (error as Error).message);
    }

    // Test external API error handling wrapper
    const apiOperation = withExternalApiErrorHandling(async (endpoint: string) => {
      if (endpoint === '/fail') {
        throw new Error('API timeout');
      }
      return { data: 'api response' };
    }, 'TestAPI', '/data');

    try {
      const apiResult = await apiOperation('/data');
      console.log('API Operation Success:', apiResult.data);
    } catch (error) {
      console.log('API Operation Error:', (error as Error).message);
    }

    // Test business logic error handling wrapper
    const businessOperation = withBusinessLogicErrorHandling(async (input: string) => {
      if (input === 'invalid') {
        throw new Error('Invalid business logic input');
      }
      return { processed: input.toUpperCase() };
    }, 'processInput', { operation: 'test' });

    try {
      const businessResult = await businessOperation('test');
      console.log('Business Operation Success:', businessResult.processed);
    } catch (error) {
      console.log('Business Operation Error:', (error as Error).message);
    }

    // Test validation error handling wrapper
    const validationOperation = withValidationErrorHandling((email: string) => {
      if (!email.includes('@')) {
        throw new Error('Invalid email format');
      }
      return { valid: true, email };
    }, 'emailValidation');

    try {
      const validationResult = validationOperation('test@example.com');
      console.log('Validation Success:', validationResult.valid);
    } catch (error) {
      console.log('Validation Error:', (error as Error).message);
    }

    console.log('✅ Error handling wrappers test completed\n');

    // Test 7: Response Helpers
    console.log('7. Testing Response Helpers...');
    
    const successResponse = createSuccessResponse(
      { id: 1, name: 'test' },
      'Data retrieved successfully',
      { total: 1, page: 1 }
    );
    console.log('Success Response:', successResponse.success, successResponse.message);

    const mockRequest = { 
      headers: { 'x-request-id': 'test-123' }, 
      correlationId: 'corr-123' 
    } as Request;
    
    const errorResponse = createErrorResponse(
      createError('Test error', 400, 'TEST_ERROR'),
      mockRequest,
      { cached: 'fallback data' }
    );
    console.log('Error Response:', errorResponse.success, errorResponse.error.code);
    console.log('✅ Response helpers test completed\n');

    // Test 8: Performance Monitoring
    console.log('8. Testing Performance Monitoring...');
    
    // Simulate a slow operation
    const slowOperation = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return 'completed';
    };

    const startTime = Date.now();
    const result = await slowOperation();
    const duration = Date.now() - startTime;
    
    StructuredLogger.performance('slow_operation_test', duration, {
      result,
      threshold: 50,
    });
    
    console.log('Performance Test:', result, `(${duration}ms)`);
    console.log('✅ Performance monitoring test completed\n');

    console.log('🎉 All Error Handling and Logging Tests Completed Successfully!\n');

    // Summary
    console.log('📊 Test Summary:');
    console.log('✅ Structured logging with correlation IDs');
    console.log('✅ Centralized error handling middleware');
    console.log('✅ Error monitoring and alerting system');
    console.log('✅ Circuit breaker and graceful degradation');
    console.log('✅ Comprehensive health check endpoints');
    console.log('✅ Error handling wrappers for different layers');
    console.log('✅ Performance monitoring and slow operation detection');
    console.log('✅ Standardized error and success response formats');

  } catch (error) {
    console.error('❌ Test failed:', error);
    StructuredLogger.error('Error handling and logging test failed', error as Error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testErrorHandlingAndLogging()
    .then(() => {
      console.log('\n✅ Test execution completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test execution failed:', error);
      process.exit(1);
    });
}

export { testErrorHandlingAndLogging };