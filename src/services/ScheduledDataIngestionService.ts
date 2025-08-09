import cron from 'node-cron';
import { Logger } from 'winston';
import { DataIngestionService, DataIngestionResult } from './DataIngestionService';
import { getDefaultIngestionLocations } from '../config/dataIngestion';

export interface SchedulerConfig {
  airQuality: {
    enabled: boolean;
    cronExpression: string;
  };
  waterQuality: {
    enabled: boolean;
    cronExpression: string;
  };
  retryConfig: {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
}

export interface ScheduledJobResult {
  jobType: 'air_quality' | 'water_quality';
  success: boolean;
  startTime: Date;
  endTime: Date;
  results: DataIngestionResult[];
  retryAttempts: number;
  error?: string;
}

/**
 * Service for managing scheduled data ingestion workflows
 * Implements requirements 1.1, 1.2, 1.3, 7.1
 */
export class ScheduledDataIngestionService {
  private dataIngestionService: DataIngestionService;
  private logger: Logger;
  private config: SchedulerConfig;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private isRunning: boolean = false;

  constructor(
    dataIngestionService: DataIngestionService,
    config: SchedulerConfig,
    logger: Logger
  ) {
    this.dataIngestionService = dataIngestionService;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Start all scheduled jobs
   * Requirement 7.1: Automated workflow management
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Scheduled data ingestion service is already running');
      return;
    }

    this.logger.info('Starting scheduled data ingestion service');

    // Schedule air quality data ingestion
    if (this.config.airQuality.enabled) {
      const airQualityJob = cron.schedule(
        this.config.airQuality.cronExpression,
        () => this.executeAirQualityIngestion(),
        { scheduled: false }
      );
      this.scheduledJobs.set('air_quality', airQualityJob);
      airQualityJob.start();
      this.logger.info(`Air quality ingestion scheduled with cron: ${this.config.airQuality.cronExpression}`);
    }

    // Schedule water quality data ingestion
    if (this.config.waterQuality.enabled) {
      const waterQualityJob = cron.schedule(
        this.config.waterQuality.cronExpression,
        () => this.executeWaterQualityIngestion(),
        { scheduled: false }
      );
      this.scheduledJobs.set('water_quality', waterQualityJob);
      waterQualityJob.start();
      this.logger.info(`Water quality ingestion scheduled with cron: ${this.config.waterQuality.cronExpression}`);
    }

    this.isRunning = true;
    this.logger.info('Scheduled data ingestion service started successfully');
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    if (!this.isRunning) {
      this.logger.warn('Scheduled data ingestion service is not running');
      return;
    }

    this.logger.info('Stopping scheduled data ingestion service');

    for (const [jobName, job] of this.scheduledJobs) {
      job.stop();
      this.logger.info(`Stopped scheduled job: ${jobName}`);
    }

    this.scheduledJobs.clear();
    this.isRunning = false;
    this.logger.info('Scheduled data ingestion service stopped');
  }

  /**
   * Execute air quality data ingestion with retry logic
   * Requirement 1.1: Fetch air quality data from OpenAQ API every hour
   * Requirement 1.3: Exponential backoff retry logic for API failures
   */
  private async executeAirQualityIngestion(): Promise<ScheduledJobResult> {
    const startTime = new Date();
    const result: ScheduledJobResult = {
      jobType: 'air_quality',
      success: false,
      startTime,
      endTime: new Date(),
      results: [],
      retryAttempts: 0
    };

    this.logger.info('Starting scheduled air quality data ingestion');

    try {
      const locations = getDefaultIngestionLocations();
      
      for (const location of locations) {
        const locationResult = await this.executeWithRetry(
          () => this.dataIngestionService.ingestAirQualityData({
            latitude: location.latitude,
            longitude: location.longitude,
            radius: location.radius
          }),
          `air quality ingestion for ${location.name}`
        );
        
        result.results.push(locationResult.result);
        result.retryAttempts += locationResult.retryAttempts;
      }

      result.success = result.results.every(r => r.success);
      result.endTime = new Date();

      this.logger.info('Scheduled air quality data ingestion completed', {
        success: result.success,
        totalResults: result.results.length,
        totalRetries: result.retryAttempts,
        duration: result.endTime.getTime() - result.startTime.getTime()
      });

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.endTime = new Date();
      this.logger.error('Scheduled air quality data ingestion failed', { error: result.error });
    }

    return result;
  }

