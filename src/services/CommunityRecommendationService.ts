// Community Recommendation Service - Core recommendation engine
// Implements requirements 4.1, 4.2, 4.3, 4.4

import { CommunityRecommendationRepository } from '../models/CommunityRecommendationRepository';
import { EnvironmentalDataRepository } from '../models/EnvironmentalDataRepository';
import { InsightsEngine } from './InsightsEngine';
import { logger } from '../utils/logger';
import {
  CommunityRecommendation,
  CreateCommunityRecommendation,
  RecommendationAnalysisInput,
  Location,
  EnvironmentalDataPoint,
  RecommendationQuery,
  PaginatedResponse
} from '../models/types';

export interface RecommendationEngineConfig {
  max_recommendations_per_location: number;
  recommendation_expiry_days: number;
  min_impact_threshold: number;
  min_feasibility_threshold: number;
}

export class CommunityRecommendationService {
  private recommendationRepo: CommunityRecommendationRepository;
  private environmentalDataRepo: EnvironmentalDataRepository;
  private insightsEngine: InsightsEngine;
  private config: RecommendationEngineConfig;

  // Recommendation templates for different pollution scenarios
  private readonly RECOMMENDATION_TEMPLATES = {
    air_quality: {
      high_pm25: {
        immediate: {
          title: 'Reduce PM2.5 Exposure - Immediate Actions',
          description: 'High PM2.5 levels detected. Take immediate protective measures.',
          steps: [
            'Stay indoors and keep windows closed',
            'Use air purifiers with HEPA filters',
            'Wear N95 masks when going outside',
            'Avoid outdoor exercise and strenuous activities',
            'Check on vulnerable community members (elderly, children, those with respiratory conditions)'
          ],
          category: 'immediate_action' as const,
          estimated_impact: 85,
          base_feasibility: 90,
          time_to_implement: '1-2 hours',
          success_metrics: ['Reduced indoor PM2.5 levels', 'Decreased respiratory symptoms reports']
        },
        long_term: {
          title: 'Community Air Quality Improvement Strategy',
          description: 'Long-term strategies to reduce PM2.5 pollution sources in the community.',
          steps: [
            'Advocate for stricter vehicle emission standards',
            'Promote public transportation and cycling infrastructure',
            'Plant trees and create green spaces to filter air',
            'Support clean energy initiatives',
            'Organize community car-free days',
            'Install community air quality monitoring stations'
          ],
          category: 'long_term_strategy' as const,
          estimated_impact: 70,
          base_feasibility: 45,
          time_to_implement: '6-24 months',
          success_metrics: ['Reduced average PM2.5 levels', 'Increased green space coverage', 'Improved air quality index ratings']
        }
      },
      high_no2: {
        immediate: {
          title: 'Reduce NO2 Exposure from Traffic',
          description: 'High nitrogen dioxide levels detected, likely from vehicle emissions.',
          steps: [
            'Avoid walking or cycling near busy roads during peak hours',
            'Use alternative routes away from major traffic arteries',
            'Keep car windows closed and use recirculated air',
            'Limit outdoor activities during rush hours',
            'Consider working from home if possible'
          ],
          category: 'immediate_action' as const,
          estimated_impact: 75,
          base_feasibility: 85,
          time_to_implement: '1 day',
          success_metrics: ['Reduced personal NO2 exposure', 'Fewer traffic-related health symptoms']
        },
        long_term: {
          title: 'Traffic Emission Reduction Initiative',
          description: 'Community-wide strategies to reduce vehicle emissions and NO2 pollution.',
          steps: [
            'Advocate for electric vehicle charging infrastructure',
            'Support congestion pricing or low-emission zones',
            'Promote carpooling and ride-sharing programs',
            'Push for improved public transportation',
            'Create pedestrian and cycling-friendly infrastructure',
            'Support local businesses to reduce commuting needs'
          ],
          category: 'long_term_strategy' as const,
          estimated_impact: 80,
          base_feasibility: 50,
          time_to_implement: '12-36 months',
          success_metrics: ['Reduced traffic volume', 'Lower NO2 concentrations', 'Increased use of alternative transportation']
        }
      }
    },
    water_quality: {
      high_turbidity: {
        immediate: {
          title: 'Water Safety Measures for High Turbidity',
          description: 'High turbidity detected in local water sources. Take precautions.',
          steps: [
            'Use bottled water for drinking and cooking',
            'Boil tap water for at least 1 minute before use',
            'Install or use water filtration systems',
            'Avoid swimming in affected water bodies',
            'Report water quality issues to local authorities'
          ],
          category: 'immediate_action' as const,
          estimated_impact: 90,
          base_feasibility: 95,
          time_to_implement: '1-2 hours',
          success_metrics: ['Reduced waterborne illness reports', 'Improved drinking water quality']
        },
        long_term: {
          title: 'Watershed Protection and Restoration',
          description: 'Long-term strategies to improve water quality and reduce turbidity.',
          steps: [
            'Organize stream and watershed cleanup events',
            'Plant vegetation along waterways to prevent erosion',
            'Advocate for stricter industrial discharge regulations',
            'Support sustainable agriculture practices in the watershed',
            'Install rain gardens and bioswales to filter runoff',
            'Monitor and report on water quality improvements'
          ],
          category: 'long_term_strategy' as const,
          estimated_impact: 75,
          base_feasibility: 60,
          time_to_implement: '6-18 months',
          success_metrics: ['Reduced turbidity levels', 'Improved aquatic ecosystem health', 'Decreased erosion rates']
        }
      },
      low_dissolved_oxygen: {
        immediate: {
          title: 'Address Low Dissolved Oxygen Emergency',
          description: 'Critically low dissolved oxygen levels detected in water bodies.',
          steps: [
            'Report to environmental authorities immediately',
            'Avoid fishing or swimming in affected areas',
            'Document and photograph any fish kills or distressed aquatic life',
            'Identify and report potential pollution sources',
            'Coordinate with local environmental groups for monitoring'
          ],
          category: 'immediate_action' as const,
          estimated_impact: 85,
          base_feasibility: 80,
          time_to_implement: '1-3 days',
          success_metrics: ['Rapid response to pollution sources', 'Prevention of further ecosystem damage']
        },
        long_term: {
          title: 'Aquatic Ecosystem Restoration Program',
          description: 'Comprehensive approach to restore oxygen levels and aquatic health.',
          steps: [
            'Reduce nutrient pollution from fertilizers and sewage',
            'Install aeration systems in stagnant water bodies',
            'Remove invasive aquatic plants that consume oxygen',
            'Restore riparian vegetation to provide shade and habitat',
            'Advocate for better wastewater treatment',
            'Establish community water quality monitoring program'
          ],
          category: 'long_term_strategy' as const,
          estimated_impact: 80,
          base_feasibility: 55,
          time_to_implement: '12-24 months',
          success_metrics: ['Increased dissolved oxygen levels', 'Recovery of fish populations', 'Reduced algae blooms']
        }
      }
    },
    noise_pollution: {
      high_noise: {
        immediate: {
          title: 'Noise Pollution Mitigation Measures',
          description: 'High noise levels detected. Protect your hearing and well-being.',
          steps: [
            'Use ear protection (earplugs or noise-canceling headphones)',
            'Limit time in noisy areas',
            'Close windows and use sound-dampening materials',
            'Identify and report excessive noise sources',
            'Create quiet zones in your home or workplace'
          ],
          category: 'immediate_action' as const,
          estimated_impact: 70,
          base_feasibility: 90,
          time_to_implement: '1 day',
          success_metrics: ['Reduced noise exposure', 'Improved sleep quality', 'Decreased stress levels']
        },
        long_term: {
          title: 'Community Noise Reduction Initiative',
          description: 'Long-term strategies to reduce community noise pollution.',
          steps: [
            'Advocate for noise ordinances and enforcement',
            'Plant trees and shrubs as natural sound barriers',
            'Support quiet pavement and road surface improvements',
            'Promote noise-reducing building designs and materials',
            'Create designated quiet zones in public spaces',
            'Work with businesses to reduce operational noise'
          ],
          category: 'long_term_strategy' as const,
          estimated_impact: 65,
          base_feasibility: 50,
          time_to_implement: '6-18 months',
          success_metrics: ['Reduced ambient noise levels', 'Improved community satisfaction', 'Better compliance with noise regulations']
        }
      }
    }
  };

