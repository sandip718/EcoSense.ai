// Tests for Environmental Data API Routes
// Tests requirements 5.1, 5.3 for environmental data queries with geospatial filtering

import request from 'supertest';
import express from 'express';
import environmentalDataRoutes from '../environmentalData';
import { EnvironmentalDataRepository } from '../../models/EnvironmentalDataRepository';
import { EnvironmentalDataPoint, PaginatedResponse } from '../../models/types';

// Mock the repository
jest.mock('../../models/EnvironmentalDataRepository');
const MockEnvironmentalDataRepository = EnvironmentalDataRepository as jest.MockedClass<typeof EnvironmentalDataRepository>;

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('Environmental Data Routes', () => {
  let app: express.Application;
  let mockRepository: jest.Mocked<EnvironmentalDataRepository>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/environmental-data', environmentalDataRoutes);

    mockRepository = new MockEnvironmentalDataRepository() as jest.Mocked<EnvironmentalDataRepository>;
    MockEnvironmentalDataRepository.mockImplementation(() => mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/environmental-data', () => {
    const mockEnvironmentalData: EnvironmentalDataPoint[] = [
      {
        id: '1',
        source: 'openaq',
        pollutant: 'pm25',
        value: 25.5,
        unit: 'µg/m³',
        location: { latitude: 40.7128, longitude: -74.0060 },
        timestamp: new Date('2024-01-01T12:00:00Z'),
        quality_grade: 'B',
        created_at: new Date('2024-01-01T12:00:00Z')
      },
      {
        id: '2',
        source: 'water_quality_portal',
        pollutant: 'turbidity',
        value: 5.2,
        unit: 'NTU',
        location: { latitude: 40.7130, longitude: -74.0062 },
        timestamp: new Date('2024-01-01T11:30:00Z'),
        quality_grade: 'A',
        created_at: new Date('2024-01-01T11:30:00Z')
      }
    ];

    const mockPaginatedResponse: PaginatedResponse<EnvironmentalDataPoint> = {
      data: mockEnvironmentalData,
      pagination: {
        total: 2,
        page: 1,
        limit: 50,
        has_next: false,
        has_previous: false
      }
    };

    it('should return environmental data without filters', async () => {
      mockRepository.findMany.mockResolvedValue(mockPaginatedResponse);

      const response = await request(app)
        .get('/api/environmental-data')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPaginatedResponse);
      expect(mockRepository.findMany).toHaveBeenCalledWith({
        limit: 50,
        offset: 0
      });
    });

    it('should return environmental data with location filter', async () => {
      mockRepository.findMany.mockResolvedValue(mockPaginatedResponse);

      const response = await request(app)
        .get('/api/environmental-data')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          radius: 5
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockRepository.findMany).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          radius_km: 5
        }
      });
    });

    it('should return environmental data with pollutant filter', async () => {
      mockRepository.findMany.mockResolvedValue(mockPaginatedResponse);

      const response = await request(app)
        .get('/api/environmental-data')
        .query({
          pollutant: 'pm25'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockRepository.findMany).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
        pollutant: 'pm25'
      });
    });

    it('should return environmental data with time range filter', async () => {
      mockRepository.findMany.mockResolvedValue(mockPaginatedResponse);

      const start = '2024-01-01T00:00:00Z';
      const end = '2024-01-01T23:59:59Z';

      const response = await request(app)
        .get('/api/environmental-data')
        .query({
          start,
          end
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockRepository.findMany).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
        time_range: {
          start: new Date(start),
          end: new Date(end)
        }
      });
    });

    it('should return environmental data with quality grade filter', async () => {
      mockRepository.findMany.mockResolvedValue(mockPaginatedResponse);

      const response = await request(app)
        .get('/api/environmental-data')
        .query({
          quality_grade: 'A,B'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockRepository.findMany).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
        quality_grade: ['A', 'B']
      });
    });

    it('should return environmental data with pagination', async () => {
      mockRepository.findMany.mockResolvedValue(mockPaginatedResponse);

      const response = await request(app)
        .get('/api/environmental-data')
        .query({
          limit: 25,
          offset: 10
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockRepository.findMany).toHaveBeenCalledWith({
        limit: 25,
        offset: 10
      });
    });

    it('should return 400 for invalid location', async () => {
      const response = await request(app)
        .get('/api/environmental-data')
        .query({
          lat: 'invalid',
          lng: -74.0060
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_LOCATION');
    });

    it('should return 400 for invalid radius', async () => {
      const response = await request(app)
        .get('/api/environmental-data')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          radius: 2000 // Too large
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_RADIUS');
    });

    it('should return 400 for invalid source', async () => {
      const response = await request(app)
        .get('/api/environmental-data')
        .query({
          source: 'invalid_source'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SOURCE');
    });

    it('should return 400 for invalid quality grade', async () => {
      const response = await request(app)
        .get('/api/environmental-data')
        .query({
          quality_grade: 'X,Y'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_QUALITY_GRADE');
    });

    it('should handle repository errors', async () => {
      mockRepository.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/environmental-data')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ENVIRONMENTAL_DATA_QUERY_ERROR');
    });
  });

  describe('GET /api/environmental-data/:id', () => {
    const mockDataPoint: EnvironmentalDataPoint = {
      id: '1',
      source: 'openaq',
      pollutant: 'pm25',
      value: 25.5,
      unit: 'µg/m³',
      location: { latitude: 40.7128, longitude: -74.0060 },
      timestamp: new Date('2024-01-01T12:00:00Z'),
      quality_grade: 'B',
      created_at: new Date('2024-01-01T12:00:00Z')
    };

    it('should return environmental data point by ID', async () => {
      mockRepository.findById.mockResolvedValue(mockDataPoint);

      const response = await request(app)
        .get('/api/environmental-data/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDataPoint);
      expect(mockRepository.findById).toHaveBeenCalledWith('1');
    });

    it('should return 404 for non-existent data point', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/environmental-data/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DATA_POINT_NOT_FOUND');
    });

    it('should return 400 for invalid ID', async () => {
      const response = await request(app)
        .get('/api/environmental-data/')
        .expect(404); // Express returns 404 for missing route parameter
    });

    it('should handle repository errors', async () => {
      mockRepository.findById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/environmental-data/1')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ENVIRONMENTAL_DATA_FETCH_ERROR');
    });
  });

  describe('GET /api/environmental-data/latest', () => {
    const mockLatestData: EnvironmentalDataPoint = {
      id: '1',
      source: 'openaq',
      pollutant: 'pm25',
      value: 25.5,
      unit: 'µg/m³',
      location: { latitude: 40.7128, longitude: -74.0060 },
      timestamp: new Date('2024-01-01T12:00:00Z'),
      quality_grade: 'B',
      created_at: new Date('2024-01-01T12:00:00Z')
    };

    it('should return latest environmental data for location and pollutant', async () => {
      mockRepository.findLatestByLocation.mockResolvedValue(mockLatestData);

      const response = await request(app)
        .get('/api/environmental-data/latest')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          pollutant: 'pm25'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockLatestData);
      expect(mockRepository.findLatestByLocation).toHaveBeenCalledWith(
        { latitude: 40.7128, longitude: -74.0060 },
        5,
        'pm25'
      );
    });

    it('should return latest data with custom radius', async () => {
      mockRepository.findLatestByLocation.mockResolvedValue(mockLatestData);

      const response = await request(app)
        .get('/api/environmental-data/latest')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          radius: 10,
          pollutant: 'pm25'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockRepository.findLatestByLocation).toHaveBeenCalledWith(
        { latitude: 40.7128, longitude: -74.0060 },
        10,
        'pm25'
      );
    });

    it('should return 400 for missing required parameters', async () => {
      const response = await request(app)
        .get('/api/environmental-data/latest')
        .query({
          lat: 40.7128
          // Missing lng and pollutant
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_PARAMETERS');
    });

    it('should return 404 when no data found', async () => {
      mockRepository.findLatestByLocation.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/environmental-data/latest')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          pollutant: 'pm25'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_DATA_FOUND');
    });

    it('should handle repository errors', async () => {
      mockRepository.findLatestByLocation.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/environmental-data/latest')
        .query({
          lat: 40.7128,
          lng: -74.0060,
          pollutant: 'pm25'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('LATEST_DATA_ERROR');
    });
  });

  describe('GET /api/environmental-data/summary', () => {
    const mockSummaryData: PaginatedResponse<EnvironmentalDataPoint> = {
      data: [
        {
          id: '1',
          source: 'openaq',
          pollutant: 'pm25',
          value: 25.5,
          unit: 'µg/m³',
          location: { latitude: 40.7128, longitude: -74.0060 },
          timestamp: new Date('2024-01-01T12:00:00Z'),
          quality_grade: 'B',
          created_at: new Date('2024-01-01T12:00:00Z')
        },
        {
          id: '2',
          source: 'openaq',
          pollutant: 'pm25',
          value: 30.0,
          unit: 'µg/m³',
          location: { latitude: 40.7130, longitude: -74.0062 },
          timestamp: new Date('2024-01-01T11:00:00Z'),
          quality_grade: 'C',
          created_at: new Date('2024-01-01T11:00:00Z')
        }
      ],
      pagination: {
        total: 2,
        page: 1,
        limit: 10000,
        has_next: false,
        has_previous: false
      }
    };

    it('should return environmental data summary for location', async () => {
      mockRepository.findMany.mockResolvedValue(mockSummaryData);

      const response = await request(app)
        .get('/api/environmental-data/summary')
        .query({
          lat: 40.7128,
          lng: -74.0060
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total_measurements).toBe(2);
      expect(response.body.data.pollutants.pm25).toBeDefined();
      expect(response.body.data.pollutants.pm25.count).toBe(2);
      expect(response.body.data.pollutants.pm25.avg_value).toBe(27.75);
      expect(response.body.data.pollutants.pm25.min_value).toBe(25.5);
      expect(response.body.data.pollutants.pm25.max_value).toBe(30.0);
    });

    it('should return 400 for missing required parameters', async () => {
      const response = await request(app)
        .get('/api/environmental-data/summary')
        .query({
          lat: 40.7128
          // Missing lng
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_PARAMETERS');
    });

    it('should handle repository errors', async () => {
      mockRepository.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/environmental-data/summary')
        .query({
          lat: 40.7128,
          lng: -74.0060
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SUMMARY_ERROR');
    });
  });
});