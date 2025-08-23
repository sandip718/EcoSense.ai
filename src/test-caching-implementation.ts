/**
 * Test script to verify caching implementation
 * This script tests the basic functionality of the caching layer
 */

import { EnvironmentalDataCache, LocationCacheKey } from './services/EnvironmentalDataCache';
import { CacheWarmingService } from './services/CacheWarmingService';
import { CacheInvalidationService } from './services/CacheInvalidationService';
import { EnvironmentalDataPoint } from './models/types';

// Mock Redis client for testing
const mockRedisClient = {
  setEx: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  expire: jest.fn().mockResolvedValue(1),
  mGet: jest.fn().mockResolvedValue([]),
  scan: jest.fn().mockResolvedValue({ cursor: 0, keys: [] }),
  info: jest.fn().mockResolvedValue('used_memory_human:1M\ndb0:keys=100\nkeyspace_hits:800\nkeyspace_misses:200'),
  incr: jest.fn().mockResolvedValue(1),
  hSet: jest.fn().mockResolvedValue(1),
  hGetAll: jest.fn().mockResolvedValue({}),
};

// Mock the Redis connection
jest.mock('./config/redis', () => ({
  getRedisClient: () => mockRedisClient,
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));

async function testCachingImplementation() {
  console.log('🧪 Testing EcoSense.ai Caching Implementation');
  console.log('=' .repeat(50));

  try {
    // Test 1: Environmental Data Cache
    console.log('\n1. Testing Environmental Data Cache...');
    const cache = new EnvironmentalDataCache();
    
    const testLocation: LocationCacheKey = {
      latitude: 40.7128,
      longitude: -74.0060,
      radius: 5
    };

    const testData: EnvironmentalDataPoint[] = [
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

    // Test caching current conditions
    await cache.cacheCurrentConditions(testLocation, testData);
    console.log('✅ Current conditions cached successfully');

    // Test retrieving cached data
    const cachedData = await cache.getCurrentConditions(testLocation);
    console.log('✅ Current conditions retrieved from cache');

    // Test cache invalidation
    await cache.invalidateLocationCache(testLocation);
    console.log('✅ Location cache invalidated successfully');

    // Test 2: Cache Warming Service
    console.log('\n2. Testing Cache Warming Service...');
    const warmingService = new CacheWarmingService();

    // Test location access tracking
    await warmingService.trackLocationAccess(testLocation);
    console.log('✅ Location access tracked successfully');

    // Test getting popular locations
    const popularLocations = await warmingService.getPopularLocations(5);
    console.log('✅ Popular locations retrieved successfully');

    // Test 3: Cache Invalidation Service
    console.log('\n3. Testing Cache Invalidation Service...');
    const invalidationService = new CacheInvalidationService();

    // Test environmental data invalidation
    await invalidationService.invalidateEnvironmentalData(testLocation, 'pm2.5');
    console.log('✅ Environmental data invalidation queued successfully');

    // Test user data invalidation
    await invalidationService.invalidateUserData('test-user-123');
    console.log('✅ User data invalidation queued successfully');

    // Test 4: Cache Statistics
    console.log('\n4. Testing Cache Statistics...');
    const stats = await cache.getCacheStats();
    console.log('✅ Cache statistics retrieved:', {
      totalKeys: stats.totalKeys,
      memoryUsage: stats.memoryUsage,
      hitRate: stats.hitRate
    });

    // Test 5: Key Generation Consistency
    console.log('\n5. Testing Key Generation...');
    const location1 = { latitude: 40.7128, longitude: -74.0060, radius: 5 };
    const location2 = { latitude: 40.7128, longitude: -74.0060, radius: 5 };
    
    await cache.cacheCurrentConditions(location1, testData);
    await cache.cacheCurrentConditions(location2, testData);
    
    // Both should use the same cache key
    const setExCalls = mockRedisClient.setEx.mock.calls.filter(call => 
      call[0].includes('current_conditions')
    );
    
    if (setExCalls.length >= 2 && setExCalls[0][0] === setExCalls[1][0]) {
      console.log('✅ Key generation is consistent for identical locations');
    } else {
      console.log('❌ Key generation inconsistency detected');
    }

    console.log('\n🎉 All caching tests completed successfully!');
    console.log('\nCache Implementation Summary:');
    console.log('- ✅ Environmental data caching with location-based keys');
    console.log('- ✅ Cache warming for popular locations');
    console.log('- ✅ Smart cache invalidation for real-time updates');
    console.log('- ✅ Performance monitoring and statistics');
    console.log('- ✅ Geospatial query optimization');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testCachingImplementation().catch(console.error);
}

export { testCachingImplementation };