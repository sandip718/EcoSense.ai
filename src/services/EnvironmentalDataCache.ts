import { getRedisClient } from '@/config/redis';
import { logger } from '@/utils/logger';
import { EnvironmentalDataPoint, TrendAnalysis, CommunityRecommendation } from '@/models/types';

export interface LocationCacheKey {
  latitude: number;
  longitude: number;
  radius: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  skipCache?: boolean;
  forceRefresh?: boolean;
}

export class EnvironmentalDataCache {
  private redis = getRedisClient();
  
  // Cache TTL constants (in seconds)
  private readonly CACHE_TTL = {
    CURRENT_CONDITIONS: 300, // 5 minutes
    HOURLY_DATA: 3600, // 1 hour
    DAILY_TRENDS: 86400, // 24 hours
    WEEKLY_TRENDS: 604800, // 7 days
    USER_DASHBOARD: 600, // 10 minutes
    RECOMMENDATIONS: 1800, // 30 minutes
    POPULAR_LOCATIONS: 7200, // 2 hours
  };

  /**
   * Generate location-based cache key with geohash for spatial queries
   */
  private generateLocationKey(location: LocationCacheKey, prefix: string): string {
    // Round coordinates to reduce cache key variations while maintaining accuracy
    const lat = Math.round(location.latitude * 1000) / 1000;
    const lng = Math.round(location.longitude * 1000) / 1000;
    const radius = Math.round(location.radius * 100) / 100;
    
    return `${prefix}:${lat}:${lng}:${radius}`;
  }

  /**
   * Generate time-based cache key for temporal data
   */
  private generateTimeKey(timestamp: Date, granularity: 'hour' | 'day' | 'week'): string {
    const date = new Date(timestamp);
    
    switch (granularity) {
      case 'hour':
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
      case 'day':
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
      default:
        return date.toISOString();
    }
  }

