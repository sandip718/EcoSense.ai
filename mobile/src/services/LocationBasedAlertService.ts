// Location-Based Alert Service for EcoSense.ai Mobile App
// Implements requirements 10.1, 10.3, 10.4: Location-based alert triggering for pollution threshold breaches

import {LocationService} from './LocationService';
import {ApiService} from './ApiService';
import {NotificationService} from './NotificationService';
import PushNotificationService from './PushNotificationService';
import {EnvironmentalDataPoint, Location} from '@/types/api';
import {logger} from '@/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AlertThreshold {
  pollutant: string;
  threshold: number;
  severity: 'warning' | 'critical';
  enabled: boolean;
}

export interface AlertRule {
  id: string;
  location: Location;
  radius: number; // in kilometers
  thresholds: AlertThreshold[];
  enabled: boolean;
  lastChecked?: Date;
  lastTriggered?: Date;
}

export class LocationBasedAlertService {
  private static instance: LocationBasedAlertService;
  private alertRules: AlertRule[] = [];
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  // Default pollution thresholds based on WHO guidelines
  private readonly DEFAULT_THRESHOLDS: AlertThreshold[] = [
    {pollutant: 'pm2.5', threshold: 35, severity: 'warning', enabled: true},
    {pollutant: 'pm2.5', threshold: 55, severity: 'critical', enabled: true},
    {pollutant: 'pm10', threshold: 50, severity: 'warning', enabled: true},
    {pollutant: 'pm10', threshold: 100, severity: 'critical', enabled: true},
    {pollutant: 'no2', threshold: 40, severity: 'warning', enabled: true},
    {pollutant: 'no2', threshold: 80, severity: 'critical', enabled: true},
    {pollutant: 'o3', threshold: 100, severity: 'warning', enabled: true},
    {pollutant: 'o3', threshold: 180, severity: 'critical', enabled: true},
    {pollutant: 'so2', threshold: 20, severity: 'warning', enabled: true},
    {pollutant: 'so2', threshold: 50, severity: 'critical', enabled: true},
    {pollutant: 'co', threshold: 10, severity: 'warning', enabled: true},
    {pollutant: 'co', threshold: 30, severity: 'critical', enabled: true},
  ];

  private constructor() {}

  static getInstance(): LocationBasedAlertService {
    if (!LocationBasedAlertService.instance) {
      LocationBasedAlertService.instance = new LocationBasedAlertService();
    }
    return LocationBasedAlertService.instance;
  }

  /**
   * Initialize the alert service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Location-Based Alert Service');
      
      // Load existing alert rules
      await this.loadAlertRules();
      
      // Create default alert rule for user's location if none exist
      if (this.alertRules.length === 0) {
        await this.createDefaultAlertRule();
      }
      
      // Start monitoring
      await this.startMonitoring();
      
      logger.info('Location-Based Alert Service initialized');
    } catch (error) {
      logger.error('Error initializing Location-Based Alert Service:', error);
      throw error;
    }
  }

  /**
   * Start monitoring environmental conditions
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    try {
      this.isMonitoring = true;
      
      // Initial check
      await this.checkAllAlertRules();
      
      // Set up periodic monitoring
      this.monitoringInterval = setInterval(async () => {
        try {
          await this.checkAllAlertRules();
        } catch (error) {
          logger.error('Error in monitoring interval:', error);
        }
      }, this.CHECK_INTERVAL);
      
      logger.info('Alert monitoring started');
    } catch (error) {
      logger.error('Error starting alert monitoring:', error);
      this.isMonitoring = false;
      throw error;
    }
  }

  /**
   * Stop monitoring environmental conditions
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    logger.info('Alert monitoring stopped');
  }

  /**
   * Check all alert rules
   */
  private async checkAllAlertRules(): Promise<void> {
    const enabledRules = this.alertRules.filter(rule => rule.enabled);
    
    for (const rule of enabledRules) {
      try {
        await this.checkAlertRule(rule);
      } catch (error) {
        logger.error(`Error checking alert rule ${rule.id}:`, error);
      }
    }
  }

