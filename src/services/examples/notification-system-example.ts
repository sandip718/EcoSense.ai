/**
 * EcoSense.ai Notification System Example
 * 
 * This example demonstrates how to use the real-time notification system
 * to manage user notification preferences, generate alerts, and handle
 * push notifications for environmental conditions.
 */

import { NotificationService } from '../NotificationService';
import { PushNotificationService } from '../PushNotificationService';
import { AlertTriggerService } from '../AlertTriggerService';
import { NotificationWorker } from '../NotificationWorker';
import { logger } from '../../utils/logger';

async function demonstrateNotificationSystem() {
  const notificationService = new NotificationService();
  const pushService = new PushNotificationService();
  const alertTriggerService = new AlertTriggerService();
  const worker = new NotificationWorker();

  try {
    logger.info('=== EcoSense.ai Notification System Demo ===');

    // 1. Create notification rules for a user
    logger.info('\n1. Creating notification rules...');
    
    const notificationRule = await notificationService.createNotificationRule({
      user_id: 'demo-user-123',
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        radius: 5 // 5km radius around NYC
      },
      triggers: {
        pollutant_thresholds: {
          'PM2.5': 25,    // Alert when PM2.5 > 25 µg/m³
          'PM10': 50,     // Alert when PM10 > 50 µg/m³
          'NO2': 40,      // Alert when NO2 > 40 µg/m³
          'O3': 120       // Alert when O3 > 120 µg/m³
        },
        trend_alerts: true,        // Receive trend alerts
        community_updates: false,  // Skip community updates
        health_warnings: true      // Receive health warnings
      },
      delivery_methods: ['push'],
      active: true
    });

    logger.info(`Created notification rule: ${notificationRule.id}`);

    // 2. Register device token for push notifications
    logger.info('\n2. Registering device token...');
    
    await pushService.registerDeviceToken(
      'demo-user-123',
      'demo-device-token-ios-123',
      'ios'
    );

    logger.info('Device token registered successfully');

    // 3. Generate different types of alerts
    logger.info('\n3. Generating alerts...');

    // Threshold breach alert
    const thresholdAlert = await notificationService.generatePollutantAlert(
      { latitude: 40.7128, longitude: -74.0060 },
      'PM2.5',
      45,      // Current value
      'µg/m³',
      25       // Threshold value
    );

    logger.info(`Generated threshold alert: ${thresholdAlert?.id}`);

    // Health warning alert
    const healthAlert = await notificationService.generateHealthWarning(
      { latitude: 40.7128, longitude: -74.0060 },
      ['PM2.5', 'NO2'],
      'high'
    );

    logger.info(`Generated health warning: ${healthAlert?.id}`);

    // Trend alert
    const trendAlert = await notificationService.generateTrendAlert(
      { latitude: 40.7128, longitude: -74.0060 },
      'PM2.5',
      'worsening',
      0.3
    );

    logger.info(`Generated trend alert: ${trendAlert?.id}`);

    // 4. Check queue status
    logger.info('\n4. Checking notification queue status...');
    
    const queueStatus = await notificationService.getQueueStatus();
    logger.info('Queue status:', queueStatus);

    // 5. Process notifications (normally done by worker)
    logger.info('\n5. Processing notification queue...');
    
    await worker.processOnce();
    logger.info('Processed notification queue');

    // 6. Demonstrate alert trigger service
    logger.info('\n6. Demonstrating automatic alert triggering...');

    // Simulate environmental data that would trigger alerts
    const mockEnvironmentalData = [
      {
        id: 'data-1',
        source: 'openaq' as const,
        pollutant: 'PM2.5',
        value: 55, // High value that should trigger alert
        unit: 'µg/m³',
        location: { latitude: 40.7128, longitude: -74.0060 },
        timestamp: new Date(),
        quality_grade: 'A' as const,
        created_at: new Date()
      },
      {
        id: 'data-2',
        source: 'openaq' as const,
        pollutant: 'NO2',
        value: 65, // High value that should trigger alert
        unit: 'µg/m³',
        location: { latitude: 40.7128, longitude: -74.0060 },
        timestamp: new Date(),
        quality_grade: 'A' as const,
        created_at: new Date()
      }
    ];

    await alertTriggerService.checkForThresholdBreaches(mockEnvironmentalData);
    logger.info('Checked for threshold breaches');

    await alertTriggerService.checkForHealthWarnings(
      { latitude: 40.7128, longitude: -74.0060 },
      10
    );
    logger.info('Checked for health warnings');

    // 7. Get user's notification rules
    logger.info('\n7. Retrieving user notification rules...');
    
    const userRules = await notificationService.getUserNotificationRules('demo-user-123');
    logger.info(`User has ${userRules.length} notification rules`);

    // 8. Update notification rule
    logger.info('\n8. Updating notification rule...');
    
    const updatedRule = await notificationService.updateNotificationRule(
      notificationRule.id,
      {
        triggers: {
          ...notificationRule.triggers,
          community_updates: true // Enable community updates
        }
      }
    );

    logger.info(`Updated rule: ${updatedRule?.id}`);

    // 9. Final queue status
    logger.info('\n9. Final queue status...');
    
    const finalQueueStatus = await notificationService.getQueueStatus();
    logger.info('Final queue status:', finalQueueStatus);

    logger.info('\n=== Notification System Demo Complete ===');

  } catch (error) {
    logger.error('Error in notification system demo:', error);
    throw error;
  }
}