  constructor(config?: Partial<RecommendationEngineConfig>) {
    this.recommendationRepo = new CommunityRecommendationRepository();
    this.environmentalDataRepo = new EnvironmentalDataRepository();
    this.insightsEngine = new InsightsEngine();
    
    this.config = {
      max_recommendations_per_location: 10,
      recommendation_expiry_days: 30,
      min_impact_threshold: 50,
      min_feasibility_threshold: 30,
      ...config
    };
  }

  /**
   * Generate recommendations for a specific location based on current environmental conditions
   * Requirement 4.1: Analyze local environmental conditions and recommend actions
   */
  async generateRecommendations(input: RecommendationAnalysisInput): Promise<CommunityRecommendation[]> {
    try {
      logger.info('Generating recommendations for location', { 
        location: input.location, 
        radius: input.radius_km 
      });

      // Check for existing recommendations to avoid duplicates
      const existingRecommendations = await this.recommendationRepo.findByLocationAndPollutants(
        input.location,
        input.radius_km,
        input.current_conditions.map(c => c.pollutant)
      );

      // Analyze current conditions and generate new recommendations
      const newRecommendations: CreateCommunityRecommendation[] = [];

      // Group conditions by pollutant for analysis
      const conditionsByPollutant = this.groupConditionsByPollutant(input.current_conditions);

      for (const [pollutant, conditions] of Object.entries(conditionsByPollutant)) {
        const recommendations = await this.generatePollutantRecommendations(
          pollutant,
          conditions,
          input.location,
          input.radius_km,
          input.community_profile
        );
        
        newRecommendations.push(...recommendations);
      }

      // Filter out recommendations that already exist
      const filteredRecommendations = this.filterDuplicateRecommendations(
        newRecommendations,
        existingRecommendations
      );

      // Prioritize and limit recommendations
      const prioritizedRecommendations = this.prioritizeRecommendations(
        filteredRecommendations,
        input.community_profile
      );

      // Create recommendations in database
      const createdRecommendations: CommunityRecommendation[] = [];
      for (const recommendation of prioritizedRecommendations.slice(0, this.config.max_recommendations_per_location)) {
        try {
          const created = await this.recommendationRepo.create(recommendation);
          createdRecommendations.push(created);
        } catch (error) {
          logger.error('Error creating recommendation:', error);
          // Continue with other recommendations
        }
      }

      logger.info(`Generated ${createdRecommendations.length} new recommendations`);
      return createdRecommendations;
    } catch (error) {
      logger.error('Error generating recommendations:', error);
      throw new Error('Failed to generate community recommendations');
    }
  }

