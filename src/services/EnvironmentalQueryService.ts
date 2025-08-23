// Environmental Query Service for Location-aware Response Generation
// Implements requirement 6.2: Implement location-aware response generation using current environmental data

import { logger } from '../utils/logger';
import { EnvironmentalDataRepository } from '../models/EnvironmentalDataRepository';
import { CommunityRecommendationService } from './CommunityRecommendationService';
import { InsightsEngine } from './InsightsEngine';
import { environmentalDataCache } from './EnvironmentalDataCache';
import { 
  EnvironmentalQuery, 
  QueryResponse, 
  Location 
} from '../models/ChatbotTypes';
import { 
  EnvironmentalDataPoint, 
  EnvironmentalDataQuery,
  CommunityRecommendation 
} from '../models/types';

export class EnvironmentalQueryService {
  private environmentalDataRepository = new EnvironmentalDataRepository();
  private communityRecommendationService = new CommunityRecommendationService();
  private insightsEngine = new InsightsEngine();

  // Health thresholds for different pollutants (simplified)
  private readonly HEALTH_THRESHOLDS = {
    'pm2.5': { good: 12, moderate: 35, unhealthy: 55, very_unhealthy: 150 },
    'pm10': { good: 54, moderate: 154, unhealthy: 254, very_unhealthy: 354 },
    'ozone': { good: 54, moderate: 70, unhealthy: 85, very_unhealthy: 105 },
    'no2': { good: 53, moderate: 100, unhealthy: 360, very_unhealthy: 649 },
    'so2': { good: 35, moderate: 75, unhealthy: 185, very_unhealthy: 304 },
    'co': { good: 4.4, moderate: 9.4, unhealthy: 12.4, very_unhealthy: 15.4 }
  };

  private readonly ACTIVITY_RISK_FACTORS = {
    'running': 2.0,
    'jogging': 2.0,
    'cycling': 1.8,
    'walking': 1.2,
    'hiking': 1.5,
    'exercise': 1.8,
    'outdoor': 1.0,
    'children': 1.5,
    'elderly': 1.3,
    'asthma': 2.5
  };

  /**
   * Process environmental query and generate response
   */
  async processQuery(query: EnvironmentalQuery): Promise<QueryResponse> {
    try {
      const startTime = Date.now();
      
      logger.info('Processing environmental query', {
        location: query.location,
        queryType: query.query_type,
        pollutants: query.pollutants,
        activityContext: query.activity_context
      });

      let response: QueryResponse;

      switch (query.query_type) {
        case 'current_conditions':
          response = await this.getCurrentConditions(query);
          break;
        
        case 'safety':
          response = await this.getSafetyAssessment(query);
          break;
        
        case 'trends':
          response = await this.getTrendAnalysis(query);
          break;
        
        case 'recommendations':
          response = await this.getRecommendations(query);
          break;
        
        default:
          response = await this.getCurrentConditions(query);
      }

      const processingTime = Date.now() - startTime;
      logger.debug('Query processed', { 
        queryType: query.query_type, 
        processingTime,
        dataSources: response.data_sources.length
      });

      return response;

    } catch (error) {
      logger.error('Error processing environmental query:', error);
      
      return {
        data: null,
        summary: "I'm sorry, I couldn't retrieve environmental data at the moment. Please try again later.",
        data_sources: [],
        last_updated: new Date()
      };
    }
  }

  /**
   * Get current environmental conditions
   */
  private async getCurrentConditions(query: EnvironmentalQuery): Promise<QueryResponse> {
    const radius = 10; // Default 10km radius
    
    // Try to get cached data first
    const cacheKey = {
      latitude: query.location.latitude,
      longitude: query.location.longitude,
      radius
    };
    
    let cachedData = await environmentalDataCache.getCurrentConditions(cacheKey);
    let data: EnvironmentalDataPoint[] = [];
    
    if (cachedData) {
      data = cachedData.data;
      logger.debug('Using cached environmental data');
    } else {
      // Fetch fresh data
      const dataQuery: EnvironmentalDataQuery = {
        location: {
          latitude: query.location.latitude,
          longitude: query.location.longitude,
          radius_km: radius
        },
        time_range: {
          start: new Date(Date.now() - 2 * 60 * 60 * 1000), // Last 2 hours
          end: new Date()
        },
        limit: 100
      };

      if (query.pollutants && query.pollutants.length > 0) {
        // Use the first pollutant for specific queries
        dataQuery.pollutant = query.pollutants[0];
      }

      const result = await this.environmentalDataRepository.findMany(dataQuery);
      data = result.data;
      
      // Cache the results
      await environmentalDataCache.cacheCurrentConditions(cacheKey, data);
    }

    // Process and summarize the data
    const summary = this.generateCurrentConditionsSummary(data, query);
    const healthImpact = this.assessHealthImpact(data, query.activity_context);
    
    return {
      data: this.formatEnvironmentalData(data),
      summary,
      health_impact: healthImpact,
      data_sources: this.extractDataSources(data),
      last_updated: this.getLatestTimestamp(data)
    };
  }