  /**
   * Cache current environmental conditions for a location
   */
  async cacheCurrentConditions(
    location: LocationCacheKey,
    data: EnvironmentalDataPoint[],
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const key = this.generateLocationKey(location, 'current_conditions');
      const ttl = options.ttl || this.CACHE_TTL.CURRENT_CONDITIONS;
      
      const cacheData = {
        data,
        timestamp: new Date().toISOString(),
        location,
      };

      await this.redis.setEx(key, ttl, JSON.stringify(cacheData));
      logger.debug(`Cached current conditions for location: ${key}`);
    } catch (error) {
      logger.error('Failed to cache current conditions:', error);
    }
  }

  /**
   * Get cached current conditions for a location
   */
  async getCurrentConditions(
    location: LocationCacheKey,
    options: CacheOptions = {}
  ): Promise<{ data: EnvironmentalDataPoint[]; timestamp: string } | null> {
    try {
      if (options.skipCache || options.forceRefresh) {
        return null;
      }

      const key = this.generateLocationKey(location, 'current_conditions');
      const cached = await this.redis.get(key);
      
      if (!cached) {
        return null;
      }

      const parsedData = JSON.parse(cached);
      logger.debug(`Cache hit for current conditions: ${key}`);
      return parsedData;
    } catch (error) {
      logger.error('Failed to get cached current conditions:', error);
      return null;
    }
  }

  /**
   * Cache hourly environmental data
   */
  async cacheHourlyData(
    location: LocationCacheKey,
    timestamp: Date,
    data: EnvironmentalDataPoint[],
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const locationKey = this.generateLocationKey(location, 'hourly_data');
      const timeKey = this.generateTimeKey(timestamp, 'hour');
      const key = `${locationKey}:${timeKey}`;
      const ttl = options.ttl || this.CACHE_TTL.HOURLY_DATA;

      const cacheData = {
        data,
        timestamp: timestamp.toISOString(),
        location,
      };

      await this.redis.setEx(key, ttl, JSON.stringify(cacheData));
      logger.debug(`Cached hourly data: ${key}`);
    } catch (error) {
      logger.error('Failed to cache hourly data:', error);
    }
  }

  /**
   * Get cached hourly data for a location and time range
   */
  async getHourlyData(
    location: LocationCacheKey,
    startTime: Date,
    endTime: Date,
    options: CacheOptions = {}
  ): Promise<EnvironmentalDataPoint[]> {
    try {
      if (options.skipCache || options.forceRefresh) {
        return [];
      }

      const locationKey = this.generateLocationKey(location, 'hourly_data');
      const keys: string[] = [];
      
      // Generate keys for each hour in the range
      const current = new Date(startTime);
      while (current <= endTime) {
        const timeKey = this.generateTimeKey(current, 'hour');
        keys.push(`${locationKey}:${timeKey}`);
        current.setHours(current.getHours() + 1);
      }

      const cachedData = await this.redis.mGet(keys);
      const results: EnvironmentalDataPoint[] = [];

      cachedData.forEach((cached, index) => {
        if (cached) {
          try {
            const parsedData = JSON.parse(cached);
            results.push(...parsedData.data);
          } catch (error) {
            logger.warn(`Failed to parse cached hourly data for key: ${keys[index]}`);
          }
        }
      });

      if (results.length > 0) {
        logger.debug(`Cache hit for hourly data: ${results.length} points`);
      }

      return results;
    } catch (error) {
      logger.error('Failed to get cached hourly data:', error);
      return [];
    }
  }

  /**
   * Cache trend analysis results
   */
  async cacheTrendAnalysis(
    location: LocationCacheKey,
    timeframe: { start: Date; end: Date },
    pollutantType: string,
    analysis: TrendAnalysis,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const locationKey = this.generateLocationKey(location, 'trend_analysis');
      const timeframeKey = `${this.generateTimeKey(timeframe.start, 'day')}_${this.generateTimeKey(timeframe.end, 'day')}`;
      const key = `${locationKey}:${pollutantType}:${timeframeKey}`;
      const ttl = options.ttl || this.CACHE_TTL.DAILY_TRENDS;

      const cacheData = {
        analysis,
        timestamp: new Date().toISOString(),
        location,
        timeframe,
        pollutantType,
      };

      await this.redis.setEx(key, ttl, JSON.stringify(cacheData));
      logger.debug(`Cached trend analysis: ${key}`);
    } catch (error) {
      logger.error('Failed to cache trend analysis:', error);
    }
  }

  /**
   * Get cached trend analysis
   */
  async getTrendAnalysis(
    location: LocationCacheKey,
    timeframe: { start: Date; end: Date },
    pollutantType: string,
    options: CacheOptions = {}
  ): Promise<TrendAnalysis | null> {
    try {
      if (options.skipCache || options.forceRefresh) {
        return null;
      }

      const locationKey = this.generateLocationKey(location, 'trend_analysis');
      const timeframeKey = `${this.generateTimeKey(timeframe.start, 'day')}_${this.generateTimeKey(timeframe.end, 'day')}`;
      const key = `${locationKey}:${pollutantType}:${timeframeKey}`;

      const cached = await this.redis.get(key);
      if (!cached) {
        return null;
      }

      const parsedData = JSON.parse(cached);
      logger.debug(`Cache hit for trend analysis: ${key}`);
      return parsedData.analysis;
    } catch (error) {
      logger.error('Failed to get cached trend analysis:', error);
      return null;
    }
  }

  /**
   * Cache user dashboard data
   */
  async cacheUserDashboard(
    userId: string,
    dashboardData: any,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const key = `user_dashboard:${userId}`;
      const ttl = options.ttl || this.CACHE_TTL.USER_DASHBOARD;

      const cacheData = {
        data: dashboardData,
        timestamp: new Date().toISOString(),
        userId,
      };

      await this.redis.setEx(key, ttl, JSON.stringify(cacheData));
      logger.debug(`Cached user dashboard: ${key}`);
    } catch (error) {
      logger.error('Failed to cache user dashboard:', error);
    }
  }

  /**
   * Get cached user dashboard data
   */
  async getUserDashboard(
    userId: string,
    options: CacheOptions = {}
  ): Promise<any | null> {
    try {
      if (options.skipCache || options.forceRefresh) {
        return null;
      }

      const key = `user_dashboard:${userId}`;
      const cached = await this.redis.get(key);
      
      if (!cached) {
        return null;
      }

      const parsedData = JSON.parse(cached);
      logger.debug(`Cache hit for user dashboard: ${key}`);
      return parsedData.data;
    } catch (error) {
      logger.error('Failed to get cached user dashboard:', error);
      return null;
    }
  }

  /**
   * Cache community recommendations
   */
  async cacheRecommendations(
    location: LocationCacheKey,
    recommendations: CommunityRecommendation[],
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const key = this.generateLocationKey(location, 'recommendations');
      const ttl = options.ttl || this.CACHE_TTL.RECOMMENDATIONS;

      const cacheData = {
        recommendations,
        timestamp: new Date().toISOString(),
        location,
      };

      await this.redis.setEx(key, ttl, JSON.stringify(cacheData));
      logger.debug(`Cached recommendations: ${key}`);
    } catch (error) {
      logger.error('Failed to cache recommendations:', error);
    }
  }

  /**
   * Get cached recommendations
   */
  async getRecommendations(
    location: LocationCacheKey,
    options: CacheOptions = {}
  ): Promise<CommunityRecommendation[] | null> {
    try {
      if (options.skipCache || options.forceRefresh) {
        return null;
      }

      const key = this.generateLocationKey(location, 'recommendations');
      const cached = await this.redis.get(key);
      
      if (!cached) {
        return null;
      }

      const parsedData = JSON.parse(cached);
      logger.debug(`Cache hit for recommendations: ${key}`);
      return parsedData.recommendations;
    } catch (error) {
      logger.error('Failed to get cached recommendations:', error);
      return null;
    }
  }

  /**
   * Invalidate cache for a specific location
   */
  async invalidateLocationCache(location: LocationCacheKey): Promise<void> {
    try {
      const patterns = [
        this.generateLocationKey(location, 'current_conditions'),
        `${this.generateLocationKey(location, 'hourly_data')}:*`,
        `${this.generateLocationKey(location, 'trend_analysis')}:*`,
        this.generateLocationKey(location, 'recommendations'),
      ];

      for (const pattern of patterns) {
        if (pattern.includes('*')) {
          // Use SCAN for pattern matching
          const keys = await this.scanKeys(pattern);
          if (keys.length > 0) {
            await this.redis.del(keys);
          }
        } else {
          await this.redis.del(pattern);
        }
      }

      logger.info(`Invalidated cache for location: ${JSON.stringify(location)}`);
    } catch (error) {
      logger.error('Failed to invalidate location cache:', error);
    }
  }

  /**
   * Invalidate user-specific cache
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      const key = `user_dashboard:${userId}`;
      await this.redis.del(key);
      logger.debug(`Invalidated user cache: ${key}`);
    } catch (error) {
      logger.error('Failed to invalidate user cache:', error);
    }
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

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    hitRate: number;
  }> {
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      const stats = await this.redis.info('stats');

      // Parse memory usage
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'Unknown';

      // Parse total keys
      const keysMatch = keyspace.match(/keys=(\d+)/);
      const totalKeys = keysMatch ? parseInt(keysMatch[1]) : 0;

      // Parse hit rate
      const hitsMatch = stats.match(/keyspace_hits:(\d+)/);
      const missesMatch = stats.match(/keyspace_misses:(\d+)/);
      const hits = hitsMatch ? parseInt(hitsMatch[1]) : 0;
      const misses = missesMatch ? parseInt(missesMatch[1]) : 0;
      const hitRate = hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0;

      return {
        totalKeys,
        memoryUsage,
        hitRate: Math.round(hitRate * 100) / 100,
      };
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      return {
        totalKeys: 0,
        memoryUsage: 'Unknown',
        hitRate: 0,
      };
    }
  }
}

export const environmentalDataCache = new EnvironmentalDataCache();