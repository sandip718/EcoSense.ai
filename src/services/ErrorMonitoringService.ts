import { StructuredLogger } from '../utils/logger';
import { getRedisClient } from '../config/redis';

export interface ErrorMetrics {
  errorCount: number;
  errorRate: number;
  lastError: Date;
  errorsByType: { [errorType: string]: number };
  errorsByEndpoint: { [endpoint: string]: number };
  errorsByStatusCode: { [statusCode: string]: number };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: 'error_rate' | 'error_count' | 'consecutive_errors';
  threshold: number;
  timeWindow: number; // in seconds
  enabled: boolean;
  lastTriggered?: Date;
  cooldownPeriod: number; // in seconds
}

export interface ErrorAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  triggeredAt: Date;
  metrics: ErrorMetrics;
  acknowledged: boolean;
}

class ErrorMonitoringService {
  private redis = getRedisClient();
  private alertRules: Map<string, AlertRule> = new Map();
  private readonly metricsWindow = 300; // 5 minutes
  private readonly maxErrorHistory = 1000;

  constructor() {
    this.initializeDefaultAlertRules();
    this.startMetricsCollection();
  }

  private initializeDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        condition: 'error_rate',
        threshold: 0.1, // 10% error rate
        timeWindow: 300, // 5 minutes
        enabled: true,
        cooldownPeriod: 600, // 10 minutes
      },
      {
        id: 'error_spike',
        name: 'Error Spike',
        condition: 'error_count',
        threshold: 50, // 50 errors
        timeWindow: 60, // 1 minute
        enabled: true,
        cooldownPeriod: 300, // 5 minutes
      },
      {
        id: 'consecutive_errors',
        name: 'Consecutive Errors',
        condition: 'consecutive_errors',
        threshold: 10, // 10 consecutive errors
        timeWindow: 60, // 1 minute
        enabled: true,
        cooldownPeriod: 300, // 5 minutes
      },
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  // Record error occurrence
  public async recordError(
    error: Error,
    context: {
      endpoint?: string;
      statusCode?: number;
      userId?: string;
      correlationId?: string;
      additionalData?: any;
    }
  ): Promise<void> {
    const timestamp = Date.now();
    const errorData = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      timestamp,
      ...context,
    };

    try {
      // Store error in Redis with expiration
      const errorKey = `error:${timestamp}:${Math.random().toString(36).substr(2, 9)}`;
      await this.redis.setEx(errorKey, 3600, JSON.stringify(errorData)); // 1 hour TTL

      // Update error counters
      await this.updateErrorCounters(errorData);

      // Check alert rules
      await this.checkAlertRules();

      StructuredLogger.error('Error recorded for monitoring', error, {
        errorKey,
        context,
      });

    } catch (monitoringError) {
      StructuredLogger.error('Failed to record error in monitoring system', monitoringError);
    }
  }

  private async updateErrorCounters(errorData: any): Promise<void> {
    const now = Date.now();
    const windowStart = now - (this.metricsWindow * 1000);

    // Update total error count
    await this.redis.zAdd('errors:timeline', { score: now, value: JSON.stringify(errorData) });
    
    // Remove old entries
    await this.redis.zRemRangeByScore('errors:timeline', 0, windowStart);

    // Update error type counters
    const errorTypeKey = `errors:by_type:${errorData.name}`;
    await this.redis.incr(errorTypeKey);
    await this.redis.expire(errorTypeKey, this.metricsWindow);

    // Update endpoint error counters
    if (errorData.endpoint) {
      const endpointKey = `errors:by_endpoint:${errorData.endpoint}`;
      await this.redis.incr(endpointKey);
      await this.redis.expire(endpointKey, this.metricsWindow);
    }

    // Update status code counters
    if (errorData.statusCode) {
      const statusKey = `errors:by_status:${errorData.statusCode}`;
      await this.redis.incr(statusKey);
      await this.redis.expire(statusKey, this.metricsWindow);
    }

    // Update consecutive error counter
    await this.redis.incr('errors:consecutive');
    await this.redis.expire('errors:consecutive', 60); // Reset after 1 minute of no errors
  }

  // Reset consecutive error counter on successful request
  public async recordSuccess(): Promise<void> {
    try {
      await this.redis.del('errors:consecutive');
    } catch (error) {
      StructuredLogger.error('Failed to reset consecutive error counter', error);
    }
  }

  // Get current error metrics
  public async getErrorMetrics(): Promise<ErrorMetrics> {
    try {
      const now = Date.now();
      const windowStart = now - (this.metricsWindow * 1000);

      // Get errors in time window
      const errors = await this.redis.zRangeByScore('errors:timeline', windowStart, now);
      const errorCount = errors.length;

      // Calculate error rate (would need request count for accurate rate)
      const requestCount = await this.getRequestCount();
      const errorRate = requestCount > 0 ? errorCount / requestCount : 0;

      // Get last error timestamp
      const lastErrorData = errors.length > 0 ? JSON.parse(errors[errors.length - 1]) : null;
      const lastError = lastErrorData ? new Date(lastErrorData.timestamp) : new Date(0);

      // Get errors by type
      const errorsByType: { [errorType: string]: number } = {};
      const typeKeys = await this.redis.keys('errors:by_type:*');
      for (const key of typeKeys) {
        const type = key.replace('errors:by_type:', '');
        const count = await this.redis.get(key);
        errorsByType[type] = parseInt(count || '0');
      }

      // Get errors by endpoint
      const errorsByEndpoint: { [endpoint: string]: number } = {};
      const endpointKeys = await this.redis.keys('errors:by_endpoint:*');
      for (const key of endpointKeys) {
        const endpoint = key.replace('errors:by_endpoint:', '');
        const count = await this.redis.get(key);
        errorsByEndpoint[endpoint] = parseInt(count || '0');
      }

      // Get errors by status code
      const errorsByStatusCode: { [statusCode: string]: number } = {};
      const statusKeys = await this.redis.keys('errors:by_status:*');
      for (const key of statusKeys) {
        const status = key.replace('errors:by_status:', '');
        const count = await this.redis.get(key);
        errorsByStatusCode[status] = parseInt(count || '0');
      }

      return {
        errorCount,
        errorRate,
        lastError,
        errorsByType,
        errorsByEndpoint,
        errorsByStatusCode,
      };

    } catch (error) {
      StructuredLogger.error('Failed to get error metrics', error);
      return {
        errorCount: 0,
        errorRate: 0,
        lastError: new Date(0),
        errorsByType: {},
        errorsByEndpoint: {},
        errorsByStatusCode: {},
      };
    }
  }

  private async getRequestCount(): Promise<number> {
    try {
      const count = await this.redis.get('requests:count');
      return parseInt(count || '0');
    } catch (error) {
      return 0;
    }
  }

  // Check alert rules and trigger alerts if necessary
  private async checkAlertRules(): Promise<void> {
    const metrics = await this.getErrorMetrics();

    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      // Check cooldown period
      if (rule.lastTriggered) {
        const cooldownEnd = new Date(rule.lastTriggered.getTime() + rule.cooldownPeriod * 1000);
        if (new Date() < cooldownEnd) continue;
      }

      let shouldTrigger = false;

      switch (rule.condition) {
        case 'error_rate':
          shouldTrigger = metrics.errorRate > rule.threshold;
          break;
        case 'error_count':
          shouldTrigger = metrics.errorCount > rule.threshold;
          break;
        case 'consecutive_errors':
          const consecutiveErrors = await this.redis.get('errors:consecutive');
          shouldTrigger = parseInt(consecutiveErrors || '0') > rule.threshold;
          break;
      }

      if (shouldTrigger) {
        await this.triggerAlert(rule, metrics);
      }
    }
  }

  private async triggerAlert(rule: AlertRule, metrics: ErrorMetrics): Promise<void> {
    const alert: ErrorAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      message: this.generateAlertMessage(rule, metrics),
      severity: this.determineSeverity(rule, metrics),
      triggeredAt: new Date(),
      metrics,
      acknowledged: false,
    };

    try {
      // Store alert
      await this.redis.setEx(`alert:${alert.id}`, 86400, JSON.stringify(alert)); // 24 hours TTL

      // Update rule last triggered time
      rule.lastTriggered = new Date();
      this.alertRules.set(rule.id, rule);

      // Log alert
      StructuredLogger.warn('Error monitoring alert triggered', {
        eventType: 'error_alert',
        alert,
      });

      // Here you could integrate with external alerting systems
      // await this.sendToExternalAlertingSystem(alert);

    } catch (error) {
      StructuredLogger.error('Failed to trigger alert', error, { rule, metrics });
    }
  }

  private generateAlertMessage(rule: AlertRule, metrics: ErrorMetrics): string {
    switch (rule.condition) {
      case 'error_rate':
        return `Error rate (${(metrics.errorRate * 100).toFixed(2)}%) exceeded threshold (${(rule.threshold * 100).toFixed(2)}%)`;
      case 'error_count':
        return `Error count (${metrics.errorCount}) exceeded threshold (${rule.threshold}) in ${rule.timeWindow} seconds`;
      case 'consecutive_errors':
        return `Consecutive errors exceeded threshold (${rule.threshold})`;
      default:
        return `Alert condition ${rule.condition} triggered`;
    }
  }

  private determineSeverity(rule: AlertRule, metrics: ErrorMetrics): 'low' | 'medium' | 'high' | 'critical' {
    if (rule.condition === 'consecutive_errors' && metrics.errorCount > 20) {
      return 'critical';
    }
    if (rule.condition === 'error_rate' && metrics.errorRate > 0.2) {
      return 'critical';
    }
    if (rule.condition === 'error_count' && metrics.errorCount > 100) {
      return 'high';
    }
    return 'medium';
  }

  // Get recent alerts
  public async getRecentAlerts(limit = 50): Promise<ErrorAlert[]> {
    try {
      const alertKeys = await this.redis.keys('alert:*');
      const alerts: ErrorAlert[] = [];

      for (const key of alertKeys.slice(0, limit)) {
        const alertData = await this.redis.get(key);
        if (alertData) {
          const alert = JSON.parse(alertData);
          alert.triggeredAt = new Date(alert.triggeredAt);
          alert.metrics.lastError = new Date(alert.metrics.lastError);
          alerts.push(alert);
        }
      }

      return alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
    } catch (error) {
      StructuredLogger.error('Failed to get recent alerts', error);
      return [];
    }
  }

  // Acknowledge alert
  public async acknowledgeAlert(alertId: string): Promise<void> {
    try {
      const alertData = await this.redis.get(`alert:${alertId}`);
      if (alertData) {
        const alert = JSON.parse(alertData);
        alert.acknowledged = true;
        await this.redis.setEx(`alert:${alertId}`, 86400, JSON.stringify(alert));
        
        StructuredLogger.info('Alert acknowledged', { alertId });
      }
    } catch (error) {
      StructuredLogger.error('Failed to acknowledge alert', error, { alertId });
    }
  }

  // Start metrics collection
  private startMetricsCollection(): void {
    // Collect metrics every minute
    setInterval(async () => {
      try {
        const metrics = await this.getErrorMetrics();
        StructuredLogger.info('Error metrics collected', {
          eventType: 'error_metrics',
          metrics,
        });
      } catch (error) {
        StructuredLogger.error('Failed to collect error metrics', error);
      }
    }, 60000); // 1 minute

    StructuredLogger.info('Error monitoring service started');
  }

  // Add or update alert rule
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    StructuredLogger.info('Alert rule added/updated', { rule });
  }

  // Remove alert rule
  public removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    StructuredLogger.info('Alert rule removed', { ruleId });
  }

  // Get all alert rules
  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }
}

export const errorMonitoringService = new ErrorMonitoringService();