  /**
   * Get recommendations for a location
   * Requirement 4.1: Retrieve location-specific recommendations
   */
  async getRecommendations(query: RecommendationQuery): Promise<PaginatedResponse<CommunityRecommendation>> {
    return this.recommendationRepo.findMany(query);
  }

  /**
   * Get recommendation by ID
   */
  async getRecommendationById(id: string): Promise<CommunityRecommendation | null> {
    return this.recommendationRepo.findById(id);
  }

  /**
   * Update recommendation
   */
  async updateRecommendation(
    id: string, 
    updates: Partial<CreateCommunityRecommendation>
  ): Promise<CommunityRecommendation | null> {
    return this.recommendationRepo.update(id, updates);
  }

  /**
   * Delete recommendation
   */
  async deleteRecommendation(id: string): Promise<boolean> {
    return this.recommendationRepo.delete(id);
  }

  /**
   * Generate recommendations for a specific pollutant
   * Requirement 4.2: Prioritize actions based on impact and feasibility
   */
  private async generatePollutantRecommendations(
    pollutant: string,
    conditions: EnvironmentalDataPoint[],
    location: Location,
    radiusKm: number,
    communityProfile?: RecommendationAnalysisInput['community_profile']
  ): Promise<CreateCommunityRecommendation[]> {
    const recommendations: CreateCommunityRecommendation[] = [];
    
    // Calculate average pollution level
    const avgValue = conditions.reduce((sum, c) => sum + c.value, 0) / conditions.length;
    const latestCondition = conditions[conditions.length - 1];
    
    if (!latestCondition) {
      return recommendations;
    }

    // Determine pollution severity
    const severity = await this.assessPollutionSeverity(pollutant, avgValue);
    
    if (severity === 'low') {
      return recommendations; // No recommendations needed for low pollution
    }

    // Get appropriate recommendation templates
    const templates = this.getRecommendationTemplates(pollutant, severity);
    
    for (const template of templates) {
      // Calculate feasibility based on community profile
      const feasibilityScore = this.calculateFeasibilityScore(
        template.base_feasibility,
        template.category,
        communityProfile
      );

      // Only include recommendations that meet minimum thresholds
      if (template.estimated_impact >= this.config.min_impact_threshold &&
          feasibilityScore >= this.config.min_feasibility_threshold) {
        
        const recommendation: CreateCommunityRecommendation = {
          location: { ...location, radius: radiusKm },
          priority: this.determinePriority(severity, template.category),
          category: template.category,
          title: template.title,
          description: template.description,
          steps: template.steps,
          estimated_impact: template.estimated_impact,
          feasibility_score: feasibilityScore,
          target_pollutants: [pollutant],
          estimated_cost: this.estimateCost(template.category, communityProfile),
          time_to_implement: template.time_to_implement,
          success_metrics: template.success_metrics,
          expires_at: new Date(Date.now() + this.config.recommendation_expiry_days * 24 * 60 * 60 * 1000)
        };

        recommendations.push(recommendation);
      }
    }

    return recommendations;
  }

