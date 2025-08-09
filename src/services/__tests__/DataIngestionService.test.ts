import { DataIngestionService, DataIngestionConfig } from '../DataIngestionService';
import { OpenAQClient } from '../clients/OpenAQClient';
import { WaterQualityPortalClient } from '../clients/WaterQualityPortalClient';
import { MessageQueuePublisher } from '../messaging/MessageQueuePublisher';
import { CreateEnvironmentalDataPoint } from '../../models/types';
import { Logger } from 'winston';

// Mock the client classes
jest.mock('../clients/OpenAQClient');
jest.mock('../clients/WaterQualityPortalClient');
jest.mock('../messaging/MessageQueuePublisher');

describe('DataIngestionService', () => {
  let service: DataIngestionService;
  let mockLogger: jest.Mocked<Logger>;
  let mockMessagePublisher: jest.Mocked<MessageQueuePublisher>;
  let mockOpenAQClient: jest.Mocked<OpenAQClient>;
  let mockWaterQualityClient: jest.Mocked<WaterQualityPortalClient>;

  const mockConfig: DataIngestionConfig = {
    apis: {
      openaq: {
        endpoint: 'https://api.openaq.org',
        rateLimit: 60
      },
      waterQuality: {
        endpoint: 'https://www.waterqualitydata.us',
        rateLimit: 30
      }
    },
    scheduledJobs: {
      airQuality: {
        interval: '0 * * * *',
        enabled: true
      },
      waterQuality: {
        interval: '0 * * * *',
        enabled: true
      }
    },
    messageQueue: {
      exchangeName: 'environmental_data',
      routingKey: 'environmental.data'
    }
  };

  const mockEnvironmentalData: CreateEnvironmentalDataPoint[] = [
    {
      source: 'openaq',
      pollutant: 'PM2.5',
      value: 25.5,
      unit: 'µg/m³',
      location: {
        latitude: 34.0522,
        longitude: -118.2437,
        address: 'Los Angeles, CA'
      },
      timestamp: new Date('2023-01-01T12:00:00Z'),
      quality_grade: 'A'
    },
    {
      source: 'water_quality_portal',
      pollutant: 'pH',
      value: 7.2,
      unit: 'pH units',
      location: {
        latitude: 34.0522,
        longitude: -118.2437,
        address: 'Los Angeles, CA'
      },
      timestamp: new Date('2023-01-01T12:00:00Z'),
      quality_grade: 'B'
    }
  ];

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    // Create mock message publisher
    mockMessagePublisher = {
      publishEnvironmentalData: jest.fn().mockResolvedValue(undefined),
      healthCheck: jest.fn().mockResolvedValue(true)
    } as any;

    // Create service instance
    service = new DataIngestionService(mockConfig, mockLogger, mockMessagePublisher);

    // Get mocked client instances
    mockOpenAQClient = (service as any).openaqClient;
    mockWaterQualityClient = (service as any).waterQualityClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ingestAirQualityData', () => {
    it('should successfully ingest air quality data', async () => {
      const airQualityData = [mockEnvironmentalData[0]];
      mockOpenAQClient.fetchLatestMeasurements.mockResolvedValue(airQualityData);

      const result = await service.ingestAirQualityData();

      expect(result.success).toBe(true);
      expect(result.dataPointsProcessed).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(result.source).toBe('openaq');
      expect(mockOpenAQClient.fetchLatestMeasurements).toHaveBeenCalledWith(undefined);
      expect(mockMessagePublisher.publishEnvironmentalData).toHaveBeenCalledWith(
        airQualityData[0],
        'environmental_data',
        'environmental.data'
      );
    });

    it('should handle location-based filtering', async () => {
      const location = { latitude: 34.0522, longitude: -118.2437, radius: 25000 };
      const airQualityData = [mockEnvironmentalData[0]];
      mockOpenAQClient.fetchLatestMeasurements.mockResolvedValue(airQualityData);

      const result = await service.ingestAirQualityData(location);

      expect(result.success).toBe(true);
      expect(mockOpenAQClient.fetchLatestMeasurements).toHaveBeenCalledWith(location);
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('OpenAQ API error');
      mockOpenAQClient.fetchLatestMeasurements.mockRejectedValue(error);

      const result = await service.ingestAirQualityData();

      expect(result.success).toBe(false);
      expect(result.dataPointsProcessed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Air quality data ingestion failed');
    });

    it('should handle individual data point processing errors', async () => {
      const airQualityData = [mockEnvironmentalData[0]];
      mockOpenAQClient.fetchLatestMeasurements.mockResolvedValue(airQualityData);
      mockMessagePublisher.publishEnvironmentalData.mockRejectedValue(new Error('Publishing failed'));

      const result = await service.ingestAirQualityData();

      expect(result.success).toBe(false);
      expect(result.dataPointsProcessed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to process air quality data point');
    });
  });

  describe('ingestWaterQualityData', () => {
    it('should successfully ingest water quality data', async () => {
      const waterQualityData = [mockEnvironmentalData[1]];
      mockWaterQualityClient.fetchLatestMeasurements.mockResolvedValue(waterQualityData);

      const result = await service.ingestWaterQualityData();

      expect(result.success).toBe(true);
      expect(result.dataPointsProcessed).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(result.source).toBe('water_quality_portal');
      expect(mockWaterQualityClient.fetchLatestMeasurements).toHaveBeenCalledWith(undefined);
      expect(mockMessagePublisher.publishEnvironmentalData).toHaveBeenCalledWith(
        waterQualityData[0],
        'environmental_data',
        'environmental.data'
      );
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('Water Quality Portal API error');
      mockWaterQualityClient.fetchLatestMeasurements.mockRejectedValue(error);

      const result = await service.ingestWaterQualityData();

      expect(result.success).toBe(false);
      expect(result.dataPointsProcessed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Water quality data ingestion failed');
    });
  });

  describe('ingestAllSources', () => {
    it('should ingest from all enabled sources', async () => {
      mockOpenAQClient.fetchLatestMeasurements.mockResolvedValue([mockEnvironmentalData[0]]);
      mockWaterQualityClient.fetchLatestMeasurements.mockResolvedValue([mockEnvironmentalData[1]]);

      const results = await service.ingestAllSources();

      expect(results).toHaveLength(2);
      expect(results[0].source).toBe('openaq');
      expect(results[1].source).toBe('water_quality_portal');
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should skip disabled sources', async () => {
      const configWithDisabledWater = {
        ...mockConfig,
        scheduledJobs: {
          ...mockConfig.scheduledJobs,
          waterQuality: {
            ...mockConfig.scheduledJobs.waterQuality,
            enabled: false
          }
        }
      };

      const serviceWithDisabledWater = new DataIngestionService(
        configWithDisabledWater,
        mockLogger,
        mockMessagePublisher
      );

      mockOpenAQClient.fetchLatestMeasurements.mockResolvedValue([mockEnvironmentalData[0]]);

      const results = await serviceWithDisabledWater.ingestAllSources();

      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('openaq');
    });
  });

  describe('data validation', () => {
    it('should validate data points before processing', async () => {
      const invalidData: CreateEnvironmentalDataPoint = {
        source: 'openaq',
        pollutant: '',
        value: -1,
        unit: '',
        location: {
          latitude: 200, // Invalid latitude
          longitude: -118.2437
        },
        timestamp: new Date(),
        quality_grade: 'A'
      };

      mockOpenAQClient.fetchLatestMeasurements.mockResolvedValue([invalidData]);

      const result = await service.ingestAirQualityData();

      expect(result.success).toBe(false);
      expect(result.dataPointsProcessed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(mockMessagePublisher.publishEnvironmentalData).not.toHaveBeenCalled();
    });

    it('should accept valid data points', async () => {
      const validData = mockEnvironmentalData[0];
      mockOpenAQClient.fetchLatestMeasurements.mockResolvedValue([validData]);

      const result = await service.ingestAirQualityData();

      expect(result.success).toBe(true);
      expect(result.dataPointsProcessed).toBe(1);
      expect(mockMessagePublisher.publishEnvironmentalData).toHaveBeenCalledWith(
        validData,
        'environmental_data',
        'environmental.data'
      );
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when all services are healthy', async () => {
      mockOpenAQClient.healthCheck.mockResolvedValue(true);
      mockWaterQualityClient.healthCheck.mockResolvedValue(true);
      mockMessagePublisher.healthCheck.mockResolvedValue(true);

      const status = await service.getHealthStatus();

      expect(status.status).toBe('healthy');
      expect(status.services.openaq).toBe(true);
      expect(status.services.waterQuality).toBe(true);
      expect(status.services.messageQueue).toBe(true);
    });

    it('should return degraded status when some services are unhealthy', async () => {
      mockOpenAQClient.healthCheck.mockResolvedValue(true);
      mockWaterQualityClient.healthCheck.mockResolvedValue(false);
      mockMessagePublisher.healthCheck.mockResolvedValue(true);

      const status = await service.getHealthStatus();

      expect(status.status).toBe('degraded');
      expect(status.services.openaq).toBe(true);
      expect(status.services.waterQuality).toBe(false);
      expect(status.services.messageQueue).toBe(true);
    });

    it('should return unhealthy status when all services are unhealthy', async () => {
      mockOpenAQClient.healthCheck.mockResolvedValue(false);
      mockWaterQualityClient.healthCheck.mockResolvedValue(false);
      mockMessagePublisher.healthCheck.mockResolvedValue(false);

      const status = await service.getHealthStatus();

      expect(status.status).toBe('unhealthy');
      expect(status.services.openaq).toBe(false);
      expect(status.services.waterQuality).toBe(false);
      expect(status.services.messageQueue).toBe(false);
    });
  });
});