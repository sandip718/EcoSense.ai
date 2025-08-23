// Community Recommendations API Routes
// Implements requirements 4.1, 4.2, 4.3, 4.4

import { Router, Request, Response } from 'express';
import { CommunityRecommendationService } from '../services/CommunityRecommendationService';
import { validateRequest } from '../utils/validation';
import { logger } from '../utils/logger';
import { ApiResponse, RecommendationQuery, RecommendationAnalysisInput } from '../models/types';
import { 
  cacheRecommendations, 
  addCacheHeaders, 
  handleConditionalRequests 
} from '../middleware/cache';

const router = Router();
const recommendationService = new CommunityRecommendationService();

/**
 * GET /api/recommendations
 * Get recommendations based on query parameters
 * Requirement 4.1: Retrieve location-specific recommendations
 */
router.get('/',
  handleConditionalRequests(),
  addCacheHeaders(1800), // 30 minutes cache
  cacheRecommendations({ ttl: 1800, trackAccess: true }),
  async (req: Request, res: Response) => {
  try {
    const query: RecommendationQuery = {
      location: req.query.lat && req.query.lng && req.query.radius ? {
        latitude: parseFloat(req.query.lat as string),
        longitude: parseFloat(req.query.lng as string),
        radius_km: parseFloat(req.query.radius as string)
      } : undefined,
      priority: req.query.priority ? 
        (Array.isArray(req.query.priority) ? req.query.priority : [req.query.priority]) as any[] : 
        undefined,
      category: req.query.category ? 
        (Array.isArray(req.query.category) ? req.query.category : [req.query.category]) as any[] : 
        undefined,
      target_pollutants: req.query.pollutants ? 
        (Array.isArray(req.query.pollutants) ? req.query.pollutants : [req.query.pollutants]) as string[] : 
        undefined,
      active_only: req.query.active_only === 'true',
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };

    // Validate location parameters if provided
    if (query.location) {
      if (isNaN(query.location.latitude) || isNaN(query.location.longitude) || isNaN(query.location.radius_km)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_LOCATION',
            message: 'Invalid location parameters. Latitude, longitude, and radius must be valid numbers.',
            details: { provided: query.location }
          },
          timestamp: new Date()
        } as ApiResponse<null>);
      }

      if (query.location.latitude < -90 || query.location.latitude > 90) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_LATITUDE',
            message: 'Latitude must be between -90 and 90 degrees.',
            details: { latitude: query.location.latitude }
          },
          timestamp: new Date()
        } as ApiResponse<null>);
      }

      if (query.location.longitude < -180 || query.location.longitude > 180) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_LONGITUDE',
            message: 'Longitude must be between -180 and 180 degrees.',
            details: { longitude: query.location.longitude }
          },
          timestamp: new Date()
        } as ApiResponse<null>);
      }

      if (query.location.radius_km <= 0 || query.location.radius_km > 100) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_RADIUS',
            message: 'Radius must be between 0 and 100 kilometers.',
            details: { radius: query.location.radius_km }
          },
          timestamp: new Date()
        } as ApiResponse<null>);
      }
    }

    const result = await recommendationService.getRecommendations(query);

    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    } as ApiResponse<typeof result>);

  } catch (error) {
    logger.error('Error getting recommendations:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve recommendations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * GET /api/recommendations/:id
 * Get a specific recommendation by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Valid recommendation ID is required',
          details: { provided: id }
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    const recommendation = await recommendationService.getRecommendationById(id);

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RECOMMENDATION_NOT_FOUND',
          message: 'Recommendation not found',
          details: { id }
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    res.json({
      success: true,
      data: recommendation,
      timestamp: new Date()
    } as ApiResponse<typeof recommendation>);

  } catch (error) {
    logger.error('Error getting recommendation by ID:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve recommendation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * POST /api/recommendations/generate
 * Generate new recommendations for a location based on current conditions
 * Requirement 4.1: Analyze local environmental conditions and generate recommendations
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const input: RecommendationAnalysisInput = req.body;

    // Validate required fields
    if (!input.location || !input.radius_km || !input.current_conditions) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Location, radius_km, and current_conditions are required',
          details: { 
            hasLocation: !!input.location,
            hasRadius: !!input.radius_km,
            hasConditions: !!input.current_conditions
          }
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    // Validate location
    if (typeof input.location.latitude !== 'number' || 
        typeof input.location.longitude !== 'number' ||
        input.location.latitude < -90 || input.location.latitude > 90 ||
        input.location.longitude < -180 || input.location.longitude > 180) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: 'Invalid location coordinates',
          details: { location: input.location }
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    // Validate radius
    if (typeof input.radius_km !== 'number' || input.radius_km <= 0 || input.radius_km > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RADIUS',
          message: 'Radius must be a number between 0 and 100 kilometers',
          details: { radius_km: input.radius_km }
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    // Validate current conditions
    if (!Array.isArray(input.current_conditions) || input.current_conditions.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONDITIONS',
          message: 'Current conditions must be a non-empty array',
          details: { current_conditions: input.current_conditions }
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    // Validate each condition
    for (const condition of input.current_conditions) {
      if (!condition.pollutant || typeof condition.value !== 'number' || !condition.timestamp) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CONDITION_DATA',
            message: 'Each condition must have pollutant, value, and timestamp',
            details: { invalidCondition: condition }
          },
          timestamp: new Date()
        } as ApiResponse<null>);
      }
    }

    const recommendations = await recommendationService.generateRecommendations(input);

    res.status(201).json({
      success: true,
      data: recommendations,
      timestamp: new Date()
    } as ApiResponse<typeof recommendations>);

  } catch (error) {
    logger.error('Error generating recommendations:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate recommendations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * PUT /api/recommendations/:id
 * Update a recommendation
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Valid recommendation ID is required',
          details: { provided: id }
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    // Validate updates object
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_UPDATES',
          message: 'Updates object is required',
          details: { provided: updates }
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    const updatedRecommendation = await recommendationService.updateRecommendation(id, updates);

    if (!updatedRecommendation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RECOMMENDATION_NOT_FOUND',
          message: 'Recommendation not found',
          details: { id }
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    res.json({
      success: true,
      data: updatedRecommendation,
      timestamp: new Date()
    } as ApiResponse<typeof updatedRecommendation>);

  } catch (error) {
    logger.error('Error updating recommendation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update recommendation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * DELETE /api/recommendations/:id
 * Delete a recommendation
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Valid recommendation ID is required',
          details: { provided: id }
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    const deleted = await recommendationService.deleteRecommendation(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RECOMMENDATION_NOT_FOUND',
          message: 'Recommendation not found',
          details: { id }
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    res.json({
      success: true,
      data: { deleted: true, id },
      timestamp: new Date()
    } as ApiResponse<{ deleted: boolean; id: string }>);

  } catch (error) {
    logger.error('Error deleting recommendation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete recommendation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

export default router;