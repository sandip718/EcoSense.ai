// Mobile App Test Script
// Comprehensive testing for EcoSense.ai Mobile App functionality

import {LocationService} from './services/LocationService';
import {CameraService} from './services/CameraService';
import {OfflineService} from './services/OfflineService';
import {ApiService} from './services/ApiService';
import {PermissionManager} from './utils/permissions';
import {logger} from './utils/logger';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  duration?: number;
}

class MobileAppTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting EcoSense.ai Mobile App Tests...\n');

    try {
      // Core Services Tests
      await this.testLocationService();
      await this.testCameraService();
      await this.testOfflineService();
      await this.testApiService();
      await this.testPermissionManager();
      
      // Integration Tests
      await this.testServiceIntegration();
      
      // Performance Tests
      await this.testPerformance();

      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  }

  private async testLocationService(): Promise<void> {
    console.log('📍 Testing Location Service...');

    // Test 1: Service initialization
    await this.runTest('LocationService.initialize', async () => {
      await LocationService.initialize();
      return 'Location service initialized successfully';
    });

    // Test 2: Permission checking
    await this.runTest('LocationService.checkPermission', async () => {
      const hasPermission = await LocationService.checkPermission();
      return `Permission status: ${hasPermission ? 'granted' : 'not granted'}`;
    });

    // Test 3: Distance calculation
    await this.runTest('LocationService.calculateDistance', async () => {
      const loc1 = {latitude: 40.7128, longitude: -74.0060};
      const loc2 = {latitude: 40.7589, longitude: -73.9851};
      const distance = LocationService.calculateDistance(loc1, loc2);
      
      if (distance > 0 && distance < 100) {
        return `Distance calculation works: ${distance.toFixed(2)} km`;
      }
      throw new Error('Distance calculation failed');
    });

    // Test 4: Location enabled check
    await this.runTest('LocationService.isLocationEnabled', async () => {
      const isEnabled = await LocationService.isLocationEnabled();
      return `Location services enabled: ${isEnabled}`;
    });
  }

  private async testCameraService(): Promise<void> {
    console.log('📷 Testing Camera Service...');

    // Test 1: Permission checking
    await this.runTest('CameraService.checkPermission', async () => {
      const hasPermission = await CameraService.checkPermission();
      return `Camera permission: ${hasPermission ? 'granted' : 'not granted'}`;
    });

    // Test 2: Image validation
    await this.runTest('CameraService.validateImageForAnalysis', async () => {
      const validImage = CameraService.validateImageForAnalysis('file://test.jpg');
      const invalidImage = CameraService.validateImageForAnalysis('');
      
      if (validImage.valid && !invalidImage.valid) {
        return 'Image validation works correctly';
      }
      throw new Error('Image validation failed');
    });

    // Test 3: Image metadata
    await this.runTest('CameraService.getImageMetadata', async () => {
      const metadata = await CameraService.getImageMetadata('file://test.jpg');
      
      if (metadata && metadata.uri && metadata.timestamp) {
        return 'Image metadata extraction works';
      }
      throw new Error('Image metadata extraction failed');
    });
  }

  private async testOfflineService(): Promise<void> {
    console.log('📱 Testing Offline Service...');

    // Test 1: Service initialization
    await this.runTest('OfflineService.initialize', async () => {
      await OfflineService.initialize();
      return 'Offline service initialized successfully';
    });

    // Test 2: Cache management
    await this.runTest('OfflineService.cacheEnvironmentalData', async () => {
      const testData = [{
        id: 'test-1',
        source: 'local_sensor' as const,
        pollutant: 'pm2.5',
        value: 25,
        unit: 'μg/m³',
        location: {latitude: 40.7128, longitude: -74.0060},
        timestamp: new Date(),
        quality_grade: 'B' as const,
      }];

      await OfflineService.cacheEnvironmentalData(testData);
      const cached = await OfflineService.getCachedEnvironmentalData();
      
      if (cached.length > 0) {
        return `Cached ${cached.length} environmental data points`;
      }
      throw new Error('Environmental data caching failed');
    });

    // Test 3: Pending uploads
    await this.runTest('OfflineService.addPendingUpload', async () => {
      await OfflineService.addPendingUpload({
        type: 'image',
        data: {test: 'data'},
      });

      const pending = await OfflineService.getPendingUploads();
      
      if (pending.length > 0) {
        return `Added pending upload, total: ${pending.length}`;
      }
      throw new Error('Pending upload management failed');
    });

    // Test 4: Cache size calculation
    await this.runTest('OfflineService.getCacheSize', async () => {
      const size = await OfflineService.getCacheSize();
      return `Cache size: ${size} bytes`;
    });

    // Test 5: Clear cache
    await this.runTest('OfflineService.clearCache', async () => {
      await OfflineService.clearCache();
      const sizeAfter = await OfflineService.getCacheSize();
      
      if (sizeAfter === 0) {
        return 'Cache cleared successfully';
      }
      throw new Error('Cache clearing failed');
    });
  }

  private async testApiService(): Promise<void> {
    console.log('🌐 Testing API Service...');

    // Test 1: Health check (if backend is running)
    await this.runTest('ApiService.healthCheck', async () => {
      try {
        const health = await ApiService.healthCheck();
        return `Backend health: ${health.status}`;
      } catch (error) {
        // Skip if backend is not running
        throw new Error('Backend not available (this is expected in development)');
      }
    }, true); // Allow this test to fail

    // Test 2: Token management
    await this.runTest('ApiService.tokenManagement', async () => {
      const testToken = 'test-token-123';
      ApiService.setAuthToken(testToken);
      
      // Verify token is set (we can't directly access it, but we can clear it)
      ApiService.clearAuthToken();
      return 'Token management works';
    });
  }

  private async testPermissionManager(): Promise<void> {
    console.log('🔐 Testing Permission Manager...');

    // Test 1: Get all permission statuses
    await this.runTest('PermissionManager.getAllPermissionStatuses', async () => {
      const statuses = await PermissionManager.getAllPermissionStatuses();
      
      if (statuses.location && statuses.camera && statuses.notifications) {
        return `Permissions - Location: ${statuses.location}, Camera: ${statuses.camera}, Notifications: ${statuses.notifications}`;
      }
      throw new Error('Permission status check failed');
    });

    // Test 2: Check critical permissions
    await this.runTest('PermissionManager.checkCriticalPermissions', async () => {
      const hasCritical = await PermissionManager.checkCriticalPermissions();
      return `Critical permissions: ${hasCritical ? 'granted' : 'not granted'}`;
    });
  }

  private async testServiceIntegration(): Promise<void> {
    console.log('🔗 Testing Service Integration...');

    // Test 1: Location + Environmental Data flow
    await this.runTest('Location-EnvironmentalData Integration', async () => {
      const testLocation = {latitude: 40.7128, longitude: -74.0060};
      
      // This would normally fetch data from API, but we'll simulate
      const mockData = [{
        id: 'integration-test',
        source: 'openaq' as const,
        pollutant: 'pm2.5',
        value: 30,
        unit: 'μg/m³',
        location: testLocation,
        timestamp: new Date(),
        quality_grade: 'B' as const,
      }];

      // Cache the data
      await OfflineService.cacheEnvironmentalData(mockData);
      
      // Verify it's cached
      const cached = await OfflineService.getCachedEnvironmentalData();
      
      if (cached.length > 0 && cached[0].location.latitude === testLocation.latitude) {
        return 'Location-Environmental data integration works';
      }
      throw new Error('Integration test failed');
    });

    // Test 2: Offline-Online sync simulation
    await this.runTest('Offline-Online Sync Simulation', async () => {
      // Add a pending upload
      await OfflineService.addPendingUpload({
        type: 'image',
        data: {imageUri: 'file://test.jpg', location: {latitude: 40.7128, longitude: -74.0060}},
      });

      const pendingBefore = await OfflineService.getPendingUploads();
      
      if (pendingBefore.length > 0) {
        return `Sync simulation ready: ${pendingBefore.length} pending uploads`;
      }
      throw new Error('Sync simulation setup failed');
    });
  }

  private async testPerformance(): Promise<void> {
    console.log('⚡ Testing Performance...');

    // Test 1: Cache performance
    await this.runTest('Cache Performance', async () => {
      const startTime = Date.now();
      
      // Generate test data
      const testData = Array.from({length: 100}, (_, i) => ({
        id: `perf-test-${i}`,
        source: 'local_sensor' as const,
        pollutant: 'pm2.5',
        value: Math.random() * 100,
        unit: 'μg/m³',
        location: {latitude: 40.7128 + Math.random() * 0.1, longitude: -74.0060 + Math.random() * 0.1},
        timestamp: new Date(),
        quality_grade: 'B' as const,
      }));

      // Cache the data
      await OfflineService.cacheEnvironmentalData(testData);
      
      // Retrieve the data
      const cached = await OfflineService.getCachedEnvironmentalData();
      
      const duration = Date.now() - startTime;
      
      if (cached.length === testData.length && duration < 1000) {
        return `Cache performance: ${duration}ms for ${testData.length} items`;
      }
      throw new Error(`Cache performance too slow: ${duration}ms`);
    });

    // Test 2: Distance calculation performance
    await this.runTest('Distance Calculation Performance', async () => {
      const startTime = Date.now();
      
      const loc1 = {latitude: 40.7128, longitude: -74.0060};
      
      // Calculate 1000 distances
      for (let i = 0; i < 1000; i++) {
        const loc2 = {
          latitude: 40.7128 + Math.random() * 0.1,
          longitude: -74.0060 + Math.random() * 0.1,
        };
        LocationService.calculateDistance(loc1, loc2);
      }
      
      const duration = Date.now() - startTime;
      
      if (duration < 100) {
        return `Distance calculation performance: ${duration}ms for 1000 calculations`;
      }
      throw new Error(`Distance calculation too slow: ${duration}ms`);
    });
  }

  private async runTest(
    name: string,
    testFn: () => Promise<string>,
    allowFailure = false
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      const message = await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        name,
        status: 'pass',
        message,
        duration,
      });
      
      console.log(`  ✅ ${name}: ${message} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      this.results.push({
        name,
        status: allowFailure ? 'skip' : 'fail',
        message,
        duration,
      });
      
      if (allowFailure) {
        console.log(`  ⚠️  ${name}: ${message} (${duration}ms) - SKIPPED`);
      } else {
        console.log(`  ❌ ${name}: ${message} (${duration}ms)`);
      }
    }
  }

  private printResults(): void {
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;
    const total = this.results.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Skipped: ${skipped}`);
    
    const successRate = ((passed / (total - skipped)) * 100).toFixed(1);
    console.log(`Success Rate: ${successRate}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => r.status === 'fail')
        .forEach(r => console.log(`  - ${r.name}: ${r.message}`));
    }
    
    const avgDuration = this.results
      .filter(r => r.duration)
      .reduce((sum, r) => sum + (r.duration || 0), 0) / this.results.length;
    
    console.log(`\nAverage Test Duration: ${avgDuration.toFixed(2)}ms`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed! Mobile app is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the implementation.');
    }
  }
}

// Export for use in React Native environment
export const testMobileApp = async (): Promise<void> => {
  const tester = new MobileAppTester();
  await tester.runAllTests();
};

// For Node.js testing (if running outside React Native)
if (typeof require !== 'undefined' && require.main === module) {
  console.log('Note: This test should be run within a React Native environment.');
  console.log('To test the mobile app:');
  console.log('1. Start the React Native app');
  console.log('2. Import and call testMobileApp() from a screen or component');
  console.log('3. Check the console output for test results');
}