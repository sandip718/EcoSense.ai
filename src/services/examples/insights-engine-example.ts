// Example usage of the Insights Engine
// Demonstrates requirements 3.1, 3.2, 3.3, 3.4

import { InsightsEngine } from '../InsightsEngine';
import { EnvironmentalDataRepository } from '../../models/EnvironmentalDataRepository';
import { CreateEnvironmentalDataPoint, Location } from '../../models/types';
import { logger } from '../../utils/logger';

/**
 * Example demonstrating Insights Engine functionality
 */
async function demonstrateInsightsEngine(): Promise<void> {
  try {
    logger.info('Starting Insights Engine demonstration');

    const insightsEngine = new InsightsEngine();
    const environmentalDataRepo = new EnvironmentalDataRepository();

    // Example location (New York City)
    const location: Location = {
      latitude: 40.7128,
      longitude: -74.0060,
      address: 'New York, NY'
    };

    // Create sample environmental data for demonstration
    await createSampleData(environmentalDataRepo, location);

    // 1. Demonstrate trend analysis (Requirement 3.1)
    logger.info('=== Trend Analysis Demo ===');
    const trendAnalysis = await insightsEngine.analyzeTrend(
      location,
      5, // 5km radius
      'pm2.5',
      {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-07')
      }
    );

    logger.info('Trend Analysis Results:', {
      direction: trendAnalysis.trend.direction,
      magnitude: trendAnalysis.trend.magnitude,
      confidence: trendAnalysis.trend.confidence,
      riskLevel: trendAnalysis.healthImpact.riskLevel,
      affectedPopulation: trendAnalysis.healthImpact.affectedPopulation
    });

    // 2. Demonstrate correlation analysis (Requirement 3.3)
    logger.info('=== Correlation Analysis Demo ===');
    const correlationAnalysis = await insightsEngine.analyzeCorrelations(
      location,
      5,
      ['pm2.5', 'no2', 'o3'],
      {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-07')
      }
    );

    logger.info('Correlation Analysis Results:');
    correlationAnalysis.correlations.forEach(corr => {
      logger.info(`${corr.pollutant1} vs ${corr.pollutant2}: ${corr.correlation.toFixed(3)} (${corr.interpretation})`);
    });

    // 3. Demonstrate health impact assessment (Requirement 3.4)
    logger.info('=== Health Impact Assessment Demo ===');
    const healthImpact = await insightsEngine.assessHealthImpact(
      location,
      5,
      'pm2.5'
    );

    logger.info('Health Impact Assessment Results:', {
      riskLevel: healthImpact.riskLevel,
      affectedPopulation: healthImpact.affectedPopulation,
      recommendations: healthImpact.recommendations
    });

    // 4. Demonstrate different pollutant types
    logger.info('=== Multi-Pollutant Health Assessment ===');
    const pollutants = ['pm2.5', 'no2', 'o3', 'turbidity'];
    
    for (const pollutant of pollutants) {
      try {
        const impact = await insightsEngine.assessHealthImpact(location, 5, pollutant);
        logger.info(`${pollutant.toUpperCase()} Health Impact:`, {
          riskLevel: impact.riskLevel,
          affectedPopulation: impact.affectedPopulation,
          recommendationCount: impact.recommendations.length
        });
      } catch (error) {
        logger.warn(`Could not assess health impact for ${pollutant}:`, error);
      }
    }

    logger.info('Insights Engine demonstration completed successfully');
  } catch (error) {
    logger.error('Error in Insights Engine demonstration:', error);
    throw error;
  }
}

/**
 * Create sample environmental data for demonstration
 */
