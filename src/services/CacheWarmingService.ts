import { environmentalDataCache, LocationCacheKey } from './EnvironmentalDataCache';
import { EnvironmentalDataRepository } from '@/models/EnvironmentalDataRepository';
import { InsightsEngine } from './InsightsEngine';
import { CommunityRecommendationService } from './CommunityRecommendationService';
import { logger } from '@/utils/logger';
import { getRedisClient } from '@/config/redis';

export interface PopularLocation {
  location: LocationCacheKey;
  requestCount: number;
  lastAccessed: Date;
  priority: 'high' | 'medium' | 'low';
}

export class CacheWarmingService {
  private redis = getRedisClient();
  private environmentalDataRepo = new EnvironmentalDataRepository();
  private insightsEngine = new InsightsEngine();
  private recommendationService = new CommunityRecommendationService();

  // Popular locations that should always be warmed
  private readonly PRIORITY_LOCATIONS: LocationCacheKey[] = [
    // Major cities - these would typically come from configuration
    { latitude: 40.7128, longitude: -74.0060, radius: 10 }, // New York
    { latitude: 34.0522, longitude: -118.2437, radius: 10 }, // Los Angeles
    { latitude: 41.8781, longitude: -87.6298, radius: 10 }, // Chicago
    { latitude: 29.7604, longitude: -95.3698, radius: 10 }, // Houston
    { latitude: 33.4484, longitude: -112.0740, radius: 10 }, // Phoenix
  ];

  /**
   * Track location access for popularity metrics
   */
  async trackLocationAccess(location: LocationCacheKey): Promise<void> {
    try {
      const key = `location_access:${location.latitude}:${location.longitude}:${location.radius}`;
      const today = new Date().toISOString().split('T')[0];
      const dailyKey = `${key}:${today}`;

      // Increment daily counter
      await this.redis.incr(dailyKey);
      await this.redis.expire(dailyKey, 86400 * 7); // Keep for 7 days

      // Update last accessed timestamp
      await this.redis.hSet(key, {
        lastAccessed: new Date().toISOString(),
        latitude: location.latitude.toString(),
        longitude: location.longitude.toString(),
        radius: location.radius.toString(),
      });
      await this.redis.expire(key, 86400 * 30); // Keep for 30 days

      logger.debug(`Tracked access for location: ${JSON.stringify(location)}`);
    } catch (error) {
      logger.error('Failed to track location access:', error);
    }
  }

  /**
   * Get popular locations based on access patterns
   */
  async getPopularLocations(limit = 50): Promise<PopularLocation[]> {
    try {
      const pattern = 'location_access:*';
      const keys = await this.scanKeys(pattern);
      const popularLocations: PopularLocation[] = [];

      for (const key of keys) {
        if (key.includes(':20')) continue; // Skip daily keys

        const locationData = await this.redis.hGetAll(key);
        if (!locationData.latitude || !locationData.longitude) continue;

        // Get request count for the last 7 days
        const requestCount = await this.getRecentRequestCount(key);
        
        const location: LocationCacheKey = {
          latitude: parseFloat(locationData.latitude),
          longitude: parseFloat(locationData.longitude),
          radius: parseFloat(locationData.radius || '5'),
        };

        const lastAccessed = new Date(locationData.lastAccessed || Date.now());
        const priority = this.calculatePriority(requestCount, lastAccessed);

        popularLocations.push({
          location,
          requestCount,
          lastAccessed,
          priority,
        });
      }

      // Sort by priority and request count
      popularLocations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.requestCount - a.requestCount;
      });

