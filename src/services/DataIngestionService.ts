import { EnvironmentalDataPoint, CreateEnvironmentalDataPoint } from '../models/types';
import { OpenAQClient } from './clients/OpenAQClient';
import { WaterQualityPortalClient } from './clients/WaterQualityPortalClient';
import { MessageQueuePublisher } from './messaging/MessageQueuePublisher';
import { Logger } from 'winston';

export interface DataIngestionConfig {
  apis: {
    openaq: {
      endpoint: string;
      apiKey?: string;
      rateLimit: number;
    };
    waterQuality: {
      endpoint: string;
      rateLimit: number;
    };
  };
  scheduledJobs: {
    airQuality: {
      interval: string;
      enabled: boolean;
    };
    waterQuality: {
      interval: string;
      enabled: boolean;
    };
  };
  messageQueue: {
    exchangeName: string;
    routingKey: string;
  };
}

export interface DataIngestionResult {
  success: boolean;
  dataPointsProcessed: number;
  errors: string[];
  source: string;
  timestamp: Date;
}

/**
 * Main service class for ingesting environmental data from external APIs
 * Implements requirements 1.1, 1.2, 1.3, 7.1
 */
export class DataIngestionService {
  private openaqClient: OpenAQClient;
  private waterQualityClient: WaterQualityPortalClient;
  private messagePublisher: MessageQueuePublisher;
  private logger: Logger;
  private config: DataIngestionConfig;

  constructor(
    config: DataIngestionConfig,
    logger: Logger,
    messagePublisher: MessageQueuePublisher
  ) {
    this.config = config;
    this.logger = logger;
    this.messagePublisher = messagePublisher;
    
    this.openaqClient = new OpenAQClient(
      config.apis.openaq,
      logger
    );
    
    this.waterQualityClient = new WaterQualityPortalClient(
      config.apis.waterQuality,
      logger
    );
  }

