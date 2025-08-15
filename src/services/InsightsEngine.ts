// Insights Engine for environmental trend analysis and health impact assessment
// Implements requirements 3.1, 3.2, 3.3, 3.4

import { EnvironmentalDataRepository } from '../models/EnvironmentalDataRepository';
import { EnvironmentalDataPoint, Location } from '../models/types';
import { logger } from '../utils/logger';

export interface TrendAnalysis {
  location: { latitude: number; longitude: number; radius: number };
  timeframe: { start: Date; end: Date };
  pollutantType: string;
  trend: {
    direction: 'improving' | 'worsening' | 'stable';
    magnitude: number;
    confidence: number;
  };
  healthImpact: {
    riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
    affectedPopulation: number;
    recommendations: string[];
  };
}

export interface CorrelationAnalysis {
  location: { latitude: number; longitude: number; radius: number };
  timeframe: { start: Date; end: Date };
  correlations: Array<{
    pollutant1: string;
    pollutant2: string;
    correlation: number;
    significance: number;
    interpretation: string;
  }>;
}

export interface HealthImpactAssessment {
  location: { latitude: number; longitude: number; radius: number };
  pollutant: string;
  currentLevel: number;
  unit: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
  healthEffects: string[];
  recommendations: string[];
  affectedPopulation: number;
  threshold: {
    moderate: number;
    high: number;
    very_high: number;
  };
}

export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  quality_grade: string;
}

export class InsightsEngine {
  private environmentalDataRepo: EnvironmentalDataRepository;

  // WHO Air Quality Guidelines and health thresholds
  private readonly HEALTH_THRESHOLDS = {
    'pm2.5': { moderate: 15, high: 35, very_high: 75, unit: 'μg/m³' },
    'pm10': { moderate: 45, high: 100, very_high: 200, unit: 'μg/m³' },
    'no2': { moderate: 40, high: 100, very_high: 200, unit: 'μg/m³' },
    'o3': { moderate: 100, high: 180, very_high: 240, unit: 'μg/m³' },
    'so2': { moderate: 40, high: 125, very_high: 350, unit: 'μg/m³' },
    'co': { moderate: 10, high: 30, very_high: 60, unit: 'mg/m³' },
    // Water quality parameters (based on WHO guidelines)
    'turbidity': { moderate: 1, high: 4, very_high: 10, unit: 'NTU' },
    'ph': { moderate: 6.5, high: 6.0, very_high: 5.5, unit: 'pH' }, // Lower is worse for pH
    'dissolved_oxygen': { moderate: 6, high: 4, very_high: 2, unit: 'mg/L' }, // Lower is worse
    // Noise levels (WHO guidelines)
    'noise': { moderate: 55, high: 70, very_high: 85, unit: 'dB' }
  };

  constructor() {
    this.environmentalDataRepo = new EnvironmentalDataRepository();
  }

  /**
   * Analyze environmental trends for a specific location and pollutant
   * Requirement 3.1: Identify trends over daily, weekly, and monthly periods
   */
  async analyzeTrend(
    location: Location,
    radiusKm: number,
    pollutant: string,
    timeframe: { start: Date; end: Date }
  ): Promise<TrendAnalysis> {
    try {
      logger.info('Starting trend analysis', { location, pollutant, timeframe });

      // Fetch environmental data for the specified parameters
      const data = await this.environmentalDataRepo.findMany({
        location: { ...location, radius_km: radiusKm },
        pollutant,
        time_range: timeframe,
        limit: 1000 // Get sufficient data for trend analysis
      });

      if (data.data.length < 3) {
        throw new Error('Insufficient data points for trend analysis');
      }

      // Convert to time series format
      const timeSeries = this.convertToTimeSeries(data.data);
      
      // Calculate trend direction and magnitude
      const trendResult = this.calculateTrend(timeSeries);
      
      // Assess health impact
      const healthImpact = await this.assessHealthImpact(location, radiusKm, pollutant, timeSeries);

      return {
        location: { ...location, radius: radiusKm },
        timeframe,
        pollutantType: pollutant,
        trend: trendResult,
        healthImpact
      };
    } catch (error) {
      logger.error('Error analyzing trend:', error);
      throw new Error('Failed to analyze environmental trend');
    }
  }

