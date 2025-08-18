// Tests for Dashboard API Routes
// Tests requirements 5.1, 5.3, 10.2 for user dashboard data aggregation

import request from 'supertest';
import express from 'express';
import dashboardRoutes from '../dashboard';
import { EnvironmentalDataRepository } from '../../models/EnvironmentalDataRepository';
import { ImageAnalysisRepository } from '../../models/ImageAnalysisRepository';
import { CommunityRecommendationRepository } from '../../models/CommunityRecommendationRepository';
import { UserRepository } from '../../models/UserRepository';
import { UserProfile, EnvironmentalDataPoint, ImageAnalysis, CommunityRecommendation } from '../../models/types';

// Mock the repositories
jest.mock('../../models/EnvironmentalDataRepository');
jest.mock('../../models/ImageAnalysisRepository');
jest.mock('../../models/CommunityRecommendationRepository');
jest.mock('../../models/UserRepository');

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = {
      id: 'user-1',
      email: 'test@example.com',
      points: 150,
      level: 2,
      contribution_streak: 5,
      badges: ['first_upload', 'streak_5'],
      location: { latitude: 40.7128, longitude: -74.0060 },
      preferences: {},
      created_at: new Date(),
      updated_at: new Date()
    };
    next();
  }
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

const MockEnvironmentalDataRepository = EnvironmentalDataRepository as jest.MockedClass<typeof EnvironmentalDataRepository>;
const MockImageAnalysisRepository = ImageAnalysisRepository as jest.MockedClass<typeof ImageAnalysisRepository>;
const MockCommunityRecommendationRepository = CommunityRecommendationRepository as jest.MockedClass<typeof CommunityRecommendationRepository>;
const MockUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;