  /**
   * Group environmental conditions by pollutant
   */
  private groupConditionsByPollutant(conditions: EnvironmentalDataPoint[]): Record<string, EnvironmentalDataPoint[]> {
    return conditions.reduce((groups, condition) => {
      if (!groups[condition.pollutant]) {
        groups[condition.pollutant] = [];
      }
      groups[condition.pollutant]!.push(condition);
      return groups;
    }, {} as Record<string, EnvironmentalDataPoint[]>);
  }

  /**
   * Assess pollution severity level
   */
  private async assessPollutionSeverity(pollutant: string, value: number): Promise<'low' | 'moderate' | 'high' | 'very_high'> {
    try {
      // Use the same health thresholds as InsightsEngine
      const healthImpact = await this.insightsEngine.assessHealthImpact(
        { latitude: 0, longitude: 0 }, // Dummy location for threshold comparison
        1,
        pollutant,
        [{ timestamp: new Date(), value, quality_grade: 'A' }]
      );
      
      return healthImpact.riskLevel;
    } catch (error) {
      logger.warn('Could not assess pollution severity, defaulting to moderate', { pollutant, value });
      return 'moderate';
    }
  }

  /**
   * Get recommendation templates for pollutant and severity
   */
  private getRecommendationTemplates(pollutant: string, severity: string): any[] {
    const templates: any[] = [];
    
    // Map pollutants to template categories
    const pollutantMapping: Record<string, string> = {
      'pm2.5': 'high_pm25',
      'pm10': 'high_pm25', // Use same templates as PM2.5
      'no2': 'high_no2',
      'o3': 'high_no2', // Use similar templates as NO2
      'turbidity': 'high_turbidity',
      'dissolved_oxygen': 'low_dissolved_oxygen',
      'noise': 'high_noise'
    };

    const templateKey = pollutantMapping[pollutant.toLowerCase()];
    if (!templateKey) {
      return templates;
    }

    // Determine which category to use based on pollutant type
    let categoryTemplates;
    if (['pm2.5', 'pm10', 'no2', 'o3', 'co', 'so2'].includes(pollutant.toLowerCase())) {
      categoryTemplates = this.RECOMMENDATION_TEMPLATES.air_quality[templateKey as keyof typeof this.RECOMMENDATION_TEMPLATES.air_quality];
    } else if (['turbidity', 'ph', 'dissolved_oxygen'].includes(pollutant.toLowerCase())) {
      categoryTemplates = this.RECOMMENDATION_TEMPLATES.water_quality[templateKey as keyof typeof this.RECOMMENDATION_TEMPLATES.water_quality];
    } else if (pollutant.toLowerCase() === 'noise') {
      categoryTemplates = this.RECOMMENDATION_TEMPLATES.noise_pollution[templateKey as keyof typeof this.RECOMMENDATION_TEMPLATES.noise_pollution];
    }

    if (categoryTemplates) {
      // For high and very high severity, include both immediate and long-term recommendations
      if (severity === 'high' || severity === 'very_high') {
        if (categoryTemplates.immediate) templates.push(categoryTemplates.immediate);
        if (categoryTemplates.long_term) templates.push(categoryTemplates.long_term);
      } else if (severity === 'moderate') {
        // For moderate severity, focus on long-term strategies
        if (categoryTemplates.long_term) templates.push(categoryTemplates.long_term);
      }
    }

    return templates;
  }

