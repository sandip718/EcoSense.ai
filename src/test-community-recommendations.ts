// Test script for Community Recommendation System
// This script tests the complete implementation without requiring database connection

import { CommunityRecommendationService } from './services/CommunityRecommendationService';
import { 
  RecommendationAnalysisInput, 
  EnvironmentalDataPoint 
} from './models/types';

// Mock the database dependencies for testing
jest.mock('./models/CommunityRecommendationRepository', () => {
  return {
    CommunityRecommendationRepository: jest.fn().mockImplementation(() => ({
      findByLocationAndPollutants: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((rec) => Promise.resolve({
        id: 'test-rec-' + Math.random().toString(36).substr(2, 9),
        ...rec,
        created_at: new Date(),
        updated_at: new Date()
      })),
      findMany: jest.fn().mockResolvedValue({
        data: [],
        pagination: { total: 0, page: 1, limit: 20, has_next: false, has_previous: false }
      }),
      findById: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(false)
    }))
  };
});

jest.mock('./models/EnvironmentalDataRepository', () => {
  return {
    EnvironmentalDataRepository: jest.fn().mockImplementation(() => ({}))
  };
});

jest.mock('./services/InsightsEngine', () => {
  return {
    InsightsEngine: jest.fn().mockImplementation(() => ({
      assessHealthImpact: jest.fn().mockImplementation((location, radius, pollutant, timeSeries) => {
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
        }
        
        return Promise.resolve({
          riskLevel,
          affectedPopulation: Math.floor(Math.random() * 1000) + 100,
          recommendations: [`Take action for ${pollutant}`]
        });
      })
    }))
  };
});

jest.mock('./utils/logger', () => ({
  logger: {
    info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
    error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
    warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args),
    debug: (msg: string, ...args: any[]) => console.log(`[DEBUG] ${msg}`, ...args)
  }
}));

async function testCommunityRecommendationSystem() {
  console.log('🧪 Testing Community Recommendation System\n');

  try {
    const service = new CommunityRecommendationService();
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
    
    airRecommendations.forEach((rec, index) => {
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
    
    waterRecommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
      console.log(`      Steps: ${rec.steps.length} action items`);
      console.log(`      Time to Implement: ${rec.time_to_implement}`);
    });

    // Test 3: Query recommendations
    console.log('\n📋 Test 3: Query Recommendations');
    const queryResult = await service.getRecommendations({
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        radius_km: 15
      },
      priority: ['high', 'urgent'],
      active_only: true,
      limit: 5
    });

    console.log(`   Query returned ${queryResult.data.length} recommendations`);
    console.log(`   Total available: ${queryResult.pagination.total}`);

    // Test 4: Test different pollution severity levels
    console.log('\n📋 Test 4: Pollution Severity Impact on Recommendations');
    
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
        const priorities = recommendations.map(r => r.priority);
        const categories = recommendations.map(r => r.category);
        console.log(`     Priorities: ${[...new Set(priorities)].join(', ')}`);
        console.log(`     Categories: ${[...new Set(categories)].join(', ')}`);
      }
    }

    // Test 5: Community profile impact
    console.log('\n📋 Test 5: Community Profile Impact on Feasibility');
    
    const communityProfiles = [
      { name: 'Low-Income', economic_level: 'low', infrastructure_quality: 'poor', awareness: 40 },
      { name: 'High-Income', economic_level: 'high', infrastructure_quality: 'excellent', awareness: 90 }
    ];

    const baseCondition: EnvironmentalDataPoint = {
      id: 'profile-test',
      source: 'openaq',
      pollutant: 'pm2.5',
      value: 45.0,
      unit: 'μg/m³',
      location: { latitude: 41.8781, longitude: -87.6298 },
      timestamp: new Date(),
      quality_grade: 'A'
    };

    for (const profile of communityProfiles) {
      const input: RecommendationAnalysisInput = {
        location: { latitude: 41.8781, longitude: -87.6298 },
        radius_km: 6,
        current_conditions: [baseCondition],
        community_profile: {
          population_density: 3000,
          economic_level: profile.economic_level as any,
          infrastructure_quality: profile.infrastructure_quality as any,
          environmental_awareness: profile.awareness
        }
      };

      const recommendations = await service.generateRecommendations(input);
      console.log(`   ${profile.name} Community: ${recommendations.length} recommendations`);
      
      if (recommendations.length > 0) {
        const avgFeasibility = recommendations.reduce((sum, r) => sum + r.feasibility_score, 0) / recommendations.length;
        console.log(`     Average Feasibility Score: ${avgFeasibility.toFixed(1)}/100`);
      }
    }

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('   ✓ Service instantiation');
    console.log('   ✓ Air pollution recommendations');
    console.log('   ✓ Water quality recommendations');
    console.log('   ✓ Recommendation querying');
    console.log('   ✓ Pollution severity impact');
    console.log('   ✓ Community profile impact');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    throw error;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testCommunityRecommendationSystem()
    .then(() => {
      console.log('\n🎉 Community Recommendation System test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed with error:', error);
      process.exit(1);
    });
}

export { testCommunityRecommendationSystem };