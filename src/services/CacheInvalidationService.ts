import { environmentalDataCache, LocationCacheKey } from './EnvironmentalDataCache';
import { getRedisClient } from '@/config/redis';
import { logger } from '@/utils/logger';
import { EnvironmentalDataPoint } from '@/models/types';

export interface InvalidationEvent {
  type: 'data_update' | 'user_action' | 'system_update';
  location?: LocationCacheKey;
  userId?: string;
  pollutantType?: string;
  timestamp: Date;
  metadata?: any;
}

export class CacheInvalidationService {
  private redis = getRedisClient();
  private invalidationQueue: InvalidationEvent[] = [];
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startInvalidationProcessor();
  }

  /**
   * Queue cache invalidation for environmental data update
   */
  async invalidateEnvironmentalData(
    location: LocationCacheKey,
    pollutantType?: string,
    metadata?: any
  ): Promise<void> {
    const event: InvalidationEvent = {
      type: 'data_update',
      location,
      pollutantType,
      timestamp: new Date(),
      metadata,
    };

    this.invalidationQueue.push(event);
    logger.debug(`Queued environmental data invalidation: ${JSON.stringify(location)}`);
  }

  /**
   * Queue cache invalidation for user-specific data
   */
  async invalidateUserData(userId: string, metadata?: any): Promise<void> {
    const event: InvalidationEvent = {
      type: 'user_action',
      userId,
      timestamp: new Date(),
      metadata,
    };

    this.invalidationQueue.push(event);
    logger.debug(`Queued user data invalidation: ${userId}`);
  }

  /**
   * Queue system-wide cache invalidation
   */
  async invalidateSystemCache(metadata?: any): Promise<void> {
    const event: InvalidationEvent = {
      type: 'system_update',
      timestamp: new Date(),
      metadata,
    };

    this.invalidationQueue.push(event);
    logger.debug('Queued system cache invalidation');
  }

  /**
   * Immediately invalidate cache for new environmental data
   */
  async handleNewEnvironmentalData(data: EnvironmentalDataPoint[]): Promise<void> {
    try {
      const locationGroups = this.groupDataByLocation(data);

      for (const [locationKey, locationData] of locationGroups.entries()) {
        const location = this.parseLocationKey(locationKey);
        if (!location) continue;

        // Invalidate current conditions
        await this.invalidateCurrentConditions(location);

        // Invalidate hourly data for affected hours
        await this.invalidateHourlyData(location, locationData);

        // Invalidate trend analysis if significant data change
        if (this.isSignificantDataChange(locationData)) {
          await this.invalidateTrendAnalysis(location);
        }

        // Invalidate recommendations if pollution levels changed significantly
        if (this.isPollutionLevelChange(locationData)) {
          await this.invalidateRecommendations(location);
        }

        logger.debug(`Invalidated cache for new data at location: ${locationKey}`);
      }
    } catch (error) {
      logger.error('Failed to handle new environmental data invalidation:', error);
    }
  }

  /**
   * Handle cache invalidation when user preferences change
   */
  async handleUserPreferenceChange(userId: string, location?: LocationCacheKey): Promise<void> {
    try {
      // Invalidate user dashboard
      await environmentalDataCache.invalidateUserCache(userId);

      // If location changed, invalidate location-based caches
      if (location) {
        await this.invalidateLocationBasedUserData(userId, location);
      }

      logger.debug(`Invalidated cache for user preference change: ${userId}`);
    } catch (error) {
      logger.error('Failed to handle user preference change:', error);
    }
  }

  /**
   * Handle cache invalidation for image analysis results
   */
  async handleImageAnalysisUpdate(
    location: LocationCacheKey,
    analysisResults: any
  ): Promise<void> {
    try {
      // If image analysis indicates significant pollution, invalidate recommendations
      if (this.isSignificantPollutionDetected(analysisResults)) {
        await this.invalidateRecommendations(location);
        
        // Also invalidate current conditions to reflect user-contributed data
        await this.invalidateCurrentConditions(location);
      }

      logger.debug(`Handled image analysis cache invalidation: ${JSON.stringify(location)}`);
    } catch (error) {
      logger.error('Failed to handle image analysis update:', error);
    }
  }

  /**
   * Smart invalidation based on data freshness and impact
   */
  async smartInvalidation(
    location: LocationCacheKey,
    newData: EnvironmentalDataPoint[],
    existingData?: EnvironmentalDataPoint[]
  ): Promise<void> {
    try {
      if (!existingData || existingData.length === 0) {
        // No existing data, invalidate everything
        await environmentalDataCache.invalidateLocationCache(location);
        return;
      }

      const changes = this.analyzeDataChanges(newData, existingData);

      // Selective invalidation based on change significance
      if (changes.significantChange) {
        await this.invalidateCurrentConditions(location);
        await this.invalidateTrendAnalysis(location);
      }

      if (changes.pollutionLevelChange) {
        await this.invalidateRecommendations(location);
      }

      if (changes.newPollutants.length > 0) {
        // New pollutant types detected, invalidate all related caches
        await environmentalDataCache.invalidateLocationCache(location);
      }

      logger.debug(`Smart invalidation completed for location: ${JSON.stringify(location)}`);
    } catch (error) {
      logger.error('Failed to perform smart invalidation:', error);
    }
  }

  /**
   * Batch invalidation for multiple locations
   */
  async batchInvalidation(locations: LocationCacheKey[]): Promise<void> {
    try {
      const concurrency = 10;
      for (let i = 0; i < locations.length; i += concurrency) {
        const batch = locations.slice(i, i + concurrency);
        await Promise.all(
          batch.map(location => environmentalDataCache.invalidateLocationCache(location))
        );
      }

      logger.info(`Batch invalidation completed for ${locations.length} locations`);
    } catch (error) {
      logger.error('Failed to perform batch invalidation:', error);
    }
  }

  /**
   * Invalidate cache based on time-based rules
   */
  async timeBasedInvalidation(): Promise<void> {
    try {
      const now = new Date();
      const patterns = [
        'current_conditions:*', // Invalidate if older than 5 minutes
        'hourly_data:*', // Invalidate if older than 1 hour
        'user_dashboard:*', // Invalidate if older than 10 minutes
      ];

      for (const pattern of patterns) {
        await this.invalidateExpiredKeys(pattern, this.getTTLForPattern(pattern));
      }

      logger.debug('Time-based invalidation completed');
    } catch (error) {
      logger.error('Failed to perform time-based invalidation:', error);
    }
  }

  /**
   * Start the invalidation processor
   */
  private startInvalidationProcessor(): void {
    this.processingInterval = setInterval(async () => {
      if (this.invalidationQueue.length === 0) return;

      const events = this.invalidationQueue.splice(0, 100); // Process in batches
      await this.processInvalidationEvents(events);
    }, 1000); // Process every second

    logger.info('Cache invalidation processor started');
  }

  /**
   * Stop the invalidation processor
   */
  stopInvalidationProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('Cache invalidation processor stopped');
    }
  }

  /**
   * Process queued invalidation events
   */
  private async processInvalidationEvents(events: InvalidationEvent[]): Promise<void> {
    try {
      for (const event of events) {
        switch (event.type) {
          case 'data_update':
            if (event.location) {
              await this.processDataUpdateEvent(event);
            }
            break;
          case 'user_action':
            if (event.userId) {
              await environmentalDataCache.invalidateUserCache(event.userId);
            }
            break;
          case 'system_update':
            await this.processSystemUpdateEvent(event);
            break;
        }
      }

      logger.debug(`Processed ${events.length} invalidation events`);
    } catch (error) {
      logger.error('Failed to process invalidation events:', error);
    }
  }

  /**
   * Process data update invalidation event
   */
  private async processDataUpdateEvent(event: InvalidationEvent): Promise<void> {
    if (!event.location) return;

    await this.invalidateCurrentConditions(event.location);
    
    if (event.pollutantType) {
      await this.invalidatePollutantSpecificCache(event.location, event.pollutantType);
    } else {
      await environmentalDataCache.invalidateLocationCache(event.location);
    }
  }

  /**
   * Process system update invalidation event
   */
  private async processSystemUpdateEvent(event: InvalidationEvent): Promise<void> {
    // Invalidate all caches for system updates
    await this.redis.flushDb();
    logger.info('System cache cleared due to system update');
  }

  /**
   * Invalidate current conditions cache
   */
  private async invalidateCurrentConditions(location: LocationCacheKey): Promise<void> {
    const key = `current_conditions:${location.latitude}:${location.longitude}:${location.radius}`;
    await this.redis.del(key);
  }

  /**
   * Invalidate hourly data cache
   */
  private async invalidateHourlyData(
    location: LocationCacheKey,
    data: EnvironmentalDataPoint[]
  ): Promise<void> {
    const affectedHours = new Set<string>();
    
    for (const point of data) {
      const hour = new Date(point.timestamp);
      hour.setMinutes(0, 0, 0);
      affectedHours.add(hour.toISOString());
    }

    const baseKey = `hourly_data:${location.latitude}:${location.longitude}:${location.radius}`;
    for (const hour of affectedHours) {
      const key = `${baseKey}:${hour}`;
      await this.redis.del(key);
    }
  }

  /**
   * Invalidate trend analysis cache
   */
  private async invalidateTrendAnalysis(location: LocationCacheKey): Promise<void> {
    const pattern = `trend_analysis:${location.latitude}:${location.longitude}:${location.radius}:*`;
    const keys = await this.scanKeys(pattern);
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
  }

  /**
   * Invalidate recommendations cache
   */
  private async invalidateRecommendations(location: LocationCacheKey): Promise<void> {
    const key = `recommendations:${location.latitude}:${location.longitude}:${location.radius}`;
    await this.redis.del(key);
  }

  /**
   * Invalidate pollutant-specific cache
   */
  private async invalidatePollutantSpecificCache(
    location: LocationCacheKey,
    pollutantType: string
  ): Promise<void> {
    const pattern = `trend_analysis:${location.latitude}:${location.longitude}:${location.radius}:${pollutantType}:*`;
    const keys = await this.scanKeys(pattern);
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
  }

  /**
   * Invalidate location-based user data
   */
  private async invalidateLocationBasedUserData(
    userId: string,
    location: LocationCacheKey
  ): Promise<void> {
    // Invalidate user dashboard as it may contain location-specific data
    await environmentalDataCache.invalidateUserCache(userId);
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

  /**
   * Check if data change is significant enough to invalidate cache
   */
  private isSignificantDataChange(data: EnvironmentalDataPoint[]): boolean {
    // Simple heuristic: if we have more than 10 new data points, consider it significant
    return data.length > 10;
  }

  /**
   * Check if pollution level changed significantly
   */
  private isPollutionLevelChange(data: EnvironmentalDataPoint[]): boolean {
    // Check if any pollutant values exceed certain thresholds
    return data.some(point => {
      switch (point.pollutant.toLowerCase()) {
        case 'pm2.5':
          return point.value > 35; // WHO guideline
        case 'pm10':
          return point.value > 50;
        case 'no2':
          return point.value > 40;
        case 'o3':
          return point.value > 100;
        default:
          return false;
      }
    });
  }

  /**
   * Check if image analysis detected significant pollution
   */
  private isSignificantPollutionDetected(analysisResults: any): boolean {
    if (!analysisResults.pollutionIndicators) return false;
    
    const { airQuality, waterQuality, visualContamination } = analysisResults.pollutionIndicators;
    
    return (
      (airQuality?.smogDensity > 0.7 && airQuality?.confidence > 0.8) ||
      (waterQuality?.turbidity > 0.6 && waterQuality?.confidence > 0.8) ||
      (visualContamination?.detected && visualContamination?.confidence > 0.8)
    );
  }

  /**
   * Analyze changes between new and existing data
   */
  private analyzeDataChanges(
    newData: EnvironmentalDataPoint[],
    existingData: EnvironmentalDataPoint[]
  ): {
    significantChange: boolean;
    pollutionLevelChange: boolean;
    newPollutants: string[];
  } {
    const existingPollutants = new Set(existingData.map(d => d.pollutant));
    const newPollutants = newData
      .map(d => d.pollutant)
      .filter(p => !existingPollutants.has(p));

    const significantChange = newData.length > existingData.length * 0.1; // 10% increase
    const pollutionLevelChange = this.isPollutionLevelChange(newData);

    return {
      significantChange,
      pollutionLevelChange,
      newPollutants,
    };
  }

  /**
   * Invalidate expired keys based on pattern
   */
  private async invalidateExpiredKeys(pattern: string, maxAge: number): Promise<void> {
    const keys = await this.scanKeys(pattern);
    const now = Date.now();
    
    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl > 0 && ttl < maxAge) {
        await this.redis.del(key);
      }
    }
  }

  /**
   * Get TTL for cache pattern
   */
  private getTTLForPattern(pattern: string): number {
    if (pattern.includes('current_conditions')) return 300; // 5 minutes
    if (pattern.includes('hourly_data')) return 3600; // 1 hour
    if (pattern.includes('user_dashboard')) return 600; // 10 minutes
    return 1800; // Default 30 minutes
  }

  /**
   * Scan for keys matching a pattern
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = 0;

    do {
      const result = await this.redis.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });
      
      cursor = result.cursor;
      keys.push(...result.keys);
    } while (cursor !== 0);

    return keys;
  }
}

export const cacheInvalidationService = new CacheInvalidationService();