  /**
   * Get safety assessment for activities
   */
  private async getSafetyAssessment(query: EnvironmentalQuery): Promise<QueryResponse> {
    const currentConditions = await this.getCurrentConditions(query);
    
    if (!currentConditions.data || (Array.isArray(currentConditions.data) && currentConditions.data.length === 0)) {
      return {
        data: null,
        summary: "I don't have enough environmental data to assess safety for your location. Please try a different location or check back later.",
        data_sources: [],
        last_updated: new Date()
      };
    }

    const data = Array.isArray(currentConditions.data) ? currentConditions.data : [currentConditions.data];
    const activity = query.activity_context || 'outdoor activities';
    
    const safetyAssessment = this.assessActivitySafety(data, activity);
    const recommendations = this.generateSafetyRecommendations(safetyAssessment, activity);
    
    const summary = this.generateSafetySummary(safetyAssessment, activity, data);
    
    return {
      data: safetyAssessment,
      summary,
      recommendations,
      health_impact: currentConditions.health_impact,
      data_sources: currentConditions.data_sources,
      last_updated: currentConditions.last_updated
    };
  }

  /**
   * Get trend analysis
   */
  private async getTrendAnalysis(query: EnvironmentalQuery): Promise<QueryResponse> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
    
    const timeframe = { start: startTime, end: endTime };
    const pollutant = query.pollutants?.[0] || 'pm2.5';
    
