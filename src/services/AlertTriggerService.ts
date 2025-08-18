import { NotificationService } from './NotificationService';
import { EnvironmentalDataRepository } from '../models/EnvironmentalDataRepository';
import { logger } from '../utils/logger';
import { EnvironmentalDataPoint, Location } from '../models/types';

interface PollutantThreshold {
  pollutant: string;
  threshold: number;
  unit: string;
  severity: 'info' | 'warning' | 'critical';
}

export class AlertTriggerService {
  private notificationService: NotificationService;
  private environmentalDataRepo: EnvironmentalDataRepository;

  // WHO Air Quality Guidelines and common thresholds
  private readonly POLLUTANT_THRESHOLDS: PollutantThreshold[] = [
    // PM2.5 (µg/m³)
    { pollutant: 'PM2.5', threshold: 15, unit: 'µg/m³', severity: 'info' },
    { pollutant: 'PM2.5', threshold: 25, unit: 'µg/m³', severity: 'warning' },
    { pollutant: 'PM2.5', threshold: 35, unit: 'µg/m³', severity: 'critical' },
    
    // PM10 (µg/m³)
    { pollutant: 'PM10', threshold: 45, unit: 'µg/m³', severity: 'info' },
    { pollutant: 'PM10', threshold: 75, unit: 'µg/m³', severity: 'warning' },
    { pollutant: 'PM10', threshold: 150, unit: 'µg/m³', severity: 'critical' },
    
    // NO2 (µg/m³)
    { pollutant: 'NO2', threshold: 25, unit: 'µg/m³', severity: 'info' },
    { pollutant: 'NO2', threshold: 40, unit: 'µg/m³', severity: 'warning' },
    { pollutant: 'NO2', threshold: 200, unit: 'µg/m³', severity: 'critical' },
    
    // O3 (µg/m³)
    { pollutant: 'O3', threshold: 100, unit: 'µg/m³', severity: 'info' },
    { pollutant: 'O3', threshold: 160, unit: 'µg/m³', severity: 'warning' },
    { pollutant: 'O3', threshold: 240, unit: 'µg/m³', severity: 'critical' },
    
    // SO2 (µg/m³)
    { pollutant: 'SO2', threshold: 20, unit: 'µg/m³', severity: 'info' },
    { pollutant: 'SO2', threshold: 40, unit: 'µg/m³', severity: 'warning' },
    { pollutant: 'SO2', threshold: 500, unit: 'µg/m³', severity: 'critical' },
    
    // CO (mg/m³)
    { pollutant: 'CO', threshold: 10, unit: 'mg/m³', severity: 'info' },
    { pollutant: 'CO', threshold: 20, unit: 'mg/m³', severity: 'warning' },
    { pollutant: 'CO', threshold: 30, unit: 'mg/m³', severity: 'critical' }
  ];

  constructor() {
    this.notificationService = new NotificationService();
    this.environmentalDataRepo = new EnvironmentalDataRepository();
  }

  async checkForThresholdBreaches(dataPoints: EnvironmentalDataPoint[]): Promise<void> {
    try {
      const alertPromises: Promise<any>[] = [];

      for (const dataPoint of dataPoints) {
        const thresholds = this.getThresholdsForPollutant(dataPoint.pollutant, dataPoint.unit);
        
        for (const threshold of thresholds) {
          if (dataPoint.value >= threshold.threshold) {
            // Check if we've already sent a similar alert recently
            const shouldSendAlert = await this.shouldSendThresholdAlert(
              dataPoint.location,
              dataPoint.pollutant,
              threshold.severity
            );

            if (shouldSendAlert) {
              alertPromises.push(
                this.notificationService.generatePollutantAlert(
                  dataPoint.location,
                  dataPoint.pollutant,
                  dataPoint.value,
                  dataPoint.unit,
                  threshold.threshold
                )
              );
            }
            
            // Only trigger the highest severity alert for this pollutant
            break;
          }
        }
      }

      if (alertPromises.length > 0) {
        await Promise.allSettled(alertPromises);
        logger.info(`Generated ${alertPromises.length} threshold breach alerts`);
      }
    } catch (error) {
      logger.error('Error checking for threshold breaches:', error);
      throw error;
    }
  }

