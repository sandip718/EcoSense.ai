import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/NotificationService';
import { PushNotificationService } from '../services/PushNotificationService';
import { AlertRepository } from '../models/AlertRepository';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../utils/validation';
import { logger } from '../utils/logger';
import Joi from 'joi';

const router = Router();
const notificationService = new NotificationService();
const pushService = new PushNotificationService();
const alertRepo = new AlertRepository();

// Validation schemas
const createNotificationRuleSchema = Joi.object({
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    radius: Joi.number().min(0.1).max(50).required()
  }).required(),
  triggers: Joi.object({
    pollutant_thresholds: Joi.object().pattern(
      Joi.string(),
      Joi.number().positive()
    ).default({}),
    trend_alerts: Joi.boolean().default(false),
    community_updates: Joi.boolean().default(false),
    health_warnings: Joi.boolean().default(true)
  }).required(),
  delivery_methods: Joi.array()
    .items(Joi.string().valid('push', 'email', 'sms'))
    .min(1)
    .default(['push']),
  active: Joi.boolean().default(true)
});

const updateNotificationRuleSchema = Joi.object({
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180),
    radius: Joi.number().min(0.1).max(50)
  }),
  triggers: Joi.object({
    pollutant_thresholds: Joi.object().pattern(
      Joi.string(),
      Joi.number().positive()
    ),
    trend_alerts: Joi.boolean(),
    community_updates: Joi.boolean(),
    health_warnings: Joi.boolean()
  }),
  delivery_methods: Joi.array()
    .items(Joi.string().valid('push', 'email', 'sms'))
    .min(1),
  active: Joi.boolean()
});

const registerDeviceTokenSchema = Joi.object({
  device_token: Joi.string().required(),
  platform: Joi.string().valid('ios', 'android', 'web').required()
});

const generateAlertSchema = Joi.object({
  type: Joi.string().valid('health_warning', 'trend_alert', 'community_update', 'threshold_breach').required(),
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
  }).required(),
  pollutant: Joi.string().when('type', {
    is: 'threshold_breach',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  current_value: Joi.number().when('type', {
    is: 'threshold_breach',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  threshold_value: Joi.number().when('type', {
    is: 'threshold_breach',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  unit: Joi.string().when('type', {
    is: 'threshold_breach',
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

// Notification Rules Management
router.post('/rules', authenticateToken, validateRequest(createNotificationRuleSchema), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const ruleData = {
      user_id: userId,
      ...req.body
    };

    const rule = await notificationService.createNotificationRule(ruleData);

    res.status(201).json({
      success: true,
      data: rule,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error creating notification rule:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'NOTIFICATION_RULE_CREATE_ERROR',
        message: 'Failed to create notification rule'
      },
      timestamp: new Date()
    });
  }
});

router.get('/rules', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const rules = await notificationService.getUserNotificationRules(userId);

    res.json({
      success: true,
      data: rules,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error getting notification rules:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'NOTIFICATION_RULES_FETCH_ERROR',
        message: 'Failed to fetch notification rules'
      },
      timestamp: new Date()
    });
  }
});

router.put('/rules/:id', authenticateToken, validateRequest(updateNotificationRuleSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedRule = await notificationService.updateNotificationRule(id, req.body);

    if (!updatedRule) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOTIFICATION_RULE_NOT_FOUND',
          message: 'Notification rule not found'
        },
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      data: updatedRule,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error updating notification rule:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'NOTIFICATION_RULE_UPDATE_ERROR',
        message: 'Failed to update notification rule'
      },
      timestamp: new Date()
    });
  }
});

router.delete('/rules/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await notificationService.deleteNotificationRule(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOTIFICATION_RULE_NOT_FOUND',
          message: 'Notification rule not found'
        },
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      data: { deleted: true },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error deleting notification rule:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'NOTIFICATION_RULE_DELETE_ERROR',
        message: 'Failed to delete notification rule'
      },
      timestamp: new Date()
    });
  }
});

