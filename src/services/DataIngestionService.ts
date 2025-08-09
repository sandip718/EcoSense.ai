import { EnvironmentalDataPoint, CreateEnvironmentalDataPoint } from '../models/types';
import { OpenAQClient } from './clients/OpenAQClient';
import { WaterQualityPortalClient } from './clients/WaterQualityPortalClient';
import { MessageQueuePublisher } from './messaging/MessageQueuePublisher';
import { DataQualityService, QualityScore } from './DataQualityService';
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
  qualityMetrics?: {
    averageScore: number;
    gradeDistribution: { A: number; B: number; C: number; D: number };
    rejectedDataPoints: number;
  };
}

/**
 * Main service class for ingesting environmental data from external APIs
 * Implements requirements 1.1, 1.2, 1.3, 7.1
 */
export class DataIngestionService {
  private openaqClient: OpenAQClient;
  private waterQualityClient: WaterQualityPortalClient;
  private messagePublisher: MessageQueuePublisher;
  private dataQualityService: DataQualityService;
  private logger: Logger;
  private config: DataIngestionConfig;

  constructor(
    config: DataIngestionConfig,
    logger: Logger,
    messagePublisher: MessageQueuePublisher,
    dataQualityService?: DataQualityService
  ) {
    this.config = config;
    this.logger = logger;
    this.messagePublisher = messagePublisher;
    this.dataQualityService = dataQualityService || new DataQualityService(logger);
    
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
      timestamp: new Date(),
      qualityMetrics: {
        averageScore: 0,
        gradeDistribution: { A: 0, B: 0, C: 0, D: 0 },
        rejectedDataPoints: 0
      }
    };

    try {
      this.logger.info('Starting air quality data ingestion from OpenAQ', { location });
      
      const airQualityData = await this.openaqClient.fetchLatestMeasurements(location);
      const qualityScores: QualityScore[] = [];
      
      for (const dataPoint of airQualityData) {
        try {
          const processResult = await this.processAndPublishDataPoint(dataPoint);
          if (processResult.accepted) {
            result.dataPointsProcessed++;
            qualityScores.push(processResult.qualityScore);
          } else {
            result.qualityMetrics!.rejectedDataPoints++;
            this.logger.warn('Data point rejected due to quality issues', {
              dataPoint: { source: dataPoint.source, pollutant: dataPoint.pollutant },
              qualityScore: processResult.qualityScore
            });
          }
        } catch (error) {
          const errorMsg = `Failed to process air quality data point: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg, { dataPoint, error });
        }
      }

      // Calculate quality metrics
      if (qualityScores.length > 0) {
        result.qualityMetrics!.averageScore = qualityScores.reduce((sum, score) => sum + score.overall, 0) / qualityScores.length;
        for (const score of qualityScores) {
          result.qualityMetrics!.gradeDistribution[score.grade]++;
        }
      }

      result.success = result.errors.length === 0 || result.dataPointsProcessed > 0;
      
      this.logger.info('Air quality data ingestion completed', {
        dataPointsProcessed: result.dataPointsProcessed,
        rejectedDataPoints: result.qualityMetrics!.rejectedDataPoints,
        averageQualityScore: result.qualityMetrics!.averageScore,
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
      timestamp: new Date(),
      qualityMetrics: {
        averageScore: 0,
        gradeDistribution: { A: 0, B: 0, C: 0, D: 0 },
        rejectedDataPoints: 0
      }
    };

    try {
      this.logger.info('Starting water quality data ingestion from Water Quality Portal', { location });
      
      const waterQualityData = await this.waterQualityClient.fetchLatestMeasurements(location);
      const qualityScores: QualityScore[] = [];
      
      for (const dataPoint of waterQualityData) {
        try {
          const processResult = await this.processAndPublishDataPoint(dataPoint);
          if (processResult.accepted) {
            result.dataPointsProcessed++;
            qualityScores.push(processResult.qualityScore);
          } else {
            result.qualityMetrics!.rejectedDataPoints++;
            this.logger.warn('Data point rejected due to quality issues', {
              dataPoint: { source: dataPoint.source, pollutant: dataPoint.pollutant },
              qualityScore: processResult.qualityScore
            });
          }
        } catch (error) {
          const errorMsg = `Failed to process water quality data point: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg, { dataPoint, error });
        }
      }

      // Calculate quality metrics
      if (qualityScores.length > 0) {
        result.qualityMetrics!.averageScore = qualityScores.reduce((sum, score) => sum + score.overall, 0) / qualityScores.length;
        for (const score of qualityScores) {
          result.qualityMetrics!.gradeDistribution[score.grade]++;
        }
      }

      result.success = result.errors.length === 0 || result.dataPointsProcessed > 0;
      
      this.logger.info('Water quality data ingestion completed', {
        dataPointsProcessed: result.dataPointsProcessed,
        rejectedDataPoints: result.qualityMetrics!.rejectedDataPoints,
        averageQualityScore: result.qualityMetrics!.averageScore,
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
   * Requirement 8.1: Data quality validation and scoring
   */
  private async processAndPublishDataPoint(dataPoint: CreateEnvironmentalDataPoint): Promise<{
    accepted: boolean;
    qualityScore: QualityScore;
  }> {
    // Assess data quality
    const qualityScore = this.dataQualityService.assessDataQuality(dataPoint);
    
    // Check for anomalies
    const anomalyResult = this.dataQualityService.detectAnomalies(dataPoint);
    
    // Determine if data should be accepted
    let accepted = true;
    
    if (anomalyResult.suggestedAction === 'reject') {
      accepted = false;
      this.logger.warn('Data point rejected due to anomaly detection', {
        dataPoint: { source: dataPoint.source, pollutant: dataPoint.pollutant },
        anomalyReasons: anomalyResult.reasons,
        confidence: anomalyResult.confidence
      });
    } else if (qualityScore.grade === 'D' && qualityScore.overall < 0.3) {
      accepted = false;
      this.logger.warn('Data point rejected due to poor quality score', {
        dataPoint: { source: dataPoint.source, pollutant: dataPoint.pollutant },
        qualityScore: qualityScore.overall,
        issues: qualityScore.issues
      });
    }

    if (accepted) {
      // Basic validation (throws on critical errors)
      this.validateDataPoint(dataPoint);

      // Update data point with quality grade
      const enrichedDataPoint = {
        ...dataPoint,
        quality_grade: qualityScore.grade
      };

      // Publish to message queue for downstream processing
      await this.messagePublisher.publishEnvironmentalData(
        enrichedDataPoint,
        this.config.messageQueue.exchangeName,
        this.config.messageQueue.routingKey
      );

      this.logger.debug('Environmental data point processed and published', {
        source: dataPoint.source,
        pollutant: dataPoint.pollutant,
        location: dataPoint.location,
        qualityGrade: qualityScore.grade,
        qualityScore: qualityScore.overall
      });
    }

    return { accepted, qualityScore };
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