    try {
      const trendAnalysis = await this.insightsEngine.analyzeTrends(
        query.location,
        10, // 10km radius
        timeframe,
        pollutant
      );

      const summary = this.generateTrendSummary(trendAnalysis, pollutant);
      
      return {
        data: trendAnalysis,
        summary,
        recommendations: this.generateTrendRecommendations(trendAnalysis),
        data_sources: ['historical_data', 'trend_analysis'],
        last_updated: new Date()
      };

    } catch (error) {
      logger.error('Error getting trend analysis:', error);
      
      return {
        data: null,
        summary: "I couldn't analyze environmental trends for your location at the moment. This might be due to insufficient historical data.",
        data_sources: [],
        last_updated: new Date()
      };
    }
  }

  /**
   * Get community recommendations
   */
  private async getRecommendations(query: EnvironmentalQuery): Promise<QueryResponse> {
    try {
      const recommendations = await this.communityRecommendationService.getRecommendationsForLocation(
        query.location,
        10 // 10km radius
      );

      const summary = this.generateRecommendationsSummary(recommendations);
      
      return {
        data: recommendations,
        summary,
        recommendations: recommendations.map(r => r.title),
        data_sources: ['community_recommendations', 'environmental_analysis'],
        last_updated: new Date()
      };

    } catch (error) {
      logger.error('Error getting recommendations:', error);
      
      return {
        data: [],
        summary: "I couldn't retrieve specific recommendations for your location, but I suggest monitoring air quality regularly and reducing outdoor activities during high pollution periods.",
        recommendations: [
          "Monitor air quality regularly",
          "Reduce outdoor activities during high pollution",
          "Use air purifiers indoors",
          "Support local environmental initiatives"
        ],
        data_sources: ['general_recommendations'],
        last_updated: new Date()
      };
    }
  }

  /**
   * Generate summary for current conditions
   */
  private generateCurrentConditionsSummary(data: EnvironmentalDataPoint[], query: EnvironmentalQuery): string {
    if (!data || data.length === 0) {
      return "I don't have current environmental data for your location. Please try a different location or check back later.";
    }

    const pollutantSummaries: string[] = [];
    const pollutantGroups = this.groupByPollutant(data);
    
    for (const [pollutant, points] of Object.entries(pollutantGroups)) {
      const latestPoint = points.reduce((latest, current) => 
        current.timestamp > latest.timestamp ? current : latest
      );
      
      const level = this.getPollutionLevel(pollutant, latestPoint.value);
      const timeAgo = this.getTimeAgo(latestPoint.timestamp);
      
      pollutantSummaries.push(
        `${pollutant.toUpperCase()}: ${latestPoint.value} ${latestPoint.unit} (${level}) - ${timeAgo}`
      );
    }

    const overallLevel = this.getOverallPollutionLevel(data);
    
    return `Current environmental conditions in your area are ${overallLevel}. ${pollutantSummaries.join('. ')}.`;
  }

  /**
   * Generate safety summary
   */
  private generateSafetySummary(
    safetyAssessment: any, 
    activity: string, 
    data: EnvironmentalDataPoint[]
  ): string {
    const riskLevel = safetyAssessment.risk_level;
    const mainConcerns = safetyAssessment.main_concerns || [];
    
    let summary = `For ${activity}, conditions are currently ${riskLevel} risk.`;
    
    if (mainConcerns.length > 0) {
      summary += ` Main concerns: ${mainConcerns.join(', ')}.`;
    }
    
    if (riskLevel === 'high' || riskLevel === 'very_high') {
      summary += " Consider postponing outdoor activities or taking extra precautions.";
    } else if (riskLevel === 'moderate') {
      summary += " Sensitive individuals should consider limiting prolonged outdoor activities.";
    } else {
      summary += " Conditions are generally suitable for outdoor activities.";
    }
    
    return summary;
  }

  /**
   * Generate trend summary
   */
  private generateTrendSummary(trendAnalysis: any, pollutant: string): string {
    if (!trendAnalysis) {
      return `I couldn't analyze trends for ${pollutant} in your area due to insufficient data.`;
    }

    const direction = trendAnalysis.trend?.direction || 'stable';
    const magnitude = trendAnalysis.trend?.magnitude || 0;
    
    let summary = `${pollutant.toUpperCase()} levels are ${direction}`;
    
    if (magnitude > 0) {
      summary += ` by ${Math.round(magnitude)}%`;
    }
    
    summary += " over the past week.";
    
    if (direction === 'improving') {
      summary += " This is good news for air quality in your area.";
    } else if (direction === 'worsening') {
      summary += " You may want to limit outdoor activities and monitor conditions closely.";
    }
    
    return summary;
  }

  /**
   * Generate recommendations summary
   */
  private generateRecommendationsSummary(recommendations: CommunityRecommendation[]): string {
    if (!recommendations || recommendations.length === 0) {
      return "I don't have specific recommendations for your area, but general environmental protection practices are always beneficial.";
    }

    const highPriority = recommendations.filter(r => r.priority === 'high' || r.priority === 'urgent');
    const actionable = recommendations.filter(r => r.category === 'immediate_action');
    
    let summary = `I found ${recommendations.length} recommendations for your area.`;
    
    if (highPriority.length > 0) {
      summary += ` ${highPriority.length} are high priority.`;
    }
    
    if (actionable.length > 0) {
      summary += ` ${actionable.length} can be implemented immediately.`;
    }
    
    return summary;
  }

  /**
   * Helper methods
   */

  private groupByPollutant(data: EnvironmentalDataPoint[]): Record<string, EnvironmentalDataPoint[]> {
    return data.reduce((groups, point) => {
      if (!groups[point.pollutant]) {
        groups[point.pollutant] = [];
      }
      groups[point.pollutant].push(point);
      return groups;
    }, {} as Record<string, EnvironmentalDataPoint[]>);
  }

  private getPollutionLevel(pollutant: string, value: number): string {
    const thresholds = this.HEALTH_THRESHOLDS[pollutant.toLowerCase()];
    
    if (!thresholds) {
      return 'unknown';
    }
    
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.moderate) return 'moderate';
    if (value <= thresholds.unhealthy) return 'unhealthy';
    return 'very unhealthy';
  }

  private getOverallPollutionLevel(data: EnvironmentalDataPoint[]): string {
    const levels = data.map(point => this.getPollutionLevel(point.pollutant, point.value));
    
    if (levels.includes('very unhealthy')) return 'very unhealthy';
    if (levels.includes('unhealthy')) return 'unhealthy';
    if (levels.includes('moderate')) return 'moderate';
    return 'good';
  }

  private assessHealthImpact(data: EnvironmentalDataPoint[], activityContext?: string): {
    risk_level: 'low' | 'moderate' | 'high' | 'very_high';
    description: string;
    precautions?: string[];
  } {
    const overallLevel = this.getOverallPollutionLevel(data);
    let riskMultiplier = 1.0;
    
    // Adjust risk based on activity
    if (activityContext) {
      const activityRisk = this.ACTIVITY_RISK_FACTORS[activityContext.toLowerCase()];
      if (activityRisk) {
        riskMultiplier = activityRisk;
      }
    }
    
    let baseRisk: 'low' | 'moderate' | 'high' | 'very_high';
    
    switch (overallLevel) {
      case 'good':
        baseRisk = 'low';
        break;
      case 'moderate':
        baseRisk = 'moderate';
        break;
      case 'unhealthy':
        baseRisk = 'high';
        break;
      default:
        baseRisk = 'very_high';
    }
    
    // Adjust risk level based on activity
    if (riskMultiplier > 1.5 && baseRisk === 'moderate') {
      baseRisk = 'high';
    } else if (riskMultiplier > 2.0 && baseRisk === 'low') {
      baseRisk = 'moderate';
    }
    
    const descriptions = {
      low: 'Air quality is satisfactory for most people and activities.',
      moderate: 'Air quality is acceptable, but sensitive individuals may experience minor issues.',
      high: 'Air quality may cause health concerns for sensitive groups and during prolonged exposure.',
      very_high: 'Air quality is unhealthy for everyone. Limit outdoor activities.'
    };
    
    const precautions = this.generateHealthPrecautions(baseRisk, activityContext);
    
    return {
      risk_level: baseRisk,
      description: descriptions[baseRisk],
      precautions
    };
  }

  private assessActivitySafety(data: EnvironmentalDataPoint[], activity: string): any {
    const healthImpact = this.assessHealthImpact(data, activity);
    const mainConcerns: string[] = [];
    
    // Identify main pollution concerns
    data.forEach(point => {
      const level = this.getPollutionLevel(point.pollutant, point.value);
      if (level === 'unhealthy' || level === 'very unhealthy') {
        mainConcerns.push(point.pollutant);
      }
    });
    
    return {
      risk_level: healthImpact.risk_level,
      main_concerns: [...new Set(mainConcerns)],
      activity,
      recommendations: healthImpact.precautions
    };
  }

  private generateSafetyRecommendations(safetyAssessment: any, activity: string): string[] {
    const recommendations: string[] = [];
    const riskLevel = safetyAssessment.risk_level;
    
    switch (riskLevel) {
      case 'very_high':
        recommendations.push(`Avoid ${activity} outdoors`);
        recommendations.push('Stay indoors with windows closed');
        recommendations.push('Use air purifiers if available');
        break;
      
      case 'high':
        recommendations.push(`Limit ${activity} duration and intensity`);
        recommendations.push('Consider indoor alternatives');
        recommendations.push('Wear a mask if you must go outside');
        break;
      
      case 'moderate':
        recommendations.push(`Reduce ${activity} intensity`);
        recommendations.push('Take frequent breaks');
        recommendations.push('Monitor how you feel');
        break;
      
      default:
        recommendations.push(`${activity} is generally safe`);
        recommendations.push('Stay hydrated');
        recommendations.push('Monitor air quality regularly');
    }
    
    return recommendations;
  }

  private generateTrendRecommendations(trendAnalysis: any): string[] {
    const recommendations: string[] = [];
    
    if (!trendAnalysis?.trend) {
      return ['Monitor environmental conditions regularly'];
    }
    
    const direction = trendAnalysis.trend.direction;
    
    switch (direction) {
      case 'worsening':
        recommendations.push('Limit outdoor activities during peak hours');
        recommendations.push('Consider using air purifiers indoors');
        recommendations.push('Monitor conditions more frequently');
        break;
      
      case 'improving':
        recommendations.push('Good time for outdoor activities');
        recommendations.push('Continue monitoring to maintain awareness');
        break;
      
      default:
        recommendations.push('Maintain current precautions');
        recommendations.push('Continue regular monitoring');
    }
    
    return recommendations;
  }

  private generateHealthPrecautions(riskLevel: string, activityContext?: string): string[] {
    const precautions: string[] = [];
    
    switch (riskLevel) {
      case 'very_high':
        precautions.push('Avoid all outdoor activities');
        precautions.push('Keep windows closed');
        precautions.push('Use air purifiers');
        break;
      
      case 'high':
        precautions.push('Limit outdoor exposure');
        precautions.push('Wear protective masks');
        precautions.push('Avoid strenuous activities');
        break;
      
      case 'moderate':
        precautions.push('Sensitive individuals should limit prolonged outdoor activities');
        precautions.push('Monitor symptoms');
        break;
      
      default:
        precautions.push('No special precautions needed');
    }
    
    return precautions;
  }

  private formatEnvironmentalData(data: EnvironmentalDataPoint[]): any {
    return data.map(point => ({
      pollutant: point.pollutant,
      value: point.value,
      unit: point.unit,
      level: this.getPollutionLevel(point.pollutant, point.value),
      timestamp: point.timestamp,
      source: point.source
    }));
  }

  private extractDataSources(data: EnvironmentalDataPoint[]): string[] {
    const sources = new Set(data.map(point => point.source));
    return Array.from(sources);
  }

  private getLatestTimestamp(data: EnvironmentalDataPoint[]): Date {
    if (!data || data.length === 0) {
      return new Date();
    }
    
    return data.reduce((latest, current) => 
      current.timestamp > latest ? current.timestamp : latest, 
      data[0].timestamp
    );
  }

  private getTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  }
}

export const environmentalQueryService = new EnvironmentalQueryService();