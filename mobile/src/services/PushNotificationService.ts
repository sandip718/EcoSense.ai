// Push Notification Service for EcoSense.ai Mobile App
// Implements requirements 10.1, 10.3, 10.4: Mobile push notifications and real-time alerts

import messaging, {FirebaseMessagingTypes} from '@react-native-firebase/messaging';
import PushNotification, {Importance} from 'react-native-push-notification';
import {Platform, Alert, Linking} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {logger} from '@/utils/logger';
import {ApiService} from './ApiService';
import {LocationService} from './LocationService';

export interface NotificationPreferences {
  enabled: boolean;
  pollutionAlerts: boolean;
  trendAlerts: boolean;
  communityUpdates: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string; // HH:MM format
  };
  locationRadius: number; // in kilometers
  severityThreshold: 'info' | 'warning' | 'critical';
}

export interface PushNotificationData {
  type: 'pollution_alert' | 'trend_alert' | 'community_update' | 'general';
  severity: 'info' | 'warning' | 'critical';
  location?: {
    latitude: number;
    longitude: number;
  };
  pollutant?: string;
  value?: number;
  threshold?: number;
  actionUrl?: string;
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private fcmToken: string | null = null;
  private preferences: NotificationPreferences | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Initialize push notification service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Push Notification Service');

      // Configure local notifications
      this.configurePushNotification();

      // Request permission and get FCM token
      await this.requestPermissionAndGetToken();

      // Set up message handlers
      this.setupMessageHandlers();

      // Load user preferences
      await this.loadPreferences();

      // Register token with backend
      if (this.fcmToken) {
        await this.registerTokenWithBackend();
      }

