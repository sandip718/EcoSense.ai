// Notification Service for Mobile App
// Implements requirements 10.1, 10.3, 10.4: Mobile push notifications and real-time alerts

import {ApiService} from './ApiService';
import {Notification} from '@/types/api';
import PushNotificationService, {NotificationPreferences} from './PushNotificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {logger} from '@/utils/logger';

export interface NotificationHistory {
  id: string;
  title: string;
  message: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  receivedAt: Date;
  readAt?: Date;
  data?: any;
}

export class NotificationService {
  private static notificationHistory: NotificationHistory[] = [];

  /**
   * Initialize notification service
   */
  static async initialize(): Promise<void> {
    try {
      logger.info('Initializing Notification Service');
      
      // Initialize push notification service
      await PushNotificationService.initialize();
      
      // Load notification history
      await this.loadNotificationHistory();
      
      logger.info('Notification Service initialized');
    } catch (error) {
      logger.error('Error initializing Notification Service:', error);
      throw error;
    }
  }

  /**
   * Get notifications from API
   */
  static async getNotifications(): Promise<Notification[]> {
    try {
      return await ApiService.getNotifications();
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<void> {
    try {
      await ApiService.markNotificationAsRead(notificationId);
      
      // Update local history
      const historyItem = this.notificationHistory.find(n => n.id === notificationId);
      if (historyItem && !historyItem.readAt) {
        historyItem.readAt = new Date();
        await this.saveNotificationHistory();
      }
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(): Promise<void> {
    try {
      await ApiService.markAllNotificationsAsRead();
      
      // Update local history
      this.notificationHistory.forEach(notification => {
        if (!notification.readAt) {
          notification.readAt = new Date();
        }
      });
      await this.saveNotificationHistory();
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Get notification preferences
   */
  static getNotificationPreferences(): NotificationPreferences | null {
    return PushNotificationService.getPreferences();
  }

  /**
   * Update notification preferences
   */
  static async updateNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
    try {
      await PushNotificationService.savePreferences(preferences);
      logger.info('Notification preferences updated');
    } catch (error) {
      logger.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  /**
   * Get FCM token
   */
  static getFCMToken(): string | null {
    return PushNotificationService.getToken();
  }

  /**
   * Test push notification
   */
  static async testPushNotification(): Promise<void> {
    try {
      await PushNotificationService.testNotification();
    } catch (error) {
      logger.error('Error testing push notification:', error);
      throw error;
    }
  }

  /**
   * Get notification history
   */
  static getNotificationHistory(): NotificationHistory[] {
    return [...this.notificationHistory].sort((a, b) => 
      new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
  }

  /**
   * Add notification to history
   */
  static async addToHistory(notification: Omit<NotificationHistory, 'id' | 'receivedAt'>): Promise<void> {
    try {
      const historyItem: NotificationHistory = {
        ...notification,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        receivedAt: new Date(),
      };

      this.notificationHistory.unshift(historyItem);
      
      // Keep only last 100 notifications
      if (this.notificationHistory.length > 100) {
        this.notificationHistory = this.notificationHistory.slice(0, 100);
      }

      await this.saveNotificationHistory();
    } catch (error) {
      logger.error('Error adding notification to history:', error);
    }
  }

  /**
   * Clear notification history
   */
  static async clearNotificationHistory(): Promise<void> {
    try {
      this.notificationHistory = [];
      await AsyncStorage.removeItem('notification_history');
      await PushNotificationService.clearNotificationHistory();
      logger.info('Notification history cleared');
    } catch (error) {
      logger.error('Error clearing notification history:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  static getUnreadCount(): number {
    return this.notificationHistory.filter(n => !n.readAt).length;
  }

  /**
   * Mark history item as read
   */
  static async markHistoryItemAsRead(historyId: string): Promise<void> {
    try {
      const item = this.notificationHistory.find(n => n.id === historyId);
      if (item && !item.readAt) {
        item.readAt = new Date();
        await this.saveNotificationHistory();
      }
    } catch (error) {
      logger.error('Error marking history item as read:', error);
    }
  }

  /**
   * Clear all notifications from system tray
   */
  static clearAllNotifications(): void {
    PushNotificationService.clearAllNotifications();
  }

  /**
   * Check if notifications are enabled
   */
  static areNotificationsEnabled(): boolean {
    const preferences = PushNotificationService.getPreferences();
    return preferences?.enabled ?? false;
  }

  /**
   * Get notification statistics
   */
  static getNotificationStats(): {
    total: number;
    unread: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    const stats = {
      total: this.notificationHistory.length,
      unread: this.getUnreadCount(),
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
    };

    this.notificationHistory.forEach(notification => {
      // Count by type
      stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
      
      // Count by severity
      stats.bySeverity[notification.severity] = (stats.bySeverity[notification.severity] || 0) + 1;
    });

    return stats;
  }

  /**
   * Load notification history from storage
   */
  private static async loadNotificationHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('notification_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.notificationHistory = parsed.map((item: any) => ({
          ...item,
          receivedAt: new Date(item.receivedAt),
          readAt: item.readAt ? new Date(item.readAt) : undefined,
        }));
      }
    } catch (error) {
      logger.error('Error loading notification history:', error);
      this.notificationHistory = [];
    }
  }

  /**
   * Save notification history to storage
   */
  private static async saveNotificationHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem('notification_history', JSON.stringify(this.notificationHistory));
    } catch (error) {
      logger.error('Error saving notification history:', error);
    }
  }
}