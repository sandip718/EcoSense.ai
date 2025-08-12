import { ImageAnalysisService } from '../ImageAnalysisService';
import { ImageAnalysisRepository } from '../../models/ImageAnalysisRepository';
import { AIAnalysisService } from '../AIAnalysisService';
import { ImageStorageService } from '../ImageStorageService';
import { ImageAnalysis, Location } from '../../models/types';

// Mock dependencies
jest.mock('../../models/ImageAnalysisRepository');
jest.mock('../AIAnalysisService');
jest.mock('../ImageStorageService');
jest.mock('../../utils/logger');

describe('ImageAnalysisService', () => {
  let imageAnalysisService: ImageAnalysisService;
  let mockImageAnalysisRepository: jest.Mocked<ImageAnalysisRepository>;
  let mockAIAnalysisService: jest.Mocked<AIAnalysisService>;
  let mockImageStorageService: jest.Mocked<ImageStorageService>;

  const mockImageAnalysis: ImageAnalysis = {
    id: 'test-id-123',
    user_id: 'user-123',
    image_url: 'https://example.com/image.jpg',
    location: { latitude: 40.7128, longitude: -74.0060 },
    upload_timestamp: new Date('2024-01-01T12:00:00Z'),
    analysis_results: {
      pollution_indicators: {
        air_quality: {
          smog_density: 0.3,
          visibility: 0.8,
          confidence: 0.9
        }
      },
      overall_score: 0.75,
      recommendations: ['Air quality is good for outdoor activities']
    },
    overall_score: 0.75,
    status: 'completed',
    created_at: new Date('2024-01-01T12:00:00Z')
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create service instance
    imageAnalysisService = new ImageAnalysisService();

    // Get mocked instances
    mockImageAnalysisRepository = ImageAnalysisRepository.prototype as jest.Mocked<ImageAnalysisRepository>;
    mockAIAnalysisService = AIAnalysisService.prototype as jest.Mocked<AIAnalysisService>;
    mockImageStorageService = ImageStorageService.prototype as jest.Mocked<ImageStorageService>;
  });

  describe('createImageAnalysis', () => {
    it('should create a new image analysis record', async () => {
      // Arrange
      const request = {
        userId: 'user-123',
        imageUrl: 'https://example.com/image.jpg',
        location: { latitude: 40.7128, longitude: -74.0060 },
        uploadTimestamp: new Date('2024-01-01T12:00:00Z')
      };

      mockImageAnalysisRepository.create.mockResolvedValue(mockImageAnalysis);

      // Act
      const result = await imageAnalysisService.createImageAnalysis(request);

      // Assert
      expect(result).toEqual(mockImageAnalysis);
      expect(mockImageAnalysisRepository.create).toHaveBeenCalledWith({
        user_id: request.userId,
        image_url: request.imageUrl,
        location: request.location,
        upload_timestamp: request.uploadTimestamp,
        analysis_results: expect.objectContaining({
          pollution_indicators: {},
          overall_score: 0,
          recommendations: []
        }),
        status: 'pending'
      });
    });

    it('should handle creation errors', async () => {
      // Arrange
      const request = {
        userId: 'user-123',
        imageUrl: 'https://example.com/image.jpg',
        uploadTimestamp: new Date()
      };

      mockImageAnalysisRepository.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(imageAnalysisService.createImageAnalysis(request))
        .rejects.toThrow('Failed to create image analysis record');
    });
  });

  describe('getImageAnalysis', () => {
    it('should retrieve image analysis by ID', async () => {
      // Arrange
      const id = 'test-id-123';
      mockImageAnalysisRepository.findById.mockResolvedValue(mockImageAnalysis);

      // Act
      const result = await imageAnalysisService.getImageAnalysis(id);

      // Assert
      expect(result).toEqual(mockImageAnalysis);
      expect(mockImageAnalysisRepository.findById).toHaveBeenCalledWith(id);
    });

    it('should return null when image analysis not found', async () => {
      // Arrange
      const id = 'non-existent-id';
      mockImageAnalysisRepository.findById.mockResolvedValue(null);

      // Act
      const result = await imageAnalysisService.getImageAnalysis(id);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle retrieval errors', async () => {
      // Arrange
      const id = 'test-id-123';
      mockImageAnalysisRepository.findById.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(imageAnalysisService.getImageAnalysis(id))
        .rejects.toThrow('Failed to retrieve image analysis');
    });
  });

  describe('getUserImageAnalyses', () => {
    it('should retrieve user image analyses with default pagination', async () => {
      // Arrange
      const userId = 'user-123';
      const mockAnalyses = [mockImageAnalysis];
      mockImageAnalysisRepository.findByUserId.mockResolvedValue(mockAnalyses);

      // Act
      const result = await imageAnalysisService.getUserImageAnalyses(userId);

      // Assert
      expect(result).toEqual(mockAnalyses);
      expect(mockImageAnalysisRepository.findByUserId).toHaveBeenCalledWith(userId, 50, 0);
    });

    it('should retrieve user image analyses with custom pagination', async () => {
      // Arrange
      const userId = 'user-123';
      const limit = 10;
      const offset = 20;
      const mockAnalyses = [mockImageAnalysis];
      mockImageAnalysisRepository.findByUserId.mockResolvedValue(mockAnalyses);

      // Act
      const result = await imageAnalysisService.getUserImageAnalyses(userId, limit, offset);

      // Assert
      expect(result).toEqual(mockAnalyses);
      expect(mockImageAnalysisRepository.findByUserId).toHaveBeenCalledWith(userId, limit, offset);
    });
  });

  describe('processImageAnalysis', () => {
    it('should process image analysis successfully', async () => {
      // Arrange
      const imageAnalysisId = 'test-id-123';
      const mockAnalysisResults = {
        pollution_indicators: {
          air_quality: {
            smog_density: 0.3,
            visibility: 0.8,
            confidence: 0.9
          }
        },
        overall_score: 0.75,
        recommendations: ['Air quality is good']
      };

      mockImageAnalysisRepository.updateStatus.mockResolvedValue(mockImageAnalysis);
      mockImageAnalysisRepository.findById.mockResolvedValue(mockImageAnalysis);
      mockAIAnalysisService.analyzeEnvironmentalImage.mockResolvedValue(mockAnalysisResults);
      mockAIAnalysisService.getModelVersion.mockReturnValue('mock-v1.0.0');
      mockImageAnalysisRepository.update.mockResolvedValue(mockImageAnalysis);

      // Act
      await imageAnalysisService.processImageAnalysis(imageAnalysisId);

      // Assert
      expect(mockImageAnalysisRepository.updateStatus).toHaveBeenCalledWith(imageAnalysisId, 'processing');
      expect(mockAIAnalysisService.analyzeEnvironmentalImage).toHaveBeenCalledWith(
        mockImageAnalysis.image_url,
        mockImageAnalysis.location
      );
      expect(mockImageAnalysisRepository.update).toHaveBeenCalledWith(imageAnalysisId, {
        analysis_results: expect.objectContaining({
          ...mockAnalysisResults,
          processing_metadata: expect.objectContaining({
            model_version: 'mock-v1.0.0',
            processing_time_ms: expect.any(Number)
          })
        }),
        overall_score: mockAnalysisResults.overall_score,
        status: 'completed'
      });
    });

    it('should handle processing errors and update status to failed', async () => {
      // Arrange
      const imageAnalysisId = 'test-id-123';
      
      mockImageAnalysisRepository.updateStatus.mockResolvedValue(mockImageAnalysis);
      mockImageAnalysisRepository.findById.mockResolvedValue(mockImageAnalysis);
      mockAIAnalysisService.analyzeEnvironmentalImage.mockRejectedValue(new Error('AI processing failed'));

      // Act
      await imageAnalysisService.processImageAnalysis(imageAnalysisId);

      // Assert
      expect(mockImageAnalysisRepository.updateStatus).toHaveBeenCalledWith(imageAnalysisId, 'processing');
      expect(mockImageAnalysisRepository.updateStatus).toHaveBeenCalledWith(imageAnalysisId, 'failed');
    });

    it('should handle case when image analysis record not found', async () => {
      // Arrange
      const imageAnalysisId = 'non-existent-id';
      
      mockImageAnalysisRepository.updateStatus.mockResolvedValue(null);
      mockImageAnalysisRepository.findById.mockResolvedValue(null);

      // Act
      await imageAnalysisService.processImageAnalysis(imageAnalysisId);

      // Assert
      expect(mockImageAnalysisRepository.updateStatus).toHaveBeenCalledWith(imageAnalysisId, 'failed');
    });
  });

  describe('getPendingAnalyses', () => {
    it('should retrieve pending analyses with default limit', async () => {
      // Arrange
      const mockPendingAnalyses = [{ ...mockImageAnalysis, status: 'pending' as const }];
      mockImageAnalysisRepository.findPendingAnalyses.mockResolvedValue(mockPendingAnalyses);

      // Act
      const result = await imageAnalysisService.getPendingAnalyses();

      // Assert
      expect(result).toEqual(mockPendingAnalyses);
      expect(mockImageAnalysisRepository.findPendingAnalyses).toHaveBeenCalledWith(10);
    });

    it('should retrieve pending analyses with custom limit', async () => {
      // Arrange
      const limit = 5;
      const mockPendingAnalyses = [{ ...mockImageAnalysis, status: 'pending' as const }];
      mockImageAnalysisRepository.findPendingAnalyses.mockResolvedValue(mockPendingAnalyses);

      // Act
      const result = await imageAnalysisService.getPendingAnalyses(limit);

      // Assert
      expect(result).toEqual(mockPendingAnalyses);
      expect(mockImageAnalysisRepository.findPendingAnalyses).toHaveBeenCalledWith(limit);
    });
  });

  describe('deleteImageAnalysis', () => {
    it('should delete image analysis and associated file', async () => {
      // Arrange
      const id = 'test-id-123';
      const userId = 'user-123';
      
      mockImageAnalysisRepository.findById.mockResolvedValue(mockImageAnalysis);
      mockImageStorageService.deleteImage.mockResolvedValue(true);
      mockImageAnalysisRepository.delete.mockResolvedValue(true);

      // Act
      const result = await imageAnalysisService.deleteImageAnalysis(id, userId);

      // Assert
      expect(result).toBe(true);
      expect(mockImageStorageService.deleteImage).toHaveBeenCalledWith(mockImageAnalysis.image_url);
      expect(mockImageAnalysisRepository.delete).toHaveBeenCalledWith(id);
    });

    it('should return false when image analysis not found', async () => {
      // Arrange
      const id = 'non-existent-id';
      const userId = 'user-123';
      
      mockImageAnalysisRepository.findById.mockResolvedValue(null);

      // Act
      const result = await imageAnalysisService.deleteImageAnalysis(id, userId);

      // Assert
      expect(result).toBe(false);
      expect(mockImageStorageService.deleteImage).not.toHaveBeenCalled();
      expect(mockImageAnalysisRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw error when user does not own the analysis', async () => {
      // Arrange
      const id = 'test-id-123';
      const userId = 'different-user';
      
      mockImageAnalysisRepository.findById.mockResolvedValue(mockImageAnalysis);

      // Act & Assert
      await expect(imageAnalysisService.deleteImageAnalysis(id, userId))
        .rejects.toThrow('Unauthorized: User does not own this image analysis');
    });
  });

  describe('getUserAnalysisStats', () => {
    it('should calculate user analysis statistics', async () => {
      // Arrange
      const userId = 'user-123';
      const mockAnalyses = [
        { ...mockImageAnalysis, status: 'completed' as const, overall_score: 0.8 },
        { ...mockImageAnalysis, status: 'completed' as const, overall_score: 0.6 },
        { ...mockImageAnalysis, status: 'pending' as const },
        { ...mockImageAnalysis, status: 'failed' as const }
      ];
      
      mockImageAnalysisRepository.findByUserId.mockResolvedValue(mockAnalyses);

      // Act
      const result = await imageAnalysisService.getUserAnalysisStats(userId);

      // Assert
      expect(result).toEqual({
        total: 4,
        completed: 2,
        pending: 1,
        failed: 1,
        averageScore: 0.7 // (0.8 + 0.6) / 2
      });
    });

    it('should handle case with no scored analyses', async () => {
      // Arrange
      const userId = 'user-123';
      const mockAnalyses = [
        { ...mockImageAnalysis, status: 'pending' as const },
        { ...mockImageAnalysis, status: 'failed' as const }
      ];
      
      mockImageAnalysisRepository.findByUserId.mockResolvedValue(mockAnalyses);

      // Act
      const result = await imageAnalysisService.getUserAnalysisStats(userId);

      // Assert
      expect(result).toEqual({
        total: 2,
        completed: 0,
        pending: 1,
        failed: 1,
        averageScore: undefined
      });
    });
  });
});