      this.isInitialized = true;
      logger.info('Push Notification Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Push Notification Service:', error);
      throw error;
    }
  }

  /**
   * Configure local push notifications
   */
  private configurePushNotification(): void {
    PushNotification.configure({
      onRegister: (token) => {
        logger.info('Local notification token registered:', token);
      },

      onNotification: (notification) => {
        logger.info('Local notification received:', notification);
        
        // Handle notification tap
        if (notification.userInteraction) {
          this.handleNotificationTap(notification);
        }
      },

      onAction: (notification) => {
        logger.info('Notification action:', notification);
      },

      onRegistrationError: (err) => {
        logger.error('Local notification registration error:', err);
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    // Create notification channels for Android
    if (Platform.OS === 'android') {
      this.createNotificationChannels();
    }
  }

  /**
   * Create notification channels for Android
   */
  private createNotificationChannels(): void {
    const channels = [
      {
        channelId: 'pollution-alerts',
        channelName: 'Pollution Alerts',
        channelDescription: 'Critical pollution level alerts',
        importance: Importance.HIGH,
        vibrate: true,
        sound: 'default',
      },
      {
        channelId: 'trend-alerts',
        channelName: 'Trend Alerts',
        channelDescription: 'Environmental trend notifications',
        importance: Importance.DEFAULT,
        vibrate: false,
        sound: 'default',
      },
      {
        channelId: 'community-updates',
        channelName: 'Community Updates',
        channelDescription: 'Community activity and updates',
        importance: Importance.LOW,
        vibrate: false,
        sound: null,
      },
    ];

    channels.forEach(channel => {
      PushNotification.createChannel(channel, () => {
        logger.info(`Created notification channel: ${channel.channelId}`);
      });
    });
  }

  /**
   * Request notification permission and get FCM token
   */
  private async requestPermissionAndGetToken(): Promise<void> {
    try {
      // Check if permission is already granted
      const authStatus = await messaging().hasPermission();
      const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                     authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        // Request permission
        const newAuthStatus = await messaging().requestPermission();
        const isGranted = newAuthStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                         newAuthStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!isGranted) {
          logger.warn('Push notification permission denied');
          this.showPermissionDeniedAlert();
          return;
        }
      }

      // Get FCM token
      this.fcmToken = await messaging().getToken();
      logger.info('FCM token obtained:', this.fcmToken);

      // Save token locally
      await AsyncStorage.setItem('fcm_token', this.fcmToken);

    } catch (error) {
      logger.error('Error requesting notification permission:', error);
      throw error;
    }
  }

  /**
   * Set up Firebase message handlers
   */
  private setupMessageHandlers(): void {
    // Handle background messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      logger.info('Background message received:', remoteMessage);
      await this.handleBackgroundMessage(remoteMessage);
    });

    // Handle foreground messages
    messaging().onMessage(async (remoteMessage) => {
      logger.info('Foreground message received:', remoteMessage);
      await this.handleForegroundMessage(remoteMessage);
    });

    // Handle notification opened app
    messaging().onNotificationOpenedApp((remoteMessage) => {
      logger.info('Notification opened app:', remoteMessage);
      this.handleNotificationOpen(remoteMessage);
    });

    // Check if app was opened from a notification
    messaging().getInitialNotification().then((remoteMessage) => {
      if (remoteMessage) {
        logger.info('App opened from notification:', remoteMessage);
        this.handleNotificationOpen(remoteMessage);
      }
    });

    // Handle token refresh
    messaging().onTokenRefresh(async (token) => {
      logger.info('FCM token refreshed:', token);
      this.fcmToken = token;
      await AsyncStorage.setItem('fcm_token', token);
      await this.registerTokenWithBackend();
    });
  }

  /**
   * Handle background message
   */
  private async handleBackgroundMessage(remoteMessage: FirebaseMessagingTypes.RemoteMessage): Promise<void> {
    try {
      const data = remoteMessage.data as PushNotificationData;
      
      // Check if notification should be shown based on preferences
      if (!this.shouldShowNotification(data)) {
        return;
      }

      // Show local notification
      this.showLocalNotification({
        title: remoteMessage.notification?.title || 'EcoSense Alert',
        message: remoteMessage.notification?.body || 'New environmental update',
        data: data,
      });

    } catch (error) {
      logger.error('Error handling background message:', error);
    }
  }

  /**
   * Handle foreground message
   */
  private async handleForegroundMessage(remoteMessage: FirebaseMessagingTypes.RemoteMessage): Promise<void> {
    try {
      const data = remoteMessage.data as PushNotificationData;
      
      // Check if notification should be shown based on preferences
      if (!this.shouldShowNotification(data)) {
        return;
      }

      // Show local notification even in foreground for critical alerts
      if (data.severity === 'critical') {
        this.showLocalNotification({
          title: remoteMessage.notification?.title || 'Critical Alert',
          message: remoteMessage.notification?.body || 'Critical environmental alert',
          data: data,
        });
      }

    } catch (error) {
      logger.error('Error handling foreground message:', error);
    }
  }

  /**
   * Handle notification open
   */
  private handleNotificationOpen(remoteMessage: FirebaseMessagingTypes.RemoteMessage): void {
    try {
      const data = remoteMessage.data as PushNotificationData;
      
      // Navigate to appropriate screen based on notification type
      this.navigateFromNotification(data);

    } catch (error) {
      logger.error('Error handling notification open:', error);
    }
  }

  /**
   * Handle notification tap
   */
  private handleNotificationTap(notification: any): void {
    try {
      const data = notification.data as PushNotificationData;
      this.navigateFromNotification(data);
    } catch (error) {
      logger.error('Error handling notification tap:', error);
    }
  }

  /**
   * Show local notification
   */
  private showLocalNotification(params: {
    title: string;
    message: string;
    data: PushNotificationData;
  }): void {
    const channelId = this.getChannelIdForType(params.data.type);
    
    PushNotification.localNotification({
      title: params.title,
      message: params.message,
      channelId: channelId,
      userInfo: params.data,
      priority: params.data.severity === 'critical' ? 'high' : 'default',
      vibrate: params.data.severity === 'critical',
      playSound: true,
      soundName: 'default',
    });
  }

  /**
   * Get notification channel ID for type
   */
  private getChannelIdForType(type: string): string {
    switch (type) {
      case 'pollution_alert':
        return 'pollution-alerts';
      case 'trend_alert':
        return 'trend-alerts';
      case 'community_update':
        return 'community-updates';
      default:
        return 'pollution-alerts';
    }
  }

  /**
   * Check if notification should be shown based on preferences
   */
  private shouldShowNotification(data: PushNotificationData): boolean {
    if (!this.preferences?.enabled) {
      return false;
    }

    // Check type-specific preferences
    switch (data.type) {
      case 'pollution_alert':
        if (!this.preferences.pollutionAlerts) return false;
        break;
      case 'trend_alert':
        if (!this.preferences.trendAlerts) return false;
        break;
      case 'community_update':
        if (!this.preferences.communityUpdates) return false;
        break;
    }

    // Check severity threshold
    const severityLevels = ['info', 'warning', 'critical'];
    const dataSeverityIndex = severityLevels.indexOf(data.severity);
    const thresholdIndex = severityLevels.indexOf(this.preferences.severityThreshold);
    
    if (dataSeverityIndex < thresholdIndex) {
      return false;
    }

    // Check quiet hours
    if (this.preferences.quietHours.enabled && this.isInQuietHours()) {
      // Only show critical alerts during quiet hours
      return data.severity === 'critical';
    }

    // Check location radius if location data is available
    if (data.location && this.preferences.locationRadius > 0) {
      return this.isWithinLocationRadius(data.location);
    }

    return true;
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(): boolean {
    if (!this.preferences?.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = this.preferences.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = this.preferences.quietHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      // Same day range
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight range
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Check if location is within notification radius
   */
  private async isWithinLocationRadius(notificationLocation: {latitude: number; longitude: number}): Promise<boolean> {
    try {
      const userLocation = await LocationService.getCurrentLocation();
      if (!userLocation) {
        return true; // Show notification if we can't determine user location
      }

      const distance = this.calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        notificationLocation.latitude,
        notificationLocation.longitude
      );

      return distance <= (this.preferences?.locationRadius || 10);
    } catch (error) {
      logger.error('Error checking location radius:', error);
      return true; // Show notification on error
    }
  }

  /**
   * Calculate distance between two coordinates in kilometers
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Navigate from notification
   */
  private navigateFromNotification(data: PushNotificationData): void {
    // This would typically use navigation service
    // For now, just log the intended navigation
    logger.info('Should navigate based on notification:', data);
    
    if (data.actionUrl) {
      Linking.openURL(data.actionUrl).catch(err => {
        logger.error('Error opening notification URL:', err);
      });
    }
  }

  /**
   * Register FCM token with backend
   */
  private async registerTokenWithBackend(): Promise<void> {
    try {
      if (!this.fcmToken) {
        logger.warn('No FCM token available for registration');
        return;
      }

      await ApiService.registerPushToken({
        token: this.fcmToken,
        platform: Platform.OS,
        deviceId: await this.getDeviceId(),
      });

      logger.info('FCM token registered with backend');
    } catch (error) {
      logger.error('Error registering FCM token with backend:', error);
    }
  }

  /**
   * Get device ID for token registration
   */
  private async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('device_id', deviceId);
      }
      return deviceId;
    } catch (error) {
      logger.error('Error getting device ID:', error);
      return `${Platform.OS}_${Date.now()}`;
    }
  }

  /**
   * Load notification preferences
   */
  private async loadPreferences(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('notification_preferences');
      if (stored) {
        this.preferences = JSON.parse(stored);
      } else {
        // Set default preferences
        this.preferences = this.getDefaultPreferences();
        await this.savePreferences(this.preferences);
      }
    } catch (error) {
      logger.error('Error loading notification preferences:', error);
      this.preferences = this.getDefaultPreferences();
    }
  }

  /**
   * Get default notification preferences
   */
  private getDefaultPreferences(): NotificationPreferences {
    return {
      enabled: true,
      pollutionAlerts: true,
      trendAlerts: true,
      communityUpdates: false,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
      },
      locationRadius: 10, // 10km default
      severityThreshold: 'warning',
    };
  }

  /**
   * Save notification preferences
   */
  async savePreferences(preferences: NotificationPreferences): Promise<void> {
    try {
      this.preferences = preferences;
      await AsyncStorage.setItem('notification_preferences', JSON.stringify(preferences));
      
      // Update backend with new preferences
      await ApiService.updateNotificationPreferences(preferences);
      
      logger.info('Notification preferences saved');
    } catch (error) {
      logger.error('Error saving notification preferences:', error);
      throw error;
    }
  }

  /**
   * Get current notification preferences
   */
  getPreferences(): NotificationPreferences | null {
    return this.preferences;
  }

  /**
   * Get FCM token
   */
  getToken(): string | null {
    return this.fcmToken;
  }

  /**
   * Show permission denied alert
   */
  private showPermissionDeniedAlert(): void {
    Alert.alert(
      'Notifications Disabled',
      'Push notifications are disabled. You can enable them in Settings to receive environmental alerts.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Open Settings', 
          onPress: () => Linking.openSettings()
        }
      ]
    );
  }

  /**
   * Test notification (for development)
   */
  async testNotification(): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('Push notification service not initialized');
      return;
    }

    this.showLocalNotification({
      title: 'Test Notification',
      message: 'This is a test notification from EcoSense.ai',
      data: {
        type: 'general',
        severity: 'info',
      },
    });
  }

  /**
   * Clear all notifications
   */
  clearAllNotifications(): void {
    PushNotification.cancelAllLocalNotifications();
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(): Promise<any[]> {
    try {
      const history = await AsyncStorage.getItem('notification_history');
      return history ? JSON.parse(history) : [];
    } catch (error) {
      logger.error('Error getting notification history:', error);
      return [];
    }
  }

  /**
   * Clear notification history
   */
  async clearNotificationHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem('notification_history');
    } catch (error) {
      logger.error('Error clearing notification history:', error);
    }
  }
}

export default PushNotificationService.getInstance();