// Tests for Community Recommendations API Routes
// Tests requirements 4.1, 4.2, 4.3, 4.4

import request from 'supertest';
import express from 'express';
import recommendationsRouter from '../recommendations';
import { CommunityRecommendationService } from '../../services/CommunityRecommendationService';
import { CommunityRecommendation, RecommendationAnalysisInput } from '../../models/types';

// Mock the service
jest.mock('../../services/CommunityRecommendationService');
jest.mock('../../utils/logger');

const app = express();
app.use(express.json());
app.use('/api/recommendations', recommendationsRouter);

describe('Recommendations API Routes', () => {
  let mockService: jest.Mocked<CommunityRecommendationService>;

  const mockRecommendation: CommunityRecommendation = {
    id: 'rec-123',
    location: { latitude: 40.7128, longitude: -74.0060, radius: 5 },
    priority: 'high',
    category: 'immediate_action',
    title: 'Reduce PM2.5 Exposure - Immediate Actions',
    description: 'High PM2.5 levels detected. Take immediate protective measures.',
    steps: ['Stay indoors and keep windows closed', 'Use air purifiers with HEPA filters'],
    estimated_impact: 85,
    feasibility_score: 90,
    target_pollutants: ['pm2.5'],
    estimated_cost: 'Low ($0-$100 per household)',
    time_to_implement: '1-2 hours',
    success_metrics: ['Reduced indoor PM2.5 levels', 'Decreased respiratory symptoms reports'],
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z')
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = new CommunityRecommendationService() as jest.Mocked<CommunityRecommendationService>;
    
    // Replace the service instance in the router
    (CommunityRecommendationService as jest.Mock).mockImplementation(() => mockService);
  });

  describe('GET /api/recommendations', () => {
    it('should get recommendations with location query', async () => {
      // Arrange
      const mockResponse = {
        data: [mockRecommendation],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          has_next: false,
          has_previous: false
        }
      };

      mockService.getRecommendations.mockResolvedValue(mockResponse);

      // Act
      const response = await request(app)
        .get('/api/recommendations')
        .query({
          lat: '40.7128',
          lng: '-74.0060',
          radius: '5',
          priority: 'high',
          active_only: 'true'
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResponse);
      expect(mockService.getRecommendations).toHaveBeenCalledWith({
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          radius_km: 5
        },
        priority: ['high'],
        category: undefined,
        target_pollutants: undefined,
        active_only: true,
        limit: undefined,
        offset: undefined
      });
    });

    it('should get recommendations without location query', async () => {
      // Arrange
      const mockResponse = {
        data: [mockRecommendation],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          has_next: false,
          has_previous: false
        }
      };

      mockService.getRecommendations.mockResolvedValue(mockResponse);

      // Act
      const response = await request(app)
        .get('/api/recommendations')
        .query({
          category: 'immediate_action',
          limit: '10'
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResponse);
      expect(mockService.getRecommendations).toHaveBeenCalledWith({
        location: undefined,
        priority: undefined,
        category: ['immediate_action'],
        target_pollutants: undefined,
        active_only: false,
        limit: 10,
        offset: undefined
      });
    });

    it('should return 400 for invalid latitude', async () => {
      // Act
      const response = await request(app)
        .get('/api/recommendations')
        .query({
          lat: '91', // Invalid latitude
          lng: '-74.0060',
          radius: '5'
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_LATITUDE');
    });

    it('should return 400 for invalid longitude', async () => {
      // Act
      const response = await request(app)
        .get('/api/recommendations')
        .query({
          lat: '40.7128',
          lng: '181', // Invalid longitude
          radius: '5'
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_LONGITUDE');
    });

    it('should return 400 for invalid radius', async () => {
      // Act
      const response = await request(app)
        .get('/api/recommendations')
        .query({
          lat: '40.7128',
          lng: '-74.0060',
          radius: '150' // Invalid radius (too large)
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_RADIUS');
    });

    it('should handle service errors', async () => {
      // Arrange
      mockService.getRecommendations.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .get('/api/recommendations');

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /api/recommendations/:id', () => {
    it('should get recommendation by ID', async () => {
      // Arrange
      mockService.getRecommendationById.mockResolvedValue(mockRecommendation);

      // Act
      const response = await request(app)
        .get('/api/recommendations/rec-123');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRecommendation);
      expect(mockService.getRecommendationById).toHaveBeenCalledWith('rec-123');
    });

    it('should return 404 for non-existent recommendation', async () => {
      // Arrange
      mockService.getRecommendationById.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .get('/api/recommendations/non-existent');

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RECOMMENDATION_NOT_FOUND');
    });

    it('should return 400 for invalid ID', async () => {
      // Act
      const response = await request(app)
        .get('/api/recommendations/');

      // Assert
      expect(response.status).toBe(404); // Express returns 404 for missing route parameter
    });
  });

  describe('POST /api/recommendations/generate', () => {
    it('should generate recommendations successfully', async () => {
      // Arrange
      const input: RecommendationAnalysisInput = {
        location: { latitude: 40.7128, longitude: -74.0060 },
        radius_km: 5,
        current_conditions: [
          {
            id: '1',
            source: 'openaq',
            pollutant: 'pm2.5',
            value: 45.5,
            unit: 'μg/m³',
            location: { latitude: 40.7128, longitude: -74.0060 },
            timestamp: new Date(),
            quality_grade: 'A'
          }
        ]
      };

      mockService.generateRecommendations.mockResolvedValue([mockRecommendation]);

      // Act
      const response = await request(app)
        .post('/api/recommendations/generate')
        .send(input);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([mockRecommendation]);
      expect(mockService.generateRecommendations).toHaveBeenCalledWith(input);
    });

    it('should return 400 for missing required fields', async () => {
      // Act
      const response = await request(app)
        .post('/api/recommendations/generate')
        .send({
          location: { latitude: 40.7128, longitude: -74.0060 }
          // Missing radius_km and current_conditions
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    it('should return 400 for invalid location', async () => {
      // Act
      const response = await request(app)
        .post('/api/recommendations/generate')
        .send({
          location: { latitude: 91, longitude: -74.0060 }, // Invalid latitude
          radius_km: 5,
          current_conditions: []
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_LOCATION');
    });

    it('should return 400 for invalid radius', async () => {
      // Act
      const response = await request(app)
        .post('/api/recommendations/generate')
        .send({
          location: { latitude: 40.7128, longitude: -74.0060 },
          radius_km: -5, // Invalid radius
          current_conditions: []
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_RADIUS');
    });

    it('should return 400 for empty current conditions', async () => {
      // Act
      const response = await request(app)
        .post('/api/recommendations/generate')
        .send({
          location: { latitude: 40.7128, longitude: -74.0060 },
          radius_km: 5,
          current_conditions: [] // Empty array
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CONDITIONS');
    });

    it('should return 400 for invalid condition data', async () => {
      // Act
      const response = await request(app)
        .post('/api/recommendations/generate')
        .send({
          location: { latitude: 40.7128, longitude: -74.0060 },
          radius_km: 5,
          current_conditions: [
            {
              pollutant: 'pm2.5'
              // Missing value and timestamp
            }
          ]
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CONDITION_DATA');
    });

    it('should handle service errors', async () => {
      // Arrange
      const input: RecommendationAnalysisInput = {
        location: { latitude: 40.7128, longitude: -74.0060 },
        radius_km: 5,
        current_conditions: [
          {
            id: '1',
            source: 'openaq',
            pollutant: 'pm2.5',
            value: 45.5,
            unit: 'μg/m³',
            location: { latitude: 40.7128, longitude: -74.0060 },
            timestamp: new Date(),
            quality_grade: 'A'
          }
        ]
      };

      mockService.generateRecommendations.mockRejectedValue(new Error('Generation failed'));

      // Act
      const response = await request(app)
        .post('/api/recommendations/generate')
        .send(input);

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('PUT /api/recommendations/:id', () => {
    it('should update recommendation successfully', async () => {
      // Arrange
      const updates = {
        priority: 'urgent',
        title: 'Updated Title'
      };

      const updatedRecommendation = {
        ...mockRecommendation,
        priority: 'urgent' as const,
        title: 'Updated Title'
      };

      mockService.updateRecommendation.mockResolvedValue(updatedRecommendation);

      // Act
      const response = await request(app)
        .put('/api/recommendations/rec-123')
        .send(updates);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(updatedRecommendation);
      expect(mockService.updateRecommendation).toHaveBeenCalledWith('rec-123', updates);
    });

    it('should return 404 for non-existent recommendation', async () => {
      // Arrange
      mockService.updateRecommendation.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .put('/api/recommendations/non-existent')
        .send({ priority: 'urgent' });

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RECOMMENDATION_NOT_FOUND');
    });

    it('should return 400 for invalid updates', async () => {
      // Act
      const response = await request(app)
        .put('/api/recommendations/rec-123')
        .send('invalid updates');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_UPDATES');
    });
  });

  describe('DELETE /api/recommendations/:id', () => {
    it('should delete recommendation successfully', async () => {
      // Arrange
      mockService.deleteRecommendation.mockResolvedValue(true);

      // Act
      const response = await request(app)
        .delete('/api/recommendations/rec-123');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ deleted: true, id: 'rec-123' });
      expect(mockService.deleteRecommendation).toHaveBeenCalledWith('rec-123');
    });

    it('should return 404 for non-existent recommendation', async () => {
      // Arrange
      mockService.deleteRecommendation.mockResolvedValue(false);

      // Act
      const response = await request(app)
        .delete('/api/recommendations/non-existent');

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RECOMMENDATION_NOT_FOUND');
    });

    it('should handle service errors', async () => {
      // Arrange
      mockService.deleteRecommendation.mockRejectedValue(new Error('Delete failed'));

      // Act
      const response = await request(app)
        .delete('/api/recommendations/rec-123');

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('input validation', () => {
    it('should handle multiple priority values', async () => {
      // Arrange
      const mockResponse = {
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          has_next: false,
          has_previous: false
        }
      };

      mockService.getRecommendations.mockResolvedValue(mockResponse);

      // Act
      const response = await request(app)
        .get('/api/recommendations')
        .query({
          priority: ['high', 'urgent']
        });

      // Assert
      expect(response.status).toBe(200);
      expect(mockService.getRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: ['high', 'urgent']
        })
      );
    });

    it('should handle multiple category values', async () => {
      // Arrange
      const mockResponse = {
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          has_next: false,
          has_previous: false
        }
      };

      mockService.getRecommendations.mockResolvedValue(mockResponse);

      // Act
      const response = await request(app)
        .get('/api/recommendations')
        .query({
          category: ['immediate_action', 'long_term_strategy']
        });

      // Assert
      expect(response.status).toBe(200);
      expect(mockService.getRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({
          category: ['immediate_action', 'long_term_strategy']
        })
      );
    });

    it('should handle multiple pollutant values', async () => {
      // Arrange
      const mockResponse = {
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          has_next: false,
          has_previous: false
        }
      };

      mockService.getRecommendations.mockResolvedValue(mockResponse);

      // Act
      const response = await request(app)
        .get('/api/recommendations')
        .query({
          pollutants: ['pm2.5', 'no2']
        });

      // Assert
      expect(response.status).toBe(200);
      expect(mockService.getRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({
          target_pollutants: ['pm2.5', 'no2']
        })
      );
    });
  });
});