  async checkForHealthWarnings(location: Location, radiusKm: number = 10): Promise<void> {
    try {
      // Get recent environmental data for the area
      const recentDataResponse = await this.environmentalDataRepo.findMany({
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          radius_km: radiusKm
        },
        time_range: {
          start: new Date(Date.now() - 2 * 60 * 60 * 1000), // Last 2 hours
          end: new Date()
        },
        limit: 1000 // Get enough data for analysis
      });
      
      const recentData = recentDataResponse.data;

      if (recentData.length === 0) {
        return;
      }

      // Group by pollutant and calculate averages
      const pollutantAverages = this.calculatePollutantAverages(recentData);
      
      // Determine overall health risk
      const riskAssessment = this.assessHealthRisk(pollutantAverages);
      
      if (riskAssessment.riskLevel !== 'low') {
        const shouldSendAlert = await this.shouldSendHealthWarning(
          location,
          riskAssessment.riskLevel
        );

        if (shouldSendAlert) {
          await this.notificationService.generateHealthWarning(
            location,
            riskAssessment.concerningPollutants,
            riskAssessment.riskLevel
          );
          
          logger.info(`Generated health warning (${riskAssessment.riskLevel}) for location ${location.latitude}, ${location.longitude}`);
        }
      }
    } catch (error) {
      logger.error('Error checking for health warnings:', error);
      throw error;
    }
  }

  async checkForTrendAlerts(location: Location, radiusKm: number = 10): Promise<void> {
    try {
      // Get data from the last week
      const weekDataResponse = await this.environmentalDataRepo.findMany({
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          radius_km: radiusKm
        },
        time_range: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          end: new Date()
        },
        limit: 1000 // Get enough data for trend analysis
      });
      
      const weekData = weekDataResponse.data;

      if (weekData.length < 10) {
        return; // Not enough data for trend analysis
      }

      // Group by pollutant and analyze trends
      const pollutantGroups = this.groupByPollutant(weekData);
      
      for (const [pollutant, dataPoints] of Object.entries(pollutantGroups)) {
        const trendAnalysis = this.analyzeTrend(dataPoints);
        
        if (trendAnalysis.isSignificant) {
          const shouldSendAlert = await this.shouldSendTrendAlert(
            location,
            pollutant,
            trendAnalysis.direction
          );

          if (shouldSendAlert) {
            await this.notificationService.generateTrendAlert(
              location,
              pollutant,
              trendAnalysis.direction,
              trendAnalysis.magnitude
            );
            
            logger.info(`Generated trend alert for ${pollutant} (${trendAnalysis.direction}) at ${location.latitude}, ${location.longitude}`);
          }
        }
      }
    } catch (error) {
      logger.error('Error checking for trend alerts:', error);
      throw error;
    }
  }

  private getThresholdsForPollutant(pollutant: string, unit: string): PollutantThreshold[] {
    return this.POLLUTANT_THRESHOLDS
      .filter(t => t.pollutant === pollutant && t.unit === unit)
      .sort((a, b) => b.threshold - a.threshold); // Sort by threshold descending
  }

  private calculatePollutantAverages(dataPoints: EnvironmentalDataPoint[]): { [pollutant: string]: { average: number; unit: string; count: number } } {
    const groups = this.groupByPollutant(dataPoints);
    const averages: { [pollutant: string]: { average: number; unit: string; count: number } } = {};

    for (const [pollutant, points] of Object.entries(groups)) {
      const sum = points.reduce((acc, point) => acc + point.value, 0);
      averages[pollutant] = {
        average: sum / points.length,
        unit: points[0].unit,
        count: points.length
      };
    }

    return averages;
  }

  private groupByPollutant(dataPoints: EnvironmentalDataPoint[]): { [pollutant: string]: EnvironmentalDataPoint[] } {
    return dataPoints.reduce((groups, point) => {
      const key = point.pollutant;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(point);
      return groups;
    }, {} as { [pollutant: string]: EnvironmentalDataPoint[] });
  }

  private assessHealthRisk(pollutantAverages: { [pollutant: string]: { average: number; unit: string; count: number } }): {
    riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
    concerningPollutants: string[];
  } {
    let maxRiskLevel: 'low' | 'moderate' | 'high' | 'very_high' = 'low';
    const concerningPollutants: string[] = [];

    for (const [pollutant, data] of Object.entries(pollutantAverages)) {
      const thresholds = this.getThresholdsForPollutant(pollutant, data.unit);
      
      for (const threshold of thresholds) {
        if (data.average >= threshold.threshold) {
          concerningPollutants.push(pollutant);
          
          // Map severity to risk level
          let riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
          switch (threshold.severity) {
            case 'info':
              riskLevel = 'moderate';
              break;
            case 'warning':
              riskLevel = 'high';
              break;
            case 'critical':
              riskLevel = 'very_high';
              break;
            default:
              riskLevel = 'low';
          }
          
          if (this.getRiskLevelPriority(riskLevel) > this.getRiskLevelPriority(maxRiskLevel)) {
            maxRiskLevel = riskLevel;
          }
          
          break; // Only consider the highest threshold exceeded
        }
      }
    }

    return {
      riskLevel: maxRiskLevel,
      concerningPollutants: [...new Set(concerningPollutants)] // Remove duplicates
    };
  }

  private getRiskLevelPriority(riskLevel: 'low' | 'moderate' | 'high' | 'very_high'): number {
    switch (riskLevel) {
      case 'low': return 0;
      case 'moderate': return 1;
      case 'high': return 2;
      case 'very_high': return 3;
      default: return 0;
    }
  }

  private analyzeTrend(dataPoints: EnvironmentalDataPoint[]): {
    direction: 'improving' | 'worsening' | 'stable';
    magnitude: number;
    isSignificant: boolean;
  } {
    if (dataPoints.length < 5) {
      return { direction: 'stable', magnitude: 0, isSignificant: false };
    }

    // Sort by timestamp
    const sortedPoints = dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Calculate linear regression slope
    const n = sortedPoints.length;
    const xValues = sortedPoints.map((_, index) => index);
    const yValues = sortedPoints.map(point => point.value);
    
    const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
    const yMean = yValues.reduce((sum, y) => sum + y, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
      denominator += (xValues[i] - xMean) ** 2;
    }
    
    const slope = denominator === 0 ? 0 : numerator / denominator;
    
    // Calculate correlation coefficient for significance
    const yVariance = yValues.reduce((sum, y) => sum + (y - yMean) ** 2, 0) / n;
    const correlation = Math.abs(slope * Math.sqrt(denominator / n) / Math.sqrt(yVariance));
    
    // Determine direction and significance
    const magnitude = Math.abs(slope) / yMean; // Relative change rate
    const isSignificant = correlation > 0.5 && magnitude > 0.1; // At least 10% relative change with good correlation
    
    let direction: 'improving' | 'worsening' | 'stable';
    if (slope > 0) {
      direction = 'worsening'; // Increasing pollution is worsening
    } else if (slope < 0) {
      direction = 'improving'; // Decreasing pollution is improving
    } else {
      direction = 'stable';
    }

    return {
      direction,
      magnitude,
      isSignificant
    };
  }

  // Rate limiting methods to prevent spam
  private async shouldSendThresholdAlert(
    location: Location,
    pollutant: string,
    severity: 'info' | 'warning' | 'critical'
  ): Promise<boolean> {
    // In a real implementation, you would check Redis or database for recent similar alerts
    // For now, we'll implement a simple time-based check
    
    // Critical alerts: max once per hour
    // Warning alerts: max once per 2 hours
    // Info alerts: max once per 4 hours
    
    const cooldownHours = severity === 'critical' ? 1 : severity === 'warning' ? 2 : 4;
    
    // This is a simplified implementation
    // In production, you'd want to store alert history in Redis with location-based keys
    return true; // For now, always allow alerts
  }

  private async shouldSendHealthWarning(
    location: Location,
    riskLevel: 'moderate' | 'high' | 'very_high'
  ): Promise<boolean> {
    // Health warnings should be sent at most once per 6 hours for the same location and risk level
    return true; // Simplified implementation
  }

  private async shouldSendTrendAlert(
    location: Location,
    pollutant: string,
    direction: 'improving' | 'worsening'
  ): Promise<boolean> {
    // Trend alerts should be sent at most once per day for the same pollutant and location
    return true; // Simplified implementation
  }
}