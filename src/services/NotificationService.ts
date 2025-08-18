import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { NotificationRuleRepository } from '../models/NotificationRuleRepository';
import { AlertRepository } from '../models/AlertRepository';
import { PushNotificationService } from './PushNotificationService';
import {
  Alert,
  CreateAlert,
  NotificationRule,
  CreateNotificationRule,
  Location,
  EnvironmentalDataPoint,
  NotificationQueueItem,
  PushNotificationPayload
} from '../models/types';
import { v4 as uuidv4 } from 'uuid';

export class NotificationService {
  private redis;
  private notificationRuleRepo: NotificationRuleRepository;
  private alertRepo: AlertRepository;
  private pushService: PushNotificationService;
  
  // Redis key patterns
  private readonly QUEUE_KEY = 'notification:queue';
  private readonly PROCESSING_KEY = 'notification:processing';
  private readonly RETRY_KEY = 'notification:retry';
  private readonly USER_PREFERENCES_KEY = 'notification:user_prefs';

  constructor() {
    this.redis = getRedisClient();
    this.notificationRuleRepo = new NotificationRuleRepository();
    this.alertRepo = new AlertRepository();
    this.pushService = new PushNotificationService();
  }

  // Notification Rule Management
  async createNotificationRule(rule: CreateNotificationRule): Promise<NotificationRule> {
    try {
      const createdRule = await this.notificationRuleRepo.create(rule);
      
      // Cache user preferences for quick access
      await this.cacheUserPreferences(rule.user_id);
      
      logger.info(`Created notification rule for user ${rule.user_id}`);
      return createdRule;
    } catch (error) {
      logger.error('Error creating notification rule:', error);
      throw error;
    }
  }

  async getUserNotificationRules(userId: string): Promise<NotificationRule[]> {
    try {
      return await this.notificationRuleRepo.findByUserId(userId);
    } catch (error) {
      logger.error('Error getting user notification rules:', error);
      throw error;
    }
  }

  async updateNotificationRule(id: string, updates: Partial<CreateNotificationRule>): Promise<NotificationRule | null> {
    try {
      const updatedRule = await this.notificationRuleRepo.update(id, updates);
      
      if (updatedRule) {
        // Update cached preferences
        await this.cacheUserPreferences(updatedRule.user_id);
        logger.info(`Updated notification rule ${id}`);
      }
      
      return updatedRule;
    } catch (error) {
      logger.error('Error updating notification rule:', error);
      throw error;
    }
  }

  async deleteNotificationRule(id: string): Promise<boolean> {
    try {
      return await this.notificationRuleRepo.delete(id);
    } catch (error) {
      logger.error('Error deleting notification rule:', error);
      throw error;
    }
  }

