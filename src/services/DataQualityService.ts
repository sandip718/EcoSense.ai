import { CreateEnvironmentalDataPoint } from '../models/types';
import { validateEnvironmentalData, validatePollutantRange, ValidationResult } from '../utils/validation';
import { Logger } from 'winston';

export interface QualityScore {
  overall: number; // 0-1 scale
  components: {
    completeness: number;
    accuracy: number;
    timeliness: number;
    consistency: number;
  };
  grade: 'A' | 'B' | 'C' | 'D';
  issues: string[];
}

export interface DataQualityMetrics {
  totalDataPoints: number;
  qualityDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
  };
  averageScore: number;
  commonIssues: Array<{
    issue: string;
    frequency: number;
  }>;
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  confidence: number;
  reasons: string[];
  suggestedAction: 'accept' | 'flag' | 'reject';
}

/**
 * Service for data quality assessment and validation
 * Implements requirements 8.1, 8.2, 8.3, 8.4
 */
export class DataQualityService {
  private logger: Logger;
  private historicalData: Map<string, CreateEnvironmentalDataPoint[]> = new Map();
  private qualityMetrics: DataQualityMetrics = {
    totalDataPoints: 0,
    qualityDistribution: { A: 0, B: 0, C: 0, D: 0 },
    averageScore: 0,
    commonIssues: []
  };

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Validate and score environmental data quality
   * Requirement 8.1: Data quality validation and scoring
   */
  assessDataQuality(dataPoint: CreateEnvironmentalDataPoint): QualityScore {
    const validationResult = validateEnvironmentalData(dataPoint);
    const qualityScore = this.calculateQualityScore(dataPoint, validationResult);
    
    // Update metrics
    this.updateQualityMetrics(qualityScore);
    
    // Store for historical analysis
    this.storeHistoricalData(dataPoint);
    
    this.logger.debug('Data quality assessed', {
      source: dataPoint.source,
      pollutant: dataPoint.pollutant,
      score: qualityScore.overall,
      grade: qualityScore.grade
    });

    return qualityScore;
  }

  /**
   * Calculate comprehensive quality score
   * Requirement 8.1: Data quality scoring algorithms
   */
  private calculateQualityScore(
    dataPoint: CreateEnvironmentalDataPoint,
    validationResult: ValidationResult
  ): QualityScore {
    const issues: string[] = [];
    
    // Completeness score (0-1)
    const completeness = this.calculateCompletenessScore(dataPoint, issues);
    
    // Accuracy score (0-1)
    const accuracy = this.calculateAccuracyScore(dataPoint, validationResult, issues);
    
    // Timeliness score (0-1)
    const timeliness = this.calculateTimelinessScore(dataPoint, issues);
    
    // Consistency score (0-1)
    const consistency = this.calculateConsistencyScore(dataPoint, issues);

    // Overall score (weighted average)
    const overall = (
      completeness * 0.25 +
      accuracy * 0.35 +
      timeliness * 0.20 +
      consistency * 0.20
    );

    // Determine grade
    const grade = this.determineGrade(overall);

    return {
      overall,
      components: {
        completeness,
        accuracy,
        timeliness,
        consistency
      },
      grade,
      issues
    };
  }

  /**
   * Calculate completeness score based on required fields
   */
  private calculateCompletenessScore(
    dataPoint: CreateEnvironmentalDataPoint,
    issues: string[]
  ): number {
    let score = 1.0;
    const requiredFields = ['source', 'pollutant', 'value', 'unit', 'location', 'timestamp'];
    
    for (const field of requiredFields) {
      const value = (dataPoint as any)[field];
      if (value === null || value === undefined || value === '') {
        score -= 0.15;
        issues.push(`Missing required field: ${field}`);
      }
    }

    // Check for optional but valuable fields
    if (!dataPoint.location?.address) {
      score -= 0.05;
      issues.push('Missing address information');
    }

    return Math.max(0, score);
  }

  /**
   * Calculate accuracy score based on validation and range checks
   */
  private calculateAccuracyScore(
    dataPoint: CreateEnvironmentalDataPoint,
    validationResult: ValidationResult,
    issues: string[]
  ): number {
    let score = 1.0;

    // Deduct for validation errors
    if (!validationResult.isValid) {
      score -= validationResult.errors.length * 0.2;
      issues.push(...validationResult.errors.map(e => e.message));
    }

    // Check pollutant value ranges
    const rangeValidation = validatePollutantRange(
      dataPoint.pollutant,
      dataPoint.value,
      dataPoint.unit
    );
    
    if (!rangeValidation.isValid) {
      score -= 0.3;
      issues.push(...rangeValidation.errors.map(e => e.message));
    }

    // Check for suspicious values (statistical outliers)
    const outlierCheck = this.checkForOutliers(dataPoint);
    if (outlierCheck.isOutlier) {
      score -= 0.2;
      issues.push(`Potential outlier: ${outlierCheck.reason}`);
    }

    return Math.max(0, score);
  }

