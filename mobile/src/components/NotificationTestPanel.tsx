// Notification Test Panel Component
// For testing push notification functionality during development

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import {NotificationService} from '@/services/NotificationService';
import PushNotificationService from '@/services/PushNotificationService';
import LocationBasedAlertService from '@/services/LocationBasedAlertService';
import {logger} from '@/utils/logger';

const NotificationTestPanel: React.FC = () => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<any>(null);
  const [monitoringStats, setMonitoringStats] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const token = NotificationService.getFCMToken();
    const prefs = NotificationService.getNotificationPreferences();
    const stats = LocationBasedAlertService.getMonitoringStats();
    
    setFcmToken(token);
    setPreferences(prefs);
    setMonitoringStats(stats);
  };

  const testLocalNotification = async () => {
    try {
      await NotificationService.testPushNotification();
      Alert.alert('Success', 'Test notification sent');
    } catch (error) {
      logger.error('Error testing notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const testPollutionAlert = async () => {
    try {
      await NotificationService.addToHistory({
        title: 'Test Pollution Alert',
        message: 'PM2.5 levels have reached 45 μg/m³, exceeding the warning threshold of 35 μg/m³. Consider limiting outdoor activities.',
        type: 'pollution_alert',
        severity: 'warning',
        data: {
          type: 'pollution_alert',
          severity: 'warning',
          pollutant: 'pm2.5',
          value: 45,
          threshold: 35,
        },
      });
      Alert.alert('Success', 'Test pollution alert added to history');
    } catch (error) {
      Alert.alert('Error', 'Failed to add test alert');
    }
  };

  const testCriticalAlert = async () => {
    try {
      await NotificationService.addToHistory({
        title: 'Critical Air Quality Alert',
        message: 'PM2.5 levels have reached 85 μg/m³, exceeding the critical threshold of 55 μg/m³. Avoid outdoor activities and stay indoors.',
        type: 'pollution_alert',
        severity: 'critical',
        data: {
          type: 'pollution_alert',
          severity: 'critical',
          pollutant: 'pm2.5',
          value: 85,
          threshold: 55,
        },
      });
      Alert.alert('Success', 'Test critical alert added to history');
    } catch (error) {
      Alert.alert('Error', 'Failed to add test critical alert');
    }
  };

  const forceAlertCheck = async () => {
    try {
      await LocationBasedAlertService.forceCheckAllRules();
      Alert.alert('Success', 'Forced alert check completed');
      loadData(); // Refresh stats
    } catch (error) {
      Alert.alert('Error', 'Failed to force alert check');
    }
  };

  const clearNotificationHistory = async () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all notification history?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await NotificationService.clearNotificationHistory();
              Alert.alert('Success', 'Notification history cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear history');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Notification Test Panel</Text>
      
      {/* FCM Token Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>FCM Token</Text>
        <Text style={styles.tokenText}>
          {fcmToken ? `${fcmToken.substring(0, 50)}...` : 'No token available'}
        </Text>
      </View>

      {/* Preferences Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <Text style={styles.infoText}>
          Enabled: {preferences?.enabled ? 'Yes' : 'No'}
        </Text>
        <Text style={styles.infoText}>
          Pollution Alerts: {preferences?.pollutionAlerts ? 'Yes' : 'No'}
        </Text>
        <Text style={styles.infoText}>
          Severity Threshold: {preferences?.severityThreshold || 'N/A'}
        </Text>
        <Text style={styles.infoText}>
          Location Radius: {preferences?.locationRadius || 'N/A'} km
        </Text>
      </View>

      {/* Monitoring Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alert Monitoring</Text>
        <Text style={styles.infoText}>
          Active: {monitoringStats?.isActive ? 'Yes' : 'No'}
        </Text>
        <Text style={styles.infoText}>
          Rules: {monitoringStats?.enabledRulesCount || 0} / {monitoringStats?.rulesCount || 0}
        </Text>
        <Text style={styles.infoText}>
          Last Check: {monitoringStats?.lastCheckTime?.toLocaleTimeString() || 'Never'}
        </Text>
      </View>

      {/* Test Buttons */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Actions</Text>
        
        <TouchableOpacity style={styles.testButton} onPress={testLocalNotification}>
          <Text style={styles.buttonText}>Send Test Notification</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.testButton} onPress={testPollutionAlert}>
          <Text style={styles.buttonText}>Add Test Warning Alert</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.testButton} onPress={testCriticalAlert}>
          <Text style={styles.buttonText}>Add Test Critical Alert</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.testButton} onPress={forceAlertCheck}>
          <Text style={styles.buttonText}>Force Alert Check</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.testButton, styles.dangerButton]} 
          onPress={clearNotificationHistory}
        >
          <Text style={styles.buttonText}>Clear History</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
        <Text style={styles.buttonText}>Refresh Data</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  tokenText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  testButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: '#d32f2f',
  },
  refreshButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default NotificationTestPanel;