  /**
   * Execute water quality data ingestion with retry logic
   * Requirement 1.2: Fetch water quality data from Water Quality Portal API every hour
   * Requirement 1.3: Exponential backoff retry logic for API failures
   */
  private async executeWaterQualityIngestion(): Promise<ScheduledJobResult> {
    const startTime = new Date();
    const result: ScheduledJobResult = {
      jobType: 'water_quality',
      success: false,
      startTime,
      endTime: new Date(),
      results: [],
      retryAttempts: 0
    };

    this.logger.info('Starting scheduled water quality data ingestion');

    try {
      const locations = getDefaultIngestionLocations();
      
      for (const location of locations) {
        const locationResult = await this.executeWithRetry(
          () => this.dataIngestionService.ingestWaterQualityData({
            latitude: location.latitude,
            longitude: location.longitude,
            radius: location.radius
          }),
          `water quality ingestion for ${location.name}`
        );
        
        result.results.push(locationResult.result);
        result.retryAttempts += locationResult.retryAttempts;
      }

      result.success = result.results.every(r => r.success);
      result.endTime = new Date();

      this.logger.info('Scheduled water quality data ingestion completed', {
        success: result.success,
        totalResults: result.results.length,
        totalRetries: result.retryAttempts,
        duration: result.endTime.getTime() - result.startTime.getTime()
      });

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.endTime = new Date();
      this.logger.error('Scheduled water quality data ingestion failed', { error: result.error });
    }

    return result;
  }

  /**
   * Execute function with exponential backoff retry logic
   * Requirement 1.3: Exponential backoff retry logic for API failures
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    operationName: string
  ): Promise<{ result: T; retryAttempts: number }> {
    let lastError: Error | null = null;
    let retryAttempts = 0;

    for (let attempt = 0; attempt <= this.config.retryConfig.maxRetries; attempt++) {
      try {
        const result = await fn();
        
        if (attempt > 0) {
          this.logger.info(`Operation succeeded after ${attempt} retries`, {
            operation: operationName,
            retryAttempts: attempt
          });
        }
        
        return { result, retryAttempts: attempt };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        retryAttempts = attempt;

        if (attempt === this.config.retryConfig.maxRetries) {
          this.logger.error(`Operation failed after ${this.config.retryConfig.maxRetries} retries`, {
            operation: operationName,
            error: lastError.message
          });
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.config.retryConfig.baseDelayMs * Math.pow(this.config.retryConfig.backoffMultiplier, attempt),
          this.config.retryConfig.maxDelayMs
        );

        this.logger.warn(`Operation failed, retrying in ${delay}ms`, {
          operation: operationName,
          attempt: attempt + 1,
          maxRetries: this.config.retryConfig.maxRetries,
          error: lastError.message
        });

        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Operation failed');
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get status of all scheduled jobs
   */
  getJobStatus(): {
    isRunning: boolean;
    jobs: Array<{
      name: string;
      enabled: boolean;
      cronExpression: string;
      isScheduled: boolean;
    }>;
  } {
    const jobs = [];

    if (this.config.airQuality.enabled) {
      const job = this.scheduledJobs.get('air_quality');
      jobs.push({
        name: 'air_quality',
        enabled: this.config.airQuality.enabled,
        cronExpression: this.config.airQuality.cronExpression,
        isScheduled: job !== undefined && this.isRunning
      });
    }

    if (this.config.waterQuality.enabled) {
      const job = this.scheduledJobs.get('water_quality');
      jobs.push({
        name: 'water_quality',
        enabled: this.config.waterQuality.enabled,
        cronExpression: this.config.waterQuality.cronExpression,
        isScheduled: job !== undefined && this.isRunning
      });
    }

    return {
      isRunning: this.isRunning,
      jobs
    };
  }

  /**
   * Manually trigger a specific job type
   */
  async triggerJob(jobType: 'air_quality' | 'water_quality'): Promise<ScheduledJobResult> {
    this.logger.info(`Manually triggering ${jobType} ingestion job`);

    if (jobType === 'air_quality') {
      return await this.executeAirQualityIngestion();
    } else {
      return await this.executeWaterQualityIngestion();
    }
  }
}