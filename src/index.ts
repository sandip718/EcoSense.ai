import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
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
import { notificationWorker } from './services/NotificationWorker';
import { cacheIntegrationService } from './services/CacheIntegrationService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
async function startServer(): Promise<void> {
  try {
    // Initialize database connection
    await connectDatabase();
    logger.info('Database connected successfully');

    // Initialize Redis connection
    await connectRedis();
    logger.info('Redis connected successfully');

    // Initialize cache integration service
    await cacheIntegrationService.initialize();
    logger.info('Cache integration service initialized');

    // Start notification worker
    notificationWorker.start();
    logger.info('Notification worker started');

    app.listen(PORT, () => {
      logger.info(`EcoSense.ai server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  notificationWorker.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  notificationWorker.stop();
  process.exit(0);
});

startServer().catch((error) => {
  logger.error('Unhandled error during server startup:', error);
  process.exit(1);
});