  /**
   * Check a specific alert rule
   */
  private async checkAlertRule(rule: AlertRule): Promise<void> {
    try {
      // Get current environmental data for the rule's location
      const environmentalData = await ApiService.getEnvironmentalData(
        rule.location,
        rule.radius
      );

      if (!environmentalData || environmentalData.length === 0) {
        logger.debug(`No environmental data found for rule ${rule.id}`);
        return;
      }

      // Check each threshold
      for (const threshold of rule.thresholds) {
        if (!threshold.enabled) continue;

        const relevantData = environmentalData.filter(
          data => data.pollutant.toLowerCase() === threshold.pollutant.toLowerCase()
        );

        if (relevantData.length === 0) continue;

        // Get the latest reading for this pollutant
        const latestReading = relevantData.reduce((latest, current) => 
          new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
        );

        // Check if threshold is breached
        if (latestReading.value >= threshold.threshold) {
          await this.triggerAlert(rule, threshold, latestReading);
        }
      }

      // Update last checked time
      rule.lastChecked = new Date();
      await this.saveAlertRules();

    } catch (error) {
      logger.error(`Error checking alert rule ${rule.id}:`, error);
    }
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(
    rule: AlertRule,
    threshold: AlertThreshold,
    data: EnvironmentalDataPoint
  ): Promise<void> {
    try {
      // Check if we've already triggered this alert recently (avoid spam)
      const now = new Date();
      const cooldownPeriod = threshold.severity === 'critical' ? 30 * 60 * 1000 : 60 * 60 * 1000; // 30min for critical, 1hr for warning
      
      if (rule.lastTriggered && (now.getTime() - rule.lastTriggered.getTime()) < cooldownPeriod) {
        logger.debug(`Alert cooldown active for rule ${rule.id}`);
        return;
      }

      // Create alert message
      const alertTitle = this.createAlertTitle(threshold, data);
      const alertMessage = this.createAlertMessage(threshold, data);

      // Send push notification
      const notificationData = {
        type: 'pollution_alert' as const,
        severity: threshold.severity,
        location: {
          latitude: data.location.latitude,
          longitude: data.location.longitude,
        },
        pollutant: data.pollutant,
        value: data.value,
        threshold: threshold.threshold,
      };

      // Add to notification history
      await NotificationService.addToHistory({
        title: alertTitle,
        message: alertMessage,
        type: 'pollution_alert',
        severity: threshold.severity,
        data: notificationData,
      });

      // Update last triggered time
      rule.lastTriggered = now;
      await this.saveAlertRules();

      logger.info(`Alert triggered for ${threshold.pollutant} threshold breach`, {
        ruleId: rule.id,
        pollutant: data.pollutant,
        value: data.value,
        threshold: threshold.threshold,
        severity: threshold.severity,
      });

    } catch (error) {
      logger.error('Error triggering alert:', error);
    }
  }

  /**
   * Create alert title
   */
  private createAlertTitle(threshold: AlertThreshold, data: EnvironmentalDataPoint): string {
    const severityText = threshold.severity === 'critical' ? 'Critical' : 'Warning';
    const pollutantName = this.getPollutantDisplayName(data.pollutant);
    
    return `${severityText}: High ${pollutantName} Levels`;
  }

  /**
   * Create alert message
   */
  private createAlertMessage(threshold: AlertThreshold, data: EnvironmentalDataPoint): string {
    const pollutantName = this.getPollutantDisplayName(data.pollutant);
    const location = data.location.address || `${data.location.latitude.toFixed(3)}, ${data.location.longitude.toFixed(3)}`;
    
    let healthAdvice = '';
    if (threshold.severity === 'critical') {
      healthAdvice = ' Avoid outdoor activities and stay indoors if possible.';
    } else {
      healthAdvice = ' Consider limiting outdoor activities, especially if you have respiratory conditions.';
    }

    return `${pollutantName} levels have reached ${data.value} ${data.unit} near ${location}, exceeding the ${threshold.severity} threshold of ${threshold.threshold} ${data.unit}.${healthAdvice}`;
  }

  /**
   * Get display name for pollutant
   */
  private getPollutantDisplayName(pollutant: string): string {
    const displayNames: Record<string, string> = {
      'pm2.5': 'PM2.5',
      'pm10': 'PM10',
      'no2': 'Nitrogen Dioxide',
      'o3': 'Ozone',
      'so2': 'Sulfur Dioxide',
      'co': 'Carbon Monoxide',
    };
    
    return displayNames[pollutant.toLowerCase()] || pollutant.toUpperCase();
  }

  /**
   * Create default alert rule for user's location
   */
  private async createDefaultAlertRule(): Promise<void> {
    try {
      const userLocation = await LocationService.getCurrentLocation();
      if (!userLocation) {
        logger.warn('Cannot create default alert rule: no user location available');
        return;
      }

      const defaultRule: AlertRule = {
        id: `default_${Date.now()}`,
        location: userLocation,
        radius: 10, // 10km radius
        thresholds: [...this.DEFAULT_THRESHOLDS],
        enabled: true,
      };

      this.alertRules.push(defaultRule);
      await this.saveAlertRules();
      
      logger.info('Created default alert rule for user location');
    } catch (error) {
      logger.error('Error creating default alert rule:', error);
    }
  }

  /**
   * Add a new alert rule
   */
  async addAlertRule(rule: Omit<AlertRule, 'id'>): Promise<string> {
    const newRule: AlertRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.alertRules.push(newRule);
    await this.saveAlertRules();
    
    logger.info(`Added new alert rule: ${newRule.id}`);
    return newRule.id;
  }

  /**
   * Update an existing alert rule
   */
  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<void> {
    const ruleIndex = this.alertRules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex === -1) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    this.alertRules[ruleIndex] = {
      ...this.alertRules[ruleIndex],
      ...updates,
    };

    await this.saveAlertRules();
    logger.info(`Updated alert rule: ${ruleId}`);
  }

