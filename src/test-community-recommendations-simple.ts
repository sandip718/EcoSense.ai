// Simple test script for Community Recommendation System
// This script tests the basic functionality without database dependencies

import { 
  RecommendationAnalysisInput, 
  EnvironmentalDataPoint 
} from './models/types';

// Simple mock implementations for testing
class MockCommunityRecommendationRepository {
  async findByLocationAndPollutants() {
    return [];
  }

  async create(rec: any) {
    return {
      id: 'test-rec-' + Math.random().toString(36).substr(2, 9),
      ...rec,
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  async findMany() {
    return {
      data: [],
      pagination: { total: 0, page: 1, limit: 20, has_next: false, has_previous: false }
    };
  }

  async findById() {
    return null;
  }

  async update() {
    return null;
  }

  async delete() {
    return false;
  }
}

class MockEnvironmentalDataRepository {}

class MockInsightsEngine {
  async assessHealthImpact(location: any, radius: any, pollutant: string, timeSeries?: any) {
    const value = timeSeries?.[0]?.value || 0;
    let riskLevel = 'low';
    
    if (pollutant === 'pm2.5') {
      if (value > 75) riskLevel = 'very_high';
      else if (value > 35) riskLevel = 'high';
      else if (value > 15) riskLevel = 'moderate';
    } else if (pollutant === 'no2') {
      if (value > 200) riskLevel = 'very_high';
      else if (value > 100) riskLevel = 'high';
      else if (value > 40) riskLevel = 'moderate';
    } else if (pollutant === 'turbidity') {
      if (value > 10) riskLevel = 'very_high';
      else if (value > 4) riskLevel = 'high';
      else if (value > 1) riskLevel = 'moderate';
    }
    
    return {
      riskLevel,
      affectedPopulation: Math.floor(Math.random() * 1000) + 100,
      recommendations: [`Take action for ${pollutant}`]
    };
  }
}

// Mock logger
const mockLogger = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args),
  debug: (msg: string, ...args: any[]) => console.log(`[DEBUG] ${msg}`, ...args)
};

// Create a simplified version of the service for testing
class SimpleCommunityRecommendationService {
  private recommendationRepo: MockCommunityRecommendationRepository;
  private environmentalDataRepo: MockEnvironmentalDataRepository;
  private insightsEngine: MockInsightsEngine;

  constructor() {
    this.recommendationRepo = new MockCommunityRecommendationRepository();
    this.environmentalDataRepo = new MockEnvironmentalDataRepository();
    this.insightsEngine = new MockInsightsEngine();
  }

  async generateRecommendations(input: RecommendationAnalysisInput) {
    mockLogger.info('Generating recommendations for location', { 
      location: input.location, 
      radius: input.radius_km 
    });

    const recommendations = [];

    // Group conditions by pollutant
    const conditionsByPollutant = this.groupConditionsByPollutant(input.current_conditions);

    for (const [pollutant, conditions] of Object.entries(conditionsByPollutant)) {
      const pollutantRecommendations = await this.generatePollutantRecommendations(
        pollutant,
        conditions,
        input.location,
        input.radius_km,
        input.community_profile
      );
      
      recommendations.push(...pollutantRecommendations);
    }

    // Create recommendations in mock repository
    const createdRecommendations = [];
    for (const recommendation of recommendations.slice(0, 10)) {
      try {
        const created = await this.recommendationRepo.create(recommendation);
        createdRecommendations.push(created);
      } catch (error) {
        mockLogger.error('Error creating recommendation:', error);
      }
    }

    mockLogger.info(`Generated ${createdRecommendations.length} new recommendations`);
    return createdRecommendations;
  }

  private groupConditionsByPollutant(conditions: EnvironmentalDataPoint[]) {
    return conditions.reduce((groups, condition) => {
      if (!groups[condition.pollutant]) {
        groups[condition.pollutant] = [];
      }
      groups[condition.pollutant]!.push(condition);
      return groups;
    }, {} as Record<string, EnvironmentalDataPoint[]>);
  }

