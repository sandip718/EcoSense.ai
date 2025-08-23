import { Request, Response, NextFunction } from 'express';
import { environmentalDataCache, LocationCacheKey } from '@/services/EnvironmentalDataCache';
import { cacheWarmingService } from '@/services/CacheWarmingService';
import { logger } from '@/utils/logger';

export interface CacheMiddlewareOptions {
  ttl?: number;
  skipCache?: boolean;
  trackAccess?: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Middleware for caching environmental data responses
 */
export function cacheEnvironmentalData(options: CacheMiddlewareOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip cache if requested or in development
      if (options.skipCache || process.env.NODE_ENV === 'development') {
        return next();
      }

      // Extract location parameters
      const location = extractLocationFromRequest(req);
      if (!location) {
        return next();
      }

      // Track location access for popularity metrics
      if (options.trackAccess !== false) {
        await cacheWarmingService.trackLocationAccess(location);
      }

      // Generate cache key
      const cacheKey = options.keyGenerator 
        ? options.keyGenerator(req)
        : generateDefaultCacheKey(req, location);

      // Try to get cached data
      const cached = await getCachedResponse(cacheKey, req);
      if (cached) {
        logger.debug(`Cache hit for key: ${cacheKey}`);
        return res.json(cached);
      }

      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache response
      res.json = function(data: any) {
        // Cache the response
        cacheResponse(cacheKey, data, options.ttl).catch(error => {
          logger.error('Failed to cache response:', error);
        });
        
        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
}

/**
 * Middleware for caching user dashboard data
 */
export function cacheUserDashboard(options: CacheMiddlewareOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (options.skipCache || process.env.NODE_ENV === 'development') {
        return next();
      }

      const userId = req.user?.id;
      if (!userId) {
        return next();
      }

      // Try to get cached dashboard
      const cached = await environmentalDataCache.getUserDashboard(userId);
      if (cached) {
        logger.debug(`Dashboard cache hit for user: ${userId}`);
        return res.json(cached);
      }

      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache response
      res.json = function(data: any) {
        // Cache the dashboard data
        environmentalDataCache.cacheUserDashboard(userId, data, options).catch(error => {
          logger.error('Failed to cache user dashboard:', error);
        });
        
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('User dashboard cache middleware error:', error);
      next();
    }
  };
}

/**
 * Middleware for caching trend analysis
 */
export function cacheTrendAnalysis(options: CacheMiddlewareOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (options.skipCache || process.env.NODE_ENV === 'development') {
        return next();
      }

      const location = extractLocationFromRequest(req);
      const timeframe = extractTimeframeFromRequest(req);
      const pollutantType = req.query.pollutant as string || 'pm2.5';

      if (!location || !timeframe) {
        return next();
      }

      // Try to get cached analysis
      const cached = await environmentalDataCache.getTrendAnalysis(
        location,
        timeframe,
        pollutantType
      );

      if (cached) {
        logger.debug(`Trend analysis cache hit for location: ${JSON.stringify(location)}`);
        return res.json(cached);
      }

      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache response
      res.json = function(data: any) {
        // Cache the trend analysis
        environmentalDataCache.cacheTrendAnalysis(
          location,
          timeframe,
          pollutantType,
          data,
          options
        ).catch(error => {
          logger.error('Failed to cache trend analysis:', error);
        });
        
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Trend analysis cache middleware error:', error);
      next();
    }
  };
}

/**
 * Middleware for caching recommendations
 */
export function cacheRecommendations(options: CacheMiddlewareOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (options.skipCache || process.env.NODE_ENV === 'development') {
        return next();
      }

      const location = extractLocationFromRequest(req);
      if (!location) {
        return next();
      }

      // Try to get cached recommendations
      const cached = await environmentalDataCache.getRecommendations(location);
      if (cached) {
        logger.debug(`Recommendations cache hit for location: ${JSON.stringify(location)}`);
        return res.json(cached);
      }

      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache response
      res.json = function(data: any) {
        // Cache the recommendations
        environmentalDataCache.cacheRecommendations(location, data, options).catch(error => {
          logger.error('Failed to cache recommendations:', error);
        });
        
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Recommendations cache middleware error:', error);
      next();
    }
  };
}