  /**
   * Calculate feasibility score based on community profile
   * Requirement 4.2: Consider feasibility in action prioritization
   */
  private calculateFeasibilityScore(
    baseFeasibility: number,
    category: string,
    communityProfile?: RecommendationAnalysisInput['community_profile']
  ): number {
    let adjustedScore = baseFeasibility;

    if (communityProfile) {
      // Adjust based on economic level
      if (category === 'long_term_strategy') {
        switch (communityProfile.economic_level) {
          case 'high':
            adjustedScore += 15;
            break;
          case 'medium':
            adjustedScore += 5;
            break;
          case 'low':
            adjustedScore -= 10;
            break;
        }
      }

      // Adjust based on infrastructure quality
      switch (communityProfile.infrastructure_quality) {
        case 'excellent':
          adjustedScore += 10;
          break;
        case 'good':
          adjustedScore += 5;
          break;
        case 'fair':
          adjustedScore -= 5;
          break;
        case 'poor':
          adjustedScore -= 15;
          break;
      }

      // Adjust based on environmental awareness
      const awarenessBonus = (communityProfile.environmental_awareness - 50) * 0.2;
      adjustedScore += awarenessBonus;
    }

    return Math.max(0, Math.min(100, Math.round(adjustedScore)));
  }

  /**
   * Determine priority based on severity and category
   */
  private determinePriority(
    severity: string,
    category: string
  ): 'low' | 'medium' | 'high' | 'urgent' {
    if (category === 'immediate_action') {
      switch (severity) {
        case 'very_high':
          return 'urgent';
        case 'high':
          return 'high';
        default:
          return 'medium';
      }
    } else if (category === 'long_term_strategy') {
      switch (severity) {
        case 'very_high':
          return 'high';
        case 'high':
          return 'medium';
        default:
          return 'low';
      }
    } else {
      return 'low';
    }
  }

  /**
   * Estimate cost based on category and community profile
   */
  private estimateCost(
    category: string,
    communityProfile?: RecommendationAnalysisInput['community_profile']
  ): string {
    if (category === 'immediate_action') {
      return 'Low ($0-$100 per household)';
    } else if (category === 'long_term_strategy') {
      if (communityProfile?.economic_level === 'high') {
        return 'High ($10,000-$100,000+ community investment)';
      } else if (communityProfile?.economic_level === 'medium') {
        return 'Medium ($1,000-$10,000 community investment)';
      } else {
        return 'Low-Medium ($100-$1,000 community investment)';
      }
    } else {
      return 'Low ($0-$500 community investment)';
    }
  }

  /**
   * Filter out duplicate recommendations
   */
  private filterDuplicateRecommendations(
    newRecommendations: CreateCommunityRecommendation[],
    existingRecommendations: CommunityRecommendation[]
  ): CreateCommunityRecommendation[] {
    return newRecommendations.filter(newRec => {
      return !existingRecommendations.some(existing => 
        existing.title === newRec.title &&
        existing.category === newRec.category &&
        this.arraysEqual(existing.target_pollutants.sort(), newRec.target_pollutants.sort())
      );
    });
  }

  /**
   * Prioritize recommendations based on impact, feasibility, and urgency
   * Requirement 4.2: Action prioritization algorithm
   */
  private prioritizeRecommendations(
    recommendations: CreateCommunityRecommendation[],
    communityProfile?: RecommendationAnalysisInput['community_profile']
  ): CreateCommunityRecommendation[] {
    return recommendations.sort((a, b) => {
      // Priority weight (urgent = 4, high = 3, medium = 2, low = 1)
      const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
      const priorityScore = (priorityWeight[b.priority] - priorityWeight[a.priority]) * 25;
      
      // Impact and feasibility combined score
      const impactFeasibilityScore = (b.estimated_impact * 0.6 + b.feasibility_score * 0.4) - 
                                   (a.estimated_impact * 0.6 + a.feasibility_score * 0.4);
      
      // Category preference (immediate actions first during high pollution)
      const categoryScore = a.category === 'immediate_action' ? 10 : 
                           b.category === 'immediate_action' ? -10 : 0;
      
      return priorityScore + impactFeasibilityScore + categoryScore;
    });
  }

  /**
   * Utility function to compare arrays
   */
  private arraysEqual(a: any[], b: any[]): boolean {
    return a.length === b.length && a.every((val, index) => val === b[index]);
  }
}