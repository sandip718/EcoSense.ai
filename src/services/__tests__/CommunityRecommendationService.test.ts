// Tests for Community Recommendation Service
// Tests requirements 4.1, 4.2, 4.3, 4.4

import { CommunityRecommendationService } from '../CommunityRecommendationService';
import { CommunityRecommendationRepository } from '../../models/CommunityRecommendationRepository';
import { EnvironmentalDataRepository } from '../../models/EnvironmentalDataRepository';
import { InsightsEngine } from '../InsightsEngine';
import { 
  RecommendationAnalysisInput, 
  CommunityRecommendation, 
  CreateCommunityRecommendation,
  EnvironmentalDataPoint 
} from '../../models/types';

// Mock dependencies
jest.mock('../../models/CommunityRecommendationRepository');
jest.mock('../../models/EnvironmentalDataRepository');
jest.mock('../InsightsEngine');
jest.mock('../../utils/logger');

describe('CommunityRecommendationService', () => {
  let service: CommunityRecommendationService;
  let mockRecommendationRepo: jest.Mocked<CommunityRecommendationRepository>;
  let mockEnvironmentalDataRepo: jest.Mocked<EnvironmentalDataRepository>;
  let mockInsightsEngine: jest.Mocked<InsightsEngine>;

  const mockLocation = { latitude: 40.7128, longitude: -74.0060 };
  const mockRadiusKm = 5;

  const mockEnvironmentalData: EnvironmentalDataPoint[] = [
    {
      id: '1',
      source: 'openaq',
      pollutant: 'pm2.5',
      value: 45.5, // High PM2.5 level
      unit: 'μg/m³',
      location: mockLocation,
      timestamp: new Date(),
      quality_grade: 'A'
    },
    {
      id: '2',
      source: 'openaq',
      pollutant: 'no2',
      value: 85.2, // High NO2 level
      unit: 'μg/m³',
      location: mockLocation,
      timestamp: new Date(),
      quality_grade: 'A'
    }
  ];

  const mockCommunityProfile = {
    population_density: 1000,
    economic_level: 'medium' as const,
    infrastructure_quality: 'good' as const,
    environmental_awareness: 70
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRecommendationRepo = new CommunityRecommendationRepository() as jest.Mocked<CommunityRecommendationRepository>;
    mockEnvironmentalDataRepo = new EnvironmentalDataRepository() as jest.Mocked<EnvironmentalDataRepository>;
    mockInsightsEngine = new InsightsEngine() as jest.Mocked<InsightsEngine>;

    service = new CommunityRecommendationService();
    
    // Replace the private instances with mocks
    (service as any).recommendationRepo = mockRecommendationRepo;
    (service as any).environmentalDataRepo = mockEnvironmentalDataRepo;
    (service as any).insightsEngine = mockInsightsEngine;
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations for high pollution levels', async () => {
      // Arrange
      const input: RecommendationAnalysisInput = {
        location: mockLocation,
        radius_km: mockRadiusKm,
        current_conditions: mockEnvironmentalData,
        community_profile: mockCommunityProfile
      };

      const mockExistingRecommendations: CommunityRecommendation[] = [];
      const mockCreatedRecommendation: CommunityRecommendation = {
        id: 'rec-1',
        location: { ...mockLocation, radius: mockRadiusKm },
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
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRecommendationRepo.findByLocationAndPollutants.mockResolvedValue(mockExistingRecommendations);
      mockInsightsEngine.assessHealthImpact.mockResolvedValue({
        riskLevel: 'high',
        affectedPopulation: 1000,
        recommendations: ['Stay indoors', 'Use air purifiers']
      });
      mockRecommendationRepo.create.mockResolvedValue(mockCreatedRecommendation);

      // Act
      const result = await service.generateRecommendations(input);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockCreatedRecommendation);
      expect(mockRecommendationRepo.findByLocationAndPollutants).toHaveBeenCalledWith(
        mockLocation,
        mockRadiusKm,
        ['pm2.5', 'no2']
      );
      expect(mockInsightsEngine.assessHealthImpact).toHaveBeenCalledTimes(2); // Once for each pollutant
      expect(mockRecommendationRepo.create).toHaveBeenCalled();
    });

    it('should not generate recommendations for low pollution levels', async () => {
      // Arrange
      const lowPollutionData: EnvironmentalDataPoint[] = [
        {
          id: '1',
          source: 'openaq',
          pollutant: 'pm2.5',
          value: 5.0, // Low PM2.5 level
          unit: 'μg/m³',
          location: mockLocation,
          timestamp: new Date(),
          quality_grade: 'A'
        }
      ];

      const input: RecommendationAnalysisInput = {
        location: mockLocation,
        radius_km: mockRadiusKm,
        current_conditions: lowPollutionData
      };

      mockRecommendationRepo.findByLocationAndPollutants.mockResolvedValue([]);
      mockInsightsEngine.assessHealthImpact.mockResolvedValue({
        riskLevel: 'low',
        affectedPopulation: 100,
        recommendations: []
      });

      // Act
      const result = await service.generateRecommendations(input);

      // Assert
      expect(result).toHaveLength(0);
      expect(mockRecommendationRepo.create).not.toHaveBeenCalled();
    });

    it('should filter out duplicate recommendations', async () => {
      // Arrange
      const input: RecommendationAnalysisInput = {
        location: mockLocation,
        radius_km: mockRadiusKm,
        current_conditions: mockEnvironmentalData
      };

      const existingRecommendation: CommunityRecommendation = {
        id: 'existing-1',
        location: { ...mockLocation, radius: mockRadiusKm },
        priority: 'high',
        category: 'immediate_action',
        title: 'Reduce PM2.5 Exposure - Immediate Actions',
        description: 'Existing recommendation',
        steps: ['Step 1'],
        estimated_impact: 85,
        feasibility_score: 90,
        target_pollutants: ['pm2.5'],
        success_metrics: ['Metric 1'],
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRecommendationRepo.findByLocationAndPollutants.mockResolvedValue([existingRecommendation]);
      mockInsightsEngine.assessHealthImpact.mockResolvedValue({
        riskLevel: 'high',
        affectedPopulation: 1000,
        recommendations: ['Stay indoors']
      });

      // Act
      const result = await service.generateRecommendations(input);

      // Assert
      expect(result).toHaveLength(0); // Should filter out duplicates
      expect(mockRecommendationRepo.create).not.toHaveBeenCalled();
    });

    it('should adjust feasibility score based on community profile', async () => {
      // Arrange
      const highEconomicProfile = {
        ...mockCommunityProfile,
        economic_level: 'high' as const,
        infrastructure_quality: 'excellent' as const,
        environmental_awareness: 90
      };

      const input: RecommendationAnalysisInput = {
        location: mockLocation,
        radius_km: mockRadiusKm,
        current_conditions: mockEnvironmentalData,
        community_profile: highEconomicProfile
      };

      mockRecommendationRepo.findByLocationAndPollutants.mockResolvedValue([]);
      mockInsightsEngine.assessHealthImpact.mockResolvedValue({
        riskLevel: 'high',
        affectedPopulation: 1000,
        recommendations: ['Take action']
      });

      const mockCreatedRecommendation: CommunityRecommendation = {
        id: 'rec-1',
        location: { ...mockLocation, radius: mockRadiusKm },
        priority: 'high',
        category: 'long_term_strategy',
        title: 'Community Air Quality Improvement Strategy',
        description: 'Long-term strategy',
        steps: ['Step 1'],
        estimated_impact: 70,
        feasibility_score: 85, // Should be higher due to good community profile
        target_pollutants: ['pm2.5'],
        success_metrics: ['Metric 1'],
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRecommendationRepo.create.mockResolvedValue(mockCreatedRecommendation);

      // Act
      const result = await service.generateRecommendations(input);

      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(mockRecommendationRepo.create).toHaveBeenCalled();
      
      // Check that feasibility score was adjusted upward for high economic level
      const createCall = mockRecommendationRepo.create.mock.calls[0][0];
      expect(createCall.feasibility_score).toBeGreaterThan(50); // Base feasibility + adjustments
    });
  });

  describe('getRecommendations', () => {
    it('should retrieve recommendations with query parameters', async () => {
      // Arrange
      const query = {
        location: {
          latitude: mockLocation.latitude,
          longitude: mockLocation.longitude,
          radius_km: mockRadiusKm
        },
        priority: ['high', 'urgent'] as ('high' | 'urgent')[],
        active_only: true
      };

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

      mockRecommendationRepo.findMany.mockResolvedValue(mockResponse);

      // Act
      const result = await service.getRecommendations(query);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockRecommendationRepo.findMany).toHaveBeenCalledWith(query);
    });
  });

  describe('getRecommendationById', () => {
    it('should retrieve a recommendation by ID', async () => {
      // Arrange
      const recommendationId = 'rec-123';
      const mockRecommendation: CommunityRecommendation = {
        id: recommendationId,
        location: { ...mockLocation, radius: mockRadiusKm },
        priority: 'high',
        category: 'immediate_action',
        title: 'Test Recommendation',
        description: 'Test description',
        steps: ['Step 1'],
        estimated_impact: 80,
        feasibility_score: 75,
        target_pollutants: ['pm2.5'],
        success_metrics: ['Metric 1'],
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRecommendationRepo.findById.mockResolvedValue(mockRecommendation);

      // Act
      const result = await service.getRecommendationById(recommendationId);

      // Assert
      expect(result).toEqual(mockRecommendation);
      expect(mockRecommendationRepo.findById).toHaveBeenCalledWith(recommendationId);
    });

    it('should return null for non-existent recommendation', async () => {
      // Arrange
      const recommendationId = 'non-existent';
      mockRecommendationRepo.findById.mockResolvedValue(null);

      // Act
      const result = await service.getRecommendationById(recommendationId);

      // Assert
      expect(result).toBeNull();
      expect(mockRecommendationRepo.findById).toHaveBeenCalledWith(recommendationId);
    });
  });

  describe('updateRecommendation', () => {
    it('should update a recommendation', async () => {
      // Arrange
      const recommendationId = 'rec-123';
      const updates: Partial<CreateCommunityRecommendation> = {
        priority: 'urgent',
        title: 'Updated Title'
      };

      const mockUpdatedRecommendation: CommunityRecommendation = {
        id: recommendationId,
        location: { ...mockLocation, radius: mockRadiusKm },
        priority: 'urgent',
        category: 'immediate_action',
        title: 'Updated Title',
        description: 'Test description',
        steps: ['Step 1'],
        estimated_impact: 80,
        feasibility_score: 75,
        target_pollutants: ['pm2.5'],
        success_metrics: ['Metric 1'],
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRecommendationRepo.update.mockResolvedValue(mockUpdatedRecommendation);

      // Act
      const result = await service.updateRecommendation(recommendationId, updates);

      // Assert
      expect(result).toEqual(mockUpdatedRecommendation);
      expect(mockRecommendationRepo.update).toHaveBeenCalledWith(recommendationId, updates);
    });
  });

  describe('deleteRecommendation', () => {
    it('should delete a recommendation', async () => {
      // Arrange
      const recommendationId = 'rec-123';
      mockRecommendationRepo.delete.mockResolvedValue(true);

      // Act
      const result = await service.deleteRecommendation(recommendationId);

      // Assert
      expect(result).toBe(true);
      expect(mockRecommendationRepo.delete).toHaveBeenCalledWith(recommendationId);
    });

    it('should return false for non-existent recommendation', async () => {
      // Arrange
      const recommendationId = 'non-existent';
      mockRecommendationRepo.delete.mockResolvedValue(false);

      // Act
      const result = await service.deleteRecommendation(recommendationId);

      // Assert
      expect(result).toBe(false);
      expect(mockRecommendationRepo.delete).toHaveBeenCalledWith(recommendationId);
    });
  });

  describe('recommendation prioritization', () => {
    it('should prioritize urgent recommendations over others', async () => {
      // Arrange
      const veryHighPollutionData: EnvironmentalDataPoint[] = [
        {
          id: '1',
          source: 'openaq',
          pollutant: 'pm2.5',
          value: 150.0, // Very high PM2.5 level
          unit: 'μg/m³',
          location: mockLocation,
          timestamp: new Date(),
          quality_grade: 'A'
        }
      ];

      const input: RecommendationAnalysisInput = {
        location: mockLocation,
        radius_km: mockRadiusKm,
        current_conditions: veryHighPollutionData
      };

      mockRecommendationRepo.findByLocationAndPollutants.mockResolvedValue([]);
      mockInsightsEngine.assessHealthImpact.mockResolvedValue({
        riskLevel: 'very_high',
        affectedPopulation: 2000,
        recommendations: ['Emergency measures']
      });

      const mockUrgentRecommendation: CommunityRecommendation = {
        id: 'urgent-rec',
        location: { ...mockLocation, radius: mockRadiusKm },
        priority: 'urgent',
        category: 'immediate_action',
        title: 'Emergency PM2.5 Response',
        description: 'Emergency response needed',
        steps: ['Emergency step'],
        estimated_impact: 95,
        feasibility_score: 85,
        target_pollutants: ['pm2.5'],
        success_metrics: ['Emergency metric'],
        created_at: new Date(),
        updated_at: new Date()
      };

      mockRecommendationRepo.create.mockResolvedValue(mockUrgentRecommendation);

      // Act
      const result = await service.generateRecommendations(input);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe('urgent');
      expect(result[0].category).toBe('immediate_action');
    });
  });

  describe('error handling', () => {
    it('should handle repository errors gracefully', async () => {
      // Arrange
      const input: RecommendationAnalysisInput = {
        location: mockLocation,
        radius_km: mockRadiusKm,
        current_conditions: mockEnvironmentalData
      };

      mockRecommendationRepo.findByLocationAndPollutants.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act & Assert
      await expect(service.generateRecommendations(input)).rejects.toThrow(
        'Failed to generate community recommendations'
      );
    });

    it('should handle insights engine errors gracefully', async () => {
      // Arrange
      const input: RecommendationAnalysisInput = {
        location: mockLocation,
        radius_km: mockRadiusKm,
        current_conditions: mockEnvironmentalData
      };

      mockRecommendationRepo.findByLocationAndPollutants.mockResolvedValue([]);
      mockInsightsEngine.assessHealthImpact.mockRejectedValue(
        new Error('Health assessment failed')
      );

      // Act
      const result = await service.generateRecommendations(input);

      // Assert
      // Should still generate recommendations with default severity assessment
      expect(result).toBeDefined();
    });
  });
});