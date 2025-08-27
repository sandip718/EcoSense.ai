import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { StructuredLogger } from './utils/logger';
import { connectDatabase, closeDatabaseConnection } from './config/database';
import { connectRedis, closeRedisConnection } from './config/redis';
import { 
  errorHandler, 
  correlationIdMiddleware, 
  asyncHandler 
} from './middleware/errorHandler';
import { 
  requestLoggerMiddleware, 
  apiUsageTracker, 
  securityEventTracker, 
  performanceMonitor 
} from './middleware/requestLogger';
import { 
  healthCheckMiddleware, 
  readinessCheckMiddleware, 
  livenessCheckMiddleware, 
  healthCheckService 
} from './middleware/healthCheck';
import { errorMonitoringService } from './services/ErrorMonitoringService';
import { gracefulDegradationService } from './services/GracefulDegradationService';
import imageAnalysisRoutes from './routes/imageAnalysis';
import insightsRoutes from './routes/insights';
import recommendationsRoutes from './routes/recommendations';
import authRoutes from './routes/auth';
import gamificationRoutes from './routes/gamification';
import environmentalDataRoutes from './routes/environmentalData';
import dashboardRoutes from './routes/dashboard';
import notificationRoutes from './routes/notifications';
import cacheRoutes from './routes/cache';
import chatbotRoutes from './routes/chatbot';
import monitoringRoutes from './routes/monitoring';
import { notificationWorker } from './services/NotificationWorker';
import { cacheIntegrationService } from './services/CacheIntegrationService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security and CORS middleware
app.use(helmet());
app.use(cors());

// Request parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging and monitoring middleware
app.use(correlationIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(apiUsageTracker);
app.use(securityEventTracker);
app.use(performanceMonitor);

// Serve static files for uploaded images
const uploadsPath = process.env.STORAGE_LOCAL_PATH || './uploads/images';
app.use('/uploads/images', express.static(path.resolve(uploadsPath)));

// API Routes
app.use('/api/images', imageAnalysisRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/environmental-data', environmentalDataRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/monitoring', monitoringRoutes);

// Health check endpoints
app.get('/health', healthCheckMiddleware);
app.get('/health/readiness', readinessCheckMiddleware);
app.get('/health/liveness', livenessCheckMiddleware);

// Monitoring endpoints
app.get('/monitoring/errors', asyncHandler(async (req, res) => {
  const metrics = await errorMonitoringService.getErrorMetrics();
  const alerts = await errorMonitoringService.getRecentAlerts(20);
  const circuitBreakers = gracefulDegradationService.getCircuitBreakerStats();
  
  res.json({
    errorMetrics: metrics,
    recentAlerts: alerts,
    circuitBreakers,
    timestamp: new Date().toISOString(),
  });
}));

app.get('/monitoring/alerts/:alertId/acknowledge', asyncHandler(async (req, res) => {
  await errorMonitoringService.acknowledgeAlert(req.params.alertId);
  res.json({ success: true, message: 'Alert acknowledged' });
}));

// Error handling middleware
app.use(errorHandler);

// Start server
async function startServer(): Promise<void> {
  try {
    StructuredLogger.info('Starting EcoSense.ai server...');

    // Initialize database connection
    await connectDatabase();
    StructuredLogger.info('Database connected successfully');

    // Initialize Redis connection
    await connectRedis();
    StructuredLogger.info('Redis connected successfully');

    // Initialize cache integration service
    await cacheIntegrationService.initialize();
    StructuredLogger.info('Cache integration service initialized');

    // Start health check service
    healthCheckService.startPeriodicChecks();
    StructuredLogger.info('Health check service started');

    // Start notification worker
    notificationWorker.start();
    StructuredLogger.info('Notification worker started');

    // Start server
    const server = app.listen(PORT, () => {
      StructuredLogger.info(`EcoSense.ai server running on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
      });
    });

    // Handle server errors
    server.on('error', (error) => {
      StructuredLogger.error('Server error', error);
      process.exit(1);
    });

    return server;
  } catch (error) {
    StructuredLogger.error('Failed to start server', error);
    await gracefulShutdown();
    process.exit(1);
  }
}

// Graceful shutdown function
async function gracefulShutdown(): Promise<void> {
  StructuredLogger.info('Initiating graceful shutdown...');

  try {
    // Stop health checks
    healthCheckService.stopPeriodicChecks();
    StructuredLogger.info('Health check service stopped');

    // Stop notification worker
    notificationWorker.stop();
    StructuredLogger.info('Notification worker stopped');

    // Close database connection
    await closeDatabaseConnection();
    StructuredLogger.info('Database connection closed');

    // Close Redis connection
    await closeRedisConnection();
    StructuredLogger.info('Redis connection closed');

    StructuredLogger.info('Graceful shutdown completed');
  } catch (error) {
    StructuredLogger.error('Error during graceful shutdown', error);
  }
}

// Handle process signals
process.on('SIGTERM', async () => {
  StructuredLogger.info('SIGTERM received, shutting down gracefully');
  await gracefulShutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  StructuredLogger.info('SIGINT received, shutting down gracefully');
  await gracefulShutdown();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  StructuredLogger.error('Uncaught exception', error);
  errorMonitoringService.recordError(error, {
    endpoint: 'uncaught_exception',
    additionalData: { type: 'uncaught_exception' },
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  StructuredLogger.error('Unhandled promise rejection', error, { promise });
  errorMonitoringService.recordError(error, {
    endpoint: 'unhandled_rejection',
    additionalData: { type: 'unhandled_rejection', reason },
  });
});

// Start server
startServer().catch(async (error) => {
  StructuredLogger.error('Unhandled error during server startup', error);
  await gracefulShutdown();
  process.exit(1);
});