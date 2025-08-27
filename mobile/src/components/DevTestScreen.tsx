// Development Test Screen Component
// Use this screen to test mobile app functionality during development

import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {testMobileApp} from '../test-mobile-app';
import {LocationService} from '../services/LocationService';
import {CameraService} from '../services/CameraService';
import {OfflineService} from '../services/OfflineService';
import {PermissionManager} from '../utils/permissions';
import {logger} from '../utils/logger';
import NotificationTestPanel from './NotificationTestPanel';

const DevTestScreen: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showNotificationTests, setShowNotificationTests] = useState(false);

  const addResult = (result: string) => {
    setTestResults(prev => [...prev, result]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const runFullTestSuite = async () => {
    setIsRunning(true);
    clearResults();
    
    try {
      addResult('🧪 Starting full test suite...');
      
      // Capture console output
      const originalLog = console.log;
      console.log = (...args) => {
        addResult(args.join(' '));
        originalLog(...args);
      };

      await testMobileApp();
      
      // Restore console
      console.log = originalLog;
      
      addResult('✅ Test suite completed');
    } catch (error) {
      addResult(`❌ Test suite failed: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const testLocationService = async () => {
    try {
      addResult('📍 Testing Location Service...');
      
      const hasPermission = await LocationService.checkPermission();
      addResult(`Location permission: ${hasPermission ? 'granted' : 'denied'}`);
      
      if (hasPermission) {
        const location = await LocationService.getCurrentLocation();
        addResult(`Current location: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`);
      } else {
        addResult('Requesting location permission...');
        const granted = await LocationService.requestPermission();
        addResult(`Permission ${granted ? 'granted' : 'denied'}`);
      }
    } catch (error) {
      addResult(`❌ Location test failed: ${error}`);
    }
  };

  const testCameraService = async () => {
    try {
      addResult('📷 Testing Camera Service...');
      
      const hasPermission = await CameraService.checkPermission();
      addResult(`Camera permission: ${hasPermission ? 'granted' : 'denied'}`);
      
      if (!hasPermission) {
        addResult('Requesting camera permission...');
        const granted = await CameraService.requestPermission();
        addResult(`Permission ${granted ? 'granted' : 'denied'}`);
      }
      
      // Test image validation
      const validation = CameraService.validateImageForAnalysis('file://test.jpg');
      addResult(`Image validation: ${validation.valid ? 'pass' : 'fail'}`);
      
    } catch (error) {
      addResult(`❌ Camera test failed: ${error}`);
    }
  };

  const testOfflineService = async () => {
    try {
      addResult('📱 Testing Offline Service...');
      
      await OfflineService.initialize();
      addResult('Offline service initialized');
      
      // Test caching
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
      addResult(`Cached data: ${cached.length} items`);
      
      // Test cache size
      const size = await OfflineService.getCacheSize();
      addResult(`Cache size: ${size} bytes`);
      
    } catch (error) {
      addResult(`❌ Offline test failed: ${error}`);
    }
  };

  const testPermissions = async () => {
    try {
      addResult('🔐 Testing Permissions...');
      
      const statuses = await PermissionManager.getAllPermissionStatuses();
      addResult(`Location: ${statuses.location}`);
      addResult(`Camera: ${statuses.camera}`);
      addResult(`Notifications: ${statuses.notifications}`);
      
      const hasCritical = await PermissionManager.checkCriticalPermissions();
      addResult(`Critical permissions: ${hasCritical ? 'granted' : 'missing'}`);
      
    } catch (error) {
      addResult(`❌ Permission test failed: ${error}`);
    }
  };

  const testLogger = () => {
    addResult('📝 Testing Logger...');
    
    logger.debug('Debug message test');
    logger.info('Info message test');
    logger.warn('Warning message test');
    logger.error('Error message test');
    
    logger.userAction('test_action', {screen: 'DevTestScreen'});
    logger.performance('test_operation', 100);
    
    addResult('Logger test completed - check console for output');
  };

  const showAlert = (title: string, message: string) => {
    Alert.alert(title, message, [{text: 'OK'}]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Icon name="bug-report" size={32} color="#FF5722" />
        <Text style={styles.title}>Development Test Screen</Text>
        <Text style={styles.subtitle}>Test mobile app functionality</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Tests</Text>
        
        <TouchableOpacity
          style={[styles.testButton, styles.primaryButton]}
          onPress={runFullTestSuite}
          disabled={isRunning}>
          <Icon name="play-arrow" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>
            {isRunning ? 'Running Tests...' : 'Run Full Test Suite'}
          </Text>
        </TouchableOpacity>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.testButton, styles.secondaryButton]}
            onPress={testLocationService}>
            <Icon name="location-on" size={16} color="#2E7D32" />
            <Text style={styles.secondaryButtonText}>Location</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testButton, styles.secondaryButton]}
            onPress={testCameraService}>
            <Icon name="camera-alt" size={16} color="#2E7D32" />
            <Text style={styles.secondaryButtonText}>Camera</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.testButton, styles.secondaryButton]}
            onPress={testOfflineService}>
            <Icon name="cloud-off" size={16} color="#2E7D32" />
            <Text style={styles.secondaryButtonText}>Offline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testButton, styles.secondaryButton]}
            onPress={testPermissions}>
            <Icon name="security" size={16} color="#2E7D32" />
            <Text style={styles.secondaryButtonText}>Permissions</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.testButton, styles.secondaryButton]}
          onPress={testLogger}>
          <Icon name="description" size={16} color="#2E7D32" />
          <Text style={styles.secondaryButtonText}>Test Logger</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, styles.primaryButton]}
          onPress={() => setShowNotificationTests(!showNotificationTests)}>
          <Icon name="notifications" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>
            {showNotificationTests ? 'Hide' : 'Show'} Notification Tests
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.resultsHeader}>
          <Text style={styles.sectionTitle}>Test Results</Text>
          <TouchableOpacity onPress={clearResults} style={styles.clearButton}>
            <Icon name="clear" size={16} color="#666666" />
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resultsContainer}>
          {testResults.length === 0 ? (
            <Text style={styles.noResults}>No test results yet. Run a test to see output.</Text>
          ) : (
            testResults.map((result, index) => (
              <Text key={index} style={styles.resultText}>
                {result}
              </Text>
            ))
          )}
        </View>
      </View>

      {showNotificationTests && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔔 Push Notification Tests</Text>
          <NotificationTestPanel />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual Tests</Text>
        <Text style={styles.manualTestText}>
          • Try navigating between tabs{'\n'}
          • Test pull-to-refresh on Home screen{'\n'}
          • Check offline indicators{'\n'}
          • Verify permission prompts{'\n'}
          • Test camera capture flow{'\n'}
          • Test push notifications (use button above){'\n'}
          • Check notification settings in Profile{'\n'}
          • Check Redux DevTools (if available)
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#2E7D32',
  },
  secondaryButton: {
    backgroundColor: '#E8F5E8',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    flex: 1,
    marginHorizontal: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  clearButtonText: {
    color: '#666666',
    fontSize: 12,
    marginLeft: 4,
  },
  resultsContainer: {
    backgroundColor: '#F8F8F8',
    padding: 12,
    borderRadius: 6,
    maxHeight: 300,
  },
  noResults: {
    color: '#999999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  resultText: {
    fontSize: 12,
    color: '#333333',
    marginBottom: 2,
    fontFamily: 'monospace',
  },
  manualTestText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
});

export default DevTestScreen;