async function createSampleData(
  repo: EnvironmentalDataRepository,
  location: Location
): Promise<void> {
  logger.info('Creating sample environmental data...');

  const sampleData: CreateEnvironmentalDataPoint[] = [
    // PM2.5 data showing improving trend
    {
      source: 'openaq',
      pollutant: 'pm2.5',
      value: 45,
      unit: 'μg/m³',
      location,
      timestamp: new Date('2024-01-01T10:00:00Z'),
      quality_grade: 'A'
    },
    {
      source: 'openaq',
      pollutant: 'pm2.5',
      value: 40,
      unit: 'μg/m³',
      location,
      timestamp: new Date('2024-01-02T10:00:00Z'),
      quality_grade: 'A'
    },
    {
      source: 'openaq',
      pollutant: 'pm2.5',
      value: 35,
      unit: 'μg/m³',
      location,
      timestamp: new Date('2024-01-03T10:00:00Z'),
      quality_grade: 'A'
    },
    {
      source: 'openaq',
      pollutant: 'pm2.5',
      value: 30,
      unit: 'μg/m³',
      location,
      timestamp: new Date('2024-01-04T10:00:00Z'),
      quality_grade: 'A'
    },
    {
      source: 'openaq',
      pollutant: 'pm2.5',
      value: 25,
      unit: 'μg/m³',
      location,
      timestamp: new Date('2024-01-05T10:00:00Z'),
      quality_grade: 'A'
    },

    // NO2 data showing correlation with PM2.5
    {
      source: 'openaq',
      pollutant: 'no2',
      value: 60,
      unit: 'μg/m³',
      location,
      timestamp: new Date('2024-01-01T10:00:00Z'),
      quality_grade: 'A'
    },
    {
      source: 'openaq',
      pollutant: 'no2',
      value: 55,
      unit: 'μg/m³',
      location,
      timestamp: new Date('2024-01-02T10:00:00Z'),
      quality_grade: 'A'
    },
    {
      source: 'openaq',
      pollutant: 'no2',
      value: 50,
      unit: 'μg/m³',
      location,
      timestamp: new Date('2024-01-03T10:00:00Z'),
      quality_grade: 'A'
    },
    {
      source: 'openaq',
      pollutant: 'no2',
      value: 45,
      unit: 'μg/m³',
      location,
      timestamp: new Date('2024-01-04T10:00:00Z'),
      quality_grade: 'A'
    },
    {
      source: 'openaq',
      pollutant: 'no2',
      value: 40,
      unit: 'μg/m³',
      location,
      timestamp: new Date('2024-01-05T10:00:00Z'),
      quality_grade: 'A'
    },

    // O3 data showing different pattern
    {
      source: 'openaq',
      pollutant: 'o3',
      value: 80,
      unit: 'μg/m³',
      location,
      timestamp: new Date('2024-01-01T10:00:00Z'),
      quality_grade: 'B'
    },
    {
      source: 'openaq',
      pollutant: 'o3',
      value: 85,
      unit: 'μg/m³',
      location,
      timestamp: new Date('2024-01-02T10:00:00Z'),
      quality_grade: 'B'
    },
    {
      source: 'openaq',
      pollutant: 'o3',
      value: 90,
      unit: 'μg/m³',
      location,
      timestamp: new Date('2024-01-03T10:00:00Z'),
      quality_grade: 'B'
    },
    {
      source: 'openaq',
      pollutant: 'o3',
      value: 95,
      unit: 'μg/m³',
      location,
      timestamp: new Date('2024-01-04T10:00:00Z'),
      quality_grade: 'B'
    },
    {
      source: 'openaq',
      pollutant: 'o3',
      value: 100,
      unit: 'μg/m³',
      location,
      timestamp: new Date('2024-01-05T10:00:00Z'),
      quality_grade: 'B'
    },

    // Water quality data
    {
      source: 'water_quality_portal',
      pollutant: 'turbidity',
      value: 2.5,
      unit: 'NTU',
      location,
      timestamp: new Date('2024-01-01T10:00:00Z'),
      quality_grade: 'B'
    },
    {
      source: 'water_quality_portal',
      pollutant: 'turbidity',
      value: 2.0,
      unit: 'NTU',
      location,
      timestamp: new Date('2024-01-02T10:00:00Z'),
      quality_grade: 'B'
    },
    {
      source: 'water_quality_portal',
      pollutant: 'turbidity',
      value: 1.8,
      unit: 'NTU',
      location,
      timestamp: new Date('2024-01-03T10:00:00Z'),
      quality_grade: 'A'
    }
  ];

  try {
    const insertedCount = await repo.bulkCreate(sampleData);
    logger.info(`Created ${insertedCount} sample environmental data points`);
  } catch (error) {
    logger.warn('Some sample data may already exist, continuing with demonstration');
  }
}

/**
 * Run the demonstration if this file is executed directly
 */
if (require.main === module) {
  demonstrateInsightsEngine()
    .then(() => {
      logger.info('Demonstration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Demonstration failed:', error);
      process.exit(1);
    });
}

export { demonstrateInsightsEngine };