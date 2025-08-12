import request from 'supertest';
import express from 'express';
import imageAnalysisRoutes from '../../routes/imageAnalysis';
import { ImageAnalysisService } from '../ImageAnalysisService';
import { ImageStorageService } from '../ImageStorageService';
import { AIAnalysisService } from '../AIAnalysisService';

// Mock dependencies
jest.mock('../ImageAnalysisService');
jest.mock('../ImageStorageService');
jest.mock('../AIAnalysisService');
jest.mock('../../utils/logger');

describe('Image Analysis Integration', () => {
  let app: express.Application;
  let mockImageAnalysisService: jest.Mocked<ImageAnalysisService>;
  let mockImageStorageService: jest.Mocked<ImageStorageService>;

  beforeEach(() => {
    // Setup Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/images', imageAnalysisRoutes);

    // Get mocked instances
    mockImageAnalysisService = ImageAnalysisService.prototype as jest.Mocked<ImageAnalysisService>;
    mockImageStorageService = ImageStorageService.prototype as jest.Mocked<ImageStorageService>;

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('POST /api/images/upload', () => {
    it('should handle image upload successfully', async () => {
      // Arrange
      const mockImageAnalysis = {
        id: 'test-id-123',
        user_id: 'user-123',
        image_url: 'https://example.com/image.jpg',
        status: 'pending',
        upload_timestamp: new Date(),
        location: { latitude: 40.7128, longitude: -74.0060 }
      };

      mockImageStorageService.storeImage.mockResolvedValue('https://example.com/image.jpg');
      mockImageAnalysisService.createImageAnalysis.mockResolvedValue(mockImageAnalysis as any);
      mockImageAnalysisService.processImageAnalysis.mockResolvedValue(undefined);

      // Create a simple test image buffer
      const testImageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG header

      // Act
      const response = await request(app)
        .post('/api/images/upload')
        .field('userId', 'user-123')
        .field('latitude', '40.7128')
        .field('longitude', '-74.0060')
        .attach('image', testImageBuffer, 'test.jpg');

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('imageUrl');
      expect(response.body.data).toHaveProperty('status', 'pending');
    });

    it('should return 400 when no image file is provided', async () => {
      // Act
      const response = await request(app)
        .post('/api/images/upload')
        .field('userId', 'user-123');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('message', 'No image file provided');
    });

    it('should return 401 when no user ID is provided', async () => {
      // Arrange
      const testImageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);

      // Act
      const response = await request(app)
        .post('/api/images/upload')
        .attach('image', testImageBuffer, 'test.jpg');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty('message', 'User ID is required');
    });
  });

  describe('GET /api/images/:id', () => {
    it('should retrieve image analysis by ID', async () => {
      // Arrange
      const mockImageAnalysis = {
        id: 'test-id-123',
        user_id: 'user-123',
        image_url: 'https://example.com/image.jpg',
        status: 'completed',
        upload_timestamp: new Date(),
        analysis_results: {
          pollution_indicators: {
            air_quality: {
              smog_density: 0.3,
              visibility: 0.8,
              confidence: 0.9
            }
          },
          overall_score: 0.75,
          recommendations: ['Air quality is good']
        }
      };

      mockImageAnalysisService.getImageAnalysis.mockResolvedValue(mockImageAnalysis as any);

      // Act
      const response = await request(app)
        .get('/api/images/test-id-123');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockImageAnalysis);
    });

    it('should return 404 when image analysis not found', async () => {
      // Arrange
      mockImageAnalysisService.getImageAnalysis.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .get('/api/images/non-existent-id');

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.error).toHaveProperty('message', 'Image analysis not found');
    });
  });

  describe('GET /api/images/:id/status', () => {
    it('should retrieve analysis status', async () => {
      // Arrange
      const mockImageAnalysis = {
        id: 'test-id-123',
        status: 'processing',
        upload_timestamp: new Date(),
        analysis_results: null
      };

      mockImageAnalysisService.getImageAnalysis.mockResolvedValue(mockImageAnalysis as any);

      // Act
      const response = await request(app)
        .get('/api/images/test-id-123/status');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('processing');
      expect(response.body.data.analysisResults).toBeNull();
    });
  });

  describe('GET /api/images/user/:userId', () => {
    it('should retrieve user image analyses', async () => {
      // Arrange
      const mockImageAnalyses = [
        {
          id: 'test-id-1',
          user_id: 'user-123',
          status: 'completed'
        },
        {
          id: 'test-id-2',
          user_id: 'user-123',
          status: 'pending'
        }
      ];

      mockImageAnalysisService.getUserImageAnalyses.mockResolvedValue(mockImageAnalyses as any);

      // Act
      const response = await request(app)
        .get('/api/images/user/user-123');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should handle pagination parameters', async () => {
      // Arrange
      mockImageAnalysisService.getUserImageAnalyses.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get('/api/images/user/user-123?limit=10&offset=20');

      // Assert
      expect(response.status).toBe(200);
      expect(mockImageAnalysisService.getUserImageAnalyses).toHaveBeenCalledWith('user-123', 10, 20);
    });
  });
});