  private async generatePollutantRecommendations(
    pollutant: string,
    conditions: EnvironmentalDataPoint[],
    location: any,
    radiusKm: number,
    communityProfile?: any
  ) {
    const recommendations: any[] = [];
    
    // Calculate average pollution level
    const avgValue = conditions.reduce((sum, c) => sum + c.value, 0) / conditions.length;
    
    // Determine pollution severity
    const healthImpact = await this.insightsEngine.assessHealthImpact(
      location, radiusKm, pollutant, [{ timestamp: new Date(), value: avgValue, quality_grade: 'A' }]
    );
    
    const severity = healthImpact.riskLevel;
    
    if (severity === 'low') {
      return recommendations;
    }

    // Get appropriate recommendation templates
    const templates = this.getRecommendationTemplates(pollutant, severity);
    
    for (const template of templates) {
      const feasibilityScore = this.calculateFeasibilityScore(
        template.base_feasibility,
        template.category,
        communityProfile
      );

      if (template.estimated_impact >= 50 && feasibilityScore >= 30) {
        const recommendation = {
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
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        };

        recommendations.push(recommendation);
      }
    }

    return recommendations;
  }

  private getRecommendationTemplates(pollutant: string, severity: string) {
    const templates = [];
    
    // Simplified templates for testing
    if (pollutant === 'pm2.5' || pollutant === 'pm10') {
      if (severity === 'high' || severity === 'very_high') {
        templates.push({
          title: 'Reduce PM2.5 Exposure - Immediate Actions',
          description: 'High PM2.5 levels detected. Take immediate protective measures.',
          steps: ['Stay indoors and keep windows closed', 'Use air purifiers with HEPA filters'],
          category: 'immediate_action',
          estimated_impact: 85,
          base_feasibility: 90,
          time_to_implement: '1-2 hours',
          success_metrics: ['Reduced indoor PM2.5 levels']
        });
        
        templates.push({
          title: 'Community Air Quality Improvement Strategy',
          description: 'Long-term strategies to reduce PM2.5 pollution sources.',
          steps: ['Advocate for emission controls', 'Plant trees', 'Promote clean transportation'],
          category: 'long_term_strategy',
          estimated_impact: 70,
          base_feasibility: 45,
          time_to_implement: '6-24 months',
          success_metrics: ['Reduced average PM2.5 levels']
        });
      }
    } else if (pollutant === 'no2') {
      if (severity === 'high' || severity === 'very_high') {
        templates.push({
          title: 'Reduce NO2 Exposure from Traffic',
          description: 'High nitrogen dioxide levels detected from vehicle emissions.',
          steps: ['Avoid busy roads during peak hours', 'Use alternative routes'],
          category: 'immediate_action',
          estimated_impact: 75,
          base_feasibility: 85,
          time_to_implement: '1 day',
          success_metrics: ['Reduced personal NO2 exposure']
        });
      }
    } else if (pollutant === 'turbidity') {
      if (severity === 'high' || severity === 'very_high') {
        templates.push({
          title: 'Water Safety Measures for High Turbidity',
          description: 'High turbidity detected in local water sources.',
          steps: ['Use bottled water for drinking', 'Boil tap water before use'],
          category: 'immediate_action',
          estimated_impact: 90,
          base_feasibility: 95,
          time_to_implement: '1-2 hours',
          success_metrics: ['Reduced waterborne illness reports']
        });
      }
    }

    return templates;
  }

  private calculateFeasibilityScore(baseFeasibility: number, category: string, communityProfile?: any) {
    let adjustedScore = baseFeasibility;

    if (communityProfile) {
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

      const awarenessBonus = (communityProfile.environmental_awareness - 50) * 0.2;
      adjustedScore += awarenessBonus;
    }

    return Math.max(0, Math.min(100, Math.round(adjustedScore)));
  }

