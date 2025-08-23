import { cacheInvalidationService } from './CacheInvalidationService';
import { cacheWarmingService } from './CacheWarmingService';
import { environmentalDataCache, LocationCacheKey } from './EnvironmentalDataCache';
import { EnvironmentalDataPoint } from '@/models/types';
import { logger } from '@/utils/logger';

export class CacheIntegrationService {
  /**
   * Initialize cache integration with data ingestion workflows
   */
  async initialize(): Promise<void> {
    try {
      // Start periodic cache warming
      await cacheWarmingService.schedulePeriodicWarming();
      
      logger.info('Cache integration service initialized');
    } catch (error) {
      logger.error('Failed to initialize cache integration service:', error);
      throw error;
    }
  }

  /**
   * Handle new environmental data ingestion
   */
  async handleDataIngestion(data: EnvironmentalDataPoint[]): Promise<void> {
    try {
      // Invalidate affected caches
      await cacheInvalidationService.handleNewEnvironmentalData(data);

      // Track location access for popular locations
      const locationGroups = this.groupDataByLocation(data);
      for (const [locationKey, locationData] of locationGroups.entries()) {
        const location = this.parseLocationKey(locationKey);
        if (location) {
          await cacheWarmingService.trackLocationAccess(location);
        }
      }

      logger.debug(`Processed cache integration for ${data.length} data points`);
    } catch (error) {
      logger.error('Failed to handle data ingestion cache integration:', error);
    }
  }

  /**
   * Handle image analysis completion
   */
  async handleImageAnalysis(
    location: LocationCacheKey,
    analysisResults: any
  ): Promise<void> {
    try {
      // Invalidate relevant caches
      await cacheInvalidationService.handleImageAnalysisUpdate(location, analysisResults);

      // Track location access
      await cacheWarmingService.trackLocationAccess(location);

      logger.debug(`Processed image analysis cache integration for location: ${JSON.stringify(location)}`);
    } catch (error) {
      logger.error('Failed to handle image analysis cache integration:', error);
    }
  }

  /**
   * Handle user preference changes
   */
  async handleUserPreferenceChange(
    userId: string,
    location?: LocationCacheKey
  ): Promise<void> {
    try {
      await cacheInvalidationService.handleUserPreferenceChange(userId, location);
      logger.debug(`Processed user preference change cache integration for user: ${userId}`);
    } catch (error) {
      logger.error('Failed to handle user preference change cache integration:', error);
    }
  }

  /**
   * Preload cache for high-traffic periods
   */
  async preloadForHighTraffic(): Promise<void> {
    try {
      logger.info('Starting cache preload for high-traffic period');
      
      // Get popular locations
      const popularLocations = await cacheWarmingService.getPopularLocations(50);
      
      // Warm cache for top locations
      const topLocations = popularLocations
        .filter(loc => loc.priority === 'high')
        .slice(0, 20);

      for (const loc of topLocations) {
        await cacheWarmingService.warmLocationCache(loc.location);
      }

      logger.info(`Preloaded cache for ${topLocations.length} high-priority locations`);
    } catch (error) {
      logger.error('Failed to preload cache for high traffic:', error);
    }
  }

  /**
   * Optimize cache during low-traffic periods
   */
  async optimizeCacheDuringLowTraffic(): Promise<void> {
    try {
      logger.info('Starting cache optimization for low-traffic period');

      // Warm cache for medium priority locations
      const popularLocations = await cacheWarmingService.getPopularLocations(100);
      const mediumPriorityLocations = popularLocations
        .filter(loc => loc.priority === 'medium')
        .slice(0, 30);

      for (const loc of mediumPriorityLocations) {
        await cacheWarmingService.warmLocationCache(loc.location);
      }

      // Perform time-based invalidation
      await cacheInvalidationService.timeBasedInvalidation();

      logger.info(`Optimized cache for ${mediumPriorityLocations.length} medium-priority locations`);
    } catch (error) {
      logger.error('Failed to optimize cache during low traffic:', error);
    }
  }

  /**
   * Handle system maintenance mode
   */
  async handleMaintenanceMode(enable: boolean): Promise<void> {
    try {
      if (enable) {
        logger.info('Entering maintenance mode - stopping cache processors');
        cacheInvalidationService.stopInvalidationProcessor();
      } else {
        logger.info('Exiting maintenance mode - restarting cache integration');
        await this.initialize();
      }
    } catch (error) {
      logger.error('Failed to handle maintenance mode:', error);
    }
  }

  /**
   * Get cache performance metrics
   */
  async getCachePerformanceMetrics(): Promise<{
    stats: any;
    popularLocations: any[];
    healthStatus: string;
  }> {
    try {
      const [stats, popularLocations] = await Promise.all([
        environmentalDataCache.getCacheStats(),
        cacheWarmingService.getPopularLocations(10)
      ]);

      // Determine health status
      let healthStatus = 'healthy';
      if (stats.hitRate < 30) {
        healthStatus = 'poor';
      } else if (stats.hitRate < 60) {
        healthStatus = 'fair';
      }

      return {
        stats,
        popularLocations,
        healthStatus
      };
    } catch (error) {
      logger.error('Failed to get cache performance metrics:', error);
      return {
        stats: { totalKeys: 0, memoryUsage: 'Unknown', hitRate: 0 },
        popularLocations: [],
        healthStatus: 'error'
      };
    }
  }

  /**
   * Schedule cache optimization tasks
   */
  scheduleOptimizationTasks(): void {
    // High-traffic preload (weekday mornings)
    const highTrafficSchedule = '0 7 * * 1-5'; // 7 AM weekdays
    // Low-traffic optimization (late nights)
    const lowTrafficSchedule = '0 2 * * *'; // 2 AM daily

    // Note: In a real implementation, you would use a proper job scheduler
    // like node-cron or integrate with a job queue system
    
    logger.info('Cache optimization tasks scheduled', {
      highTraffic: highTrafficSchedule,
      lowTraffic: lowTrafficSchedule
    });
  }

  /**
   * Group environmental data by location
   */
  private groupDataByLocation(data: EnvironmentalDataPoint[]): Map<string, EnvironmentalDataPoint[]> {
    const groups = new Map<string, EnvironmentalDataPoint[]>();
    
    for (const point of data) {
      // Create a location key with some tolerance for grouping nearby points
      const lat = Math.round(point.location.latitude * 100) / 100;
      const lng = Math.round(point.location.longitude * 100) / 100;
      const key = `${lat}:${lng}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(point);
    }
    
    return groups;
  }

  /**
   * Parse location key back to LocationCacheKey
   */
  private parseLocationKey(locationKey: string): LocationCacheKey | null {
    const parts = locationKey.split(':');
    if (parts.length !== 2) return null;
    
    return {
      latitude: parseFloat(parts[0]),
      longitude: parseFloat(parts[1]),
      radius: 5, // Default radius
    };
  }
}

export const cacheIntegrationService = new CacheIntegrationService();