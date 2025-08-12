import { ImageAnalysisRepository } from '../models/ImageAnalysisRepository';
import { AIAnalysisService } from './AIAnalysisService';
import { ImageStorageService } from './ImageStorageService';
import { logger } from '../utils/logger';
import {
  ImageAnalysis,
  CreateImageAnalysis,
  ImageAnalysisResults,
  Location
} from '../models/types';

export interface CreateImageAnalysisRequest {
  userId: string;
  imageUrl: string;
  location?: Location;
  uploadTimestamp: Date;
  originalFilename?: string;
  fileSize?: number;
  mimeType?: string;
}

export class ImageAnalysisService {
  private imageAnalysisRepository: ImageAnalysisRepository;
  private aiAnalysisService: AIAnalysisService;
  private imageStorageService: ImageStorageService;

  constructor() {
    this.imageAnalysisRepository = new ImageAnalysisRepository();
    this.aiAnalysisService = new AIAnalysisService();
    this.imageStorageService = new ImageStorageService();
  }

  /**
   * Create a new image analysis record
   * @param request Image analysis creation request
   * @returns Created image analysis record
   */
  async createImageAnalysis(request: CreateImageAnalysisRequest): Promise<ImageAnalysis> {
    try {
      // Create initial analysis record with pending status
      const createData: CreateImageAnalysis = {
        user_id: request.userId,
        image_url: request.imageUrl,
        location: request.location,
        upload_timestamp: request.uploadTimestamp,
        analysis_results: {
          pollution_indicators: {},
          overall_score: 0,
          recommendations: [],
          processing_metadata: {
            model_version: 'pending',
            processing_time_ms: 0,
            image_quality_score: 0
          }
        },
        status: 'pending'
      };

      const imageAnalysis = await this.imageAnalysisRepository.create(createData);
      
      logger.info(`Created image analysis record: ${imageAnalysis.id}`);
      return imageAnalysis;

    } catch (error) {
      logger.error('Error creating image analysis:', error);
      throw new Error('Failed to create image analysis record');
    }
  }

  /**
   * Get image analysis by ID
   * @param id Image analysis ID
   * @returns Image analysis record or null if not found
   */
  async getImageAnalysis(id: string): Promise<ImageAnalysis | null> {
    try {
      return await this.imageAnalysisRepository.findById(id);
    } catch (error) {
      logger.error('Error retrieving image analysis:', error);
      throw new Error('Failed to retrieve image analysis');
    }
  }

  /**
   * Get all image analyses for a user
   * @param userId User ID
   * @param limit Maximum number of results
   * @param offset Offset for pagination
   * @returns Array of image analysis records
   */
  async getUserImageAnalyses(userId: string, limit: number = 50, offset: number = 0): Promise<ImageAnalysis[]> {
    try {
      return await this.imageAnalysisRepository.findByUserId(userId, limit, offset);
    } catch (error) {
      logger.error('Error retrieving user image analyses:', error);
      throw new Error('Failed to retrieve user image analyses');
    }
  }

  /**
   * Process image analysis using AI service
   * This method runs asynchronously and updates the analysis record
   * @param imageAnalysisId Image analysis ID to process
   */
  async processImageAnalysis(imageAnalysisId: string): Promise<void> {
    try {
      // Update status to processing
      await this.imageAnalysisRepository.updateStatus(imageAnalysisId, 'processing');
      logger.info(`Started processing image analysis: ${imageAnalysisId}`);

      // Get the image analysis record
      const imageAnalysis = await this.imageAnalysisRepository.findById(imageAnalysisId);
      if (!imageAnalysis) {
        throw new Error('Image analysis record not found');
      }

      // Process the image using AI service
      const startTime = Date.now();
      const analysisResults = await this.aiAnalysisService.analyzeEnvironmentalImage(
        imageAnalysis.image_url,
        imageAnalysis.location
      );
      const processingTime = Date.now() - startTime;

      // Add processing metadata
      analysisResults.processing_metadata = {
        model_version: this.aiAnalysisService.getModelVersion(),
        processing_time_ms: processingTime,
        image_quality_score: analysisResults.processing_metadata?.image_quality_score || 0.8
      };

      // Update the analysis record with results
      await this.imageAnalysisRepository.update(imageAnalysisId, {
        analysis_results: analysisResults,
        overall_score: analysisResults.overall_score,
        status: 'completed'
      });

      logger.info(`Completed image analysis processing: ${imageAnalysisId} (${processingTime}ms)`);

    } catch (error) {
      logger.error(`Error processing image analysis ${imageAnalysisId}:`, error);
      
      // Update status to failed
      try {
        await this.imageAnalysisRepository.updateStatus(imageAnalysisId, 'failed');
      } catch (updateError) {
        logger.error('Error updating failed status:', updateError);
      }
    }
  }

