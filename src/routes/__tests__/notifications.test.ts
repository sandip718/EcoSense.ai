import request from 'supertest';
import express from 'express';
import notificationRoutes from '../notifications';
import { NotificationService } from '../../services/NotificationService';
import { PushNotificationService } from '../../services/PushNotificationService';
import { AlertRepository } from '../../models/AlertRepository';
import { authenticateToken } from '../../middleware/auth';

// Mock dependencies
jest.mock('../../services/NotificationService');
jest.mock('../../services/PushNotificationService');
jest.mock('../../models/AlertRepository');
jest.mock('../../middleware/auth');

const app = express();
app.use(express.json());
app.use('/notifications', notificationRoutes);

describe('Notification Routes', () => {
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockPushService: jest.Mocked<PushNotificationService>;
  let mockAlertRepo: jest.Mocked<AlertRepository>;

  const mockUser = {
    userId: 'user-123',
    email: 'test@example.com'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock authentication middleware
    (authenticateToken as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
      req.user = mockUser;
      next();
    });

    // Setup service mocks
    mockNotificationService = NotificationService.prototype as jest.Mocked<NotificationService>;
    mockPushService = PushNotificationService.prototype as jest.Mocked<PushNotificationService>;
    mockAlertRepo = AlertRepository.prototype as jest.Mocked<AlertRepository>;
  });

  describe('POST /notifications/rules', () => {
    const validRuleData = {
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        radius: 5
      },
      triggers: {
        pollutant_thresholds: { 'PM2.5': 25 },
        trend_alerts: true,
        community_updates: false,
        health_warnings: true
      },
      delivery_methods: ['push'],
      active: true
    };

    it('should create a notification rule successfully', async () => {
      const mockCreatedRule = {
        id: 'rule-123',
        user_id: 'user-123',
        ...validRuleData,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockNotificationService.createNotificationRule.mockResolvedValue(mockCreatedRule);

      const response = await request(app)
        .post('/notifications/rules')
        .send(validRuleData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCreatedRule);
      expect(mockNotificationService.createNotificationRule).toHaveBeenCalledWith({
        user_id: 'user-123',
        ...validRuleData
      });
    });

    it('should validate required fields', async () => {
      const invalidData = {
        location: {
          latitude: 40.7128
          // Missing longitude and radius
        }
      };

      const response = await request(app)
        .post('/notifications/rules')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(mockNotificationService.createNotificationRule).not.toHaveBeenCalled();
    });

    it('should validate location coordinates', async () => {
      const invalidData = {
        ...validRuleData,
        location: {
          latitude: 91, // Invalid latitude
          longitude: -74.0060,
          radius: 5
        }
      };

      const response = await request(app)
        .post('/notifications/rules')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle service errors', async () => {
      mockNotificationService.createNotificationRule.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/notifications/rules')
        .send(validRuleData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOTIFICATION_RULE_CREATE_ERROR');
    });
  });

  describe('GET /notifications/rules', () => {
    it('should get user notification rules', async () => {
      const mockRules = [
        {
          id: 'rule-123',
          user_id: 'user-123',
          location: { latitude: 40.7128, longitude: -74.0060, radius: 5 },
          triggers: {
            pollutant_thresholds: { 'PM2.5': 25 },
            trend_alerts: true,
            community_updates: false,
            health_warnings: true
          },
          delivery_methods: ['push'],
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockNotificationService.getUserNotificationRules.mockResolvedValue(mockRules);

      const response = await request(app)
        .get('/notifications/rules')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRules);
      expect(mockNotificationService.getUserNotificationRules).toHaveBeenCalledWith('user-123');
    });
  });

  describe('PUT /notifications/rules/:id', () => {
    it('should update a notification rule', async () => {
      const updateData = {
        triggers: {
          pollutant_thresholds: { 'PM2.5': 30 },
          trend_alerts: false,
          community_updates: true,
          health_warnings: true
        }
      };

      const mockUpdatedRule = {
        id: 'rule-123',
        user_id: 'user-123',
        location: { latitude: 40.7128, longitude: -74.0060, radius: 5 },
        ...updateData,
        delivery_methods: ['push'],
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockNotificationService.updateNotificationRule.mockResolvedValue(mockUpdatedRule);

      const response = await request(app)
        .put('/notifications/rules/rule-123')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUpdatedRule);
      expect(mockNotificationService.updateNotificationRule).toHaveBeenCalledWith('rule-123', updateData);
    });

    it('should return 404 for non-existent rule', async () => {
      mockNotificationService.updateNotificationRule.mockResolvedValue(null);

      const response = await request(app)
        .put('/notifications/rules/non-existent')
        .send({ active: false })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOTIFICATION_RULE_NOT_FOUND');
    });
  });

  describe('DELETE /notifications/rules/:id', () => {
    it('should delete a notification rule', async () => {
      mockNotificationService.deleteNotificationRule.mockResolvedValue(true);

      const response = await request(app)
        .delete('/notifications/rules/rule-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);
      expect(mockNotificationService.deleteNotificationRule).toHaveBeenCalledWith('rule-123');
    });

    it('should return 404 for non-existent rule', async () => {
      mockNotificationService.deleteNotificationRule.mockResolvedValue(false);

      const response = await request(app)
        .delete('/notifications/rules/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOTIFICATION_RULE_NOT_FOUND');
    });
  });

  describe('POST /notifications/device-tokens', () => {
    it('should register a device token', async () => {
      const tokenData = {
        device_token: 'device-token-123',
        platform: 'ios'
      };

      mockPushService.registerDeviceToken.mockResolvedValue();

      const response = await request(app)
        .post('/notifications/device-tokens')
        .send(tokenData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.registered).toBe(true);
      expect(mockPushService.registerDeviceToken).toHaveBeenCalledWith(
        'user-123',
        'device-token-123',
        'ios'
      );
    });

    it('should validate platform', async () => {
      const invalidData = {
        device_token: 'device-token-123',
        platform: 'invalid-platform'
      };

      const response = await request(app)
        .post('/notifications/device-tokens')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /notifications/alerts', () => {
    it('should get alerts by location', async () => {
      const mockAlerts = [
        {
          id: 'alert-123',
          type: 'threshold_breach',
          severity: 'warning',
          title: 'PM2.5 Alert',
          message: 'High PM2.5 levels detected',
          location: { latitude: 40.7128, longitude: -74.0060 },
          affected_radius: 5,
          pollutant: 'PM2.5',
          current_value: 35,
          threshold_value: 25,
          expires_at: new Date(),
          created_at: new Date()
        }
      ];

      mockAlertRepo.findActiveByLocation.mockResolvedValue(mockAlerts);

      const response = await request(app)
        .get('/notifications/alerts')
        .query({
          latitude: 40.7128,
          longitude: -74.0060,
          radius: 10
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAlerts);
      expect(mockAlertRepo.findActiveByLocation).toHaveBeenCalledWith(
        { latitude: 40.7128, longitude: -74.0060 },
        10
      );
    });

    it('should get alerts by severity', async () => {
      const mockAlerts = [
        {
          id: 'alert-124',
          type: 'health_warning',
          severity: 'critical',
          title: 'Health Advisory',
          message: 'Severe air quality conditions',
          location: { latitude: 40.7128, longitude: -74.0060 },
          affected_radius: 10,
          expires_at: new Date(),
          created_at: new Date()
        }
      ];

      mockAlertRepo.findRecentBySeverity.mockResolvedValue(mockAlerts);

      const response = await request(app)
        .get('/notifications/alerts')
        .query({ severity: 'critical' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAlerts);
      expect(mockAlertRepo.findRecentBySeverity).toHaveBeenCalledWith('critical');
    });
  });

  describe('POST /notifications/alerts/generate', () => {
    it('should generate a threshold breach alert', async () => {
      const alertData = {
        type: 'threshold_breach',
        location: { latitude: 40.7128, longitude: -74.0060 },
        pollutant: 'PM2.5',
        current_value: 50,
        threshold_value: 25,
        unit: 'µg/m³'
      };

      const mockAlert = {
        id: 'alert-123',
        ...alertData,
        severity: 'critical',
        title: 'PM2.5 Level Alert',
        message: 'High PM2.5 levels detected',
        affected_radius: 10,
        expires_at: new Date(),
        created_at: new Date()
      };

      mockNotificationService.generatePollutantAlert.mockResolvedValue(mockAlert);

      const response = await request(app)
        .post('/notifications/alerts/generate')
        .send(alertData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAlert);
      expect(mockNotificationService.generatePollutantAlert).toHaveBeenCalledWith(
        alertData.location,
        alertData.pollutant,
        alertData.current_value,
        alertData.unit,
        alertData.threshold_value
      );
    });

    it('should generate a health warning alert', async () => {
      const alertData = {
        type: 'health_warning',
        location: { latitude: 40.7128, longitude: -74.0060 },
        pollutant: 'PM2.5'
      };

      const mockAlert = {
        id: 'alert-124',
        type: 'health_warning',
        severity: 'warning',
        title: 'Health Advisory',
        message: 'Health advisory issued',
        location: alertData.location,
        affected_radius: 5,
        expires_at: new Date(),
        created_at: new Date()
      };

      mockNotificationService.generateHealthWarning.mockResolvedValue(mockAlert);

      const response = await request(app)
        .post('/notifications/alerts/generate')
        .send(alertData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(mockNotificationService.generateHealthWarning).toHaveBeenCalledWith(
        alertData.location,
        ['PM2.5'],
        'high'
      );
    });

    it('should validate required fields for threshold breach', async () => {
      const invalidData = {
        type: 'threshold_breach',
        location: { latitude: 40.7128, longitude: -74.0060 }
        // Missing required fields for threshold breach
      };

      const response = await request(app)
        .post('/notifications/alerts/generate')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /notifications/stats/queue', () => {
    it('should get queue status', async () => {
      const mockStatus = {
        pending: 5,
        processing: 2,
        retry: 1
      };

      mockNotificationService.getQueueStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/notifications/stats/queue')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStatus);
    });
  });
});