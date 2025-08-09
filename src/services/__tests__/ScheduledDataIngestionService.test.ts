import { ScheduledDataIngestionService, SchedulerConfig } from '../ScheduledDataIngestionService';
import { DataIngestionService, DataIngestionResult } from '../DataIngestionService';
import { Logger } from 'winston';

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue({
    start: jest.fn(),
    stop: jest.fn(),
    running: true
  })
}));

// Mock the default locations
jest.mock('../../config/dataIngestion', () => ({
  getDefaultIngestionLocations: jest.fn().mockReturnValue([
    {
      name: 'Test Location 1',
      latitude: 40.7128,
      longitude: -74.0060,
      radius: 50000
    },
    {
      name: 'Test Location 2',
      latitude: 34.0522,
      longitude: -118.2437,
      radius: 50000
    }
  ])
}));

describe('ScheduledDataIngestionService', () => {
  let scheduledService: ScheduledDataIngestionService;
  let mockDataIngestionService: jest.Mocked<DataIngestionService>;
  let mockLogger: jest.Mocked<Logger>;
  let config: SchedulerConfig;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    // Create mock data ingestion service
    mockDataIngestionService = {
      ingestAirQualityData: jest.fn(),
      ingestWaterQualityData: jest.fn()
    } as any;

    // Create test configuration
    config = {
      airQuality: {
        enabled: true,
        cronExpression: '0 * * * *' // Every hour
      },
      waterQuality: {
        enabled: true,
        cronExpression: '0 * * * *' // Every hour
      },
      retryConfig: {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2
      }
    };

    scheduledService = new ScheduledDataIngestionService(
      mockDataIngestionService,
      config,
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('should start scheduled jobs when enabled', () => {
      const cron = require('node-cron');
      
      scheduledService.start();

      expect(cron.schedule).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith('Starting scheduled data ingestion service');
      expect(mockLogger.info).toHaveBeenCalledWith('Scheduled data ingestion service started successfully');
    });

    it('should not start jobs when disabled', () => {
      config.airQuality.enabled = false;
      config.waterQuality.enabled = false;
      
      const newService = new ScheduledDataIngestionService(
        mockDataIngestionService,
        config,
        mockLogger
      );

      const cron = require('node-cron');
      cron.schedule.mockClear();

      newService.start();

      expect(cron.schedule).not.toHaveBeenCalled();
    });

    it('should warn if service is already running', () => {
      scheduledService.start();
      scheduledService.start(); // Start again

      expect(mockLogger.warn).toHaveBeenCalledWith('Scheduled data ingestion service is already running');
    });
  });

  describe('stop', () => {
    it('should stop all scheduled jobs', () => {
      const mockJob = {
        start: jest.fn(),
        stop: jest.fn(),
        getStatus: jest.fn().mockReturnValue('scheduled')
      };

      const cron = require('node-cron');
      cron.schedule.mockReturnValue(mockJob);

      scheduledService.start();
      scheduledService.stop();

      expect(mockJob.stop).toHaveBeenCalledTimes(2); // Both air and water quality jobs
      expect(mockLogger.info).toHaveBeenCalledWith('Stopping scheduled data ingestion service');
      expect(mockLogger.info).toHaveBeenCalledWith('Scheduled data ingestion service stopped');
    });

    it('should warn if service is not running', () => {
      scheduledService.stop();

      expect(mockLogger.warn).toHaveBeenCalledWith('Scheduled data ingestion service is not running');
    });
  });

  describe('executeAirQualityIngestion', () => {
    it('should successfully execute air quality ingestion for all locations', async () => {
      const mockResult: DataIngestionResult = {
        success: true,
        dataPointsProcessed: 10,
        errors: [],
        source: 'openaq',
        timestamp: new Date()
      };

      mockDataIngestionService.ingestAirQualityData.mockResolvedValue(mockResult);

      const result = await scheduledService.triggerJob('air_quality');

      expect(result.success).toBe(true);
      expect(result.jobType).toBe('air_quality');
      expect(result.results).toHaveLength(2); // Two test locations
      expect(mockDataIngestionService.ingestAirQualityData).toHaveBeenCalledTimes(2);
    });

    it('should handle ingestion failures with retry logic', async () => {
      mockDataIngestionService.ingestAirQualityData
        .mockRejectedValueOnce(new Error('API timeout'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          success: true,
          dataPointsProcessed: 5,
          errors: [],
          source: 'openaq',
          timestamp: new Date()
        });

      const result = await scheduledService.triggerJob('air_quality');

      expect(result.success).toBe(true);
      expect(result.retryAttempts).toBeGreaterThan(0);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should fail after max retries exceeded', async () => {
      mockDataIngestionService.ingestAirQualityData.mockRejectedValue(new Error('Persistent failure'));

      const result = await scheduledService.triggerJob('air_quality');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Persistent failure');
      expect(mockDataIngestionService.ingestAirQualityData).toHaveBeenCalledTimes(4); // 2 locations * 2 attempts (1 + 1 retry before giving up)
    }, 10000); // Increase timeout to 10 seconds
  });

  describe('executeWaterQualityIngestion', () => {
    it('should successfully execute water quality ingestion for all locations', async () => {
      const mockResult: DataIngestionResult = {
        success: true,
        dataPointsProcessed: 8,
        errors: [],
        source: 'water_quality_portal',
        timestamp: new Date()
      };

      mockDataIngestionService.ingestWaterQualityData.mockResolvedValue(mockResult);

      const result = await scheduledService.triggerJob('water_quality');

      expect(result.success).toBe(true);
      expect(result.jobType).toBe('water_quality');
      expect(result.results).toHaveLength(2);
      expect(mockDataIngestionService.ingestWaterQualityData).toHaveBeenCalledTimes(2);
    });
  });

  describe('exponential backoff retry logic', () => {
    beforeEach(() => {
      // Mock setTimeout to avoid actual delays in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should implement exponential backoff delays', async () => {
      let attemptCount = 0;
      mockDataIngestionService.ingestAirQualityData.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({
          success: true,
          dataPointsProcessed: 1,
          errors: [],
          source: 'openaq',
          timestamp: new Date()
        });
      });

      await scheduledService.triggerJob('air_quality');

      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000); // First retry: 1000ms
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 2000); // Second retry: 2000ms
    });

    it('should respect maximum delay limit', async () => {
      config.retryConfig.maxDelayMs = 5000;
      config.retryConfig.baseDelayMs = 10000; // Higher than max
      
      const newService = new ScheduledDataIngestionService(
        mockDataIngestionService,
        config,
        mockLogger
      );

      mockDataIngestionService.ingestAirQualityData
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValue({
          success: true,
          dataPointsProcessed: 1,
          errors: [],
          source: 'openaq',
          timestamp: new Date()
        });

      await newService.triggerJob('air_quality');

      // Should use maxDelayMs instead of calculated delay
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
    });
  });

  describe('getJobStatus', () => {
    it('should return correct job status', () => {
      scheduledService.start();
      
      const status = scheduledService.getJobStatus();

      expect(status.isRunning).toBe(true);
      expect(status.jobs).toHaveLength(2);
      expect(status.jobs[0]?.name).toBe('air_quality');
      expect(status.jobs[1]?.name).toBe('water_quality');
      expect(status.jobs[0]?.enabled).toBe(true);
      expect(status.jobs[1]?.enabled).toBe(true);
    });

    it('should return empty jobs array when no jobs are enabled', () => {
      config.airQuality.enabled = false;
      config.waterQuality.enabled = false;
      
      const newService = new ScheduledDataIngestionService(
        mockDataIngestionService,
        config,
        mockLogger
      );

      const status = newService.getJobStatus();

      expect(status.isRunning).toBe(false);
      expect(status.jobs).toHaveLength(0);
    });
  });

  describe('triggerJob', () => {
    it('should manually trigger air quality job', async () => {
      mockDataIngestionService.ingestAirQualityData.mockResolvedValue({
        success: true,
        dataPointsProcessed: 5,
        errors: [],
        source: 'openaq',
        timestamp: new Date()
      });

      const result = await scheduledService.triggerJob('air_quality');

      expect(result.jobType).toBe('air_quality');
      expect(mockLogger.info).toHaveBeenCalledWith('Manually triggering air_quality ingestion job');
    });

    it('should manually trigger water quality job', async () => {
      mockDataIngestionService.ingestWaterQualityData.mockResolvedValue({
        success: true,
        dataPointsProcessed: 3,
        errors: [],
        source: 'water_quality_portal',
        timestamp: new Date()
      });

      const result = await scheduledService.triggerJob('water_quality');

      expect(result.jobType).toBe('water_quality');
      expect(mockLogger.info).toHaveBeenCalledWith('Manually triggering water_quality ingestion job');
    });
  });
});