import { NotificationService } from './NotificationService';
import { logger } from '../utils/logger';
import * as cron from 'node-cron';

export class NotificationWorker {
  private notificationService: NotificationService;
  private isRunning: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private retryInterval: NodeJS.Timeout | null = null;
  private cleanupJob: cron.ScheduledTask | null = null;

  constructor() {
    this.notificationService = new NotificationService();
  }

  start(): void {
    if (this.isRunning) {
      logger.warn('Notification worker is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting notification worker...');

    // Process main notification queue every 5 seconds
    this.processingInterval = setInterval(async () => {
      try {
        await this.notificationService.processNotificationQueue();
      } catch (error) {
        logger.error('Error processing notification queue:', error);
      }
    }, 5000);

    // Process retry queue every minute
    this.retryInterval = setInterval(async () => {
      try {
        await this.notificationService.processRetryQueue();
      } catch (error) {
        logger.error('Error processing retry queue:', error);
      }
    }, 60000);

    // Cleanup expired alerts every hour
    this.cleanupJob = cron.schedule('0 * * * *', async () => {
      try {
        await this.notificationService.cleanupExpiredAlerts();
      } catch (error) {
        logger.error('Error cleaning up expired alerts:', error);
      }
    });

    logger.info('Notification worker started successfully');
  }

  stop(): void {
    if (!this.isRunning) {
      logger.warn('Notification worker is not running');
      return;
    }

    this.isRunning = false;
    logger.info('Stopping notification worker...');

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }

    if (this.cleanupJob) {
      this.cleanupJob.stop();
      this.cleanupJob = null;
    }

    logger.info('Notification worker stopped');
  }

  async processOnce(): Promise<void> {
    try {
      await this.notificationService.processNotificationQueue();
      await this.notificationService.processRetryQueue();
    } catch (error) {
      logger.error('Error in processOnce:', error);
      throw error;
    }
  }

  getStatus(): {
    isRunning: boolean;
    hasProcessingInterval: boolean;
    hasRetryInterval: boolean;
    hasCleanupJob: boolean;
  } {
    return {
      isRunning: this.isRunning,
      hasProcessingInterval: this.processingInterval !== null,
      hasRetryInterval: this.retryInterval !== null,
      hasCleanupJob: this.cleanupJob !== null
    };
  }
}

// Singleton instance
export const notificationWorker = new NotificationWorker();