      return popularLocations.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get popular locations:', error);
      return [];
    }
  }

  /**
   * Warm cache for popular locations
   */
  async warmPopularLocations(): Promise<void> {
    try {
      logger.info('Starting cache warming for popular locations');

      // Get popular locations from access patterns
      const popularLocations = await this.getPopularLocations(20);
      
      // Add priority locations
      const priorityLocations = this.PRIORITY_LOCATIONS.map(location => ({
        location,
        requestCount: 1000, // High artificial count
        lastAccessed: new Date(),
        priority: 'high' as const,
      }));

      const allLocations = [...priorityLocations, ...popularLocations];
      const uniqueLocations = this.deduplicateLocations(allLocations);

      logger.info(`Warming cache for ${uniqueLocations.length} locations`);

      // Warm cache in parallel with concurrency limit
      const concurrency = 5;
      for (let i = 0; i < uniqueLocations.length; i += concurrency) {
        const batch = uniqueLocations.slice(i, i + concurrency);
        await Promise.all(batch.map(loc => this.warmLocationCache(loc.location)));
      }

      logger.info('Cache warming completed');
    } catch (error) {
      logger.error('Failed to warm popular locations:', error);
    }
  }

  /**
   * Warm cache for a specific location
   */
  async warmLocationCache(location: LocationCacheKey): Promise<void> {
    try {
      logger.debug(`Warming cache for location: ${JSON.stringify(location)}`);

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Warm current conditions
      await this.warmCurrentConditions(location);

      // Warm hourly data for the last 24 hours
      await this.warmHourlyData(location, oneDayAgo, now);

      // Warm trend analysis for the last week
      await this.warmTrendAnalysis(location, oneWeekAgo, now);

      // Warm recommendations
      await this.warmRecommendations(location);

      logger.debug(`Cache warmed for location: ${JSON.stringify(location)}`);
    } catch (error) {
      logger.error(`Failed to warm cache for location ${JSON.stringify(location)}:`, error);
    }
  }

  /**
   * Warm current conditions cache
   */
  private async warmCurrentConditions(location: LocationCacheKey): Promise<void> {
    try {
      // Check if already cached
      const cached = await environmentalDataCache.getCurrentConditions(location);
      if (cached) return;

      // Fetch fresh data
      const currentData = await this.environmentalDataRepo.getByLocationAndTimeRange(
        location.latitude,
        location.longitude,
        location.radius,
        new Date(Date.now() - 60 * 60 * 1000), // Last hour
        new Date()
      );

      if (currentData.length > 0) {
        await environmentalDataCache.cacheCurrentConditions(location, currentData);
      }
    } catch (error) {
      logger.error('Failed to warm current conditions:', error);
    }
  }

  /**
   * Warm hourly data cache
   */
  private async warmHourlyData(
    location: LocationCacheKey,
    startTime: Date,
    endTime: Date
  ): Promise<void> {
    try {
      // Check if already cached
      const cached = await environmentalDataCache.getHourlyData(location, startTime, endTime);
      if (cached.length > 0) return;

      // Fetch fresh data
      const hourlyData = await this.environmentalDataRepo.getByLocationAndTimeRange(
        location.latitude,
        location.longitude,
        location.radius,
        startTime,
        endTime
      );

      if (hourlyData.length > 0) {
        // Cache data by hour
        const hourlyGroups = this.groupDataByHour(hourlyData);
        for (const [hour, data] of hourlyGroups.entries()) {
          await environmentalDataCache.cacheHourlyData(location, new Date(hour), data);
        }
      }
    } catch (error) {
      logger.error('Failed to warm hourly data:', error);
    }
  }

  /**
   * Warm trend analysis cache
   */
  private async warmTrendAnalysis(
    location: LocationCacheKey,
    startTime: Date,
    endTime: Date
  ): Promise<void> {
    try {
      const pollutantTypes = ['pm2.5', 'pm10', 'no2', 'o3', 'so2', 'co'];

      for (const pollutant of pollutantTypes) {
        // Check if already cached
        const cached = await environmentalDataCache.getTrendAnalysis(
          location,
          { start: startTime, end: endTime },
          pollutant
        );
        if (cached) continue;

        // Generate fresh analysis
        const analysis = await this.insightsEngine.analyzeTrends(
          location.latitude,
          location.longitude,
          location.radius,
          startTime,
          endTime,
          pollutant
        );

        if (analysis) {
          await environmentalDataCache.cacheTrendAnalysis(
            location,
            { start: startTime, end: endTime },
            pollutant,
            analysis
          );
        }
      }
    } catch (error) {
      logger.error('Failed to warm trend analysis:', error);
    }
  }

  /**
   * Warm recommendations cache
   */
  private async warmRecommendations(location: LocationCacheKey): Promise<void> {
    try {
      // Check if already cached
      const cached = await environmentalDataCache.getRecommendations(location);
      if (cached) return;

      // Generate fresh recommendations
      const recommendations = await this.recommendationService.generateRecommendations(
        location.latitude,
        location.longitude,
        location.radius
      );

      if (recommendations.length > 0) {
        await environmentalDataCache.cacheRecommendations(location, recommendations);
      }
    } catch (error) {
      logger.error('Failed to warm recommendations:', error);
    }
  }

  /**
   * Schedule periodic cache warming
   */
  async schedulePeriodicWarming(): Promise<void> {
    // Warm popular locations every 30 minutes
    setInterval(async () => {
      try {
        await this.warmPopularLocations();
      } catch (error) {
        logger.error('Scheduled cache warming failed:', error);
      }
    }, 30 * 60 * 1000);

    // Initial warming
    setTimeout(() => this.warmPopularLocations(), 5000);
    
    logger.info('Scheduled periodic cache warming');
  }

  /**
   * Get recent request count for a location
   */
  private async getRecentRequestCount(baseKey: string): Promise<number> {
    let totalCount = 0;
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = `${baseKey}:${date.toISOString().split('T')[0]}`;
      
      const count = await this.redis.get(dateKey);
      totalCount += count ? parseInt(count) : 0;
    }

    return totalCount;
  }

  /**
   * Calculate priority based on request count and recency
   */
  private calculatePriority(requestCount: number, lastAccessed: Date): 'high' | 'medium' | 'low' {
    const hoursSinceAccess = (Date.now() - lastAccessed.getTime()) / (1000 * 60 * 60);
    
    if (requestCount > 100 && hoursSinceAccess < 24) return 'high';
    if (requestCount > 50 && hoursSinceAccess < 48) return 'medium';
    if (requestCount > 10 && hoursSinceAccess < 168) return 'medium';
    return 'low';
  }

  /**
   * Remove duplicate locations
   */
  private deduplicateLocations(locations: PopularLocation[]): PopularLocation[] {
    const seen = new Set<string>();
    return locations.filter(loc => {
      const key = `${loc.location.latitude}:${loc.location.longitude}:${loc.location.radius}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Group environmental data by hour
   */
  private groupDataByHour(data: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    
    for (const point of data) {
      const hour = new Date(point.timestamp);
      hour.setMinutes(0, 0, 0);
      const hourKey = hour.toISOString();
      
      if (!groups.has(hourKey)) {
        groups.set(hourKey, []);
      }
      groups.get(hourKey)!.push(point);
    }
    
    return groups;
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

export const cacheWarmingService = new CacheWarmingService();