  /**
   * Remove an alert rule
   */
  async removeAlertRule(ruleId: string): Promise<void> {
    const ruleIndex = this.alertRules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex === -1) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    this.alertRules.splice(ruleIndex, 1);
    await this.saveAlertRules();
    
    logger.info(`Removed alert rule: ${ruleId}`);
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }

  /**
   * Get alert rule by ID
   */
  getAlertRule(ruleId: string): AlertRule | null {
    return this.alertRules.find(rule => rule.id === ruleId) || null;
  }

  /**
   * Enable/disable monitoring
   */
  async setMonitoringEnabled(enabled: boolean): Promise<void> {
    if (enabled && !this.isMonitoring) {
      await this.startMonitoring();
    } else if (!enabled && this.isMonitoring) {
      this.stopMonitoring();
    }
  }

  /**
   * Check if monitoring is active
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Force check all rules (for testing)
   */
  async forceCheckAllRules(): Promise<void> {
    await this.checkAllAlertRules();
  }

  /**
   * Load alert rules from storage
   */
  private async loadAlertRules(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('alert_rules');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.alertRules = parsed.map((rule: any) => ({
          ...rule,
          lastChecked: rule.lastChecked ? new Date(rule.lastChecked) : undefined,
          lastTriggered: rule.lastTriggered ? new Date(rule.lastTriggered) : undefined,
        }));
      }
    } catch (error) {
      logger.error('Error loading alert rules:', error);
      this.alertRules = [];
    }
  }

  /**
   * Save alert rules to storage
   */
  private async saveAlertRules(): Promise<void> {
    try {
      await AsyncStorage.setItem('alert_rules', JSON.stringify(this.alertRules));
    } catch (error) {
      logger.error('Error saving alert rules:', error);
    }
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    isActive: boolean;
    rulesCount: number;
    enabledRulesCount: number;
    lastCheckTime?: Date;
    nextCheckTime?: Date;
  } {
    const enabledRules = this.alertRules.filter(rule => rule.enabled);
    const lastCheckTimes = this.alertRules
      .map(rule => rule.lastChecked)
      .filter(time => time !== undefined) as Date[];
    
    const lastCheckTime = lastCheckTimes.length > 0 
      ? new Date(Math.max(...lastCheckTimes.map(t => t.getTime())))
      : undefined;

    const nextCheckTime = this.isMonitoring && lastCheckTime
      ? new Date(lastCheckTime.getTime() + this.CHECK_INTERVAL)
      : undefined;

    return {
      isActive: this.isMonitoring,
      rulesCount: this.alertRules.length,
      enabledRulesCount: enabledRules.length,
      lastCheckTime,
      nextCheckTime,
    };
  }
}

export default LocationBasedAlertService.getInstance();