describe('Dashboard Routes', () => {
  let app: express.Application;
  let mockEnvDataRepo: jest.Mocked<EnvironmentalDataRepository>;
  let mockImageRepo: jest.Mocked<ImageAnalysisRepository>;
  let mockRecommendationRepo: jest.Mocked<CommunityRecommendationRepository>;
  let mockUserRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/dashboard', dashboardRoutes);

    mockEnvDataRepo = new MockEnvironmentalDataRepository() as jest.Mocked<EnvironmentalDataRepository>;
    mockImageRepo = new MockImageAnalysisRepository() as jest.Mocked<ImageAnalysisRepository>;
    mockRecommendationRepo = new MockCommunityRecommendationRepository() as jest.Mocked<CommunityRecommendationRepository>;
    mockUserRepo = new MockUserRepository() as jest.Mocked<UserRepository>;

    MockEnvironmentalDataRepository.mockImplementation(() => mockEnvDataRepo);
    MockImageAnalysisRepository.mockImplementation(() => mockImageRepo);
    MockCommunityRecommendationRepository.mockImplementation(() => mockRecommendationRepo);
    MockUserRepository.mockImplementation(() => mockUserRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/dashboard/overview', () => {
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
      }
    ];

    const mockImageAnalyses: ImageAnalysis[] = [
      {
        id: 'img-1',
        user_id: 'user-1',
        image_url: 'https://example.com/image1.jpg',
        upload_timestamp: new Date('2024-01-01T10:00:00Z'),
        analysis_results: {
          pollution_indicators: {
            air_quality: { smog_density: 0.3, visibility: 0.8, confidence: 0.9 }
          },
          overall_score: 0.7,
          recommendations: ['Consider wearing a mask outdoors']
        },
        status: 'completed',
        created_at: new Date('2024-01-01T10:00:00Z')
      }
    ];

    const mockRecommendations: CommunityRecommendation[] = [
      {
        id: 'rec-1',
        location: { latitude: 40.7128, longitude: -74.0060, radius: 5 },
        priority: 'medium',
        category: 'immediate_action',
        title: 'Reduce Vehicle Emissions',
        description: 'Implement car-free zones during peak hours',
        steps: ['Identify high-traffic areas', 'Set up temporary barriers'],
        estimated_impact: 75,
        feasibility_score: 80,
        target_pollutants: ['pm25', 'no2'],
        success_metrics: ['Reduced PM2.5 levels'],
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    const mockNearbyUsers: UserProfile[] = [
      {
        id: 'user-2',
        email: 'user2@example.com',
        password_hash: 'hash',
        location: { latitude: 40.7130, longitude: -74.0062 },
        preferences: {},
        points: 100,
        level: 1,
        badges: [],
        contribution_streak: 3,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    beforeEach(() => {
      mockEnvDataRepo.findMany.mockResolvedValue({
        data: mockEnvironmentalData,
        pagination: { total: 1, page: 1, limit: 100, has_next: false, has_previous: false }
      });

      mockImageRepo.findMany.mockResolvedValue({
        data: mockImageAnalyses,
        pagination: { total: 5, page: 1, limit: 10, has_next: false, has_previous: false }
      });

      mockRecommendationRepo.findMany.mockResolvedValue({
        data: mockRecommendations,
        pagination: { total: 1, page: 1, limit: 10, has_next: false, has_previous: false }
      });

      mockUserRepo.findNearby.mockResolvedValue(mockNearbyUsers);
    });

    it('should return comprehensive dashboard overview', async () => {
      const response = await request(app)
        .get('/api/dashboard/overview')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe('user-1');
      expect(response.body.data.user.points).toBe(150);
      expect(response.body.data.environmental_conditions.current).toHaveLength(1);
      expect(response.body.data.user_contributions.recent_images).toHaveLength(1);
      expect(response.body.data.recommendations.active).toHaveLength(1);
      expect(response.body.data.community_stats.nearby_contributors).toBe(0); // Excludes current user
    });

    it('should handle custom radius parameter', async () => {
      const response = await request(app)
        .get('/api/dashboard/overview')
        .query({ radius: 15 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockEnvDataRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          location: expect.objectContaining({
            radius_km: 15
          })
        })
      );
    });

    it('should return 400 for invalid radius', async () => {
      const response = await request(app)
        .get('/api/dashboard/overview')
        .query({ radius: 150 }) // Too large
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_RADIUS');
    });

    it('should handle repository errors gracefully', async () => {
      mockEnvDataRepo.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/dashboard/overview')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DASHBOARD_OVERVIEW_ERROR');
    });
  });

  describe('GET /api/dashboard/environmental-summary', () => {
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
        source: 'openaq',
        pollutant: 'pm25',
        value: 30.0,
        unit: 'µg/m³',
        location: { latitude: 40.7130, longitude: -74.0062 },
        timestamp: new Date('2024-01-01T11:00:00Z'),
        quality_grade: 'C',
        created_at: new Date('2024-01-01T11:00:00Z')
      },
      {
        id: '3',
        source: 'water_quality_portal',
        pollutant: 'turbidity',
        value: 5.2,
        unit: 'NTU',
        location: { latitude: 40.7128, longitude: -74.0060 },
        timestamp: new Date('2024-01-01T10:00:00Z'),
        quality_grade: 'A',
        created_at: new Date('2024-01-01T10:00:00Z')
      }
    ];

    beforeEach(() => {
      mockEnvDataRepo.findMany.mockResolvedValue({
        data: mockEnvironmentalData,
        pagination: { total: 3, page: 1, limit: 5000, has_next: false, has_previous: false }
      });
    });

    it('should return environmental summary for user location', async () => {
      const response = await request(app)
        .get('/api/dashboard/environmental-summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total_measurements).toBe(3);
      expect(response.body.data.pollutants.pm25).toBeDefined();
      expect(response.body.data.pollutants.turbidity).toBeDefined();
      expect(response.body.data.pollutants.pm25.count).toBe(2);
      expect(response.body.data.pollutants.pm25.statistics.avg).toBeCloseTo(27.75);
      expect(response.body.data.overall_quality.current_grade).toBeDefined();
    });

    it('should return environmental summary for custom location', async () => {
      const response = await request(app)
        .get('/api/dashboard/environmental-summary')
        .query({
          lat: 41.0000,
          lng: -75.0000,
          radius: 20
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockEnvDataRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          location: {
            latitude: 41.0000,
            longitude: -75.0000,
            radius_km: 20
          }
        })
      );
    });

    it('should return environmental summary with custom time range', async () => {
      const response = await request(app)
        .get('/api/dashboard/environmental-summary')
        .query({
          hours: 48
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.timeframe.hours).toBe(48);
    });

    it('should return 400 for invalid location', async () => {
      const response = await request(app)
        .get('/api/dashboard/environmental-summary')
        .query({
          lat: 'invalid',
          lng: -75.0000
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_LOCATION');
    });

    it('should return 400 for invalid hours parameter', async () => {
      const response = await request(app)
        .get('/api/dashboard/environmental-summary')
        .query({
          hours: 200 // Too large
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_HOURS');
    });

    it('should handle no data scenario', async () => {
      mockEnvDataRepo.findMany.mockResolvedValue({
        data: [],
        pagination: { total: 0, page: 1, limit: 5000, has_next: false, has_previous: false }
      });

      const response = await request(app)
        .get('/api/dashboard/environmental-summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total_measurements).toBe(0);
      expect(response.body.data.message).toContain('No environmental data found');
    });

    it('should handle repository errors', async () => {
      mockEnvDataRepo.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/dashboard/environmental-summary')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ENVIRONMENTAL_SUMMARY_ERROR');
    });
  });

  describe('GET /api/dashboard/user-activity', () => {
    const mockImageAnalyses: ImageAnalysis[] = [
      {
        id: 'img-1',
        user_id: 'user-1',
        image_url: 'https://example.com/image1.jpg',
        upload_timestamp: new Date('2024-01-01T12:00:00Z'),
        analysis_results: {
          pollution_indicators: {
            air_quality: { smog_density: 0.3, visibility: 0.8, confidence: 0.9 }
          },
          overall_score: 0.7,
          recommendations: ['Consider wearing a mask outdoors']
        },
        status: 'completed',
        created_at: new Date('2024-01-01T12:00:00Z')
      },
      {
        id: 'img-2',
        user_id: 'user-1',
        image_url: 'https://example.com/image2.jpg',
        upload_timestamp: new Date('2024-01-01T10:00:00Z'),
        analysis_results: {
          pollution_indicators: {
            water_quality: { turbidity: 0.2, color_index: 0.1, confidence: 0.8 }
          },
          overall_score: 0.9,
          recommendations: ['Water quality looks good']
        },
        status: 'completed',
        created_at: new Date('2024-01-01T10:00:00Z')
      }
    ];

    beforeEach(() => {
      mockImageRepo.findMany.mockResolvedValue({
        data: mockImageAnalyses,
        pagination: { total: 2, page: 1, limit: 50, has_next: false, has_previous: false }
      });
    });

    it('should return user activity with default parameters', async () => {
      const response = await request(app)
        .get('/api/dashboard/user-activity')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.activities).toHaveLength(2);
      expect(response.body.data.summary.total_activities).toBe(2);
      expect(response.body.data.summary.points_earned).toBe(20); // 2 completed images * 10 points
      expect(response.body.data.summary.activity_types.image_analysis).toBe(2);
    });

    it('should return user activity with custom parameters', async () => {
      const response = await request(app)
        .get('/api/dashboard/user-activity')
        .query({
          days: 7,
          limit: 25
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockImageRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          limit: 25
        })
      );
    });

    it('should limit days parameter to maximum', async () => {
      const response = await request(app)
        .get('/api/dashboard/user-activity')
        .query({
          days: 400 // Should be limited to 365
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.timeframe.days).toBe(365);
    });

    it('should limit results parameter to maximum', async () => {
      const response = await request(app)
        .get('/api/dashboard/user-activity')
        .query({
          limit: 300 // Should be limited to 200
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockImageRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 200
        })
      );
    });

    it('should handle repository errors', async () => {
      mockImageRepo.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/dashboard/user-activity')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_ACTIVITY_ERROR');
    });
  });
});