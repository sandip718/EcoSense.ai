import { CacheWarmingService, PopularLocation } from '../CacheWarmingService';
import { environmentalDataCache } from '../EnvironmentalDataCache';
import { EnvironmentalDataRepository } from '@/models/EnvironmentalDataRepository';
import { InsightsEngine } from '../InsightsEngine';
import { CommunityRecommendationService } from '../CommunityRecommendationService';
import { getRedisClient } from '@/config/redis';

// Mock dependencies
jest.mock('../EnvironmentalDataCache');
jest.mock('@/models/EnvironmentalDataRepository');
jest.mock('../InsightsEngine');
jest.mock('../CommunityRecommendationService');
jest.mock('@/config/redis');

const mockRedisClient = {
  incr: jest.fn(),
  expire: jest.fn(),
  hSet: jest.fn(),
  hGetAll: jest.fn(),
  get: jest.fn(),
  scan: jest.fn(),
};

(getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);

describe('CacheWarmingService', () => {
  let service: CacheWarmingService;
  let mockEnvironmentalDataRepo: jest.Mocked<EnvironmentalDataRepository>;
  let mockInsightsEngine: jest.Mocked<InsightsEngine>;
  let mockRecommendationService: jest.Mocked<CommunityRecommendationService>;

  beforeEach(() => {
    service = new CacheWarmingService();
    mockEnvironmentalDataRepo = new EnvironmentalDataRepository() as jest.Mocked<EnvironmentalDataRepository>;
    mockInsightsEngine = new InsightsEngine() as jest.Mocked<InsightsEngine>;
    mockRecommendationService = new CommunityRecommendationService() as jest.Mocked<CommunityRecommendationService>;

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('trackLocationAccess', () => {
    it('should track location access with daily counter', async () => {
      const location = { latitude: 40.7128, longitude: -74.0060, radius: 5 };
      const today = new Date().toISOString().split('T')[0];

      await service.trackLocationAccess(location);

      expect(mockRedisClient.incr).toHaveBeenCalledWith(
        `location_access:40.7128:-74.006:5:${today}`
      );
      expect(mockRedisClient.expire).toHaveBeenCalledWith(
        `location_access:40.7128:-74.006:5:${today}`,
        86400 * 7 // 7 days
      );
      expect(mockRedisClient.hSet).toHaveBeenCalledWith(
        'location_access:40.7128:-74.006:5',
        expect.objectContaining({
          lastAccessed: expect.any(String),
          latitude: '40.7128',
          longitude: '-74.006',
          radius: '5'
        })
      );
    });

    it('should handle Redis errors gracefully', async () => {
      const location = { latitude: 40.7128, longitude: -74.0060, radius: 5 };
      mockRedisClient.incr.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(service.trackLocationAccess(location)).resolves.toBeUndefined();
    });
  });

  describe('getPopularLocations', () => {
    it('should return popular locations sorted by priority and request count', async () => {
      mockRedisClient.scan.mockResolvedValue({
        cursor: 0,
        keys: ['location_access:40.7128:-74.0060:5', 'location_access:34.0522:-118.2437:10']
      });

      mockRedisClient.hGetAll
        .mockResolvedValueOnce({
          latitude: '40.7128',
          longitude: '-74.0060',
          radius: '5',
          lastAccessed: new Date().toISOString()
        })
        .mockResolvedValueOnce({
          latitude: '34.0522',
          longitude: '-118.2437',
          radius: '10',
          lastAccessed: new Date().toISOString()
        });

      // Mock recent request counts
      mockRedisClient.get
        .mockResolvedValueOnce('150') // High count for first location
        .mockResolvedValueOnce('50'); // Medium count for second location

      const result = await service.getPopularLocations(10);

      expect(result).toHaveLength(2);
      expect(result[0].priority).toBe('high');
      expect(result[0].requestCount).toBe(150);
      expect(result[1].priority).toBe('medium');
      expect(result[1].requestCount).toBe(50);
    });

    it('should handle empty results gracefully', async () => {
      mockRedisClient.scan.mockResolvedValue({ cursor: 0, keys: [] });

      const result = await service.getPopularLocations(10);

      expect(result).toEqual([]);
    });

    it('should limit results to specified count', async () => {
      mockRedisClient.scan.mockResolvedValue({
        cursor: 0,
        keys: Array.from({ length: 100 }, (_, i) => `location_access:${i}:${i}:5`)
      });

      // Mock responses for all locations
      for (let i = 0; i < 100; i++) {
        mockRedisClient.hGetAll.mockResolvedValueOnce({
          latitude: i.toString(),
          longitude: i.toString(),
          radius: '5',
          lastAccessed: new Date().toISOString()
        });
        mockRedisClient.get.mockResolvedValueOnce('10');
      }

      const result = await service.getPopularLocations(5);

      expect(result).toHaveLength(5);
    });
  });

  describe('warmPopularLocations', () => {
    it('should warm cache for popular and priority locations', async () => {
      const mockPopularLocations: PopularLocation[] = [
        {
          location: { latitude: 40.7128, longitude: -74.0060, radius: 5 },
          requestCount: 100,
          lastAccessed: new Date(),
          priority: 'high'
        }
      ];

      // Mock getPopularLocations
      jest.spyOn(service, 'getPopularLocations').mockResolvedValue(mockPopularLocations);
      
      // Mock warmLocationCache
      jest.spyOn(service, 'warmLocationCache').mockResolvedValue();

      await service.warmPopularLocations();

      expect(service.warmLocationCache).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: 40.7128, longitude: -74.0060 })
      );
    });

    it('should handle warming errors gracefully', async () => {
      jest.spyOn(service, 'getPopularLocations').mockRejectedValue(new Error('Test error'));

      // Should not throw
      await expect(service.warmPopularLocations()).resolves.toBeUndefined();
    });
  });

  describe('warmLocationCache', () => {
    it('should warm all cache types for a location', async () => {
      const location = { latitude: 40.7128, longitude: -74.0060, radius: 5 };
      
      // Mock cache checks to return no cached data
      (environmentalDataCache.getCurrentConditions as jest.Mock).mockResolvedValue(null);
      (environmentalDataCache.getHourlyData as jest.Mock).mockResolvedValue([]);
      (environmentalDataCache.getTrendAnalysis as jest.Mock).mockResolvedValue(null);
      (environmentalDataCache.getRecommendations as jest.Mock).mockResolvedValue(null);

      // Mock data fetching
      mockEnvironmentalDataRepo.getByLocationAndTimeRange.mockResolvedValue([
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
      ]);

      mockInsightsEngine.analyzeTrends.mockResolvedValue({
        location,
        timeframe: { start: new Date(), end: new Date() },
        pollutantType: 'pm2.5',
        trend: { direction: 'stable', magnitude: 0, confidence: 0.8 },
        healthImpact: { riskLevel: 'low', affectedPopulation: 0, recommendations: [] }
      });

      mockRecommendationService.generateRecommendations.mockResolvedValue([]);

      await service.warmLocationCache(location);

      expect(environmentalDataCache.cacheCurrentConditions).toHaveBeenCalled();
      expect(environmentalDataCache.cacheHourlyData).toHaveBeenCalled();
      expect(environmentalDataCache.cacheTrendAnalysis).toHaveBeenCalled();
      expect(environmentalDataCache.cacheRecommendations).toHaveBeenCalled();
    });

    it('should skip warming if data is already cached', async () => {
      const location = { latitude: 40.7128, longitude: -74.0060, radius: 5 };
      
      // Mock cache checks to return cached data
      (environmentalDataCache.getCurrentConditions as jest.Mock).mockResolvedValue({
        data: [],
        timestamp: new Date().toISOString()
      });

      await service.warmLocationCache(location);

      // Should not fetch new data if already cached
      expect(mockEnvironmentalDataRepo.getByLocationAndTimeRange).not.toHaveBeenCalled();
    });

    it('should handle individual warming errors gracefully', async () => {
      const location = { latitude: 40.7128, longitude: -74.0060, radius: 5 };
      
      (environmentalDataCache.getCurrentConditions as jest.Mock).mockRejectedValue(new Error('Cache error'));

      // Should not throw
      await expect(service.warmLocationCache(location)).resolves.toBeUndefined();
    });
  });

  describe('schedulePeriodicWarming', () => {
    it('should schedule periodic warming', async () => {
      // Mock setInterval
      const mockSetInterval = jest.spyOn(global, 'setInterval').mockImplementation(() => 123 as any);
      const mockSetTimeout = jest.spyOn(global, 'setTimeout').mockImplementation(() => 456 as any);

      await service.schedulePeriodicWarming();

      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        30 * 60 * 1000 // 30 minutes
      );
      expect(mockSetTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        5000 // 5 seconds initial delay
      );

      mockSetInterval.mockRestore();
      mockSetTimeout.mockRestore();
    });
  });

  describe('priority calculation', () => {
    it('should calculate high priority for recent high-traffic locations', async () => {
      const location = { latitude: 40.7128, longitude: -74.0060, radius: 5 };
      const recentAccess = new Date();
      
      mockRedisClient.scan.mockResolvedValue({
        cursor: 0,
        keys: ['location_access:40.7128:-74.0060:5']
      });

      mockRedisClient.hGetAll.mockResolvedValue({
        latitude: '40.7128',
        longitude: '-74.0060',
        radius: '5',
        lastAccessed: recentAccess.toISOString()
      });

      mockRedisClient.get.mockResolvedValue('150'); // High request count

      const result = await service.getPopularLocations(1);

      expect(result[0].priority).toBe('high');
    });

    it('should calculate low priority for old low-traffic locations', async () => {
      const location = { latitude: 40.7128, longitude: -74.0060, radius: 5 };
      const oldAccess = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      
      mockRedisClient.scan.mockResolvedValue({
        cursor: 0,
        keys: ['location_access:40.7128:-74.0060:5']
      });

      mockRedisClient.hGetAll.mockResolvedValue({
        latitude: '40.7128',
        longitude: '-74.0060',
        radius: '5',
        lastAccessed: oldAccess.toISOString()
      });

      mockRedisClient.get.mockResolvedValue('5'); // Low request count

      const result = await service.getPopularLocations(1);

      expect(result[0].priority).toBe('low');
    });
  });
});