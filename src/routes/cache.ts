import { Router, Request, Response } from 'express';
import { environmentalDataCache } from '@/services/EnvironmentalDataCache';
import { cacheWarmingService } from '@/services/CacheWarmingService';
import { cacheInvalidationService } from '@/services/CacheInvalidationService';
import { cacheStats } from '@/middleware/cache';
import { logger } from '@/utils/logger';
import { authenticate, AuthenticatedRequest } from '@/middleware/auth';

const router = Router();

/**
 * GET /api/cache/stats
 * Get cache statistics and performance metrics
 */
router.get('/stats', cacheStats());

/**
 * GET /api/cache/popular-locations
 * Get popular locations based on access patterns
 */
router.get('/popular-locations', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const popularLocations = await cacheWarmingService.getPopularLocations(limit);

    res.json({
      success: true,
      data: {
        locations: popularLocations,
        total: popularLocations.length,
        timestamp: new Date()
      },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error getting popular locations:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'POPULAR_LOCATIONS_ERROR',
        message: 'Failed to retrieve popular locations'
      },
      timestamp: new Date()
    });
  }
});

/**
 * POST /api/cache/warm
 * Manually trigger cache warming for popular locations
 */
router.post('/warm', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Start cache warming in background
    cacheWarmingService.warmPopularLocations().catch(error => {
      logger.error('Background cache warming failed:', error);
    });

    res.json({
      success: true,
      data: {
        message: 'Cache warming started',
        timestamp: new Date()
      },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error starting cache warming:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_WARMING_ERROR',
        message: 'Failed to start cache warming'
      },
      timestamp: new Date()
    });
  }
});

/**
 * POST /api/cache/warm-location
 * Warm cache for a specific location
 */
router.post('/warm-location', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { latitude, longitude, radius = 5 } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_LOCATION',
          message: 'Latitude and longitude are required'
        },
        timestamp: new Date()
      });
    }

    const location = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      radius: parseFloat(radius)
    };

    if (isNaN(location.latitude) || isNaN(location.longitude) || isNaN(location.radius)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: 'Invalid location parameters'
        },
        timestamp: new Date()
      });
    }

    // Start location warming in background
    cacheWarmingService.warmLocationCache(location).catch(error => {
      logger.error('Background location cache warming failed:', error);
    });

    res.json({
      success: true,
      data: {
        message: 'Location cache warming started',
        location,
        timestamp: new Date()
      },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error warming location cache:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOCATION_WARMING_ERROR',
        message: 'Failed to warm location cache'
      },
      timestamp: new Date()
    });
  }
});

/**
 * POST /api/cache/invalidate
 * Invalidate cache for a specific location
 */
router.post('/invalidate', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { latitude, longitude, radius = 5, type = 'location' } = req.body;

    if (type === 'location') {
      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_LOCATION',
            message: 'Latitude and longitude are required for location invalidation'
          },
          timestamp: new Date()
        });
      }

      const location = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: parseFloat(radius)
      };

      if (isNaN(location.latitude) || isNaN(location.longitude) || isNaN(location.radius)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_LOCATION',
            message: 'Invalid location parameters'
          },
          timestamp: new Date()
        });
      }

      await environmentalDataCache.invalidateLocationCache(location);

      res.json({
        success: true,
        data: {
          message: 'Location cache invalidated',
          location,
          timestamp: new Date()
        },
        timestamp: new Date()
      });
    } else if (type === 'user') {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_USER_ID',
            message: 'User ID is required for user cache invalidation'
          },
          timestamp: new Date()
        });
      }

      await environmentalDataCache.invalidateUserCache(userId);

      res.json({
        success: true,
        data: {
          message: 'User cache invalidated',
          userId,
          timestamp: new Date()
        },
        timestamp: new Date()
      });
    } else {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TYPE',
          message: 'Type must be either "location" or "user"'
        },
        timestamp: new Date()
      });
    }
  } catch (error) {
    logger.error('Error invalidating cache:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_INVALIDATION_ERROR',
        message: 'Failed to invalidate cache'
      },
      timestamp: new Date()
    });
  }
});

/**
 * POST /api/cache/invalidate-batch
 * Batch invalidate cache for multiple locations
 */
router.post('/invalidate-batch', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { locations } = req.body;

    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LOCATIONS',
          message: 'Locations must be a non-empty array'
        },
        timestamp: new Date()
      });
    }

    // Validate all locations
    const validLocations = [];
    for (const loc of locations) {
      if (loc.latitude && loc.longitude) {
        const location = {
          latitude: parseFloat(loc.latitude),
          longitude: parseFloat(loc.longitude),
          radius: parseFloat(loc.radius || 5)
        };

        if (!isNaN(location.latitude) && !isNaN(location.longitude) && !isNaN(location.radius)) {
          validLocations.push(location);
        }
      }
    }

    if (validLocations.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_VALID_LOCATIONS',
          message: 'No valid locations found in the request'
        },
        timestamp: new Date()
      });
    }

    // Start batch invalidation in background
    cacheInvalidationService.batchInvalidation(validLocations).catch(error => {
      logger.error('Background batch invalidation failed:', error);
    });

    res.json({
      success: true,
      data: {
        message: 'Batch cache invalidation started',
        locations: validLocations,
        count: validLocations.length,
        timestamp: new Date()
      },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error in batch cache invalidation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BATCH_INVALIDATION_ERROR',
        message: 'Failed to start batch cache invalidation'
      },
      timestamp: new Date()
    });
  }
});

/**
 * GET /api/cache/health
 * Get cache health status and diagnostics
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await environmentalDataCache.getCacheStats();
    
    // Determine health status based on metrics
    const health = {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      checks: {
        redis_connection: true,
        memory_usage: stats.memoryUsage !== 'Unknown',
        hit_rate: stats.hitRate > 50, // Consider healthy if hit rate > 50%
        total_keys: stats.totalKeys > 0
      },
      metrics: stats,
      timestamp: new Date()
    };

    // Determine overall health
    const failedChecks = Object.values(health.checks).filter(check => !check).length;
    if (failedChecks === 0) {
      health.status = 'healthy';
    } else if (failedChecks <= 1) {
      health.status = 'degraded';
    } else {
      health.status = 'unhealthy';
    }

    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: health.status !== 'unhealthy',
      data: health,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error checking cache health:', error);
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        error: 'Failed to check cache health',
        timestamp: new Date()
      },
      timestamp: new Date()
    });
  }
});

export default router;