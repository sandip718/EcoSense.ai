// Integration tests for insights routes
// Tests requirements 3.1, 3.2, 3.3, 3.4

import request from 'supertest';
import express from 'express';
import insightsRoutes from '../insights';
import { InsightsEngine } from '../../services/InsightsEngine';

// Mock the InsightsEngine
jest.mock('../../services/InsightsEngine');
const MockedInsightsEngine = InsightsEngine as jest.MockedClass<typeof InsightsEngine>;

const app = express();
app.use(express.json());
app.use('/api/insights', insightsRoutes);

describe('Insights Routes', () => {
  let mockInsightsEngine: jest.Mocked<InsightsEngine>;

  beforeEach(() => {
    MockedInsightsEngine.mockClear();
    mockInsightsEngine = new MockedInsightsEngine() as jest.Mocked<InsightsEngine>;
    
    // Replace the instance in the routes module
    (insightsRoutes as any).insightsEngine = mockInsightsEngine;
  });

  describe('GET /api/insights/trends', () => {
    const validTrendResponse = {
      location: { latitude: 40.7128, longitude: -74.0060, radius: 5 },
      timeframe: { start: new Date('2024-01-01'), end: new Date('2024-01-07') },
      pollutantType: 'pm2.5',
      trend: {
        direction: 'improving' as const,
        magnitude: 2.5,
        confidence: 0.85
      },
      healthImpact: {
        riskLevel: 'moderate' as const,
        affectedPopulation: 1500,
        recommendations: ['Limit outdoor activities if sensitive']
      }
    };

    it('should return trend analysis for valid parameters', async () => {
      mockInsightsEngine.analyzeTrend.mockResolvedValue(validTrendResponse);

      const response = await request(app)
        .get('/api/insights/trends')
        .query({
          lat: '40.7128',
          lng: '-74.0060',
          radius: '5',
          pollutant: 'pm2.5',
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-07T00:00:00Z'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(validTrendResponse);
      expect(mockInsightsEngine.analyzeTrend).toHaveBeenCalledWith(
        { latitude: 40.7128, longitude: -74.0060 },
        5,
        'pm2.5',
        { start: new Date('2024-01-01T00:00:00Z'), end: new Date('2024-01-07T00:00:00Z') }
      );
    });

    it('should return 400 for missing required parameters', async () => {
      const response = await request(app)
        .get('/api/insights/trends')
        .query({
          lat: '40.7128',
          lng: '-74.0060'
          // Missing pollutant, start, end
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_PARAMETERS');
    });

    it('should return 400 for invalid location', async () => {
      const response = await request(app)
        .get('/api/insights/trends')
        .query({
          lat: '91', // Invalid latitude
          lng: '-74.0060',
          pollutant: 'pm2.5',
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-07T00:00:00Z'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_LOCATION');
    });

    it('should return 400 for invalid time range', async () => {
      const response = await request(app)
        .get('/api/insights/trends')
        .query({
          lat: '40.7128',
          lng: '-74.0060',
          pollutant: 'pm2.5',
          start: '2024-01-07T00:00:00Z',
          end: '2024-01-01T00:00:00Z' // End before start
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TIME_RANGE');
    });

    it('should return 400 for invalid radius', async () => {
      const response = await request(app)
        .get('/api/insights/trends')
        .query({
          lat: '40.7128',
          lng: '-74.0060',
          radius: '150', // Too large
          pollutant: 'pm2.5',
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-07T00:00:00Z'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_RADIUS');
    });

    it('should return 500 for service errors', async () => {
      mockInsightsEngine.analyzeTrend.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/insights/trends')
        .query({
          lat: '40.7128',
          lng: '-74.0060',
          pollutant: 'pm2.5',
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-07T00:00:00Z'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TREND_ANALYSIS_ERROR');
    });
  });

  describe('GET /api/insights/correlations', () => {
    const validCorrelationResponse = {
      location: { latitude: 40.7128, longitude: -74.0060, radius: 5 },
      timeframe: { start: new Date('2024-01-01'), end: new Date('2024-01-07') },
      correlations: [
        {
          pollutant1: 'pm2.5',
          pollutant2: 'no2',
          correlation: 0.75,
          significance: 0.95,
          interpretation: 'Strong correlation'
        }
      ]
    };

    it('should return correlation analysis for valid parameters', async () => {
      mockInsightsEngine.analyzeCorrelations.mockResolvedValue(validCorrelationResponse);

      const response = await request(app)
        .get('/api/insights/correlations')
        .query({
          lat: '40.7128',
          lng: '-74.0060',
          pollutants: 'pm2.5,no2',
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-07T00:00:00Z'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(validCorrelationResponse);
    });

    it('should return 400 for insufficient pollutants', async () => {
      const response = await request(app)
        .get('/api/insights/correlations')
        .query({
          lat: '40.7128',
          lng: '-74.0060',
          pollutants: 'pm2.5', // Only one pollutant
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-07T00:00:00Z'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_POLLUTANTS');
    });
  });

  describe('GET /api/insights/health-impact', () => {
    const validHealthImpactResponse = {
      riskLevel: 'moderate' as const,
      affectedPopulation: 1500,
      recommendations: ['Limit outdoor activities if sensitive', 'Consider air purifiers indoors']
    };

    it('should return health impact assessment for valid parameters', async () => {
      mockInsightsEngine.assessHealthImpact.mockResolvedValue(validHealthImpactResponse);

      const response = await request(app)
        .get('/api/insights/health-impact')
        .query({
          lat: '40.7128',
          lng: '-74.0060',
          pollutant: 'pm2.5'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(validHealthImpactResponse);
    });

    it('should use default radius when not provided', async () => {
      mockInsightsEngine.assessHealthImpact.mockResolvedValue(validHealthImpactResponse);

      await request(app)
        .get('/api/insights/health-impact')
        .query({
          lat: '40.7128',
          lng: '-74.0060',
          pollutant: 'pm2.5'
        });

      expect(mockInsightsEngine.assessHealthImpact).toHaveBeenCalledWith(
        { latitude: 40.7128, longitude: -74.0060 },
        5, // Default radius
        'pm2.5'
      );
    });
  });

  describe('GET /api/insights/comprehensive', () => {
    const validComprehensiveResponse = {
      location: { latitude: 40.7128, longitude: -74.0060, radius: 5 },
      timeframe: { start: new Date('2024-01-01'), end: new Date('2024-01-07') },
      trends: [
        {
          location: { latitude: 40.7128, longitude: -74.0060, radius: 5 },
          timeframe: { start: new Date('2024-01-01'), end: new Date('2024-01-07') },
          pollutantType: 'pm2.5',
          trend: { direction: 'improving' as const, magnitude: 2.5, confidence: 0.85 },
          healthImpact: { riskLevel: 'moderate' as const, affectedPopulation: 1500, recommendations: [] }
        }
      ],
      correlations: {
        location: { latitude: 40.7128, longitude: -74.0060, radius: 5 },
        timeframe: { start: new Date('2024-01-01'), end: new Date('2024-01-07') },
        correlations: []
      },
      healthImpacts: [
        {
          pollutant: 'pm2.5',
          riskLevel: 'moderate' as const,
          affectedPopulation: 1500,
          recommendations: []
        }
      ]
    };

    it('should return comprehensive insights for valid parameters', async () => {
      mockInsightsEngine.analyzeTrend.mockResolvedValue(validComprehensiveResponse.trends[0]);
      mockInsightsEngine.analyzeCorrelations.mockResolvedValue(validComprehensiveResponse.correlations);
      mockInsightsEngine.assessHealthImpact.mockResolvedValue(validComprehensiveResponse.healthImpacts[0]);

      const response = await request(app)
        .get('/api/insights/comprehensive')
        .query({
          lat: '40.7128',
          lng: '-74.0060',
          pollutants: 'pm2.5,no2',
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-07T00:00:00Z'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.trends).toBeDefined();
      expect(response.body.data.correlations).toBeDefined();
      expect(response.body.data.healthImpacts).toBeDefined();
    });

    it('should handle partial failures gracefully', async () => {
      mockInsightsEngine.analyzeTrend.mockRejectedValue(new Error('Trend analysis failed'));
      mockInsightsEngine.analyzeCorrelations.mockResolvedValue(validComprehensiveResponse.correlations);
      mockInsightsEngine.assessHealthImpact.mockResolvedValue(validComprehensiveResponse.healthImpacts[0]);

      const response = await request(app)
        .get('/api/insights/comprehensive')
        .query({
          lat: '40.7128',
          lng: '-74.0060',
          pollutants: 'pm2.5',
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-07T00:00:00Z'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.trends[0]).toHaveProperty('error');
    });
  });
});