  /**
   * Analyze correlations between different pollution sources
   * Requirement 3.3: Correlate multiple data sources
   */
  async analyzeCorrelations(
    location: Location,
    radiusKm: number,
    pollutants: string[],
    timeframe: { start: Date; end: Date }
  ): Promise<CorrelationAnalysis> {
    try {
      logger.info('Starting correlation analysis', { location, pollutants, timeframe });

      if (pollutants.length < 2) {
        throw new Error('At least two pollutants required for correlation analysis');
      }

      // Fetch data for all pollutants
      const pollutantData: { [key: string]: TimeSeriesDataPoint[] } = {};
      
      for (const pollutant of pollutants) {
        const data = await this.environmentalDataRepo.findMany({
          location: { ...location, radius_km: radiusKm },
          pollutant,
          time_range: timeframe,
          limit: 1000
        });
        
        pollutantData[pollutant] = this.convertToTimeSeries(data.data);
      }

      // Calculate pairwise correlations
      const correlations = [];
      
      for (let i = 0; i < pollutants.length; i++) {
        for (let j = i + 1; j < pollutants.length; j++) {
          const pollutant1 = pollutants[i];
          const pollutant2 = pollutants[j];
          
          if (!pollutant1 || !pollutant2 || !pollutantData[pollutant1] || !pollutantData[pollutant2]) {
            continue;
          }
          
          const correlation = this.calculateCorrelation(
            pollutantData[pollutant1],
            pollutantData[pollutant2]
          );
          
          correlations.push({
            pollutant1,
            pollutant2,
            correlation: correlation.coefficient,
            significance: correlation.significance,
            interpretation: this.interpretCorrelation(correlation.coefficient)
          });
        }
      }

      return {
        location: { ...location, radius: radiusKm },
        timeframe,
        correlations
      };
    } catch (error) {
      logger.error('Error analyzing correlations:', error);
      throw new Error('Failed to analyze pollution correlations');
    }
  }

  /**
   * Assess health impact based on current pollution levels
   * Requirement 3.4: Provide health impact assessments
   */
  async assessHealthImpact(
    location: Location,
    radiusKm: number,
    pollutant: string,
    timeSeries?: TimeSeriesDataPoint[]
  ): Promise<{
    riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
    affectedPopulation: number;
    recommendations: string[];
  }> {
    try {
      // Get current pollution level
      let currentLevel: number;
      
      if (timeSeries && timeSeries.length > 0) {
        // Use the most recent value from provided time series
        const lastPoint = timeSeries[timeSeries.length - 1];
        if (!lastPoint) {
          throw new Error('Invalid time series data');
        }
        currentLevel = lastPoint.value;
      } else {
        // Fetch latest data point
        const latestData = await this.environmentalDataRepo.findLatestByLocationAndPollutant(
          location,
          radiusKm,
          pollutant
        );
        
        if (!latestData) {
          throw new Error('No current data available for health impact assessment');
        }
        
        currentLevel = latestData.value;
      }

      const pollutantKey = pollutant.toLowerCase() as keyof typeof this.HEALTH_THRESHOLDS;
      const threshold = this.HEALTH_THRESHOLDS[pollutantKey];
      if (!threshold) {
        throw new Error(`No health thresholds defined for pollutant: ${pollutant}`);
      }

      // Determine risk level
      let riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
      
      if (this.isInverseThreshold(pollutant)) {
        // For pollutants where lower values are worse (pH, dissolved oxygen)
        if (currentLevel >= threshold.moderate) riskLevel = 'low';
        else if (currentLevel >= threshold.high) riskLevel = 'moderate';
        else if (currentLevel >= threshold.very_high) riskLevel = 'high';
        else riskLevel = 'very_high';
      } else {
        // For pollutants where higher values are worse
        if (currentLevel <= threshold.moderate) riskLevel = 'low';
        else if (currentLevel <= threshold.high) riskLevel = 'moderate';
        else if (currentLevel <= threshold.very_high) riskLevel = 'high';
        else riskLevel = 'very_high';
      }

      // Generate health effects and recommendations
      const healthEffects = this.getHealthEffects(pollutant, riskLevel);
      const recommendations = this.getHealthRecommendations(pollutant, riskLevel);
      
      // Estimate affected population (simplified calculation)
      const affectedPopulation = this.estimateAffectedPopulation(radiusKm, riskLevel);

      return {
        riskLevel,
        affectedPopulation,
        recommendations
      };
    } catch (error) {
      logger.error('Error assessing health impact:', error);
      throw new Error('Failed to assess health impact');
    }
  }

