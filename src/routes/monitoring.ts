import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { errorMonitoringService } from '../services/ErrorMonitoringService';
import { gracefulDegradationService } from '../services/GracefulDegradationService';
import { healthCheckService } from '../middleware/healthCheck';
import { StructuredLogger } from '../utils/logger';

const router = Router();

// Get error metrics
router.get('/errors', asyncHandler(async (req, res) => {
  const metrics = await errorMonitoringService.getErrorMetrics();
  res.json({
    success: true,
    data: metrics,
    timestamp: new Date().toISOString(),
  });
}));

// Get recent alerts
router.get('/alerts', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const alerts = await errorMonitoringService.getRecentAlerts(limit);
  
  res.json({
    success: true,
    data: alerts,
    count: alerts.length,
    timestamp: new Date().toISOString(),
  });
}));

// Acknowledge alert
router.post('/alerts/:alertId/acknowledge', asyncHandler(async (req, res) => {
  const { alertId } = req.params;
  await errorMonitoringService.acknowledgeAlert(alertId);
  
  StructuredLogger.businessEvent('alert_acknowledged', {
    alertId,
    userId: req.user?.id,
  });

  res.json({
    success: true,
    message: 'Alert acknowledged successfully',
  });
}));

// Get alert rules
router.get('/alert-rules', asyncHandler(async (req, res) => {
  const rules = errorMonitoringService.getAlertRules();
  res.json({
    success: true,
    data: rules,
    count: rules.length,
  });
}));

// Add or update alert rule
router.post('/alert-rules', asyncHandler(async (req, res) => {
  const rule = req.body;
  
  // Validate rule structure
  if (!rule.id || !rule.name || !rule.condition || !rule.threshold) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: id, name, condition, threshold',
    });
  }

  errorMonitoringService.addAlertRule(rule);
  
  StructuredLogger.businessEvent('alert_rule_created', {
    ruleId: rule.id,
    userId: req.user?.id,
  });

  res.json({
    success: true,
    message: 'Alert rule added successfully',
    data: rule,
  });
}));

// Remove alert rule
router.delete('/alert-rules/:ruleId', asyncHandler(async (req, res) => {
  const { ruleId } = req.params;
  errorMonitoringService.removeAlertRule(ruleId);
  
  StructuredLogger.businessEvent('alert_rule_deleted', {
    ruleId,
    userId: req.user?.id,
  });

  res.json({
    success: true,
    message: 'Alert rule removed successfully',
  });
}));

// Get circuit breaker stats
router.get('/circuit-breakers', asyncHandler(async (req, res) => {
  const stats = gracefulDegradationService.getCircuitBreakerStats();
  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString(),
  });
}));

// Get comprehensive monitoring dashboard data
router.get('/dashboard', asyncHandler(async (req, res) => {
  const [errorMetrics, alerts, circuitBreakers, healthCheck] = await Promise.all([
    errorMonitoringService.getErrorMetrics(),
    errorMonitoringService.getRecentAlerts(10),
    gracefulDegradationService.getCircuitBreakerStats(),
    healthCheckService.runHealthCheck(),
  ]);

  res.json({
    success: true,
    data: {
      errorMetrics,
      recentAlerts: alerts,
      circuitBreakers,
      healthCheck,
      systemInfo: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    },
    timestamp: new Date().toISOString(),
  });
}));

// Test error handling (development only)
if (process.env.NODE_ENV !== 'production') {
  router.post('/test-error', asyncHandler(async (req, res) => {
    const { type = 'generic', statusCode = 500 } = req.body;
    
    switch (type) {
      case 'validation':
        throw new Error('Test validation error');
      case 'not_found':
        throw new Error('Test resource not found');
      case 'timeout':
        await new Promise(resolve => setTimeout(resolve, 6000)); // Simulate timeout
        break;
      case 'database':
        throw new Error('Test database connection error');
      default:
        throw new Error('Test generic error');
    }

    res.json({ success: true, message: 'Error test completed' });
  }));
}

export default router;