/**
 * Middleware to add cache headers to responses
 */
export function addCacheHeaders(maxAge: number = 300) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set cache control headers
    res.set({
      'Cache-Control': `public, max-age=${maxAge}`,
      'ETag': generateETag(req),
      'Last-Modified': new Date().toUTCString(),
    });

    next();
  };
}

/**
 * Middleware to handle conditional requests (304 Not Modified)
 */
export function handleConditionalRequests() {
  return (req: Request, res: Response, next: NextFunction) => {
    const ifNoneMatch = req.get('If-None-Match');
    const etag = generateETag(req);

    if (ifNoneMatch && ifNoneMatch === etag) {
      return res.status(304).end();
    }

    next();
  };
}

/**
 * Extract location parameters from request
 */
function extractLocationFromRequest(req: Request): LocationCacheKey | null {
  const { latitude, longitude, radius } = req.query;
  
  if (!latitude || !longitude) {
    return null;
  }

  return {
    latitude: parseFloat(latitude as string),
    longitude: parseFloat(longitude as string),
    radius: parseFloat(radius as string) || 5,
  };
}

/**
 * Extract timeframe parameters from request
 */
function extractTimeframeFromRequest(req: Request): { start: Date; end: Date } | null {
  const { startTime, endTime } = req.query;
  
  if (!startTime || !endTime) {
    return null;
  }

  return {
    start: new Date(startTime as string),
    end: new Date(endTime as string),
  };
}

/**
 * Generate default cache key for request
 */
function generateDefaultCacheKey(req: Request, location: LocationCacheKey): string {
  const baseKey = `${req.method}:${req.path}`;
  const locationKey = `${location.latitude}:${location.longitude}:${location.radius}`;
  const queryKey = Object.keys(req.query)
    .sort()
    .map(key => `${key}=${req.query[key]}`)
    .join('&');
  
  return `${baseKey}:${locationKey}:${queryKey}`;
}

/**
 * Get cached response for key
 */
async function getCachedResponse(key: string, req: Request): Promise<any | null> {
  try {
    // For environmental data, try specific cache methods first
    if (req.path.includes('/environmental-data/current')) {
      const location = extractLocationFromRequest(req);
      if (location) {
        const cached = await environmentalDataCache.getCurrentConditions(location);
        return cached?.data || null;
      }
    }

    if (req.path.includes('/environmental-data/hourly')) {
      const location = extractLocationFromRequest(req);
      const timeframe = extractTimeframeFromRequest(req);
      if (location && timeframe) {
        const cached = await environmentalDataCache.getHourlyData(
          location,
          timeframe.start,
          timeframe.end
        );
        return cached.length > 0 ? cached : null;
      }
    }

    // Fallback to generic cache
    const redis = require('@/config/redis').getRedisClient();
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logger.error('Failed to get cached response:', error);
    return null;
  }
}

/**
 * Cache response data
 */
async function cacheResponse(key: string, data: any, ttl: number = 300): Promise<void> {
  try {
    const redis = require('@/config/redis').getRedisClient();
    await redis.setEx(key, ttl, JSON.stringify(data));
    logger.debug(`Cached response for key: ${key}`);
  } catch (error) {
    logger.error('Failed to cache response:', error);
  }
}

/**
 * Generate ETag for request
 */
function generateETag(req: Request): string {
  const content = `${req.method}${req.path}${JSON.stringify(req.query)}`;
  const crypto = require('crypto');
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Cache statistics middleware
 */
export function cacheStats() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await environmentalDataCache.getCacheStats();
      res.json({
        cache: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      res.status(500).json({ error: 'Failed to get cache statistics' });
    }
  };
}