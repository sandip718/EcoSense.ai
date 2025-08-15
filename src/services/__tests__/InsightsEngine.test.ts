// Unit tests for InsightsEngine
// Tests requirements 3.1, 3.2, 3.3, 3.4

import { InsightsEngine } from '../InsightsEngine';
import { EnvironmentalDataRepository } from '../../models/EnvironmentalDataRepository';
import { EnvironmentalDataPoint, Location } from '../../models/types';

// Mock the EnvironmentalDataRepository
jest.mock('../../models/EnvironmentalDataRepository');
const MockedEnvironmentalDataRepository = EnvironmentalDataRepository as jest.MockedClass<typeof EnvironmentalDataRepository>;

describe('InsightsEngine', () => {
  let insightsEngine: InsightsEngine;
  let mockRepo: jest.Mocked<EnvironmentalDataRepository>;

  const testLocation: Location = {
    latitude: 40.7128,
    longitude: -74.0060,
    address: 'New York, NY'
  };

  const createMockDataPoint = (
    timestamp: Date,
    value: number,
    pollutant: string = 'pm2.5'
  ): EnvironmentalDataPoint => ({
    id: `test-${timestamp.getTime()}`,
    source: 'openaq',
    pollutant,
    value,
    unit: 'μg/m³',
    location: testLocation,
    timestamp,
    quality_grade: 'A',
    created_at: new Date()
  });

  beforeEach(() => {
    MockedEnvironmentalDataRepository.mockClear();
    mockRepo = new MockedEnvironmentalDataRepository() as jest.Mocked<EnvironmentalDataRepository>;
    insightsEngine = new InsightsEngine();
    
    // Replace the private repo instance with our mock
    (insightsEngine as any).environmentalDataRepo = mockRepo;
  });

  describe('analyzeTrend', () => {
    it('should identify improving trend when pollution decreases', async () => {
      // Requirement 3.1: Identify trends (improving/worsening/stable)
      const mockData = [
        createMockDataPoint(new Date('2024-01-01'), 50),
        createMockDataPoint(new Date('2024-01-02'), 45),
        createMockDataPoint(new Date('2024-01-03'), 40),
        createMockDataPoint(new Date('2024-01-04'), 35),
        createMockDataPoint(new Date('2024-01-05'), 30)
      ];

      mockRepo.findMany.mockResolvedValue({
        data: mockData,
        pagination: {
          total: mockData.length,
          page: 1,
          limit: 50,
          has_next: false,
          has_previous: false
        }
      });

      mockRepo.findLatestByLocationAndPollutant.mockResolvedValue(mockData[mockData.length - 1]);

      const result = await insightsEngine.analyzeTrend(
        testLocation,
        5,
        'pm2.5',
        { start: new Date('2024-01-01'), end: new Date('2024-01-05') }
      );

      expect(result.trend.direction).toBe('improving');
      expect(result.trend.magnitude).toBeGreaterThan(0);
      expect(result.trend.confidence).toBeGreaterThan(0.5);
      expect(result.pollutantType).toBe('pm2.5');
    });

    it('should identify worsening trend when pollution increases', async () => {
      const mockData = [
        createMockDataPoint(new Date('2024-01-01'), 20),
        createMockDataPoint(new Date('2024-01-02'), 25),
        createMockDataPoint(new Date('2024-01-03'), 30),
        createMockDataPoint(new Date('2024-01-04'), 35),
        createMockDataPoint(new Date('2024-01-05'), 40)
      ];

      mockRepo.findMany.mockResolvedValue({
        data: mockData,
        pagination: {
          total: mockData.length,
          page: 1,
          limit: 50,
          has_next: false,
          has_previous: false
        }
      });

      mockRepo.findLatestByLocationAndPollutant.mockResolvedValue(mockData[mockData.length - 1]);

      const result = await insightsEngine.analyzeTrend(
        testLocation,
        5,
        'pm2.5',
        { start: new Date('2024-01-01'), end: new Date('2024-01-05') }
      );

      expect(result.trend.direction).toBe('worsening');
      expect(result.trend.magnitude).toBeGreaterThan(0);
    });

    it('should identify stable trend when pollution remains constant', async () => {
      const mockData = [
        createMockDataPoint(new Date('2024-01-01'), 25),
        createMockDataPoint(new Date('2024-01-02'), 26),
        createMockDataPoint(new Date('2024-01-03'), 24),
        createMockDataPoint(new Date('2024-01-04'), 25),
        createMockDataPoint(new Date('2024-01-05'), 25)
      ];

      mockRepo.findMany.mockResolvedValue({
        data: mockData,
        pagination: {
          total: mockData.length,
          page: 1,
          limit: 50,
          has_next: false,
          has_previous: false
        }
      });

      mockRepo.findLatestByLocationAndPollutant.mockResolvedValue(mockData[mockData.length - 1]);

      const result = await insightsEngine.analyzeTrend(
        testLocation,
        5,
        'pm2.5',
        { start: new Date('2024-01-01'), end: new Date('2024-01-05') }
      );

      expect(result.trend.direction).toBe('stable');
    });

    it('should throw error with insufficient data points', async () => {
      const mockData = [
        createMockDataPoint(new Date('2024-01-01'), 25),
        createMockDataPoint(new Date('2024-01-02'), 26)
      ];

      mockRepo.findMany.mockResolvedValue({
        data: mockData,
        pagination: {
          total: mockData.length,
          page: 1,
          limit: 50,
          has_next: false,
          has_previous: false
        }
      });

      await expect(
        insightsEngine.analyzeTrend(
          testLocation,
          5,
          'pm2.5',
          { start: new Date('2024-01-01'), end: new Date('2024-01-02') }
        )
      ).rejects.toThrow('Insufficient data points for trend analysis');
    });
  });

  describe('analyzeCorrelations', () => {
    it('should calculate correlation between pollutants', async () => {
      // Requirement 3.3: Correlate multiple data sources
      const pm25Data = [
        createMockDataPoint(new Date('2024-01-01T10:00:00Z'), 30, 'pm2.5'),
        createMockDataPoint(new Date('2024-01-02T10:00:00Z'), 35, 'pm2.5'),
        createMockDataPoint(new Date('2024-01-03T10:00:00Z'), 40, 'pm2.5')
      ];

      const no2Data = [
        createMockDataPoint(new Date('2024-01-01T10:00:00Z'), 20, 'no2'),
        createMockDataPoint(new Date('2024-01-02T10:00:00Z'), 25, 'no2'),
        createMockDataPoint(new Date('2024-01-03T10:00:00Z'), 30, 'no2')
      ];

      mockRepo.findMany
        .mockResolvedValueOnce({
          data: pm25Data,
          pagination: { total: 3, page: 1, limit: 50, has_next: false, has_previous: false }
        })
        .mockResolvedValueOnce({
          data: no2Data,
          pagination: { total: 3, page: 1, limit: 50, has_next: false, has_previous: false }
        });

      const result = await insightsEngine.analyzeCorrelations(
        testLocation,
        5,
        ['pm2.5', 'no2'],
        { start: new Date('2024-01-01'), end: new Date('2024-01-03') }
      );

      expect(result.correlations).toHaveLength(1);
      expect(result.correlations[0].pollutant1).toBe('pm2.5');
      expect(result.correlations[0].pollutant2).toBe('no2');
      expect(result.correlations[0].correlation).toBeCloseTo(1, 1); // Perfect positive correlation
      expect(result.correlations[0].interpretation).toContain('correlation');
    });

    it('should throw error with insufficient pollutants', async () => {
      await expect(
        insightsEngine.analyzeCorrelations(
          testLocation,
          5,
          ['pm2.5'],
          { start: new Date('2024-01-01'), end: new Date('2024-01-03') }
        )
      ).rejects.toThrow('At least two pollutants required for correlation analysis');
    });
  });

  describe('assessHealthImpact', () => {
    it('should assess low risk for PM2.5 below moderate threshold', async () => {
      // Requirement 3.4: Provide health impact assessments
      const mockData = createMockDataPoint(new Date(), 10, 'pm2.5'); // Below 15 μg/m³ threshold

      mockRepo.findLatestByLocationAndPollutant.mockResolvedValue(mockData);

      const result = await insightsEngine.assessHealthImpact(testLocation, 5, 'pm2.5');

      expect(result.riskLevel).toBe('low');
      expect(result.recommendations).toContain('Limit outdoor activities if sensitive');
      expect(result.affectedPopulation).toBeGreaterThan(0);
    });

    it('should assess high risk for PM2.5 above high threshold', async () => {
      const mockData = createMockDataPoint(new Date(), 50, 'pm2.5'); // Above 35 μg/m³ threshold

      mockRepo.findLatestByLocationAndPollutant.mockResolvedValue(mockData);

      const result = await insightsEngine.assessHealthImpact(testLocation, 5, 'pm2.5');

      expect(result.riskLevel).toBe('high');
      expect(result.recommendations).toContain('Avoid outdoor exercise');
      expect(result.affectedPopulation).toBeGreaterThan(0);
    });

    it('should assess very high risk for PM2.5 above very high threshold', async () => {
      const mockData = createMockDataPoint(new Date(), 100, 'pm2.5'); // Above 75 μg/m³ threshold

      mockRepo.findLatestByLocationAndPollutant.mockResolvedValue(mockData);

      const result = await insightsEngine.assessHealthImpact(testLocation, 5, 'pm2.5');

      expect(result.riskLevel).toBe('very_high');
      expect(result.recommendations).toContain('Stay indoors');
      expect(result.affectedPopulation).toBeGreaterThan(0);
    });

    it('should handle inverse thresholds for pH correctly', async () => {
      const mockData = createMockDataPoint(new Date(), 5.0, 'ph'); // Below 6.5 pH threshold (acidic)

      mockRepo.findLatestByLocationAndPollutant.mockResolvedValue(mockData);

      const result = await insightsEngine.assessHealthImpact(testLocation, 5, 'ph');

      expect(result.riskLevel).toBe('very_high'); // Low pH is dangerous
      expect(result.affectedPopulation).toBeGreaterThan(0);
    });

    it('should throw error for unknown pollutant', async () => {
      const mockData = createMockDataPoint(new Date(), 50, 'unknown_pollutant');

      mockRepo.findLatestByLocationAndPollutant.mockResolvedValue(mockData);

      await expect(
        insightsEngine.assessHealthImpact(testLocation, 5, 'unknown_pollutant')
      ).rejects.toThrow('No health thresholds defined for pollutant: unknown_pollutant');
    });

    it('should throw error when no current data available', async () => {
      mockRepo.findLatestByLocationAndPollutant.mockResolvedValue(null);

      await expect(
        insightsEngine.assessHealthImpact(testLocation, 5, 'pm2.5')
      ).rejects.toThrow('No current data available for health impact assessment');
    });
  });

  describe('private methods via public interface', () => {
    it('should handle time series conversion correctly', async () => {
      const mockData = [
        createMockDataPoint(new Date('2024-01-03'), 30),
        createMockDataPoint(new Date('2024-01-01'), 20),
        createMockDataPoint(new Date('2024-01-02'), 25)
      ];

      mockRepo.findMany.mockResolvedValue({
        data: mockData,
        pagination: {
          total: mockData.length,
          page: 1,
          limit: 50,
          has_next: false,
          has_previous: false
        }
      });

      mockRepo.findLatestByLocationAndPollutant.mockResolvedValue(mockData[0]);

      const result = await insightsEngine.analyzeTrend(
        testLocation,
        5,
        'pm2.5',
        { start: new Date('2024-01-01'), end: new Date('2024-01-03') }
      );

      // Should handle the data correctly despite unsorted input
      expect(result.trend.direction).toBeDefined();
      expect(result.trend.magnitude).toBeGreaterThanOrEqual(0);
      expect(result.trend.confidence).toBeGreaterThanOrEqual(0);
    });
  });
});