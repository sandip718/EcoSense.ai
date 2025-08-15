// Community Recommendation System Usage Examples
// Demonstrates requirements 4.1, 4.2, 4.3, 4.4

import { CommunityRecommendationService } from '../CommunityRecommendationService';
import { 
  RecommendationAnalysisInput, 
  EnvironmentalDataPoint,
  RecommendationQuery 
} from '../../models/types';

/**
 * Example: Generate recommendations for high air pollution scenario
 */
async function generateAirPollutionRecommendations() {
  console.log('=== Air Pollution Recommendation Example ===');
  
  const service = new CommunityRecommendationService();
  
  // Simulate high PM2.5 and NO2 levels in New York City
  const currentConditions: EnvironmentalDataPoint[] = [
    {
      id: '1',
      source: 'openaq',
      pollutant: 'pm2.5',
      value: 55.8, // High PM2.5 level (WHO guideline: 15 μg/m³)
      unit: 'μg/m³',
      location: { latitude: 40.7128, longitude: -74.0060, address: 'New York, NY' },
      timestamp: new Date(),
      quality_grade: 'A'
    },
    {
      id: '2',
      source: 'openaq',
      pollutant: 'no2',
      value: 95.2, // High NO2 level (WHO guideline: 40 μg/m³)
      unit: 'μg/m³',
      location: { latitude: 40.7128, longitude: -74.0060, address: 'New York, NY' },
      timestamp: new Date(),
      quality_grade: 'A'
    }
  ];

  const input: RecommendationAnalysisInput = {
    location: { latitude: 40.7128, longitude: -74.0060, address: 'New York, NY' },
    radius_km: 10,
    current_conditions: currentConditions,
    community_profile: {
      population_density: 10000, // High density urban area
      economic_level: 'high',
      infrastructure_quality: 'good',
      environmental_awareness: 75
    }
  };

  try {
    const recommendations = await service.generateRecommendations(input);
    
    console.log(`Generated ${recommendations.length} recommendations:`);
    recommendations.forEach((rec, index) => {
      console.log(`\n${index + 1}. ${rec.title}`);
      console.log(`   Priority: ${rec.priority}`);
      console.log(`   Category: ${rec.category}`);
      console.log(`   Impact Score: ${rec.estimated_impact}/100`);
      console.log(`   Feasibility Score: ${rec.feasibility_score}/100`);
      console.log(`   Target Pollutants: ${rec.target_pollutants.join(', ')}`);
      console.log(`   Time to Implement: ${rec.time_to_implement}`);
      console.log(`   Estimated Cost: ${rec.estimated_cost}`);
      console.log(`   Steps:`);
      rec.steps.forEach((step, stepIndex) => {
        console.log(`     ${stepIndex + 1}. ${step}`);
      });
    });
    
    return recommendations;
  } catch (error) {
    console.error('Error generating recommendations:', error);
    throw error;
  }
}

/**
 * Example: Generate recommendations for water quality issues
 */
async function generateWaterQualityRecommendations() {
  console.log('\n=== Water Quality Recommendation Example ===');
  
  const service = new CommunityRecommendationService();
  
  // Simulate high turbidity and low dissolved oxygen in a water body
  const currentConditions: EnvironmentalDataPoint[] = [
    {
      id: '3',
      source: 'water_quality_portal',
      pollutant: 'turbidity',
      value: 8.5, // High turbidity (WHO guideline: <1 NTU for drinking water)
      unit: 'NTU',
      location: { latitude: 39.2904, longitude: -76.6122, address: 'Baltimore, MD' },
      timestamp: new Date(),
      quality_grade: 'B'
    },
    {
      id: '4',
      source: 'water_quality_portal',
      pollutant: 'dissolved_oxygen',
      value: 3.2, // Low dissolved oxygen (healthy levels: >6 mg/L)
      unit: 'mg/L',
      location: { latitude: 39.2904, longitude: -76.6122, address: 'Baltimore, MD' },
      timestamp: new Date(),
      quality_grade: 'C'
    }
  ];

  const input: RecommendationAnalysisInput = {
    location: { latitude: 39.2904, longitude: -76.6122, address: 'Baltimore, MD' },
    radius_km: 5,
    current_conditions: currentConditions,
    community_profile: {
      population_density: 3000,
      economic_level: 'medium',
      infrastructure_quality: 'fair',
      environmental_awareness: 60
    }
  };

  try {
    const recommendations = await service.generateRecommendations(input);
    
    console.log(`Generated ${recommendations.length} recommendations:`);
    recommendations.forEach((rec, index) => {
      console.log(`\n${index + 1}. ${rec.title}`);
      console.log(`   Priority: ${rec.priority}`);
      console.log(`   Category: ${rec.category}`);
      console.log(`   Description: ${rec.description}`);
      console.log(`   Success Metrics: ${rec.success_metrics.join(', ')}`);
    });
    
    return recommendations;
  } catch (error) {
    console.error('Error generating water quality recommendations:', error);
    throw error;
  }
}

