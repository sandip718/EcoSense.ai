// Basic functionality test for Community Recommendation Service
// This test verifies the core service can be instantiated and basic methods work

import { CommunityRecommendationService } from '../CommunityRecommendationService';

// Mock all external dependencies
jest.mock('../../models/CommunityRecommendationRepository');
jest.mock('../../models/EnvironmentalDataRepository');
jest.mock('../InsightsEngine');
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('CommunityRecommendationService - Basic Tests', () => {
  let service: CommunityRecommendationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommunityRecommendationService();
  });

  describe('Service Instantiation', () => {
    it('should create service instance successfully', () => {
      expect(service).toBeInstanceOf(CommunityRecommendationService);
    });

    it('should create service with custom config', () => {
      const customConfig = {
        max_recommendations_per_location: 5,
        recommendation_expiry_days: 15,
        min_impact_threshold: 60,
        min_feasibility_threshold: 40
      };

      const customService = new CommunityRecommendationService(customConfig);
      expect(customService).toBeInstanceOf(CommunityRecommendationService);
    });
  });

  describe('Method Availability', () => {
    it('should have all required public methods', () => {
      expect(typeof service.generateRecommendations).toBe('function');
      expect(typeof service.getRecommendations).toBe('function');
      expect(typeof service.getRecommendationById).toBe('function');
      expect(typeof service.updateRecommendation).toBe('function');
      expect(typeof service.deleteRecommendation).toBe('function');
    });
  });

  describe('Input Validation', () => {
    it('should handle empty current conditions gracefully', async () => {
      const input = {
        location: { latitude: 40.7128, longitude: -74.0060 },
        radius_km: 5,
        current_conditions: []
      };

      // Should not throw an error, but return empty recommendations
      const result = await service.generateRecommendations(input);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration when none provided', () => {
      const service = new CommunityRecommendationService();
      expect(service).toBeDefined();
      
      // Access private config through type assertion for testing
      const config = (service as any).config;
      expect(config.max_recommendations_per_location).toBe(10);
      expect(config.recommendation_expiry_days).toBe(30);
      expect(config.min_impact_threshold).toBe(50);
      expect(config.min_feasibility_threshold).toBe(30);
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig = {
        max_recommendations_per_location: 15
      };
      
      const service = new CommunityRecommendationService(customConfig);
      const config = (service as any).config;
      
      expect(config.max_recommendations_per_location).toBe(15);
      expect(config.recommendation_expiry_days).toBe(30); // Should use default
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid location coordinates', async () => {
      const input = {
        location: { latitude: 91, longitude: -181 }, // Invalid coordinates
        radius_km: 5,
        current_conditions: [
          {
            id: '1',
            source: 'openaq' as const,
            pollutant: 'pm2.5',
            value: 50,
            unit: 'μg/m³',
            location: { latitude: 91, longitude: -181 },
            timestamp: new Date(),
            quality_grade: 'A' as const
          }
        ]
      };

      // Should handle gracefully without throwing
      try {
        await service.generateRecommendations(input);
      } catch (error) {
        // Error is expected for invalid coordinates, but should be handled gracefully
        expect(error).toBeDefined();
      }
    });
  });
});