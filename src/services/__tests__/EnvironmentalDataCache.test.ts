import { EnvironmentalDataCache, LocationCacheKey } from '../EnvironmentalDataCache';
import { EnvironmentalDataPoint, TrendAnalysis, CommunityRecommendation } from '@/models/types';
import { getRedisClient } from '@/config/redis';

// Mock Redis client
jest.mock('@/config/redis');
const mockRedisClient = {
  setEx: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  mGet: jest.fn(),
  scan: jest.fn(),
  info: jest.fn(),
};

(getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);

describe('EnvironmentalDataCache', () => {
  let cache: EnvironmentalDataCache;
  let mockLocation: LocationCacheKey;
  let mockData: EnvironmentalDataPoint[];

  beforeEach(() => {
    cache = new EnvironmentalDataCache();
    mockLocation = {
      latitude: 40.7128,
      longitude: -74.0060,
      radius: 5
    };
    
    mockData = [
      {
        id: '1',
        source: 'openaq',
        pollutant: 'pm2.5',
        value: 25.5,
        unit: 'µg/m³',
        location: { latitude: 40.7128, longitude: -74.0060 },
        timestamp: new Date(),
        quality_grade: 'B'
      }
    ];

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('cacheCurrentConditions', () => {
    it('should cache current conditions with correct key and TTL', async () => {
      await cache.cacheCurrentConditions(mockLocation, mockData);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'current_conditions:40.713:-74.006:5',
        300, // 5 minutes TTL
        expect.stringContaining('"data"')
      );
    });

    it('should handle caching errors gracefully', async () => {
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(cache.cacheCurrentConditions(mockLocation, mockData)).resolves.toBeUndefined();
    });
  });

  describe('getCurrentConditions', () => {
    it('should return cached data when available', async () => {
      const cachedData = {
        data: mockData,
        timestamp: new Date().toISOString(),
        location: mockLocation
      };
      
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await cache.getCurrentConditions(mockLocation);

      expect(result).toEqual(cachedData);
      expect(mockRedisClient.get).toHaveBeenCalledWith('current_conditions:40.713:-74.006:5');
    });

    it('should return null when no cached data exists', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await cache.getCurrentConditions(mockLocation);

      expect(result).toBeNull();
    });

    it('should skip cache when skipCache option is true', async () => {
      const result = await cache.getCurrentConditions(mockLocation, { skipCache: true });

      expect(result).toBeNull();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await cache.getCurrentConditions(mockLocation);

      expect(result).toBeNull();
    });
  });

  describe('cacheHourlyData', () => {
    it('should cache hourly data with time-based key', async () => {
      const timestamp = new Date('2023-01-01T10:00:00Z');
      
      await cache.cacheHourlyData(mockLocation, timestamp, mockData);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'hourly_data:40.713:-74.006:5:2023-0-1-10',
        3600, // 1 hour TTL
        expect.stringContaining('"data"')
      );
    });
  });

  describe('getHourlyData', () => {
    it('should retrieve hourly data for time range', async () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const endTime = new Date('2023-01-01T12:00:00Z');
      
      const cachedData = {
        data: mockData,
        timestamp: startTime.toISOString(),
        location: mockLocation
      };

      mockRedisClient.mGet.mockResolvedValue([
        JSON.stringify(cachedData),
        JSON.stringify(cachedData),
        JSON.stringify(cachedData)
      ]);

      const result = await cache.getHourlyData(mockLocation, startTime, endTime);

      expect(result).toHaveLength(3); // 3 data points (one for each hour)
      expect(mockRedisClient.mGet).toHaveBeenCalledWith([
        'hourly_data:40.713:-74.006:5:2023-0-1-10',
        'hourly_data:40.713:-74.006:5:2023-0-1-11',
        'hourly_data:40.713:-74.006:5:2023-0-1-12'
      ]);
    });

    it('should return empty array when skipCache is true', async () => {
      const startTime = new Date();
      const endTime = new Date();

      const result = await cache.getHourlyData(mockLocation, startTime, endTime, { skipCache: true });

      expect(result).toEqual([]);
      expect(mockRedisClient.mGet).not.toHaveBeenCalled();
    });
  });

  describe('cacheTrendAnalysis', () => {
    it('should cache trend analysis with location and pollutant key', async () => {
      const timeframe = {
        start: new Date('2023-01-01'),
        end: new Date('2023-01-07')
      };
      const pollutantType = 'pm2.5';
      const analysis: TrendAnalysis = {
        location: mockLocation,
        timeframe,
        pollutantType,
        trend: {
          direction: 'improving',
          magnitude: 0.1,
          confidence: 0.8
        },
        healthImpact: {
          riskLevel: 'low',
          affectedPopulation: 1000,
          recommendations: ['Continue monitoring']
        }
      };

      await cache.cacheTrendAnalysis(mockLocation, timeframe, pollutantType, analysis);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'trend_analysis:40.713:-74.006:5:pm2.5:2023-0-1_2023-0-7',
        86400, // 24 hours TTL
        expect.stringContaining('"analysis"')
      );
    });
  });

  describe('cacheUserDashboard', () => {
    it('should cache user dashboard data', async () => {
      const userId = 'user123';
      const dashboardData = { summary: 'test data' };

      await cache.cacheUserDashboard(userId, dashboardData);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'user_dashboard:user123',
        600, // 10 minutes TTL
        expect.stringContaining('"data"')
      );
    });
  });

  describe('invalidateLocationCache', () => {
    it('should invalidate all location-related cache keys', async () => {
      mockRedisClient.scan.mockResolvedValue({
        cursor: 0,
        keys: ['hourly_data:40.713:-74.006:5:2023-0-1-10']
      });

      await cache.invalidateLocationCache(mockLocation);

      expect(mockRedisClient.del).toHaveBeenCalledWith('current_conditions:40.713:-74.006:5');
      expect(mockRedisClient.del).toHaveBeenCalledWith('recommendations:40.713:-74.006:5');
      expect(mockRedisClient.del).toHaveBeenCalledWith(['hourly_data:40.713:-74.006:5:2023-0-1-10']);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      mockRedisClient.info.mockImplementation((section: string) => {
        if (section === 'memory') return 'used_memory_human:1.5M';
        if (section === 'keyspace') return 'db0:keys=100,expires=50';
        if (section === 'stats') return 'keyspace_hits:800\nkeyspace_misses:200';
        return '';
      });

      const stats = await cache.getCacheStats();

      expect(stats).toEqual({
        totalKeys: 100,
        memoryUsage: '1.5M',
        hitRate: 80
      });
    });

    it('should handle Redis info errors gracefully', async () => {
      mockRedisClient.info.mockRejectedValue(new Error('Redis error'));

      const stats = await cache.getCacheStats();

      expect(stats).toEqual({
        totalKeys: 0,
        memoryUsage: 'Unknown',
        hitRate: 0
      });
    });
  });

  describe('key generation', () => {
    it('should generate consistent location keys', async () => {
      const location1 = { latitude: 40.7128, longitude: -74.0060, radius: 5 };
      const location2 = { latitude: 40.7128, longitude: -74.0060, radius: 5 };

      await cache.cacheCurrentConditions(location1, mockData);
      await cache.cacheCurrentConditions(location2, mockData);

      // Should use the same key for identical locations
      expect(mockRedisClient.setEx).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.setEx).toHaveBeenNthCalledWith(1, 
        'current_conditions:40.713:-74.006:5', 
        expect.any(Number), 
        expect.any(String)
      );
      expect(mockRedisClient.setEx).toHaveBeenNthCalledWith(2, 
        'current_conditions:40.713:-74.006:5', 
        expect.any(Number), 
        expect.any(String)
      );
    });

    it('should round coordinates for consistent keys', async () => {
      const location = { latitude: 40.712834, longitude: -74.006012, radius: 5.123 };

      await cache.cacheCurrentConditions(location, mockData);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'current_conditions:40.713:-74.006:5.12',
        expect.any(Number),
        expect.any(String)
      );
    });
  });
});