  /**
   * Calculate timeliness score based on data freshness
   */
  private calculateTimelinessScore(
    dataPoint: CreateEnvironmentalDataPoint,
    issues: string[]
  ): number {
    const now = new Date();
    const dataAge = now.getTime() - dataPoint.timestamp.getTime();
    const ageInHours = dataAge / (1000 * 60 * 60);

    let score = 1.0;

    if (ageInHours > 24) {
      score -= 0.5;
      issues.push('Data is more than 24 hours old');
    } else if (ageInHours > 6) {
      score -= 0.3;
      issues.push('Data is more than 6 hours old');
    } else if (ageInHours > 2) {
      score -= 0.1;
      issues.push('Data is more than 2 hours old');
    }

    // Future timestamps are problematic
    if (ageInHours < 0) {
      score -= 0.4;
      issues.push('Data timestamp is in the future');
    }

    return Math.max(0, score);
  }

  /**
   * Calculate consistency score based on historical patterns
   */
  private calculateConsistencyScore(
    dataPoint: CreateEnvironmentalDataPoint,
    issues: string[]
  ): number {
    const key = `${dataPoint.source}_${dataPoint.pollutant}_${dataPoint.location.latitude}_${dataPoint.location.longitude}`;
    const historical = this.historicalData.get(key) || [];
    
    if (historical.length < 3) {
      return 0.8; // Neutral score for insufficient historical data
    }

    let score = 1.0;

    // Check for sudden spikes or drops
    const recentValues = historical.slice(-5).map(d => d.value);
    const average = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const stdDev = Math.sqrt(
      recentValues.reduce((sq, n) => sq + Math.pow(n - average, 2), 0) / recentValues.length
    );

    const deviation = Math.abs(dataPoint.value - average);
    const zScore = stdDev > 0 ? deviation / stdDev : 0;

    if (zScore > 3) {
      score -= 0.4;
      issues.push(`Value deviates significantly from recent pattern (z-score: ${zScore.toFixed(2)})`);
    } else if (zScore > 2) {
      score -= 0.2;
      issues.push(`Value shows moderate deviation from recent pattern (z-score: ${zScore.toFixed(2)})`);
    }

    // Check for unit consistency
    const recentUnits = historical.slice(-10).map(d => d.unit);
    const uniqueUnits = [...new Set(recentUnits)];
    if (uniqueUnits.length > 1 && !uniqueUnits.includes(dataPoint.unit)) {
      score -= 0.3;
      issues.push(`Unit inconsistency detected. Expected: ${uniqueUnits.join(' or ')}, got: ${dataPoint.unit}`);
    }

    return Math.max(0, score);
  }

  /**
   * Determine quality grade based on overall score
   */
  private determineGrade(score: number): 'A' | 'B' | 'C' | 'D' {
    if (score >= 0.9) return 'A';
    if (score >= 0.75) return 'B';
    if (score >= 0.6) return 'C';
    return 'D';
  }

  /**
   * Check for statistical outliers
   * Requirement 8.2: Anomaly detection for suspicious data points
   */
  private checkForOutliers(dataPoint: CreateEnvironmentalDataPoint): {
    isOutlier: boolean;
    reason: string;
  } {
    // Define extreme value thresholds for common pollutants
    const extremeThresholds: Record<string, { min: number; max: number }> = {
      'pm25': { min: 0, max: 300 },
      'pm10': { min: 0, max: 500 },
      'no2': { min: 0, max: 1000 },
      'o3': { min: 0, max: 500 },
      'so2': { min: 0, max: 1000 },
      'co': { min: 0, max: 30 },
      'turbidity': { min: 0, max: 100 },
      'ph': { min: 0, max: 14 },
      'temperature': { min: -40, max: 50 }
    };

    const threshold = extremeThresholds[dataPoint.pollutant.toLowerCase()];
    if (threshold) {
      if (dataPoint.value < threshold.min) {
        return {
          isOutlier: true,
          reason: `Value ${dataPoint.value} is below minimum threshold ${threshold.min}`
        };
      }
      if (dataPoint.value > threshold.max) {
        return {
          isOutlier: true,
          reason: `Value ${dataPoint.value} is above maximum threshold ${threshold.max}`
        };
      }
    }

    return { isOutlier: false, reason: '' };
  }