  /**
   * Get pending image analyses for batch processing
   * @param limit Maximum number of analyses to retrieve
   * @returns Array of pending image analysis records
   */
  async getPendingAnalyses(limit: number = 10): Promise<ImageAnalysis[]> {
    try {
      return await this.imageAnalysisRepository.findPendingAnalyses(limit);
    } catch (error) {
      logger.error('Error retrieving pending analyses:', error);
      throw new Error('Failed to retrieve pending analyses');
    }
  }

  /**
   * Process multiple pending analyses in batch
   * @param batchSize Number of analyses to process in parallel
   */
  async processPendingAnalysesBatch(batchSize: number = 5): Promise<void> {
    try {
      const pendingAnalyses = await this.getPendingAnalyses(batchSize);
      
      if (pendingAnalyses.length === 0) {
        logger.info('No pending image analyses to process');
        return;
      }

      logger.info(`Processing ${pendingAnalyses.length} pending image analyses`);

      // Process analyses in parallel with limited concurrency
      const processingPromises = pendingAnalyses.map(analysis => 
        this.processImageAnalysis(analysis.id).catch(error => {
          logger.error(`Failed to process analysis ${analysis.id}:`, error);
        })
      );

      await Promise.all(processingPromises);
      logger.info(`Completed batch processing of ${pendingAnalyses.length} analyses`);

    } catch (error) {
      logger.error('Error in batch processing:', error);
    }
  }

  /**
   * Get image analyses by location
   * @param location Center location
   * @param radiusKm Search radius in kilometers
   * @param limit Maximum number of results
   * @returns Array of image analysis records
   */
  async getImageAnalysesByLocation(
    location: Location, 
    radiusKm: number, 
    limit: number = 50
  ): Promise<ImageAnalysis[]> {
    try {
      return await this.imageAnalysisRepository.findByLocation(location, radiusKm, limit);
    } catch (error) {
      logger.error('Error retrieving image analyses by location:', error);
      throw new Error('Failed to retrieve image analyses by location');
    }
  }

  /**
   * Delete image analysis and associated image file
   * @param id Image analysis ID
   * @param userId User ID (for authorization)
   * @returns true if deleted successfully
   */
  async deleteImageAnalysis(id: string, userId: string): Promise<boolean> {
    try {
      // Get the image analysis record
      const imageAnalysis = await this.imageAnalysisRepository.findById(id);
      if (!imageAnalysis) {
        return false;
      }

      // Check if user owns this analysis
      if (imageAnalysis.user_id !== userId) {
        throw new Error('Unauthorized: User does not own this image analysis');
      }

      // Delete the image file
      try {
        await this.imageStorageService.deleteImage(imageAnalysis.image_url);
      } catch (error) {
        logger.warn('Failed to delete image file, continuing with database deletion:', error);
      }

      // Delete the database record
      const deleted = await this.imageAnalysisRepository.delete(id);
      
      if (deleted) {
        logger.info(`Deleted image analysis: ${id}`);
      }

      return deleted;

    } catch (error) {
      logger.error('Error deleting image analysis:', error);
      throw new Error('Failed to delete image analysis');
    }
  }

  /**
   * Update image analysis status
   * @param id Image analysis ID
   * @param status New status
   * @returns Updated image analysis record or null if not found
   */
  async updateAnalysisStatus(
    id: string, 
    status: 'pending' | 'processing' | 'completed' | 'failed'
  ): Promise<ImageAnalysis | null> {
    try {
      return await this.imageAnalysisRepository.updateStatus(id, status);
    } catch (error) {
      logger.error('Error updating analysis status:', error);
      throw new Error('Failed to update analysis status');
    }
  }

  /**
   * Get analysis statistics for a user
   * @param userId User ID
   * @returns Analysis statistics
   */
  async getUserAnalysisStats(userId: string): Promise<{
    total: number;
    completed: number;
    pending: number;
    failed: number;
    averageScore?: number;
  }> {
    try {
      const analyses = await this.imageAnalysisRepository.findByUserId(userId, 1000, 0);
      
      const stats = {
        total: analyses.length,
        completed: 0,
        pending: 0,
        failed: 0,
        averageScore: undefined as number | undefined
      };

      let totalScore = 0;
      let scoredAnalyses = 0;

      for (const analysis of analyses) {
        switch (analysis.status) {
          case 'completed':
            stats.completed++;
            if (analysis.overall_score !== undefined) {
              totalScore += analysis.overall_score;
              scoredAnalyses++;
            }
            break;
          case 'pending':
            stats.pending++;
            break;
          case 'failed':
            stats.failed++;
            break;
        }
      }

      if (scoredAnalyses > 0) {
        stats.averageScore = totalScore / scoredAnalyses;
      }

      return stats;

    } catch (error) {
      logger.error('Error getting user analysis stats:', error);
      throw new Error('Failed to get user analysis statistics');
    }
  }
}