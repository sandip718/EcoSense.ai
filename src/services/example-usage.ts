/**
 * Example usage of the Data Ingestion Service
 * Demonstrates how to set up and use the service components
 */

import { DataIngestionService } from './DataIngestionService';
import { MessageQueuePublisher } from './messaging/MessageQueuePublisher';
import { getDataIngestionConfig, getMessageQueueConfig } from '../config/dataIngestion';
import winston from 'winston';

// Example: Setting up the Data Ingestion Service
export async function setupDataIngestionService() {
  // 1. Create logger
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'logs/data-ingestion.log' })
    ]
  });

  // 2. Load configurations
  const dataIngestionConfig = getDataIngestionConfig();
  const messageQueueConfig = getMessageQueueConfig();

  // 3. Create and initialize message queue publisher
  const messagePublisher = new MessageQueuePublisher(messageQueueConfig, logger);
  await messagePublisher.initialize();

  // 4. Create data ingestion service
  const dataIngestionService = new DataIngestionService(
    dataIngestionConfig,
    logger,
    messagePublisher
  );

  return {
    dataIngestionService,
    messagePublisher,
    logger
  };
}

// Example: Ingesting air quality data for a specific location
export async function ingestAirQualityForLocation() {
  const { dataIngestionService, logger } = await setupDataIngestionService();

  const location = {
    latitude: 34.0522,  // Los Angeles
    longitude: -118.2437,
    radius: 25000 // 25km radius
  };

  try {
    logger.info('Starting air quality data ingestion for location', location);
    
    const result = await dataIngestionService.ingestAirQualityData(location);
    
    logger.info('Air quality ingestion completed', {
      success: result.success,
      dataPointsProcessed: result.dataPointsProcessed,
      errors: result.errors.length
    });

    return result;
  } catch (error) {
    logger.error('Air quality ingestion failed', { error, location });
    throw error;
  }
}

// Example: Ingesting water quality data
export async function ingestWaterQualityData() {
  const { dataIngestionService, logger } = await setupDataIngestionService();

  try {
    logger.info('Starting water quality data ingestion');
    
    const result = await dataIngestionService.ingestWaterQualityData();
    
    logger.info('Water quality ingestion completed', {
      success: result.success,
      dataPointsProcessed: result.dataPointsProcessed,
      errors: result.errors.length
    });

    return result;
  } catch (error) {
    logger.error('Water quality ingestion failed', { error });
    throw error;
  }
}

// Example: Ingesting from all sources
export async function ingestAllEnvironmentalData() {
  const { dataIngestionService, logger } = await setupDataIngestionService();

  try {
    logger.info('Starting ingestion from all sources');
    
    const results = await dataIngestionService.ingestAllSources();
    
    const summary = {
      totalSources: results.length,
      successfulSources: results.filter(r => r.success).length,
      totalDataPoints: results.reduce((sum, r) => sum + r.dataPointsProcessed, 0),
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0)
    };

    logger.info('All sources ingestion completed', summary);

    return { results, summary };
  } catch (error) {
    logger.error('All sources ingestion failed', { error });
    throw error;
  }
}

// Example: Health monitoring
export async function monitorServiceHealth() {
  const { dataIngestionService, logger } = await setupDataIngestionService();

  try {
    const healthStatus = await dataIngestionService.getHealthStatus();
    
    logger.info('Service health check completed', healthStatus);

    // Alert if any service is unhealthy
    if (healthStatus.status !== 'healthy') {
      logger.warn('Service health degraded', {
        status: healthStatus.status,
        unhealthyServices: Object.entries(healthStatus.services)
          .filter(([_, healthy]) => !healthy)
          .map(([service, _]) => service)
      });
    }

    return healthStatus;
  } catch (error) {
    logger.error('Health check failed', { error });
    throw error;
  }
}

// Example: Scheduled ingestion (would be used with cron jobs)
export async function scheduledIngestion() {
  const { dataIngestionService, messagePublisher, logger } = await setupDataIngestionService();

  try {
    logger.info('Starting scheduled ingestion');

    // Ingest from all sources
    const results = await dataIngestionService.ingestAllSources();

    // Log summary
    const summary = {
      timestamp: new Date().toISOString(),
      sources: results.map(r => ({
        source: r.source,
        success: r.success,
        dataPoints: r.dataPointsProcessed,
        errors: r.errors.length
      }))
    };

    logger.info('Scheduled ingestion completed', summary);

    return summary;

  } catch (error) {
    logger.error('Scheduled ingestion failed', { error });
    throw error;
  } finally {
    // Clean up connections
    await messagePublisher.close();
  }
}

// Example configuration for different environments
export const environmentConfigs = {
  development: {
    logLevel: 'debug',
    openaqRateLimit: 30, // Lower rate limit for development
    wqpRateLimit: 15,
    mqReconnectDelay: 1000
  },
  
  production: {
    logLevel: 'info',
    openaqRateLimit: 60,
    wqpRateLimit: 30,
    mqReconnectDelay: 5000
  },
  
  testing: {
    logLevel: 'error',
    openaqRateLimit: 10,
    wqpRateLimit: 5,
    mqReconnectDelay: 500
  }
};

// Example error handling patterns
export class DataIngestionError extends Error {
  constructor(
    message: string,
    public source: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'DataIngestionError';
  }
}

export function handleIngestionError(error: unknown, source: string): DataIngestionError {
  if (error instanceof DataIngestionError) {
    return error;
  }
  
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new DataIngestionError(`${source} ingestion failed: ${message}`, source, error as Error);
}