  /**
   * Detect anomalies in environmental data
   * Requirement 8.2: Anomaly detection for identifying suspicious data points
   */
  detectAnomalies(dataPoint: CreateEnvironmentalDataPoint): AnomalyDetectionResult {
    const reasons: string[] = [];
    let confidence = 0;

    // Check for extreme values
    const outlierCheck = this.checkForOutliers(dataPoint);
    if (outlierCheck.isOutlier) {
      reasons.push(outlierCheck.reason);
      confidence += 0.6; // Increase confidence for extreme values
    }

    // Check for temporal anomalies
    const now = new Date();
    const ageInHours = (now.getTime() - dataPoint.timestamp.getTime()) / (1000 * 60 * 60);
    
    if (ageInHours > 48) {
      reasons.push('Data is unusually old');
      confidence += 0.3;
    }

    if (ageInHours < -1) {
      reasons.push('Data timestamp is significantly in the future');
      confidence += 0.6; // Increase confidence for future timestamps
    }

    // Check for location anomalies
    if (Math.abs(dataPoint.location.latitude) > 90 || Math.abs(dataPoint.location.longitude) > 180) {
      reasons.push('Invalid geographic coordinates');
      confidence += 0.6;
    }

    // Check for source reliability
    const sourceReliability = this.getSourceReliability(dataPoint.source);
    if (sourceReliability < 0.5) {
      reasons.push('Data from unreliable source');
      confidence += 0.2;
    }

    const isAnomaly = confidence > 0.5;
    let suggestedAction: 'accept' | 'flag' | 'reject';

    if (confidence > 0.6) {
      suggestedAction = 'reject';
    } else if (confidence > 0.3) {
      suggestedAction = 'flag';
    } else {
      suggestedAction = 'accept';
    }

    return {
      isAnomaly,
      confidence,
      reasons,
      suggestedAction
    };
  }

  /**
   * Get source reliability score
   * Requirement 8.3: Data source reliability tracking
   */
  private getSourceReliability(source: string): number {
    // In a real implementation, this would be based on historical performance
    const sourceReliability: Record<string, number> = {
      'openaq': 0.9,
      'water_quality_portal': 0.85,
      'local_sensor': 0.7
    };

    return sourceReliability[source] || 0.5;
  }

  /**
   * Store historical data for pattern analysis
   */
  private storeHistoricalData(dataPoint: CreateEnvironmentalDataPoint): void {
    const key = `${dataPoint.source}_${dataPoint.pollutant}_${dataPoint.location.latitude}_${dataPoint.location.longitude}`;
    
    if (!this.historicalData.has(key)) {
      this.historicalData.set(key, []);
    }

    const historical = this.historicalData.get(key)!;
    historical.push(dataPoint);

    // Keep only last 100 data points per location/pollutant combination
    if (historical.length > 100) {
      historical.shift();
    }
  }

  /**
   * Update quality metrics
   */
  private updateQualityMetrics(qualityScore: QualityScore): void {
    this.qualityMetrics.totalDataPoints++;
    this.qualityMetrics.qualityDistribution[qualityScore.grade]++;
    
    // Update average score
    const totalScore = this.qualityMetrics.averageScore * (this.qualityMetrics.totalDataPoints - 1) + qualityScore.overall;
    this.qualityMetrics.averageScore = totalScore / this.qualityMetrics.totalDataPoints;

    // Update common issues
    for (const issue of qualityScore.issues) {
      const existingIssue = this.qualityMetrics.commonIssues.find(i => i.issue === issue);
      if (existingIssue) {
        existingIssue.frequency++;
      } else {
        this.qualityMetrics.commonIssues.push({ issue, frequency: 1 });
      }
    }

    // Keep only top 10 most common issues
    this.qualityMetrics.commonIssues.sort((a, b) => b.frequency - a.frequency);
    this.qualityMetrics.commonIssues = this.qualityMetrics.commonIssues.slice(0, 10);
  }

  /**
   * Get current quality metrics
   * Requirement 8.4: Data quality monitoring
   */
  getQualityMetrics(): DataQualityMetrics {
    return { ...this.qualityMetrics };
  }

  /**
   * Reset quality metrics (useful for testing)
   */
  resetMetrics(): void {
    this.qualityMetrics = {
      totalDataPoints: 0,
      qualityDistribution: { A: 0, B: 0, C: 0, D: 0 },
      averageScore: 0,
      commonIssues: []
    };
    this.historicalData.clear();
  }

  /**
   * Get quality report for a specific time period
   */
  getQualityReport(startDate: Date, endDate: Date): {
    period: { start: Date; end: Date };
    metrics: DataQualityMetrics;
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    // Analyze quality distribution
    const total = this.qualityMetrics.totalDataPoints;
    if (total > 0) {
      const lowQualityPercentage = (this.qualityMetrics.qualityDistribution.C + this.qualityMetrics.qualityDistribution.D) / total;
      
      if (lowQualityPercentage > 0.2) {
        recommendations.push('High percentage of low-quality data detected. Consider reviewing data sources and validation rules.');
      }

      if (this.qualityMetrics.averageScore < 0.7) {
        recommendations.push('Average data quality score is below acceptable threshold. Implement additional quality controls.');
      }

      // Analyze common issues
      const topIssues = this.qualityMetrics.commonIssues.slice(0, 3);
      for (const issue of topIssues) {
        if (issue.frequency > total * 0.1) {
          recommendations.push(`Address frequent issue: ${issue.issue} (${issue.frequency} occurrences)`);
        }
      }
    }

    return {
      period: { start: startDate, end: endDate },
      metrics: this.getQualityMetrics(),
      recommendations
    };
  }
}