  /**
   * Convert environmental data points to time series format
   */
  private convertToTimeSeries(data: EnvironmentalDataPoint[]): TimeSeriesDataPoint[] {
    return data
      .map(point => ({
        timestamp: point.timestamp,
        value: point.value,
        quality_grade: point.quality_grade
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Calculate trend direction and magnitude using linear regression
   * Requirement 3.1: Identify trends (improving/worsening/stable)
   */
  private calculateTrend(timeSeries: TimeSeriesDataPoint[]): {
    direction: 'improving' | 'worsening' | 'stable';
    magnitude: number;
    confidence: number;
  } {
    if (timeSeries.length < 3) {
      throw new Error('Insufficient data points for trend calculation');
    }

    // Convert timestamps to numeric values (days since first measurement)
    const firstPoint = timeSeries[0];
    if (!firstPoint) {
      throw new Error('Invalid time series data');
    }
    const startTime = firstPoint.timestamp.getTime();
    const dataPoints = timeSeries.map(point => ({
      x: (point.timestamp.getTime() - startTime) / (1000 * 60 * 60 * 24), // Days
      y: point.value
    }));

    // Calculate linear regression
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, point) => sum + point.x, 0);
    const sumY = dataPoints.reduce((sum, point) => sum + point.y, 0);
    const sumXY = dataPoints.reduce((sum, point) => sum + point.x * point.y, 0);
    const sumXX = dataPoints.reduce((sum, point) => sum + point.x * point.x, 0);
    const sumYY = dataPoints.reduce((sum, point) => sum + point.y * point.y, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate correlation coefficient (R)
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    const correlation = denominator === 0 ? 0 : numerator / denominator;
    const confidence = Math.abs(correlation);

    // Determine trend direction based on slope
    const magnitude = Math.abs(slope);
    let direction: 'improving' | 'worsening' | 'stable';

    if (Math.abs(slope) < 0.1 || confidence < 0.3) {
      direction = 'stable';
    } else if (slope > 0) {
      direction = 'worsening'; // Increasing pollution is worsening
    } else {
      direction = 'improving'; // Decreasing pollution is improving
    }

    return {
      direction,
      magnitude,
      confidence
    };
  }

  /**
   * Calculate Pearson correlation coefficient between two time series
   */
  private calculateCorrelation(
    series1: TimeSeriesDataPoint[],
    series2: TimeSeriesDataPoint[]
  ): { coefficient: number; significance: number } {
    // Align time series by timestamp (simplified - assumes same timestamps)
    const alignedData = this.alignTimeSeries(series1, series2);
    
    if (alignedData.length < 3) {
      return { coefficient: 0, significance: 0 };
    }

    const n = alignedData.length;
    const sumX = alignedData.reduce((sum, point) => sum + point.x, 0);
    const sumY = alignedData.reduce((sum, point) => sum + point.y, 0);
    const sumXY = alignedData.reduce((sum, point) => sum + point.x * point.y, 0);
    const sumXX = alignedData.reduce((sum, point) => sum + point.x * point.x, 0);
    const sumYY = alignedData.reduce((sum, point) => sum + point.y * point.y, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    const coefficient = denominator === 0 ? 0 : numerator / denominator;
    
    // Calculate significance (simplified t-test)
    const tStat = Math.abs(coefficient) * Math.sqrt((n - 2) / (1 - coefficient * coefficient));
    const significance = Math.min(1, 2 * (1 - this.tDistribution(tStat, n - 2)));

    return { coefficient, significance };
  }

  /**
   * Align two time series by finding matching timestamps
   */
  private alignTimeSeries(
    series1: TimeSeriesDataPoint[],
    series2: TimeSeriesDataPoint[]
  ): Array<{ x: number; y: number; timestamp: Date }> {
    const aligned = [];
    const tolerance = 60 * 60 * 1000; // 1 hour tolerance

    for (const point1 of series1) {
      const matchingPoint = series2.find(point2 => 
        Math.abs(point1.timestamp.getTime() - point2.timestamp.getTime()) <= tolerance
      );
      
      if (matchingPoint) {
        aligned.push({
          x: point1.value,
          y: matchingPoint.value,
          timestamp: point1.timestamp
        });
      }
    }

    return aligned;
  }

  /**
   * Interpret correlation coefficient
   */
  private interpretCorrelation(coefficient: number): string {
    const abs = Math.abs(coefficient);
    
    if (abs < 0.1) return 'No correlation';
    if (abs < 0.3) return 'Weak correlation';
    if (abs < 0.5) return 'Moderate correlation';
    if (abs < 0.7) return 'Strong correlation';
    return 'Very strong correlation';
  }

  /**
   * Check if pollutant uses inverse thresholds (lower is worse)
   */
  private isInverseThreshold(pollutant: string): boolean {
    const inverseThresholds = ['ph', 'dissolved_oxygen'];
    return inverseThresholds.includes(pollutant.toLowerCase());
  }

  /**
   * Get health effects for specific pollutant and risk level
   */
  private getHealthEffects(pollutant: string, riskLevel: string): string[] {
    const effects: { [key: string]: { [level: string]: string[] } } = {
      'pm2.5': {
        moderate: ['Mild respiratory irritation in sensitive individuals'],
        high: ['Respiratory symptoms', 'Reduced lung function', 'Aggravated asthma'],
        very_high: ['Serious respiratory effects', 'Cardiovascular effects', 'Premature mortality risk']
      },
      'pm10': {
        moderate: ['Eye and throat irritation'],
        high: ['Respiratory symptoms', 'Reduced lung function'],
        very_high: ['Serious respiratory effects', 'Cardiovascular strain']
      },
      'no2': {
        moderate: ['Mild respiratory irritation'],
        high: ['Increased respiratory infections', 'Reduced lung function'],
        very_high: ['Severe respiratory effects', 'Increased hospital admissions']
      },
      'o3': {
        moderate: ['Throat irritation', 'Coughing'],
        high: ['Chest pain', 'Shortness of breath', 'Reduced lung function'],
        very_high: ['Severe respiratory distress', 'Lung inflammation']
      },
      'turbidity': {
        moderate: ['Potential gastrointestinal issues'],
        high: ['Increased risk of waterborne diseases'],
        very_high: ['High risk of serious waterborne illnesses']
      },
      'noise': {
        moderate: ['Sleep disturbance', 'Mild stress'],
        high: ['Hearing damage risk', 'Cardiovascular stress'],
        very_high: ['Permanent hearing loss risk', 'Severe health impacts']
      }
    };

    return effects[pollutant.toLowerCase()]?.[riskLevel] || ['Health effects unknown for this pollutant'];
  }

  /**
   * Get health recommendations for specific pollutant and risk level
   */
  private getHealthRecommendations(pollutant: string, riskLevel: string): string[] {
    const recommendations: { [key: string]: { [level: string]: string[] } } = {
      'pm2.5': {
        moderate: ['Limit outdoor activities if sensitive', 'Consider air purifiers indoors'],
        high: ['Avoid outdoor exercise', 'Use N95 masks outdoors', 'Keep windows closed'],
        very_high: ['Stay indoors', 'Use air purifiers', 'Seek medical attention if symptoms occur']
      },
      'pm10': {
        moderate: ['Limit strenuous outdoor activities'],
        high: ['Avoid outdoor exercise', 'Use protective masks'],
        very_high: ['Stay indoors', 'Seek medical attention for respiratory symptoms']
      },
      'no2': {
        moderate: ['Limit time near busy roads'],
        high: ['Avoid outdoor exercise near traffic', 'Use air purifiers'],
        very_high: ['Stay indoors', 'Seek medical attention for breathing difficulties']
      },
      'o3': {
        moderate: ['Limit outdoor activities during peak hours'],
        high: ['Avoid outdoor exercise', 'Stay indoors during afternoon'],
        very_high: ['Stay indoors', 'Seek immediate medical attention for breathing problems']
      },
      'turbidity': {
        moderate: ['Boil water before drinking', 'Use water filters'],
        high: ['Use bottled water', 'Avoid swimming in affected water'],
        very_high: ['Use only bottled water', 'Seek medical attention for gastrointestinal symptoms']
      },
      'noise': {
        moderate: ['Use ear protection in noisy areas', 'Limit exposure time'],
        high: ['Use noise-canceling headphones', 'Avoid prolonged exposure'],
        very_high: ['Evacuate noisy areas', 'Seek medical attention for hearing issues']
      }
    };

    return recommendations[pollutant.toLowerCase()]?.[riskLevel] || ['Consult health authorities for guidance'];
  }

  /**
   * Estimate affected population based on radius and risk level
   */
  private estimateAffectedPopulation(radiusKm: number, riskLevel: string): number {
    // Simplified population density estimation (people per km²)
    const populationDensity = 1000; // Assume 1000 people per km² (adjustable)
    const area = Math.PI * radiusKm * radiusKm;
    const totalPopulation = area * populationDensity;

    // Risk level multipliers for affected population
    const riskMultipliers = {
      low: 0.1,
      moderate: 0.3,
      high: 0.6,
      very_high: 0.9
    };

    const multiplier = riskMultipliers[riskLevel as keyof typeof riskMultipliers];
    return Math.round(totalPopulation * multiplier);
  }

  /**
   * Simplified t-distribution CDF approximation
   */
  private tDistribution(t: number, df: number): number {
    // Simplified approximation for t-distribution CDF
    // For production use, consider using a proper statistical library
    if (df > 30) {
      // Approximate with normal distribution for large df
      return 0.5 * (1 + this.erf(t / Math.sqrt(2)));
    }
    
    // Very simplified approximation for small df
    const x = t / Math.sqrt(df);
    return 0.5 + 0.5 * this.erf(x / Math.sqrt(2));
  }

  /**
   * Error function approximation
   */
  private erf(x: number): number {
    // Abramowitz and Stegun approximation
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }
}