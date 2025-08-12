import { AIAnalysisService } from '../AIAnalysisService';
import { Location } from '../../models/types';

// Mock logger
jest.mock('../../utils/logger');

describe('AIAnalysisService', () => {
  let aiAnalysisService: AIAnalysisService;

  beforeEach(() => {
    aiAnalysisService = new AIAnalysisService();
  });

  describe('analyzeEnvironmentalImage', () => {
    it('should analyze image and return pollution indicators', async () => {
      // Arrange
      const imageUrl = 'https://example.com/test-image.jpg';
      const location: Location = { latitude: 40.7128, longitude: -74.0060 };

      // Act
      const result = await aiAnalysisService.analyzeEnvironmentalImage(imageUrl, location);

      // Assert
      expect(result).toHaveProperty('pollution_indicators');
      expect(result).toHaveProperty('overall_score');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('processing_metadata');

      expect(typeof result.overall_score).toBe('number');
      expect(result.overall_score).toBeGreaterThanOrEqual(0);
      expect(result.overall_score).toBeLessThanOrEqual(1);

      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.processing_metadata?.model_version).toBe('mock-v1.0.0');
    });

    it('should include air quality indicators when enabled', async () => {
      // Arrange
      const imageUrl = 'https://example.com/air-quality-test.jpg';

      // Act
      const result = await aiAnalysisService.analyzeEnvironmentalImage(imageUrl);

      // Assert
      expect(result.pollution_indicators).toHaveProperty('air_quality');
      expect(result.pollution_indicators.air_quality).toHaveProperty('smog_density');
      expect(result.pollution_indicators.air_quality).toHaveProperty('visibility');
      expect(result.pollution_indicators.air_quality).toHaveProperty('confidence');

      const airQuality = result.pollution_indicators.air_quality!;
      expect(airQuality.smog_density).toBeGreaterThanOrEqual(0);
      expect(airQuality.smog_density).toBeLessThanOrEqual(1);
      expect(airQuality.visibility).toBeGreaterThanOrEqual(0);
      expect(airQuality.visibility).toBeLessThanOrEqual(1);
      expect(airQuality.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('should include water quality indicators when enabled', async () => {
      // Arrange
      const imageUrl = 'https://example.com/water-quality-test.jpg';

      // Act
      const result = await aiAnalysisService.analyzeEnvironmentalImage(imageUrl);

      // Assert
      expect(result.pollution_indicators).toHaveProperty('water_quality');
      expect(result.pollution_indicators.water_quality).toHaveProperty('turbidity');
      expect(result.pollution_indicators.water_quality).toHaveProperty('color_index');
      expect(result.pollution_indicators.water_quality).toHaveProperty('confidence');

      const waterQuality = result.pollution_indicators.water_quality!;
      expect(waterQuality.turbidity).toBeGreaterThanOrEqual(0);
      expect(waterQuality.turbidity).toBeLessThanOrEqual(1);
      expect(waterQuality.color_index).toBeGreaterThanOrEqual(0);
      expect(waterQuality.color_index).toBeLessThanOrEqual(1);
      expect(waterQuality.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should include visual contamination indicators when enabled', async () => {
      // Arrange
      const imageUrl = 'https://example.com/contamination-test.jpg';

      // Act
      const result = await aiAnalysisService.analyzeEnvironmentalImage(imageUrl);

      // Assert
      expect(result.pollution_indicators).toHaveProperty('visual_contamination');
      expect(result.pollution_indicators.visual_contamination).toHaveProperty('detected');
      expect(result.pollution_indicators.visual_contamination).toHaveProperty('type');
      expect(result.pollution_indicators.visual_contamination).toHaveProperty('confidence');

      const contamination = result.pollution_indicators.visual_contamination!;
      expect(typeof contamination.detected).toBe('boolean');
      expect(typeof contamination.type).toBe('string');
      expect(contamination.confidence).toBeGreaterThanOrEqual(0.4);
    });

    it('should generate consistent results for the same image URL', async () => {
      // Arrange
      const imageUrl = 'https://example.com/consistent-test.jpg';

      // Act
      const result1 = await aiAnalysisService.analyzeEnvironmentalImage(imageUrl);
      const result2 = await aiAnalysisService.analyzeEnvironmentalImage(imageUrl);

      // Assert
      expect(result1.overall_score).toBe(result2.overall_score);
      expect(result1.pollution_indicators.air_quality?.smog_density)
        .toBe(result2.pollution_indicators.air_quality?.smog_density);
    });

    it('should generate different results for different image URLs', async () => {
      // Arrange
      const imageUrl1 = 'https://example.com/test1.jpg';
      const imageUrl2 = 'https://example.com/test2.jpg';

      // Act
      const result1 = await aiAnalysisService.analyzeEnvironmentalImage(imageUrl1);
      const result2 = await aiAnalysisService.analyzeEnvironmentalImage(imageUrl2);

      // Assert
      // Results should be different (with very high probability)
      expect(result1.overall_score).not.toBe(result2.overall_score);
    });

    it('should include location-specific recommendations when location provided', async () => {
      // Arrange
      const imageUrl = 'https://example.com/location-test.jpg';
      const location: Location = { 
        latitude: 45.0, 
        longitude: -75.0, 
        address: 'Industrial River Area' 
      };

      // Act
      const result = await aiAnalysisService.analyzeEnvironmentalImage(imageUrl, location);

      // Assert
      expect(result.recommendations.length).toBeGreaterThan(0);
      
      // Should include location-specific recommendations
      const hasLocationRecommendation = result.recommendations.some(rec => 
        rec.includes('industrial') || rec.includes('river') || rec.includes('seasonal')
      );
      expect(hasLocationRecommendation).toBe(true);
    });
  });

  describe('getModelVersion', () => {
    it('should return the current model version', () => {
      // Act
      const version = aiAnalysisService.getModelVersion();

      // Assert
      expect(version).toBe('mock-v1.0.0');
    });
  });

  describe('updateConfig', () => {
    it('should update analysis configuration', () => {
      // Arrange
      const newConfig = {
        confidenceThreshold: 0.8,
        enabledIndicators: {
          airQuality: false,
          waterQuality: true,
          visualContamination: true
        }
      };

      // Act
      aiAnalysisService.updateConfig(newConfig);

      // Assert
      const config = aiAnalysisService.getConfig();
      expect(config.confidenceThreshold).toBe(0.8);
      expect(config.enabledIndicators.airQuality).toBe(false);
      expect(config.enabledIndicators.waterQuality).toBe(true);
      expect(config.enabledIndicators.visualContamination).toBe(true);
    });

    it('should partially update configuration', () => {
      // Arrange
      const originalConfig = aiAnalysisService.getConfig();
      const partialUpdate = { confidenceThreshold: 0.9 };

      // Act
      aiAnalysisService.updateConfig(partialUpdate);

      // Assert
      const updatedConfig = aiAnalysisService.getConfig();
      expect(updatedConfig.confidenceThreshold).toBe(0.9);
      expect(updatedConfig.enabledIndicators).toEqual(originalConfig.enabledIndicators);
      expect(updatedConfig.modelVersion).toBe(originalConfig.modelVersion);
    });
  });

  describe('validateImageForAnalysis', () => {
    it('should validate valid HTTP image URL', async () => {
      // Arrange
      const imageUrl = 'https://example.com/valid-image.jpg';

      // Act
      const result = await aiAnalysisService.validateImageForAnalysis(imageUrl);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate valid HTTPS image URL', async () => {
      // Arrange
      const imageUrl = 'http://example.com/valid-image.jpg';

      // Act
      const result = await aiAnalysisService.validateImageForAnalysis(imageUrl);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid URL format', async () => {
      // Arrange
      const imageUrl = 'not-a-valid-url';

      // Act
      const result = await aiAnalysisService.validateImageForAnalysis(imageUrl);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Image URL must be a valid HTTP/HTTPS URL');
    });

    it('should reject empty or null URL', async () => {
      // Act
      const result1 = await aiAnalysisService.validateImageForAnalysis('');
      const result2 = await aiAnalysisService.validateImageForAnalysis(null as any);

      // Assert
      expect(result1.isValid).toBe(false);
      expect(result1.error).toBe('Invalid image URL provided');
      expect(result2.isValid).toBe(false);
      expect(result2.error).toBe('Invalid image URL provided');
    });

    it('should warn about localhost URLs', async () => {
      // Arrange
      const imageUrl = 'http://localhost:3000/image.jpg';

      // Act
      const result = await aiAnalysisService.validateImageForAnalysis(imageUrl);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Using localhost URL - may not be accessible in production');
    });
  });

  describe('getSupportedAnalysisTypes', () => {
    it('should return all enabled analysis types by default', () => {
      // Act
      const types = aiAnalysisService.getSupportedAnalysisTypes();

      // Assert
      expect(types).toContain('air_quality');
      expect(types).toContain('water_quality');
      expect(types).toContain('visual_contamination');
      expect(types).toHaveLength(3);
    });

    it('should return only enabled analysis types', () => {
      // Arrange
      aiAnalysisService.updateConfig({
        enabledIndicators: {
          airQuality: true,
          waterQuality: false,
          visualContamination: true
        }
      });

      // Act
      const types = aiAnalysisService.getSupportedAnalysisTypes();

      // Assert
      expect(types).toContain('air_quality');
      expect(types).toContain('visual_contamination');
      expect(types).not.toContain('water_quality');
      expect(types).toHaveLength(2);
    });
  });

  describe('confidence threshold management', () => {
    it('should get current confidence threshold', () => {
      // Act
      const threshold = aiAnalysisService.getConfidenceThreshold();

      // Assert
      expect(threshold).toBe(0.6); // Default value
    });

    it('should set valid confidence threshold', () => {
      // Arrange
      const newThreshold = 0.8;

      // Act
      aiAnalysisService.setConfidenceThreshold(newThreshold);

      // Assert
      expect(aiAnalysisService.getConfidenceThreshold()).toBe(newThreshold);
    });

    it('should reject invalid confidence threshold values', () => {
      // Act & Assert
      expect(() => aiAnalysisService.setConfidenceThreshold(-0.1))
        .toThrow('Confidence threshold must be between 0 and 1');
      
      expect(() => aiAnalysisService.setConfidenceThreshold(1.1))
        .toThrow('Confidence threshold must be between 0 and 1');
    });

    it('should accept boundary confidence threshold values', () => {
      // Act & Assert
      expect(() => aiAnalysisService.setConfidenceThreshold(0)).not.toThrow();
      expect(() => aiAnalysisService.setConfidenceThreshold(1)).not.toThrow();
      
      aiAnalysisService.setConfidenceThreshold(0);
      expect(aiAnalysisService.getConfidenceThreshold()).toBe(0);
      
      aiAnalysisService.setConfidenceThreshold(1);
      expect(aiAnalysisService.getConfidenceThreshold()).toBe(1);
    });
  });
});