/**
 * Example usage of Scheduled Data Ingestion Service
 * This demonstrates how to set up and use the scheduled data ingestion workflows
 * Implements requirements 1.1, 1.2, 1.3, 7.1, 8.1
 */

import winston from 'winston';
import { DataIngestionService } from '../DataIngestionService';
import { ScheduledDataIngestionService } from '../ScheduledDataIngestionService';
import { DataQualityService } from '../DataQualityService';
import { MessageQueuePublisher } from '../messaging/MessageQueuePublisher';
import { getDataIngestionConfig, getMessageQueueConfig } from '../../config/dataIngestion';
import { getSchedulerConfig, validateSchedulerConfig, describeCronExpression } from '../../config/scheduler';

// Create logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/scheduled-ingestion.log' })
  ]
});

async function setupScheduledIngestion() {
  try {
    logger.info('Setting up scheduled data ingestion service...');

    // Load and validate configurations
    const dataIngestionConfig = getDataIngestionConfig();
    const messageQueueConfig = getMessageQueueConfig();
    const schedulerConfig = getSchedulerConfig();

    validateSchedulerConfig(schedulerConfig);

    logger.info('Configuration loaded successfully', {
      airQualityEnabled: schedulerConfig.airQuality.enabled,
      waterQualityEnabled: schedulerConfig.waterQuality.enabled,
      airQualitySchedule: describeCronExpression(schedulerConfig.airQuality.cronExpression),
      waterQualitySchedule: describeCronExpression(schedulerConfig.waterQuality.cronExpression),
      maxRetries: schedulerConfig.retryConfig.maxRetries
    });

    // Initialize services
    const messagePublisher = new MessageQueuePublisher(messageQueueConfig, logger);
    await messagePublisher.connect();

    const dataQualityService = new DataQualityService(logger);
    
    const dataIngestionService = new DataIngestionService(
      dataIngestionConfig,
      logger,
      messagePublisher,
      dataQualityService
    );

    const scheduledIngestionService = new ScheduledDataIngestionService(
      dataIngestionService,
      schedulerConfig,
      logger
    );

    // Start scheduled jobs
    scheduledIngestionService.start();

    logger.info('Scheduled data ingestion service started successfully');

    // Set up graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      
      scheduledIngestionService.stop();
      await messagePublisher.disconnect();
      
      logger.info('Shutdown complete');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      
      scheduledIngestionService.stop();
      await messagePublisher.disconnect();
      
      logger.info('Shutdown complete');
      process.exit(0);
    });

    // Monitor service health
    setInterval(async () => {
      try {
        const healthStatus = await dataIngestionService.getHealthStatus();
        const jobStatus = scheduledIngestionService.getJobStatus();
        const qualityMetrics = dataQualityService.getQualityMetrics();

        logger.info('Service health check', {
          ingestionHealth: healthStatus.status,
          schedulerRunning: jobStatus.isRunning,
          activeJobs: jobStatus.jobs.length,
          totalDataPoints: qualityMetrics.totalDataPoints,
          averageQuality: qualityMetrics.averageScore
        });

        if (healthStatus.status === 'unhealthy') {
          logger.error('Data ingestion service is unhealthy', { services: healthStatus.services });
        }

      } catch (error) {
        logger.error('Health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    return {
      dataIngestionService,
      scheduledIngestionService,
      dataQualityService,
      messagePublisher
    };

  } catch (error) {
    logger.error('Failed to setup scheduled ingestion service', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

async function manualIngestionExample() {
  logger.info('Running manual ingestion example...');

  const services = await setupScheduledIngestion();

  try {
    // Manually trigger air quality ingestion
    logger.info('Triggering manual air quality ingestion...');
    const airQualityResult = await services.scheduledIngestionService.triggerJob('air_quality');
    
    logger.info('Air quality ingestion completed', {
      success: airQualityResult.success,
      dataPointsProcessed: airQualityResult.results.reduce((sum, r) => sum + r.dataPointsProcessed, 0),
      retryAttempts: airQualityResult.retryAttempts,
      duration: airQualityResult.endTime.getTime() - airQualityResult.startTime.getTime()
    });

    // Manually trigger water quality ingestion
    logger.info('Triggering manual water quality ingestion...');
    const waterQualityResult = await services.scheduledIngestionService.triggerJob('water_quality');
    
    logger.info('Water quality ingestion completed', {
      success: waterQualityResult.success,
      dataPointsProcessed: waterQualityResult.results.reduce((sum, r) => sum + r.dataPointsProcessed, 0),
      retryAttempts: waterQualityResult.retryAttempts,
      duration: waterQualityResult.endTime.getTime() - waterQualityResult.startTime.getTime()
    });

    // Get quality report
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    const endDate = new Date();
    const qualityReport = services.dataQualityService.getQualityReport(startDate, endDate);

    logger.info('Data quality report', {
      period: qualityReport.period,
      totalDataPoints: qualityReport.metrics.totalDataPoints,
      averageScore: qualityReport.metrics.averageScore,
      gradeDistribution: qualityReport.metrics.qualityDistribution,
      recommendations: qualityReport.recommendations
    });

  } catch (error) {
    logger.error('Manual ingestion example failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function qualityAssessmentExample() {
  logger.info('Running quality assessment example...');

  const dataQualityService = new DataQualityService(logger);

  // Example of high-quality data
  const highQualityData = {
    source: 'openaq' as const,
    pollutant: 'pm25',
    value: 25.5,
    unit: 'µg/m³',
    location: { latitude: 40.7128, longitude: -74.0060, address: 'New York, NY' },
    timestamp: new Date(),
    quality_grade: 'A' as const
  };

  const highQualityScore = dataQualityService.assessDataQuality(highQualityData);
  logger.info('High quality data assessment', {
    overall: highQualityScore.overall,
    grade: highQualityScore.grade,
    components: highQualityScore.components,
    issues: highQualityScore.issues
  });

  // Example of low-quality data
  const lowQualityData = {
    source: 'openaq' as const,
    pollutant: '',
    value: -10,
    unit: '',
    location: { latitude: 200, longitude: 300 },
    timestamp: new Date('invalid'),
    quality_grade: 'A' as const
  };

  const lowQualityScore = dataQualityService.assessDataQuality(lowQualityData);
  logger.info('Low quality data assessment', {
    overall: lowQualityScore.overall,
    grade: lowQualityScore.grade,
    components: lowQualityScore.components,
    issues: lowQualityScore.issues
  });

  // Example of anomaly detection
  const anomalousData = {
    source: 'openaq' as const,
    pollutant: 'pm25',
    value: 1000, // Extremely high value
    unit: 'µg/m³',
    location: { latitude: 40.7128, longitude: -74.0060 },
    timestamp: new Date(),
    quality_grade: 'A' as const
  };

  const anomalyResult = dataQualityService.detectAnomalies(anomalousData);
  logger.info('Anomaly detection result', {
    isAnomaly: anomalyResult.isAnomaly,
    confidence: anomalyResult.confidence,
    reasons: anomalyResult.reasons,
    suggestedAction: anomalyResult.suggestedAction
  });

  // Get final metrics
  const metrics = dataQualityService.getQualityMetrics();
  logger.info('Final quality metrics', metrics);
}

// Main execution
if (require.main === module) {
  (async () => {
    try {
      // Run examples
      await qualityAssessmentExample();
      await manualIngestionExample();

      // Keep the process running to demonstrate scheduled jobs
      logger.info('Scheduled ingestion service is running. Press Ctrl+C to stop.');
      
    } catch (error) {
      logger.error('Example execution failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      process.exit(1);
    }
  })();
}

export {
  setupScheduledIngestion,
  manualIngestionExample,
  qualityAssessmentExample
};