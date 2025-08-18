import { Pool } from 'pg';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';
import { PushNotificationPayload } from '../models/types';

interface DeviceToken {
  id: string;
  user_id: string;
  device_token: string;
  platform: 'ios' | 'android' | 'web';
  active: boolean;
}

export class PushNotificationService {
  private db: Pool;

  constructor() {
    this.db = getDatabase();
  }

  async sendNotification(payload: PushNotificationPayload): Promise<void> {
    try {
      // Get user's device tokens
      const deviceTokens = await this.getUserDeviceTokens(payload.user_id);
      
      if (deviceTokens.length === 0) {
        logger.info(`No device tokens found for user ${payload.user_id}`);
        return;
      }

      // Send to all user's devices
      const sendPromises = deviceTokens.map(token => 
        this.sendToDevice(token, payload)
      );

      const results = await Promise.allSettled(sendPromises);
      
      // Log results and handle failed tokens
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const token = deviceTokens[i];

        if (result.status === 'fulfilled') {
          successCount++;
          await this.logNotificationDelivery(
            payload.data?.alert_id || 'unknown',
            payload.user_id,
            'push',
            'sent',
            token.device_token
          );
        } else {
          failureCount++;
          logger.error(`Failed to send push notification to device ${token.device_token}:`, result.reason);
          
          // If token is invalid, deactivate it
          if (this.isInvalidTokenError(result.reason)) {
            await this.deactivateDeviceToken(token.device_token);
          }

          await this.logNotificationDelivery(
            payload.data?.alert_id || 'unknown',
            payload.user_id,
            'push',
            'failed',
            token.device_token,
            result.reason?.message || 'Unknown error'
          );
        }
      }

      logger.info(`Push notification sent to user ${payload.user_id}: ${successCount} success, ${failureCount} failed`);
    } catch (error) {
      logger.error('Error sending push notification:', error);
      throw error;
    }
  }

  async registerDeviceToken(
    userId: string,
    deviceToken: string,
    platform: 'ios' | 'android' | 'web'
  ): Promise<void> {
    const client = await this.db.connect();
    
    try {
      // Insert or update device token
      const query = `
        INSERT INTO user_device_tokens (user_id, device_token, platform, active)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (user_id, device_token)
        DO UPDATE SET 
          platform = EXCLUDED.platform,
          active = true,
          updated_at = NOW()
      `;
      
      await client.query(query, [userId, deviceToken, platform]);
      logger.info(`Registered device token for user ${userId} on ${platform}`);
    } catch (error) {
      logger.error('Error registering device token:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deactivateDeviceToken(deviceToken: string): Promise<void> {
    const client = await this.db.connect();
    
    try {
      const query = `
        UPDATE user_device_tokens
        SET active = false, updated_at = NOW()
        WHERE device_token = $1
      `;
      
      const result = await client.query(query, [deviceToken]);
      
      if (result.rowCount > 0) {
        logger.info(`Deactivated device token ${deviceToken}`);
      }
    } catch (error) {
      logger.error('Error deactivating device token:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserDeviceTokens(userId: string): Promise<DeviceToken[]> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT id, user_id, device_token, platform, active
        FROM user_device_tokens
        WHERE user_id = $1 AND active = true
      `;
      
      const result = await client.query(query, [userId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting user device tokens:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async sendToDevice(deviceToken: DeviceToken, payload: PushNotificationPayload): Promise<void> {
    // This is a mock implementation. In a real application, you would integrate with:
    // - Firebase Cloud Messaging (FCM) for Android and Web
    // - Apple Push Notification Service (APNs) for iOS
    // - Web Push Protocol for web browsers

    try {
      switch (deviceToken.platform) {
        case 'android':
          await this.sendFCMNotification(deviceToken.device_token, payload);
          break;
        case 'ios':
          await this.sendAPNSNotification(deviceToken.device_token, payload);
          break;
        case 'web':
          await this.sendWebPushNotification(deviceToken.device_token, payload);
          break;
        default:
          throw new Error(`Unsupported platform: ${deviceToken.platform}`);
      }
    } catch (error) {
      logger.error(`Error sending to ${deviceToken.platform} device:`, error);
      throw error;
    }
  }

  private async sendFCMNotification(deviceToken: string, payload: PushNotificationPayload): Promise<void> {
    // Mock FCM implementation
    // In production, you would use the Firebase Admin SDK
    
    const fcmPayload = {
      to: deviceToken,
      notification: {
        title: payload.title,
        body: payload.body,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png'
      },
      data: payload.data || {},
      priority: payload.priority === 'high' ? 'high' : 'normal',
      time_to_live: 3600 // 1 hour
    };

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Mock success response
    logger.debug(`Mock FCM notification sent to ${deviceToken}:`, fcmPayload);
  }

  private async sendAPNSNotification(deviceToken: string, payload: PushNotificationPayload): Promise<void> {
    // Mock APNS implementation
    // In production, you would use the node-apn library or similar
    
    const apnsPayload = {
      deviceToken,
      notification: {
        alert: {
          title: payload.title,
          body: payload.body
        },
        badge: 1,
        sound: 'default'
      },
      data: payload.data || {},
      priority: payload.priority === 'high' ? 10 : 5,
      expiry: Math.floor(Date.now() / 1000) + 3600 // 1 hour
    };

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Mock success response
    logger.debug(`Mock APNS notification sent to ${deviceToken}:`, apnsPayload);
  }

  private async sendWebPushNotification(deviceToken: string, payload: PushNotificationPayload): Promise<void> {
    // Mock Web Push implementation
    // In production, you would use the web-push library
    
    const webPushPayload = {
      endpoint: deviceToken,
      payload: JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        data: payload.data || {},
        actions: [
          {
            action: 'view',
            title: 'View Details'
          },
          {
            action: 'dismiss',
            title: 'Dismiss'
          }
        ]
      }),
      options: {
        TTL: 3600, // 1 hour
        urgency: payload.priority === 'high' ? 'high' : 'normal'
      }
    };

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 80));
    
    // Mock success response
    logger.debug(`Mock Web Push notification sent to ${deviceToken}:`, webPushPayload);
  }

  private isInvalidTokenError(error: any): boolean {
    // Check for common invalid token error patterns
    if (!error || !error.message) return false;
    
    const errorMessage = error.message.toLowerCase();
    return (
      errorMessage.includes('invalid token') ||
      errorMessage.includes('not registered') ||
      errorMessage.includes('invalid registration') ||
      errorMessage.includes('mismatched sender') ||
      errorMessage.includes('invalid apns-topic')
    );
  }

  private async logNotificationDelivery(
    alertId: string,
    userId: string,
    deliveryMethod: 'push' | 'email' | 'sms',
    status: 'pending' | 'sent' | 'delivered' | 'failed',
    deviceToken?: string,
    errorMessage?: string
  ): Promise<void> {
    const client = await this.db.connect();
    
    try {
      const query = `
        INSERT INTO notification_deliveries (
          alert_id, user_id, delivery_method, status, error_message, sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      const values = [
        alertId,
        userId,
        deliveryMethod,
        status,
        errorMessage || null,
        status === 'sent' || status === 'delivered' ? new Date() : null
      ];
      
      await client.query(query, values);
    } catch (error) {
      logger.error('Error logging notification delivery:', error);
      // Don't throw here to avoid breaking the main notification flow
    } finally {
      client.release();
    }
  }

  async getDeliveryStatistics(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<{
    total: number;
    by_status: { [key: string]: number };
    by_method: { [key: string]: number };
  }> {
    const client = await this.db.connect();
    
    try {
      let timeCondition = '';
      switch (timeframe) {
        case 'hour':
          timeCondition = "created_at >= NOW() - INTERVAL '1 hour'";
          break;
        case 'day':
          timeCondition = "created_at >= NOW() - INTERVAL '1 day'";
          break;
        case 'week':
          timeCondition = "created_at >= NOW() - INTERVAL '1 week'";
          break;
      }
      
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
          COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
          COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
          COUNT(*) FILTER (WHERE delivery_method = 'push') as push_count,
          COUNT(*) FILTER (WHERE delivery_method = 'email') as email_count,
          COUNT(*) FILTER (WHERE delivery_method = 'sms') as sms_count
        FROM notification_deliveries
        WHERE ${timeCondition}
      `;
      
      const result = await client.query(query);
      const row = result.rows[0];
      
      return {
        total: parseInt(row.total),
        by_status: {
          pending: parseInt(row.pending_count),
          sent: parseInt(row.sent_count),
          delivered: parseInt(row.delivered_count),
          failed: parseInt(row.failed_count)
        },
        by_method: {
          push: parseInt(row.push_count),
          email: parseInt(row.email_count),
          sms: parseInt(row.sms_count)
        }
      };
    } catch (error) {
      logger.error('Error getting delivery statistics:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}