  // Alert Generation
  async generatePollutantAlert(
    location: Location,
    pollutant: string,
    currentValue: number,
    unit: string,
    thresholdValue: number
  ): Promise<Alert | null> {
    try {
      // Determine severity based on how much the threshold is exceeded
      const exceedanceRatio = currentValue / thresholdValue;
      let severity: 'info' | 'warning' | 'critical';
      
      if (exceedanceRatio >= 2.0) {
        severity = 'critical';
      } else if (exceedanceRatio >= 1.5) {
        severity = 'warning';
      } else {
        severity = 'info';
      }

      const alert: CreateAlert = {
        type: 'threshold_breach',
        severity,
        title: `${pollutant} Level Alert`,
        message: `${pollutant} levels have reached ${currentValue} ${unit}, exceeding the safe threshold of ${thresholdValue} ${unit}. Consider limiting outdoor activities.`,
        location,
        affected_radius: this.calculateAffectedRadius(severity),
        pollutant,
        current_value: currentValue,
        threshold_value: thresholdValue,
        expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000) // 6 hours
      };

      const createdAlert = await this.alertRepo.create(alert);
      
      // Queue notifications for affected users
      await this.queueNotificationsForAlert(createdAlert);
      
      logger.info(`Generated ${severity} alert for ${pollutant} at ${location.latitude}, ${location.longitude}`);
      return createdAlert;
    } catch (error) {
      logger.error('Error generating pollutant alert:', error);
      throw error;
    }
  }

  async generateTrendAlert(
    location: Location,
    pollutant: string,
    trendDirection: 'improving' | 'worsening',
    magnitude: number
  ): Promise<Alert | null> {
    try {
      if (trendDirection === 'improving') {
        // Only generate alerts for significant improvements
        if (magnitude < 0.2) return null;
      }

      const severity = trendDirection === 'worsening' ? 'warning' : 'info';
      const trendText = trendDirection === 'worsening' ? 'deteriorating' : 'improving';
      
      const alert: CreateAlert = {
        type: 'trend_alert',
        severity,
        title: `${pollutant} Trend Alert`,
        message: `${pollutant} levels have been ${trendText} in your area over the past week. ${trendDirection === 'worsening' ? 'Consider taking precautions.' : 'Great news for outdoor activities!'}`,
        location,
        affected_radius: 5.0, // 5km radius for trend alerts
        pollutant,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };

      const createdAlert = await this.alertRepo.create(alert);
      await this.queueNotificationsForAlert(createdAlert);
      
      logger.info(`Generated trend alert for ${pollutant} (${trendDirection}) at ${location.latitude}, ${location.longitude}`);
      return createdAlert;
    } catch (error) {
      logger.error('Error generating trend alert:', error);
      throw error;
    }
  }

  async generateHealthWarning(
    location: Location,
    pollutants: string[],
    riskLevel: 'moderate' | 'high' | 'very_high'
  ): Promise<Alert | null> {
    try {
      const severity = riskLevel === 'very_high' ? 'critical' : 'warning';
      const pollutantList = pollutants.join(', ');
      
      const alert: CreateAlert = {
        type: 'health_warning',
        severity,
        title: 'Health Advisory',
        message: `Health advisory issued for your area due to elevated ${pollutantList} levels. ${this.getHealthRecommendation(riskLevel)}`,
        location,
        affected_radius: this.calculateAffectedRadius(severity),
        expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours
      };

      const createdAlert = await this.alertRepo.create(alert);
      await this.queueNotificationsForAlert(createdAlert);
      
      logger.info(`Generated health warning (${riskLevel}) at ${location.latitude}, ${location.longitude}`);
      return createdAlert;
    } catch (error) {
      logger.error('Error generating health warning:', error);
      throw error;
    }
  }

  // Notification Queue Management
  async queueNotificationsForAlert(alert: Alert): Promise<void> {
    try {
      // Find users who should receive this alert
      const affectedUsers = await this.findAffectedUsers(alert);
      
      if (affectedUsers.length === 0) {
        logger.info(`No users found for alert ${alert.id}`);
        return;
      }

      const queueItem: NotificationQueueItem = {
        id: uuidv4(),
        alert,
        target_users: affectedUsers.map(u => u.user_id),
        delivery_methods: this.consolidateDeliveryMethods(affectedUsers),
        retry_count: 0,
        max_retries: 3,
        scheduled_at: new Date(),
        created_at: new Date()
      };

      // Add to Redis queue
      await this.redis.lPush(this.QUEUE_KEY, JSON.stringify(queueItem));
      
      logger.info(`Queued notifications for alert ${alert.id} to ${affectedUsers.length} users`);
    } catch (error) {
      logger.error('Error queueing notifications for alert:', error);
      throw error;
    }
  }

  async processNotificationQueue(): Promise<void> {
    try {
      // Process items from the queue
      const queueItem = await this.redis.brPop(
        { key: this.QUEUE_KEY, timeout: 5 },
      );

      if (!queueItem) {
        return; // No items in queue
      }

      const item: NotificationQueueItem = JSON.parse(queueItem.element);
      
      // Move to processing set
      await this.redis.sAdd(this.PROCESSING_KEY, item.id);
      
      try {
        await this.deliverNotifications(item);
        
        // Remove from processing set on success
        await this.redis.sRem(this.PROCESSING_KEY, item.id);
        
        logger.info(`Successfully processed notification queue item ${item.id}`);
      } catch (error) {
        logger.error(`Error processing notification queue item ${item.id}:`, error);
        
        // Handle retry logic
        await this.handleNotificationRetry(item, error);
      }
    } catch (error) {
      logger.error('Error processing notification queue:', error);
    }
  }

  async deliverNotifications(queueItem: NotificationQueueItem): Promise<void> {
    const { alert, target_users, delivery_methods } = queueItem;
    
    const deliveryPromises: Promise<void>[] = [];

    for (const userId of target_users) {
      // Get user's preferred delivery methods
      const userPrefs = await this.getUserPreferences(userId);
      const userDeliveryMethods = userPrefs?.delivery_methods || ['push'];

      for (const method of userDeliveryMethods) {
        if (delivery_methods.includes(method)) {
          deliveryPromises.push(this.deliverNotification(userId, alert, method));
        }
      }
    }

    await Promise.allSettled(deliveryPromises);
  }

  async deliverNotification(userId: string, alert: Alert, method: 'push' | 'email' | 'sms'): Promise<void> {
    try {
      switch (method) {
        case 'push':
          await this.deliverPushNotification(userId, alert);
          break;
        case 'email':
          // Email delivery would be implemented here
          logger.info(`Email notification delivery not implemented for user ${userId}`);
          break;
        case 'sms':
          // SMS delivery would be implemented here
          logger.info(`SMS notification delivery not implemented for user ${userId}`);
          break;
      }
    } catch (error) {
      logger.error(`Error delivering ${method} notification to user ${userId}:`, error);
      throw error;
    }
  }

  async deliverPushNotification(userId: string, alert: Alert): Promise<void> {
    const payload: PushNotificationPayload = {
      user_id: userId,
      title: alert.title,
      body: alert.message,
      data: {
        alert_id: alert.id,
        location: alert.location,
        severity: alert.severity,
        type: alert.type
      },
      priority: alert.severity === 'critical' ? 'high' : 'normal'
    };

    await this.pushService.sendNotification(payload);
  }

  // Helper methods
  private async findAffectedUsers(alert: Alert): Promise<{ user_id: string; delivery_methods: string[] }[]> {
    if (alert.pollutant && alert.current_value && alert.threshold_value) {
      return await this.notificationRuleRepo.findUsersForPollutantAlert(
        alert.location,
        alert.affected_radius,
        alert.pollutant,
        alert.current_value
      );
    }

    // For non-pollutant alerts, find users by location
    const rules = await this.notificationRuleRepo.findByLocation(alert.location, alert.affected_radius);
    
    return rules
      .filter(rule => this.shouldReceiveAlert(rule, alert))
      .map(rule => ({
        user_id: rule.user_id,
        delivery_methods: rule.delivery_methods
      }));
  }

  private shouldReceiveAlert(rule: NotificationRule, alert: Alert): boolean {
    switch (alert.type) {
      case 'trend_alert':
        return rule.triggers.trend_alerts;
      case 'community_update':
        return rule.triggers.community_updates;
      case 'health_warning':
        return rule.triggers.health_warnings;
      case 'threshold_breach':
        return true; // Always send threshold breach alerts if user is in range
      default:
        return false;
    }
  }

  private consolidateDeliveryMethods(users: { user_id: string; delivery_methods: string[] }[]): ('push' | 'email' | 'sms')[] {
    const methods = new Set<'push' | 'email' | 'sms'>();
    users.forEach(user => {
      user.delivery_methods.forEach(method => {
        methods.add(method as 'push' | 'email' | 'sms');
      });
    });
    return Array.from(methods);
  }

  private calculateAffectedRadius(severity: 'info' | 'warning' | 'critical'): number {
    switch (severity) {
      case 'critical':
        return 10.0; // 10km
      case 'warning':
        return 5.0;  // 5km
      case 'info':
        return 2.0;  // 2km
      default:
        return 5.0;
    }
  }

  private getHealthRecommendation(riskLevel: 'moderate' | 'high' | 'very_high'): string {
    switch (riskLevel) {
      case 'very_high':
        return 'Avoid all outdoor activities. Keep windows closed and use air purifiers if available.';
      case 'high':
        return 'Limit outdoor activities, especially strenuous exercise. Sensitive individuals should stay indoors.';
      case 'moderate':
        return 'Consider reducing prolonged outdoor activities. Sensitive individuals may experience symptoms.';
      default:
        return 'Monitor conditions and take precautions as needed.';
    }
  }

  private async cacheUserPreferences(userId: string): Promise<void> {
    try {
      const rules = await this.notificationRuleRepo.findByUserId(userId);
      const preferences = {
        rules: rules.map(rule => ({
          id: rule.id,
          location: rule.location,
          triggers: rule.triggers,
          delivery_methods: rule.delivery_methods,
          active: rule.active
        }))
      };

      await this.redis.setEx(
        `${this.USER_PREFERENCES_KEY}:${userId}`,
        3600, // 1 hour TTL
        JSON.stringify(preferences)
      );
    } catch (error) {
      logger.error('Error caching user preferences:', error);
    }
  }

  private async getUserPreferences(userId: string): Promise<any> {
    try {
      const cached = await this.redis.get(`${this.USER_PREFERENCES_KEY}:${userId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // If not cached, fetch and cache
      await this.cacheUserPreferences(userId);
      const newCached = await this.redis.get(`${this.USER_PREFERENCES_KEY}:${userId}`);
      return newCached ? JSON.parse(newCached) : null;
    } catch (error) {
      logger.error('Error getting user preferences:', error);
      return null;
    }
  }

  private async handleNotificationRetry(item: NotificationQueueItem, error: any): Promise<void> {
    item.retry_count++;

    if (item.retry_count >= item.max_retries) {
      logger.error(`Max retries reached for notification queue item ${item.id}. Discarding.`);
      await this.redis.sRem(this.PROCESSING_KEY, item.id);
      return;
    }

    // Exponential backoff: 2^retry_count minutes
    const delayMinutes = Math.pow(2, item.retry_count);
    const retryAt = new Date(Date.now() + delayMinutes * 60 * 1000);

    await this.redis.zAdd(this.RETRY_KEY, {
      score: retryAt.getTime(),
      value: JSON.stringify(item)
    });

    await this.redis.sRem(this.PROCESSING_KEY, item.id);
    
    logger.info(`Scheduled retry for notification queue item ${item.id} in ${delayMinutes} minutes`);
  }

  async processRetryQueue(): Promise<void> {
    try {
      const now = Date.now();
      const retryItems = await this.redis.zRangeByScore(this.RETRY_KEY, 0, now);

      for (const itemStr of retryItems) {
        const item: NotificationQueueItem = JSON.parse(itemStr);
        
        // Move back to main queue
        await this.redis.lPush(this.QUEUE_KEY, JSON.stringify(item));
        await this.redis.zRem(this.RETRY_KEY, itemStr);
        
        logger.info(`Moved retry item ${item.id} back to main queue`);
      }
    } catch (error) {
      logger.error('Error processing retry queue:', error);
    }
  }

  // Cleanup methods
  async cleanupExpiredAlerts(): Promise<void> {
    try {
      const deletedCount = await this.alertRepo.cleanupExpiredAlerts();
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} expired alerts`);
      }
    } catch (error) {
      logger.error('Error cleaning up expired alerts:', error);
    }
  }

  async getQueueStatus(): Promise<{
    pending: number;
    processing: number;
    retry: number;
  }> {
    try {
      const [pending, processing, retry] = await Promise.all([
        this.redis.lLen(this.QUEUE_KEY),
        this.redis.sCard(this.PROCESSING_KEY),
        this.redis.zCard(this.RETRY_KEY)
      ]);

      return { pending, processing, retry };
    } catch (error) {
      logger.error('Error getting queue status:', error);
      return { pending: 0, processing: 0, retry: 0 };
    }
  }
}