/**
 * Example: Query existing recommendations for a location
 */
async function queryLocationRecommendations() {
  console.log('\n=== Query Location Recommendations Example ===');
  
  const service = new CommunityRecommendationService();
  
  const query: RecommendationQuery = {
    location: {
      latitude: 40.7128,
      longitude: -74.0060,
      radius_km: 15
    },
    priority: ['high', 'urgent'],
    category: ['immediate_action'],
    active_only: true,
    limit: 10
  };

  try {
    const result = await service.getRecommendations(query);
    
    console.log(`Found ${result.data.length} recommendations (${result.pagination.total} total):`);
    result.data.forEach((rec, index) => {
      console.log(`\n${index + 1}. ${rec.title}`);
      console.log(`   Priority: ${rec.priority} | Category: ${rec.category}`);
      console.log(`   Created: ${rec.created_at.toLocaleDateString()}`);
      console.log(`   Expires: ${rec.expires_at ? rec.expires_at.toLocaleDateString() : 'Never'}`);
    });
    
    return result;
  } catch (error) {
    console.error('Error querying recommendations:', error);
    throw error;
  }
}

/**
 * Example: Update recommendation priority
 */
async function updateRecommendationPriority(recommendationId: string) {
  console.log('\n=== Update Recommendation Example ===');
  
  const service = new CommunityRecommendationService();
  
  try {
    const updated = await service.updateRecommendation(recommendationId, {
      priority: 'urgent',
      title: 'URGENT: Reduce PM2.5 Exposure - Immediate Actions Required'
    });
    
    if (updated) {
      console.log('Recommendation updated successfully:');
      console.log(`  ID: ${updated.id}`);
      console.log(`  New Priority: ${updated.priority}`);
      console.log(`  New Title: ${updated.title}`);
      console.log(`  Updated At: ${updated.updated_at.toISOString()}`);
    } else {
      console.log('Recommendation not found');
    }
    
    return updated;
  } catch (error) {
    console.error('Error updating recommendation:', error);
    throw error;
  }
}

/**
 * Example: Demonstrate recommendation prioritization algorithm
 */
