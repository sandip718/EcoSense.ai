import { NotificationService } from '../NotificationService';
import { NotificationRuleRepository } from '../../models/NotificationRuleRepository';
import { AlertRepository } from '../../models/AlertRepository';
import { PushNotificationService } from '../PushNotificationService';
import { getRedisClient } from '../../config/redis';
import { CreateNotificationRule, CreateAlert, Location } from '../../models/types';

// Mock dependencies
jest.mock('../../models/NotificationRuleRepository');
jest.mock('../../models/AlertRepository');
jest.mock('../PushNotificationService');
jest.mock('../../config/redis');

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockNotificationRuleRepo: jest.Mocked<NotificationRuleRepository>;
  let mockAlertRepo: jest.Mocked<AlertRepository>;
  let mockPushService: jest.Mocked<PushNotificationService>;
  let mockRedis: any;

  const mockLocation: Location = {
    latitude: 40.7128,
    longitude: -74.0060
  };

  const mockNotificationRule: CreateNotificationRule = {
    user_id: 'user-123',
    location: { ...mockLocation, radius: 5 },
    triggers: {
      pollutant_thresholds: { 'PM2.5': 25 },
      trend_alerts: true,
      community_updates: false,
      health_warnings: true
    },
    delivery_methods: ['push'],
    active: true
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup Redis mock
    mockRedis = {
      lPush: jest.fn(),
      brPop: jest.fn(),
      sAdd: jest.fn(),
      sRem: jest.fn(),
      setEx: jest.fn(),
      get: jest.fn(),
      lLen: jest.fn(),
      sCard: jest.fn(),
      zCard: jest.fn(),
      zAdd: jest.fn(),
      zRem: jest.fn(),
      zRangeByScore: jest.fn()
    };
    (getRedisClient as jest.Mock).mockReturnValue(mockRedis);

    // Setup repository mocks
    mockNotificationRuleRepo = new NotificationRuleRepository() as jest.Mocked<NotificationRuleRepository>;
    mockAlertRepo = new AlertRepository() as jest.Mocked<AlertRepository>;
    mockPushService = new PushNotificationService() as jest.Mocked<PushNotificationService>;

    // Create service instance
    notificationService = new NotificationService();
    
    // Replace private properties with mocks
    (notificationService as any).notificationRuleRepo = mockNotificationRuleRepo;
    (notificationService as any).alertRepo = mockAlertRepo;
    (notificationService as any).pushService = mockPushService;
  });

  describe('createNotificationRule', () => {
    it('should create a notification rule successfully', async () => {
      const mockCreatedRule = {
        id: 'rule-123',
        ...mockNotificationRule,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockNotificationRuleRepo.create.mockResolvedValue(mockCreatedRule);

      const result = await notificationService.createNotificationRule(mockNotificationRule);

      expect(mockNotificationRuleRepo.create).toHaveBeenCalledWith(mockNotificationRule);
      expect(mockRedis.setEx).toHaveBeenCalled(); // Cache user preferences
      expect(result).toEqual(mockCreatedRule);
    });

    it('should handle errors when creating notification rule', async () => {
      const error = new Error('Database error');
      mockNotificationRuleRepo.create.mockRejectedValue(error);

      await expect(notificationService.createNotificationRule(mockNotificationRule))
        .rejects.toThrow('Database error');
    });
  });

  describe('generatePollutantAlert', () => {
    it('should generate a critical alert for high pollution levels', async () => {
      const mockAlert = {
        id: 'alert-123',
        type: 'threshold_breach' as const,
        severity: 'critical' as const,
        title: 'PM2.5 Level Alert',
        message: 'PM2.5 levels have reached 50 µg/m³, exceeding the safe threshold of 25 µg/m³. Consider limiting outdoor activities.',
        location: mockLocation,
        affected_radius: 10,
        pollutant: 'PM2.5',
        current_value: 50,
        threshold_value: 25,
        expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000),
        created_at: new Date()
      };

      mockAlertRepo.create.mockResolvedValue(mockAlert);
      mockNotificationRuleRepo.findUsersForPollutantAlert.mockResolvedValue([
        { user_id: 'user-123', delivery_methods: ['push'] }
      ]);

      const result = await notificationService.generatePollutantAlert(
        mockLocation,
        'PM2.5',
        50,
        'µg/m³',
        25
      );

      expect(mockAlertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'threshold_breach',
          severity: 'critical',
          pollutant: 'PM2.5',
          current_value: 50,
          threshold_value: 25
        })
      );
      expect(mockRedis.lPush).toHaveBeenCalled(); // Queue notification
      expect(result).toEqual(mockAlert);
    });

    it('should generate a warning alert for moderate pollution levels', async () => {
      const mockAlert = {
        id: 'alert-124',
        type: 'threshold_breach' as const,
        severity: 'warning' as const,
        title: 'PM2.5 Level Alert',
        message: 'PM2.5 levels have reached 37.5 µg/m³, exceeding the safe threshold of 25 µg/m³. Consider limiting outdoor activities.',
        location: mockLocation,
        affected_radius: 5,
        pollutant: 'PM2.5',
        current_value: 37.5,
        threshold_value: 25,
        expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000),
        created_at: new Date()
      };

      mockAlertRepo.create.mockResolvedValue(mockAlert);
      mockNotificationRuleRepo.findUsersForPollutantAlert.mockResolvedValue([]);

      const result = await notificationService.generatePollutantAlert(
        mockLocation,
        'PM2.5',
        37.5,
        'µg/m³',
        25
      );

      expect(result?.severity).toBe('warning');
    });
  });

  describe('generateTrendAlert', () => {
    it('should generate a trend alert for worsening conditions', async () => {
      const mockAlert = {
        id: 'alert-125',
        type: 'trend_alert' as const,
        severity: 'warning' as const,
        title: 'PM2.5 Trend Alert',
        message: 'PM2.5 levels have been worsening in your area over the past week. Consider taking precautions.',
        location: mockLocation,
        affected_radius: 5,
        pollutant: 'PM2.5',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        created_at: new Date()
      };

      mockAlertRepo.create.mockResolvedValue(mockAlert);
      mockNotificationRuleRepo.findByLocation.mockResolvedValue([
        {
          id: 'rule-123',
          user_id: 'user-123',
          location: { ...mockLocation, radius: 5 },
          triggers: {
            pollutant_thresholds: {},
            trend_alerts: true,
            community_updates: false,
            health_warnings: true
          },
          delivery_methods: ['push'],
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);

      const result = await notificationService.generateTrendAlert(
        mockLocation,
        'PM2.5',
        'worsening',
        0.3
      );

      expect(mockAlertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'trend_alert',
          severity: 'warning',
          pollutant: 'PM2.5'
        })
      );
      expect(result).toEqual(mockAlert);
    });

    it('should not generate alert for minor improvements', async () => {
      const result = await notificationService.generateTrendAlert(
        mockLocation,
        'PM2.5',
        'improving',
        0.1 // Below threshold
      );

      expect(result).toBeNull();
      expect(mockAlertRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('generateHealthWarning', () => {
    it('should generate a health warning for high risk conditions', async () => {
      const mockAlert = {
        id: 'alert-126',
        type: 'health_warning' as const,
        severity: 'critical' as const,
        title: 'Health Advisory',
        message: 'Health advisory issued for your area due to elevated PM2.5, NO2 levels. Avoid all outdoor activities. Keep windows closed and use air purifiers if available.',
        location: mockLocation,
        affected_radius: 10,
        expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000),
        created_at: new Date()
      };

      mockAlertRepo.create.mockResolvedValue(mockAlert);
      mockNotificationRuleRepo.findByLocation.mockResolvedValue([]);

      const result = await notificationService.generateHealthWarning(
        mockLocation,
        ['PM2.5', 'NO2'],
        'very_high'
      );

      expect(mockAlertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'health_warning',
          severity: 'critical'
        })
      );
      expect(result).toEqual(mockAlert);
    });
  });

  describe('processNotificationQueue', () => {
    it('should process notification queue items successfully', async () => {
      const mockQueueItem = {
        id: 'queue-123',
        alert: {
          id: 'alert-123',
          type: 'threshold_breach' as const,
          severity: 'warning' as const,
          title: 'Test Alert',
          message: 'Test message',
          location: mockLocation,
          affected_radius: 5,
          expires_at: new Date(),
          created_at: new Date()
        },
        target_users: ['user-123'],
        delivery_methods: ['push'] as ('push' | 'email' | 'sms')[],
        retry_count: 0,
        max_retries: 3,
        scheduled_at: new Date(),
        created_at: new Date()
      };

      mockRedis.brPop.mockResolvedValue({
        key: 'notification:queue',
        element: JSON.stringify(mockQueueItem)
      });
      mockRedis.get.mockResolvedValue(JSON.stringify({
        rules: [{
          delivery_methods: ['push']
        }]
      }));
      mockPushService.sendNotification.mockResolvedValue();

      await notificationService.processNotificationQueue();

      expect(mockRedis.sAdd).toHaveBeenCalledWith('notification:processing', 'queue-123');
      expect(mockPushService.sendNotification).toHaveBeenCalled();
      expect(mockRedis.sRem).toHaveBeenCalledWith('notification:processing', 'queue-123');
    });

    it('should handle empty queue gracefully', async () => {
      mockRedis.brPop.mockResolvedValue(null);

      await notificationService.processNotificationQueue();

      expect(mockRedis.sAdd).not.toHaveBeenCalled();
      expect(mockPushService.sendNotification).not.toHaveBeenCalled();
    });

    it('should handle processing errors and retry', async () => {
      const mockQueueItem = {
        id: 'queue-123',
        alert: {
          id: 'alert-123',
          type: 'threshold_breach' as const,
          severity: 'warning' as const,
          title: 'Test Alert',
          message: 'Test message',
          location: mockLocation,
          affected_radius: 5,
          expires_at: new Date(),
          created_at: new Date()
        },
        target_users: ['user-123'],
        delivery_methods: ['push'] as ('push' | 'email' | 'sms')[],
        retry_count: 0,
        max_retries: 3,
        scheduled_at: new Date(),
        created_at: new Date()
      };

      mockRedis.brPop.mockResolvedValue({
        key: 'notification:queue',
        element: JSON.stringify(mockQueueItem)
      });
      mockRedis.get.mockResolvedValue(null);
      mockPushService.sendNotification.mockRejectedValue(new Error('Push service error'));

      await notificationService.processNotificationQueue();

      expect(mockRedis.zAdd).toHaveBeenCalled(); // Add to retry queue
      expect(mockRedis.sRem).toHaveBeenCalledWith('notification:processing', 'queue-123');
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue status', async () => {
      mockRedis.lLen.mockResolvedValue(5);
      mockRedis.sCard.mockResolvedValue(2);
      mockRedis.zCard.mockResolvedValue(1);

      const status = await notificationService.getQueueStatus();

      expect(status).toEqual({
        pending: 5,
        processing: 2,
        retry: 1
      });
    });
  });
});