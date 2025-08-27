// Notification Settings Screen for EcoSense.ai Mobile App
// Implements requirements 10.1, 10.3, 10.4: Notification preference management

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NotificationService} from '@/services/NotificationService';
import {NotificationPreferences} from '@/services/PushNotificationService';
import {logger} from '@/utils/logger';

interface NotificationSettingsScreenProps {
  navigation: any;
}

const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = ({navigation}) => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const prefs = NotificationService.getNotificationPreferences();
      setPreferences(prefs);
    } catch (error) {
      logger.error('Error loading notification preferences:', error);
      Alert.alert('Error', 'Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (newPreferences: NotificationPreferences) => {
    try {
      setSaving(true);
      await NotificationService.updateNotificationPreferences(newPreferences);
      setPreferences(newPreferences);
      Alert.alert('Success', 'Notification preferences updated');
    } catch (error) {
      logger.error('Error saving notification preferences:', error);
      Alert.alert('Error', 'Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: any) => {
    if (!preferences) return;
    
    const updated = {...preferences, [key]: value};
    setPreferences(updated);
    savePreferences(updated);
  };

  const updateQuietHours = (key: 'enabled' | 'start' | 'end', value: any) => {
    if (!preferences) return;
    
    const updated = {
      ...preferences,
      quietHours: {
        ...preferences.quietHours,
        [key]: value,
      },
    };
    setPreferences(updated);
    savePreferences(updated);
  };

  const showTimePickerAlert = (type: 'start' | 'end') => {
    const currentTime = preferences?.quietHours[type] || '22:00';
    const [hours, minutes] = currentTime.split(':').map(Number);
    
    // Simple time picker using alerts (in production, use a proper time picker)
    Alert.prompt(
      `Set ${type === 'start' ? 'Start' : 'End'} Time`,
      'Enter time in HH:MM format (24-hour)',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Set',
          onPress: (text) => {
            if (text && /^\d{2}:\d{2}$/.test(text)) {
              updateQuietHours(type, text);
            } else {
              Alert.alert('Invalid Format', 'Please use HH:MM format (e.g., 22:00)');
            }
          },
        },
      ],
      'plain-text',
      currentTime
    );
  };

  const testNotification = async () => {
    try {
      await NotificationService.testPushNotification();
      Alert.alert('Test Sent', 'Check your notifications for the test message');
    } catch (error) {
      logger.error('Error testing notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const clearHistory = async () => {
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
              Alert.alert('Error', 'Failed to clear notification history');
            }
          },
        },
      ]
    );
  };

  if (loading || !preferences) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading preferences...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Notification Settings</Text>
          <Text style={styles.subtitle}>
            Configure when and how you receive environmental alerts
          </Text>
        </View>

        {/* Main Toggle */}
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Enable Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive push notifications for environmental alerts
              </Text>
            </View>
            <Switch
              value={preferences.enabled}
              onValueChange={(value) => updatePreference('enabled', value)}
              disabled={saving}
            />
          </View>
        </View>

        {/* Notification Types */}
        {preferences.enabled && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Alert Types</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Pollution Alerts</Text>
                  <Text style={styles.settingDescription}>
                    Critical pollution level warnings
                  </Text>
                </View>
                <Switch
                  value={preferences.pollutionAlerts}
                  onValueChange={(value) => updatePreference('pollutionAlerts', value)}
                  disabled={saving}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Trend Alerts</Text>
                  <Text style={styles.settingDescription}>
                    Environmental trend changes
                  </Text>
                </View>
                <Switch
                  value={preferences.trendAlerts}
                  onValueChange={(value) => updatePreference('trendAlerts', value)}
                  disabled={saving}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Community Updates</Text>
                  <Text style={styles.settingDescription}>
                    Community activities and achievements
                  </Text>
                </View>
                <Switch
                  value={preferences.communityUpdates}
                  onValueChange={(value) => updatePreference('communityUpdates', value)}
                  disabled={saving}
                />
              </View>
            </View>

            {/* Severity Threshold */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Alert Sensitivity</Text>
              <Text style={styles.sectionDescription}>
                Minimum severity level for notifications
              </Text>
              
              {['info', 'warning', 'critical'].map((severity) => (
                <TouchableOpacity
                  key={severity}
                  style={[
                    styles.radioRow,
                    preferences.severityThreshold === severity && styles.radioRowSelected,
                  ]}
                  onPress={() => updatePreference('severityThreshold', severity)}
                  disabled={saving}
                >
                  <View style={[
                    styles.radioButton,
                    preferences.severityThreshold === severity && styles.radioButtonSelected,
                  ]} />
                  <Text style={[
                    styles.radioText,
                    preferences.severityThreshold === severity && styles.radioTextSelected,
                  ]}>
                    {severity.charAt(0).toUpperCase() + severity.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Location Radius */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location Radius</Text>
              <Text style={styles.sectionDescription}>
                Receive alerts within {preferences.locationRadius} km of your location
              </Text>
              
              {[5, 10, 25, 50].map((radius) => (
                <TouchableOpacity
                  key={radius}
                  style={[
                    styles.radioRow,
                    preferences.locationRadius === radius && styles.radioRowSelected,
                  ]}
                  onPress={() => updatePreference('locationRadius', radius)}
                  disabled={saving}
                >
                  <View style={[
                    styles.radioButton,
                    preferences.locationRadius === radius && styles.radioButtonSelected,
                  ]} />
                  <Text style={[
                    styles.radioText,
                    preferences.locationRadius === radius && styles.radioTextSelected,
                  ]}>
                    {radius} km
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quiet Hours */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quiet Hours</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Enable Quiet Hours</Text>
                  <Text style={styles.settingDescription}>
                    Only critical alerts during quiet hours
                  </Text>
                </View>
                <Switch
                  value={preferences.quietHours.enabled}
                  onValueChange={(value) => updateQuietHours('enabled', value)}
                  disabled={saving}
                />
              </View>

              {preferences.quietHours.enabled && (
                <>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => showTimePickerAlert('start')}
                    disabled={saving}
                  >
                    <Text style={styles.timeButtonLabel}>Start Time</Text>
                    <Text style={styles.timeButtonValue}>{preferences.quietHours.start}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => showTimePickerAlert('end')}
                    disabled={saving}
                  >
                    <Text style={styles.timeButtonLabel}>End Time</Text>
                    <Text style={styles.timeButtonValue}>{preferences.quietHours.end}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={testNotification}
            disabled={saving || !preferences.enabled}
          >
            <Text style={styles.actionButtonText}>Send Test Notification</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => navigation.navigate('NotificationHistory')}
            disabled={saving}
          >
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
              View Notification History
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonDanger]}
            onPress={clearHistory}
            disabled={saving}
          >
            <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>
              Clear Notification History
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            FCM Token: {NotificationService.getFCMToken()?.substring(0, 20)}...
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 20,
    backgroundColor: '#2E7D32',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#E8F5E8',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  radioRowSelected: {
    backgroundColor: '#E8F5E8',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 12,
  },
  radioButtonSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#2E7D32',
  },
  radioText: {
    fontSize: 16,
    color: '#333',
  },
  radioTextSelected: {
    color: '#2E7D32',
    fontWeight: '500',
  },
  timeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  timeButtonLabel: {
    fontSize: 16,
    color: '#333',
  },
  timeButtonValue: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '500',
  },
  actionButton: {
    backgroundColor: '#2E7D32',
    marginHorizontal: 20,
    marginVertical: 8,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2E7D32',
  },
  actionButtonDanger: {
    backgroundColor: '#d32f2f',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  actionButtonTextSecondary: {
    color: '#2E7D32',
  },
  actionButtonTextDanger: {
    color: '#fff',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
});

export default NotificationSettingsScreen;