// Device Token Management
router.post('/device-tokens', authenticateToken, validateRequest(registerDeviceTokenSchema), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { device_token, platform } = req.body;

    await pushService.registerDeviceToken(userId, device_token, platform);

    res.status(201).json({
      success: true,
      data: { registered: true },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error registering device token:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DEVICE_TOKEN_REGISTER_ERROR',
        message: 'Failed to register device token'
      },
      timestamp: new Date()
    });
  }
});

router.delete('/device-tokens/:token', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    await pushService.deactivateDeviceToken(token);

    res.json({
      success: true,
      data: { deactivated: true },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error deactivating device token:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DEVICE_TOKEN_DEACTIVATE_ERROR',
        message: 'Failed to deactivate device token'
      },
      timestamp: new Date()
    });
  }
});

// Alerts
router.get('/alerts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { latitude, longitude, radius = 10, severity } = req.query;

    let alerts;
    if (latitude && longitude) {
      const location = {
        latitude: parseFloat(latitude as string),
        longitude: parseFloat(longitude as string)
      };
      alerts = await alertRepo.findActiveByLocation(location, parseFloat(radius as string));
    } else if (severity) {
      alerts = await alertRepo.findRecentBySeverity(severity as 'info' | 'warning' | 'critical');
    } else {
      // Return recent critical alerts if no filters provided
      alerts = await alertRepo.findRecentBySeverity('critical');
    }

    res.json({
      success: true,
      data: alerts,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error getting alerts:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ALERTS_FETCH_ERROR',
        message: 'Failed to fetch alerts'
      },
      timestamp: new Date()
    });
  }
});

router.get('/alerts/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const alert = await alertRepo.findById(id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_NOT_FOUND',
          message: 'Alert not found'
        },
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      data: alert,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error getting alert:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ALERT_FETCH_ERROR',
        message: 'Failed to fetch alert'
      },
      timestamp: new Date()
    });
  }
});

// Admin endpoint for generating test alerts
router.post('/alerts/generate', authenticateToken, validateRequest(generateAlertSchema), async (req: Request, res: Response) => {
  try {
    // This would typically be restricted to admin users
    const { type, location, pollutant, current_value, threshold_value, unit } = req.body;

    let alert;
    switch (type) {
      case 'threshold_breach':
        alert = await notificationService.generatePollutantAlert(
          location,
          pollutant,
          current_value,
          unit,
          threshold_value
        );
        break;
      case 'health_warning':
        alert = await notificationService.generateHealthWarning(
          location,
          [pollutant || 'PM2.5'],
          'high'
        );
        break;
      case 'trend_alert':
        alert = await notificationService.generateTrendAlert(
          location,
          pollutant || 'PM2.5',
          'worsening',
          0.3
        );
        break;
      default:
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ALERT_TYPE',
            message: 'Invalid alert type'
          },
          timestamp: new Date()
        });
    }

    res.status(201).json({
      success: true,
      data: alert,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error generating alert:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ALERT_GENERATION_ERROR',
        message: 'Failed to generate alert'
      },
      timestamp: new Date()
    });
  }
});

// Statistics endpoints
router.get('/stats/alerts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { timeframe = 'day' } = req.query;
    const stats = await alertRepo.getAlertStatistics(timeframe as 'hour' | 'day' | 'week');

    res.json({
      success: true,
      data: stats,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error getting alert statistics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ALERT_STATS_ERROR',
        message: 'Failed to get alert statistics'
      },
      timestamp: new Date()
    });
  }
});

router.get('/stats/deliveries', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { timeframe = 'day' } = req.query;
    const stats = await pushService.getDeliveryStatistics(timeframe as 'hour' | 'day' | 'week');

    res.json({
      success: true,
      data: stats,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error getting delivery statistics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELIVERY_STATS_ERROR',
        message: 'Failed to get delivery statistics'
      },
      timestamp: new Date()
    });
  }
});

router.get('/stats/queue', authenticateToken, async (req: Request, res: Response) => {
  try {
    const queueStatus = await notificationService.getQueueStatus();

    res.json({
      success: true,
      data: queueStatus,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error getting queue status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'QUEUE_STATUS_ERROR',
        message: 'Failed to get queue status'
      },
      timestamp: new Date()
    });
  }
});

export default router;