  /**
   * Ingest air quality data from OpenAQ API
   * Requirement 1.1: Fetch air quality data from OpenAQ API every hour
   */
  async ingestAirQualityData(
    location?: { latitude: number; longitude: number; radius: number }
  ): Promise<DataIngestionResult> {
    const startTime = Date.now();
    const result: DataIngestionResult = {
      success: false,
      dataPointsProcessed: 0,
      errors: [],
      source: 'openaq',
      timestamp: new Date()
    };

    try {
      this.logger.info('Starting air quality data ingestion from OpenAQ', { location });
      
      const airQualityData = await this.openaqClient.fetchLatestMeasurements(location);
      
      for (const dataPoint of airQualityData) {
        try {
          await this.processAndPublishDataPoint(dataPoint);
          result.dataPointsProcessed++;
        } catch (error) {
          const errorMsg = `Failed to process air quality data point: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg, { dataPoint, error });
        }
      }

      result.success = result.errors.length === 0 || result.dataPointsProcessed > 0;
      
      this.logger.info('Air quality data ingestion completed', {
        dataPointsProcessed: result.dataPointsProcessed,
        errors: result.errors.length,
        duration: Date.now() - startTime
      });

    } catch (error) {
      const errorMsg = `Air quality data ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      this.logger.error(errorMsg, { error });
    }

    return result;
  }

  /**
   * Ingest water quality data from Water Quality Portal API
   * Requirement 1.2: Fetch water quality data from Water Quality Portal API every hour
   */
  async ingestWaterQualityData(
    location?: { latitude: number; longitude: number; radius: number }
  ): Promise<DataIngestionResult> {
    const startTime = Date.now();
    const result: DataIngestionResult = {
      success: false,
      dataPointsProcessed: 0,
      errors: [],
      source: 'water_quality_portal',
      timestamp: new Date()
    };

    try {
      this.logger.info('Starting water quality data ingestion from Water Quality Portal', { location });
      
      const waterQualityData = await this.waterQualityClient.fetchLatestMeasurements(location);
      
      for (const dataPoint of waterQualityData) {
        try {
          await this.processAndPublishDataPoint(dataPoint);
          result.dataPointsProcessed++;
        } catch (error) {
          const errorMsg = `Failed to process water quality data point: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg, { dataPoint, error });
        }
      }

      result.success = result.errors.length === 0 || result.dataPointsProcessed > 0;
      
      this.logger.info('Water quality data ingestion completed', {
        dataPointsProcessed: result.dataPointsProcessed,
        errors: result.errors.length,
        duration: Date.now() - startTime
      });

    } catch (error) {
      const errorMsg = `Water quality data ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      this.logger.error(errorMsg, { error });
    }

    return result;
  }

  /**
   * Process all configured data sources
   * Requirement 7.1: Automated workflow for data ingestion
   */
  async ingestAllSources(
    location?: { latitude: number; longitude: number; radius: number }
  ): Promise<DataIngestionResult[]> {
    const results: DataIngestionResult[] = [];

    if (this.config.scheduledJobs.airQuality.enabled) {
      const airQualityResult = await this.ingestAirQualityData(location);
      results.push(airQualityResult);
    }

    if (this.config.scheduledJobs.waterQuality.enabled) {
      const waterQualityResult = await this.ingestWaterQualityData(location);
      results.push(waterQualityResult);
    }

    return results;
  }

  /**
   * Process and validate environmental data point before publishing
   * Requirement 1.4: Validate and store data with timestamp and location metadata
   */
  private async processAndPublishDataPoint(dataPoint: CreateEnvironmentalDataPoint): Promise<void> {
    // Validate data point
    this.validateDataPoint(dataPoint);

    // Publish to message queue for downstream processing
    await this.messagePublisher.publishEnvironmentalData(
      dataPoint,
      this.config.messageQueue.exchangeName,
      this.config.messageQueue.routingKey
    );

    this.logger.debug('Environmental data point processed and published', {
      source: dataPoint.source,
      pollutant: dataPoint.pollutant,
      location: dataPoint.location
    });
  }

  /**
   * Validate environmental data point
   * Requirement 1.4: Data validation
   */
  private validateDataPoint(dataPoint: CreateEnvironmentalDataPoint): void {
    if (!dataPoint.source || !['openaq', 'water_quality_portal', 'local_sensor'].includes(dataPoint.source)) {
      throw new Error(`Invalid data source: ${dataPoint.source}`);
    }

    if (!dataPoint.pollutant || dataPoint.pollutant.trim().length === 0) {
      throw new Error('Pollutant name is required');
    }

    if (typeof dataPoint.value !== 'number' || isNaN(dataPoint.value) || dataPoint.value < 0) {
      throw new Error(`Invalid pollutant value: ${dataPoint.value}`);
    }

    if (!dataPoint.unit || dataPoint.unit.trim().length === 0) {
      throw new Error('Unit is required');
    }

    if (!dataPoint.location || 
        typeof dataPoint.location.latitude !== 'number' || 
        typeof dataPoint.location.longitude !== 'number' ||
        dataPoint.location.latitude < -90 || dataPoint.location.latitude > 90 ||
        dataPoint.location.longitude < -180 || dataPoint.location.longitude > 180) {
      throw new Error('Valid location coordinates are required');
    }

    if (!dataPoint.timestamp || !(dataPoint.timestamp instanceof Date)) {
      throw new Error('Valid timestamp is required');
    }

    if (!dataPoint.quality_grade || !['A', 'B', 'C', 'D'].includes(dataPoint.quality_grade)) {
      throw new Error(`Invalid quality grade: ${dataPoint.quality_grade}`);
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      openaq: boolean;
      waterQuality: boolean;
      messageQueue: boolean;
    };
    lastIngestion?: {
      airQuality?: Date;
      waterQuality?: Date;
    };
  }> {
    const services = {
      openaq: await this.openaqClient.healthCheck(),
      waterQuality: await this.waterQualityClient.healthCheck(),
      messageQueue: await this.messagePublisher.healthCheck()
    };

    const healthyServices = Object.values(services).filter(Boolean).length;
    const totalServices = Object.keys(services).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServices === totalServices) {
      status = 'healthy';
    } else if (healthyServices > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      services
    };
  }
}