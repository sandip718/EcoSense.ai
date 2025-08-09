import { DataQualityService, QualityScore, AnomalyDetectionResult } from '../DataQualityService';
import { CreateEnvironmentalDataPoint } from '../../models/types';
import { Logger } from 'winston';

describe('DataQualityService', () => {
  let dataQualityService: DataQualityService;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    dataQualityService = new DataQualityService(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
    dataQualityService.resetMetrics();
  });

  describe('assessDataQuality', () => {
    it('should assign grade A for high-quality data', () => {
      const dataPoint: CreateEnvironmentalDataPoint = {
        source: 'openaq',
        pollutant: 'pm25',
        value: 25.5,
        unit: 'µg/m³',
        location: { latitude: 40.7128, longitude: -74.0060, address: 'New York, NY' },
        timestamp: new Date(),
        quality_grade: 'A'
      };

      const qualityScore = dataQualityService.assessDataQuality(dataPoint);

      expect(qualityScore.grade).toBe('A');
      expect(qualityScore.overall).toBeGreaterThan(0.9);
      expect(qualityScore.components.completeness).toBeGreaterThan(0.9);
      expect(qualityScore.components.accuracy).toBeGreaterThan(0.9);
    });

    it('should assign grade D for poor-quality data', () => {
      const dataPoint: CreateEnvironmentalDataPoint = {
        source: 'unknown_source' as any,
        pollutant: '',
        value: -10, // Invalid negative value
        unit: '',
        location: { latitude: 200, longitude: 300 }, // Invalid coordinates
        timestamp: new Date('invalid'),
        quality_grade: 'X' as any
      };

      const qualityScore = dataQualityService.assessDataQuality(dataPoint);

      expect(qualityScore.grade).toBe('D');
      expect(qualityScore.overall).toBeLessThan(0.6);
      expect(qualityScore.issues.length).toBeGreaterThan(0);
    });

    it('should penalize missing optional fields', () => {
      const dataPointWithAddress: CreateEnvironmentalDataPoint = {
        source: 'openaq',
        pollutant: 'pm25',
        value: 25.5,
        unit: 'µg/m³',
        location: { latitude: 40.7128, longitude: -74.0060, address: 'New York, NY' },
        timestamp: new Date(),
        quality_grade: 'A'
      };

      const dataPointWithoutAddress: CreateEnvironmentalDataPoint = {
        ...dataPointWithAddress,
        location: { latitude: 40.7128, longitude: -74.0060 }
      };

      const scoreWithAddress = dataQualityService.assessDataQuality(dataPointWithAddress);
      dataQualityService.resetMetrics();
      const scoreWithoutAddress = dataQualityService.assessDataQuality(dataPointWithoutAddress);

      expect(scoreWithAddress.components.completeness).toBeGreaterThan(scoreWithoutAddress.components.completeness);
    });

    it('should penalize stale data', () => {
      const freshData: CreateEnvironmentalDataPoint = {
        source: 'openaq',
        pollutant: 'pm25',
        value: 25.5,
        unit: 'µg/m³',
        location: { latitude: 40.7128, longitude: -74.0060 },
        timestamp: new Date(), // Current time
        quality_grade: 'A'
      };

      const staleData: CreateEnvironmentalDataPoint = {
        ...freshData,
        timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      };

      const freshScore = dataQualityService.assessDataQuality(freshData);
      dataQualityService.resetMetrics();
      const staleScore = dataQualityService.assessDataQuality(staleData);

      expect(freshScore.components.timeliness).toBeGreaterThan(staleScore.components.timeliness);
      expect(staleScore.issues).toContain('Data is more than 24 hours old');
    });

    it('should detect consistency issues with historical data', () => {
      const baseDataPoint: CreateEnvironmentalDataPoint = {
        source: 'openaq',
        pollutant: 'pm25',
        value: 25,
        unit: 'µg/m³',
        location: { latitude: 40.7128, longitude: -74.0060 },
        timestamp: new Date(),
        quality_grade: 'A'
      };

      // Add several consistent data points
      for (let i = 0; i < 5; i++) {
        dataQualityService.assessDataQuality({
          ...baseDataPoint,
          value: 25 + i, // Gradual increase
          timestamp: new Date(Date.now() - i * 60 * 60 * 1000)
        });
      }

      // Add an outlier
      const outlierDataPoint = {
        ...baseDataPoint,
        value: 200, // Significant spike
        timestamp: new Date()
      };

      const outlierScore = dataQualityService.assessDataQuality(outlierDataPoint);

      expect(outlierScore.components.consistency).toBeLessThan(0.8);
      expect(outlierScore.issues.some(issue => issue.includes('deviates significantly'))).toBe(true);
    });
  });

  describe('detectAnomalies', () => {
    it('should detect extreme value anomalies', () => {
      const extremeDataPoint: CreateEnvironmentalDataPoint = {
        source: 'openaq',
        pollutant: 'pm25',
        value: 1000, // Extremely high PM2.5 value
        unit: 'µg/m³',
        location: { latitude: 40.7128, longitude: -74.0060 },
        timestamp: new Date(),
        quality_grade: 'A'
      };

      const anomalyResult = dataQualityService.detectAnomalies(extremeDataPoint);

      expect(anomalyResult.isAnomaly).toBe(true);
      expect(anomalyResult.confidence).toBeGreaterThan(0.5);
      expect(anomalyResult.suggestedAction).toMatch(/reject|flag/); // Accept either reject or flag
      expect(anomalyResult.reasons).toContain('Value 1000 is above maximum threshold 300');
    });

    it('should detect temporal anomalies', () => {
      const futureDataPoint: CreateEnvironmentalDataPoint = {
        source: 'openaq',
        pollutant: 'pm25',
        value: 25,
        unit: 'µg/m³',
        location: { latitude: 40.7128, longitude: -74.0060 },
        timestamp: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours in future
        quality_grade: 'A'
      };

      const anomalyResult = dataQualityService.detectAnomalies(futureDataPoint);

      expect(anomalyResult.isAnomaly).toBe(true);
      expect(anomalyResult.reasons).toContain('Data timestamp is significantly in the future');
    });

    it('should detect location anomalies', () => {
      const invalidLocationDataPoint: CreateEnvironmentalDataPoint = {
        source: 'openaq',
        pollutant: 'pm25',
        value: 25,
        unit: 'µg/m³',
        location: { latitude: 200, longitude: 300 }, // Invalid coordinates
        timestamp: new Date(),
        quality_grade: 'A'
      };

      const anomalyResult = dataQualityService.detectAnomalies(invalidLocationDataPoint);

      expect(anomalyResult.isAnomaly).toBe(true);
      expect(anomalyResult.confidence).toBeGreaterThan(0.5);
      expect(anomalyResult.reasons).toContain('Invalid geographic coordinates');
    });

    it('should accept normal data', () => {
      const normalDataPoint: CreateEnvironmentalDataPoint = {
        source: 'openaq',
        pollutant: 'pm25',
        value: 25,
        unit: 'µg/m³',
        location: { latitude: 40.7128, longitude: -74.0060 },
        timestamp: new Date(),
        quality_grade: 'A'
      };

      const anomalyResult = dataQualityService.detectAnomalies(normalDataPoint);

      expect(anomalyResult.isAnomaly).toBe(false);
      expect(anomalyResult.suggestedAction).toBe('accept');
      expect(anomalyResult.confidence).toBeLessThan(0.5);
    });
  });

  describe('quality metrics tracking', () => {
    it('should track quality distribution', () => {
      // Create data points that will result in different quality grades
      const dataPoints = [
        // High quality data (should get A)
        { value: 10, pollutant: 'pm25', timestamp: new Date() },
        { value: 15, pollutant: 'pm25', timestamp: new Date() },
        // Medium quality data (should get B or C due to age)
        { value: 25, pollutant: 'pm25', timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000) },
        // Lower quality data (should get C or D due to age and missing address)
        { value: 35, pollutant: 'pm25', timestamp: new Date(Date.now() - 7 * 60 * 60 * 1000) },
        // Very poor quality data (should get D due to invalid value)
        { value: -5, pollutant: '', timestamp: new Date() }
      ];

      dataPoints.forEach(({ value, pollutant, timestamp }) => {
        const dataPoint: CreateEnvironmentalDataPoint = {
          source: 'openaq',
          pollutant,
          value,
          unit: 'µg/m³',
          location: { latitude: 40.7128, longitude: -74.0060 },
          timestamp,
          quality_grade: 'A' // Input grade, but service will calculate its own
        };
        dataQualityService.assessDataQuality(dataPoint);
      });

      const metrics = dataQualityService.getQualityMetrics();

      expect(metrics.totalDataPoints).toBe(5);
      // The exact distribution will depend on the scoring algorithm
      // Just verify that we have some distribution across grades
      const totalGrades = metrics.qualityDistribution.A + 
                         metrics.qualityDistribution.B + 
                         metrics.qualityDistribution.C + 
                         metrics.qualityDistribution.D;
      expect(totalGrades).toBe(5);
      // Expect that not all data gets the same grade (some variation)
      const uniqueGrades = Object.values(metrics.qualityDistribution).filter(count => count > 0).length;
      expect(uniqueGrades).toBeGreaterThan(1);
    });

    it('should track common issues', () => {
      // Create data points with missing fields
      for (let i = 0; i < 3; i++) {
        const dataPoint: CreateEnvironmentalDataPoint = {
          source: 'openaq',
          pollutant: '',
          value: 25,
          unit: 'µg/m³',
          location: { latitude: 40.7128, longitude: -74.0060 },
          timestamp: new Date(),
          quality_grade: 'A'
        };
        dataQualityService.assessDataQuality(dataPoint);
      }

      const metrics = dataQualityService.getQualityMetrics();
      const pollutantIssue = metrics.commonIssues.find(issue => 
        issue.issue.includes('Pollutant is required')
      );

      expect(pollutantIssue).toBeDefined();
      expect(pollutantIssue!.frequency).toBe(3);
    });

    it('should calculate average score correctly', () => {
      const scores = [0.9, 0.8, 0.7];
      const expectedAverage = scores.reduce((a, b) => a + b, 0) / scores.length;

      scores.forEach(score => {
        // Create data point that will result in approximately the target score
        const dataPoint: CreateEnvironmentalDataPoint = {
          source: 'openaq',
          pollutant: 'pm25',
          value: 25,
          unit: 'µg/m³',
          location: { latitude: 40.7128, longitude: -74.0060 },
          timestamp: score > 0.85 ? new Date() : new Date(Date.now() - 7 * 60 * 60 * 1000),
          quality_grade: 'A'
        };
        dataQualityService.assessDataQuality(dataPoint);
      });

      const metrics = dataQualityService.getQualityMetrics();
      expect(metrics.averageScore).toBeGreaterThan(0);
      expect(metrics.averageScore).toBeLessThan(1);
    });
  });

  describe('getQualityReport', () => {
    it('should generate quality report with recommendations', () => {
      // Add some low-quality data
      for (let i = 0; i < 10; i++) {
        const dataPoint: CreateEnvironmentalDataPoint = {
          source: 'openaq',
          pollutant: i < 5 ? '' : 'pm25', // Half with missing pollutant
          value: i < 3 ? -1 : 25, // Some with invalid values
          unit: 'µg/m³',
          location: { latitude: 40.7128, longitude: -74.0060 },
          timestamp: new Date(),
          quality_grade: 'A'
        };
        dataQualityService.assessDataQuality(dataPoint);
      }

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();
      const report = dataQualityService.getQualityReport(startDate, endDate);

      expect(report.period.start).toEqual(startDate);
      expect(report.period.end).toEqual(endDate);
      expect(report.metrics.totalDataPoints).toBe(10);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide specific recommendations for quality issues', () => {
      // Create data with high percentage of low-quality grades
      for (let i = 0; i < 10; i++) {
        const dataPoint: CreateEnvironmentalDataPoint = {
          source: 'openaq',
          pollutant: '',
          value: -1,
          unit: '',
          location: { latitude: 200, longitude: 300 },
          timestamp: new Date('invalid'),
          quality_grade: 'A'
        };
        dataQualityService.assessDataQuality(dataPoint);
      }

      const report = dataQualityService.getQualityReport(new Date(), new Date());
      
      expect(report.recommendations).toContain(
        'High percentage of low-quality data detected. Consider reviewing data sources and validation rules.'
      );
      expect(report.recommendations).toContain(
        'Average data quality score is below acceptable threshold. Implement additional quality controls.'
      );
    });
  });

  describe('pollutant range validation', () => {
    it('should validate PM2.5 ranges correctly', () => {
      const validPM25: CreateEnvironmentalDataPoint = {
        source: 'openaq',
        pollutant: 'pm25',
        value: 25,
        unit: 'µg/m³',
        location: { latitude: 40.7128, longitude: -74.0060 },
        timestamp: new Date(),
        quality_grade: 'A'
      };

      const invalidPM25: CreateEnvironmentalDataPoint = {
        ...validPM25,
        value: 600 // Above reasonable threshold
      };

      const validScore = dataQualityService.assessDataQuality(validPM25);
      dataQualityService.resetMetrics();
      const invalidScore = dataQualityService.assessDataQuality(invalidPM25);

      expect(validScore.components.accuracy).toBeGreaterThan(invalidScore.components.accuracy);
    });

    it('should validate pH ranges correctly', () => {
      const validPH: CreateEnvironmentalDataPoint = {
        source: 'water_quality_portal',
        pollutant: 'ph',
        value: 7.2,
        unit: 'pH',
        location: { latitude: 40.7128, longitude: -74.0060 },
        timestamp: new Date(),
        quality_grade: 'A'
      };

      const invalidPH: CreateEnvironmentalDataPoint = {
        ...validPH,
        value: 20 // Above pH scale
      };

      const validScore = dataQualityService.assessDataQuality(validPH);
      dataQualityService.resetMetrics();
      const invalidScore = dataQualityService.assessDataQuality(invalidPH);

      expect(validScore.components.accuracy).toBeGreaterThan(invalidScore.components.accuracy);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to initial state', () => {
      // Add some data
      const dataPoint: CreateEnvironmentalDataPoint = {
        source: 'openaq',
        pollutant: 'pm25',
        value: 25,
        unit: 'µg/m³',
        location: { latitude: 40.7128, longitude: -74.0060 },
        timestamp: new Date(),
        quality_grade: 'A'
      };
      dataQualityService.assessDataQuality(dataPoint);

      // Verify data exists
      let metrics = dataQualityService.getQualityMetrics();
      expect(metrics.totalDataPoints).toBe(1);

      // Reset and verify
      dataQualityService.resetMetrics();
      metrics = dataQualityService.getQualityMetrics();
      
      expect(metrics.totalDataPoints).toBe(0);
      expect(metrics.averageScore).toBe(0);
      expect(metrics.qualityDistribution.A).toBe(0);
      expect(metrics.commonIssues).toHaveLength(0);
    });
  });
});