// Example of how to integrate with environmental data monitoring
async function integrateWithDataMonitoring() {
  const alertTriggerService = new AlertTriggerService();
  
  logger.info('=== Environmental Data Monitoring Integration ===');

  // This would typically be called when new environmental data is received
  const simulateDataIngestion = async () => {
    // Simulate receiving new environmental data
    const newData = [
      {
        id: 'data-3',
        source: 'local_sensor' as const,
        pollutant: 'PM2.5',
        value: 75, // Very high value
        unit: 'µg/m³',
        location: { latitude: 40.7589, longitude: -73.9851 }, // Central Park
        timestamp: new Date(),
        quality_grade: 'A' as const,
        created_at: new Date()
      }
    ];

    // Check if this data should trigger any alerts
    await alertTriggerService.checkForThresholdBreaches(newData);
    
    // Check for health warnings in the area
    await alertTriggerService.checkForHealthWarnings(
      newData[0].location,
      5 // 5km radius
    );

    logger.info('Processed new environmental data for alerts');
  };

  await simulateDataIngestion();
}

// Example of notification preferences management
async function demonstratePreferencesManagement() {
  const notificationService = new NotificationService();
  
  logger.info('=== Notification Preferences Management ===');

  // Create different types of notification rules for different scenarios
  
  // 1. Sensitive user - wants all alerts with low thresholds
  const sensitiveUserRule = await notificationService.createNotificationRule({
    user_id: 'sensitive-user-456',
    location: {
      latitude: 34.0522,
      longitude: -118.2437,
      radius: 3 // Smaller radius for more precise alerts
    },
    triggers: {
      pollutant_thresholds: {
        'PM2.5': 15,    // Lower threshold
        'PM10': 30,     // Lower threshold
        'NO2': 25,      // Lower threshold
        'O3': 80        // Lower threshold
      },
      trend_alerts: true,
      community_updates: true,
      health_warnings: true
    },
    delivery_methods: ['push', 'email'], // Multiple delivery methods
    active: true
  });

  // 2. Casual user - only wants critical alerts
  const casualUserRule = await notificationService.createNotificationRule({
    user_id: 'casual-user-789',
    location: {
      latitude: 41.8781,
      longitude: -87.6298,
      radius: 10 // Larger radius
    },
    triggers: {
      pollutant_thresholds: {
        'PM2.5': 50,    // Higher threshold - only critical alerts
        'PM10': 100,    // Higher threshold
        'NO2': 80,      // Higher threshold
        'O3': 200       // Higher threshold
      },
      trend_alerts: false,      // No trend alerts
      community_updates: false, // No community updates
      health_warnings: true     // Only health warnings
    },
    delivery_methods: ['push'],
    active: true
  });

  logger.info(`Created sensitive user rule: ${sensitiveUserRule.id}`);
  logger.info(`Created casual user rule: ${casualUserRule.id}`);
}

// Run examples if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      await demonstrateNotificationSystem();
      await integrateWithDataMonitoring();
      await demonstratePreferencesManagement();
    } catch (error) {
      logger.error('Example execution failed:', error);
      process.exit(1);
    }
  })();
}

export {
  demonstrateNotificationSystem,
  integrateWithDataMonitoring,
  demonstratePreferencesManagement
};