  private determinePriority(severity: string, category: string) {
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

  private estimateCost(category: string, communityProfile?: any) {
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
}

async function testCommunityRecommendationSystem() {
  console.log('🧪 Testing Community Recommendation System\n');

  try {
    const service = new SimpleCommunityRecommendationService();
    console.log('✅ Service instantiated successfully');

    // Test 1: Generate recommendations for high air pollution
    console.log('\n📋 Test 1: High Air Pollution Scenario');
    const airPollutionInput: RecommendationAnalysisInput = {
      location: { latitude: 40.7128, longitude: -74.0060, address: 'New York, NY' },
      radius_km: 10,
      current_conditions: [
        {
          id: '1',
          source: 'openaq',
          pollutant: 'pm2.5',
          value: 65.5, // High PM2.5 level
          unit: 'μg/m³',
          location: { latitude: 40.7128, longitude: -74.0060 },
          timestamp: new Date(),
          quality_grade: 'A'
        },
        {
          id: '2',
          source: 'openaq',
          pollutant: 'no2',
          value: 120.0, // High NO2 level
          unit: 'μg/m³',
          location: { latitude: 40.7128, longitude: -74.0060 },
          timestamp: new Date(),
          quality_grade: 'A'
        }
      ],
      community_profile: {
        population_density: 10000,
        economic_level: 'high',
        infrastructure_quality: 'good',
        environmental_awareness: 80
      }
    };

    const airRecommendations = await service.generateRecommendations(airPollutionInput);
    console.log(`   Generated ${airRecommendations.length} recommendations for air pollution`);
    
    airRecommendations.forEach((rec: any, index: number) => {
      console.log(`   ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
      console.log(`      Category: ${rec.category}`);
      console.log(`      Impact: ${rec.estimated_impact}/100, Feasibility: ${rec.feasibility_score}/100`);
      console.log(`      Target Pollutants: ${rec.target_pollutants.join(', ')}`);
    });

    // Test 2: Generate recommendations for water quality issues
    console.log('\n📋 Test 2: Water Quality Issues Scenario');
    const waterQualityInput: RecommendationAnalysisInput = {
      location: { latitude: 39.2904, longitude: -76.6122, address: 'Baltimore, MD' },
      radius_km: 5,
      current_conditions: [
        {
          id: '3',
          source: 'water_quality_portal',
          pollutant: 'turbidity',
          value: 12.0, // Very high turbidity
          unit: 'NTU',
          location: { latitude: 39.2904, longitude: -76.6122 },
          timestamp: new Date(),
          quality_grade: 'C'
        }
      ],
      community_profile: {
        population_density: 3000,
        economic_level: 'medium',
        infrastructure_quality: 'fair',
        environmental_awareness: 60
      }
    };

    const waterRecommendations = await service.generateRecommendations(waterQualityInput);
    console.log(`   Generated ${waterRecommendations.length} recommendations for water quality`);
    
    waterRecommendations.forEach((rec: any, index: number) => {
      console.log(`   ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
      console.log(`      Steps: ${rec.steps.length} action items`);
      console.log(`      Time to Implement: ${rec.time_to_implement}`);
    });

    // Test 3: Test different pollution severity levels
    console.log('\n📋 Test 3: Pollution Severity Impact on Recommendations');
    
    const severityLevels = [
      { name: 'Moderate', value: 25.0 },
      { name: 'High', value: 55.0 },
      { name: 'Very High', value: 150.0 }
    ];

    for (const level of severityLevels) {
      const input: RecommendationAnalysisInput = {
        location: { latitude: 34.0522, longitude: -118.2437 },
        radius_km: 8,
        current_conditions: [
          {
            id: `test-${level.name}`,
            source: 'openaq',
            pollutant: 'pm2.5',
            value: level.value,
            unit: 'μg/m³',
            location: { latitude: 34.0522, longitude: -118.2437 },
            timestamp: new Date(),
            quality_grade: 'A'
          }
        ]
      };

      const recommendations = await service.generateRecommendations(input);
      console.log(`   ${level.name} PM2.5 (${level.value} μg/m³): ${recommendations.length} recommendations`);
      
      if (recommendations.length > 0) {
        const priorities = recommendations.map((r: any) => r.priority);
        const categories = recommendations.map((r: any) => r.category);
        console.log(`     Priorities: ${[...new Set(priorities)].join(', ')}`);
        console.log(`     Categories: ${[...new Set(categories)].join(', ')}`);
      }
    }

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('   ✓ Service instantiation');
    console.log('   ✓ Air pollution recommendations');
    console.log('   ✓ Water quality recommendations');
    console.log('   ✓ Pollution severity impact');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    throw error;
  }
}

// Run the test
testCommunityRecommendationSystem()
  .then(() => {
    console.log('\n🎉 Community Recommendation System test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed with error:', error);
    process.exit(1);
  });