async function demonstratePrioritization() {
  console.log('\n=== Recommendation Prioritization Example ===');
  
  const service = new CommunityRecommendationService();
  
  // Create scenarios with different pollution severities
  const scenarios = [
    {
      name: 'Moderate Pollution',
      conditions: [
        {
          id: '5',
          source: 'openaq' as const,
          pollutant: 'pm2.5',
          value: 25.0, // Moderate level
          unit: 'μg/m³',
          location: { latitude: 34.0522, longitude: -118.2437 },
          timestamp: new Date(),
          quality_grade: 'A' as const
        }
      ]
    },
    {
      name: 'High Pollution',
      conditions: [
        {
          id: '6',
          source: 'openaq' as const,
          pollutant: 'pm2.5',
          value: 65.0, // High level
          unit: 'μg/m³',
          location: { latitude: 34.0522, longitude: -118.2437 },
          timestamp: new Date(),
          quality_grade: 'A' as const
        }
      ]
    },
    {
      name: 'Very High Pollution',
      conditions: [
        {
          id: '7',
          source: 'openaq' as const,
          pollutant: 'pm2.5',
          value: 150.0, // Very high level
          unit: 'μg/m³',
          location: { latitude: 34.0522, longitude: -118.2437 },
          timestamp: new Date(),
          quality_grade: 'A' as const
        }
      ]
    }
  ];

  for (const scenario of scenarios) {
    console.log(`\n--- ${scenario.name} Scenario ---`);
    
    const input: RecommendationAnalysisInput = {
      location: { latitude: 34.0522, longitude: -118.2437, address: 'Los Angeles, CA' },
      radius_km: 8,
      current_conditions: scenario.conditions,
      community_profile: {
        population_density: 3000,
        economic_level: 'medium',
        infrastructure_quality: 'good',
        environmental_awareness: 65
      }
    };

    try {
      const recommendations = await service.generateRecommendations(input);
      
      console.log(`Generated ${recommendations.length} recommendations:`);
      recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.category}: ${rec.title}`);
        console.log(`     Impact: ${rec.estimated_impact}/100, Feasibility: ${rec.feasibility_score}/100`);
      });
    } catch (error) {
      console.error(`Error in ${scenario.name} scenario:`, error);
    }
  }
}

/**
 * Example: Community profile impact on feasibility scoring
 */
async function demonstrateCommunityProfileImpact() {
  console.log('\n=== Community Profile Impact Example ===');
  
  const service = new CommunityRecommendationService();
  
  const baseConditions: EnvironmentalDataPoint[] = [
    {
      id: '8',
      source: 'openaq',
      pollutant: 'pm2.5',
      value: 45.0,
      unit: 'μg/m³',
      location: { latitude: 41.8781, longitude: -87.6298 },
      timestamp: new Date(),
      quality_grade: 'A'
    }
  ];

  const communityProfiles = [
    {
      name: 'Low-Income Community',
      profile: {
        population_density: 5000,
        economic_level: 'low' as const,
        infrastructure_quality: 'poor' as const,
        environmental_awareness: 40
      }
    },
    {
      name: 'Middle-Income Community',
      profile: {
        population_density: 3000,
        economic_level: 'medium' as const,
        infrastructure_quality: 'fair' as const,
        environmental_awareness: 65
      }
    },
    {
      name: 'High-Income Community',
      profile: {
        population_density: 1500,
        economic_level: 'high' as const,
        infrastructure_quality: 'excellent' as const,
        environmental_awareness: 85
      }
    }
  ];

  for (const { name, profile } of communityProfiles) {
    console.log(`\n--- ${name} ---`);
    
    const input: RecommendationAnalysisInput = {
      location: { latitude: 41.8781, longitude: -87.6298, address: 'Chicago, IL' },
      radius_km: 6,
      current_conditions: baseConditions,
      community_profile: profile
    };

    try {
      const recommendations = await service.generateRecommendations(input);
      
      console.log('Feasibility scores adjusted for community profile:');
      recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec.category}: Feasibility ${rec.feasibility_score}/100`);
        console.log(`     Cost: ${rec.estimated_cost}`);
      });
    } catch (error) {
      console.error(`Error for ${name}:`, error);
    }
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    console.log('🌍 Community Recommendation System Examples\n');
    
    // Generate recommendations for different scenarios
    await generateAirPollutionRecommendations();
    await generateWaterQualityRecommendations();
    
    // Query existing recommendations
    await queryLocationRecommendations();
    
    // Demonstrate prioritization
    await demonstratePrioritization();
    
    // Show community profile impact
    await demonstrateCommunityProfileImpact();
    
    console.log('\n✅ All examples completed successfully!');
    
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Export functions for individual use
export {
  generateAirPollutionRecommendations,
  generateWaterQualityRecommendations,
  queryLocationRecommendations,
  updateRecommendationPriority,
  demonstratePrioritization,
  demonstrateCommunityProfileImpact,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}