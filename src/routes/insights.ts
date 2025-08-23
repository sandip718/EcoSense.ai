// REST API routes for Insights Engine
// Implements requirements 3.1, 3.2, 3.3, 3.4

import { Router, Request, Response } from 'express';
import { InsightsEngine } from '../services/InsightsEngine';
import { logger } from '../utils/logger';
import { validateLocation, validateTimeRange } from '../utils/validation';
import { 
  cacheTrendAnalysis, 
  addCacheHeaders, 
  handleConditionalRequests 
} from '../middleware/cache';

const router = Router();
const insightsEngine = new InsightsEngine();

/**
 * GET /api/insights/trends
 * Analyze environmental trends for a specific location and pollutant
 * Query parameters:
 * - lat: latitude (required)
 * - lng: longitude (required)
 * - radius: radius in km (default: 5)
 * - pollutant: pollutant type (required)
 * - start: start date (ISO string, required)
 * - end: end date (ISO string, required)
 */
router.get('/trends',
  handleConditionalRequests(),
  addCacheHeaders(1800), // 30 minutes cache
  cacheTrendAnalysis({ ttl: 1800 }),
  async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lng, radius = 5, pollutant, start, end } = req.query;

    // Validate required parameters
    if (!lat || !lng || !pollutant || !start || !end) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Missing required parameters: lat, lng, pollutant, start, end'
        },
        timestamp: new Date()
      });
    }

    // Validate location
    const location = {
      latitude: parseFloat(lat as string),
      longitude: parseFloat(lng as string)
    };

    if (!validateLocation(location)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: 'Invalid latitude or longitude values'
        },
        timestamp: new Date()
      });
    }

    // Validate time range
    const timeframe = {
      start: new Date(start as string),
      end: new Date(end as string)
    };

    if (!validateTimeRange(timeframe)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TIME_RANGE',
          message: 'Invalid time range or end date before start date'
        },
        timestamp: new Date()
      });
    }

    // Validate radius
    const radiusKm = parseFloat(radius as string);
    if (isNaN(radiusKm) || radiusKm <= 0 || radiusKm > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RADIUS',
          message: 'Radius must be between 0 and 100 km'
        },
        timestamp: new Date()
      });
    }

    logger.info('Analyzing trend', { location, pollutant, timeframe, radius: radiusKm });

    const trendAnalysis = await insightsEngine.analyzeTrend(
      location,
      radiusKm,
      pollutant as string,
      timeframe
    );

    res.json({
      success: true,
      data: trendAnalysis,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error analyzing trend:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    res.status(500).json({
      success: false,
      error: {
        code: 'TREND_ANALYSIS_ERROR',
        message: errorMessage
      },
      timestamp: new Date()
    });
  }
});

/**
 * GET /api/insights/correlations
 * Analyze correlations between different pollution sources
 * Query parameters:
 * - lat: latitude (required)
 * - lng: longitude (required)
 * - radius: radius in km (default: 5)
 * - pollutants: comma-separated list of pollutants (required, min 2)
 * - start: start date (ISO string, required)
 * - end: end date (ISO string, required)
 */
router.get('/correlations', async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lng, radius = 5, pollutants, start, end } = req.query;

    // Validate required parameters
    if (!lat || !lng || !pollutants || !start || !end) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Missing required parameters: lat, lng, pollutants, start, end'
        },
        timestamp: new Date()
      });
    }

    // Validate location
    const location = {
      latitude: parseFloat(lat as string),
      longitude: parseFloat(lng as string)
    };

    if (!validateLocation(location)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: 'Invalid latitude or longitude values'
        },
        timestamp: new Date()
      });
    }

    // Parse and validate pollutants
    const pollutantList = (pollutants as string).split(',').map(p => p.trim());
    if (pollutantList.length < 2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_POLLUTANTS',
          message: 'At least two pollutants required for correlation analysis'
        },
        timestamp: new Date()
      });
    }

    // Validate time range
    const timeframe = {
      start: new Date(start as string),
      end: new Date(end as string)
    };

    if (!validateTimeRange(timeframe)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TIME_RANGE',
          message: 'Invalid time range or end date before start date'
        },
        timestamp: new Date()
      });
    }

    // Validate radius
    const radiusKm = parseFloat(radius as string);
    if (isNaN(radiusKm) || radiusKm <= 0 || radiusKm > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RADIUS',
          message: 'Radius must be between 0 and 100 km'
        },
        timestamp: new Date()
      });
    }

    logger.info('Analyzing correlations', { location, pollutants: pollutantList, timeframe, radius: radiusKm });

    const correlationAnalysis = await insightsEngine.analyzeCorrelations(
      location,
      radiusKm,
      pollutantList,
      timeframe
    );

    res.json({
      success: true,
      data: correlationAnalysis,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error analyzing correlations:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    res.status(500).json({
      success: false,
      error: {
        code: 'CORRELATION_ANALYSIS_ERROR',
        message: errorMessage
      },
      timestamp: new Date()
    });
  }
});

/**
 * GET /api/insights/health-impact
 * Assess health impact based on current pollution levels
 * Query parameters:
 * - lat: latitude (required)
 * - lng: longitude (required)
 * - radius: radius in km (default: 5)
 * - pollutant: pollutant type (required)
 */
router.get('/health-impact', async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lng, radius = 5, pollutant } = req.query;

    // Validate required parameters
    if (!lat || !lng || !pollutant) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Missing required parameters: lat, lng, pollutant'
        },
        timestamp: new Date()
      });
    }

    // Validate location
    const location = {
      latitude: parseFloat(lat as string),
      longitude: parseFloat(lng as string)
    };

    if (!validateLocation(location)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: 'Invalid latitude or longitude values'
        },
        timestamp: new Date()
      });
    }

    // Validate radius
    const radiusKm = parseFloat(radius as string);
    if (isNaN(radiusKm) || radiusKm <= 0 || radiusKm > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RADIUS',
          message: 'Radius must be between 0 and 100 km'
        },
        timestamp: new Date()
      });
    }

    logger.info('Assessing health impact', { location, pollutant, radius: radiusKm });

    const healthImpact = await insightsEngine.assessHealthImpact(
      location,
      radiusKm,
      pollutant as string
    );

    res.json({
      success: true,
      data: healthImpact,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error assessing health impact:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_IMPACT_ERROR',
        message: errorMessage
      },
      timestamp: new Date()
    });
  }
});

/**
 * GET /api/insights/comprehensive
 * Get comprehensive insights including trends, correlations, and health impact
 * Query parameters:
 * - lat: latitude (required)
 * - lng: longitude (required)
 * - radius: radius in km (default: 5)
 * - pollutants: comma-separated list of pollutants (required)
 * - start: start date (ISO string, required)
 * - end: end date (ISO string, required)
 */
router.get('/comprehensive', async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lng, radius = 5, pollutants, start, end } = req.query;

    // Validate required parameters
    if (!lat || !lng || !pollutants || !start || !end) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Missing required parameters: lat, lng, pollutants, start, end'
        },
        timestamp: new Date()
      });
    }

    // Validate location
    const location = {
      latitude: parseFloat(lat as string),
      longitude: parseFloat(lng as string)
    };

    if (!validateLocation(location)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: 'Invalid latitude or longitude values'
        },
        timestamp: new Date()
      });
    }

    // Parse pollutants
    const pollutantList = (pollutants as string).split(',').map(p => p.trim());

    // Validate time range
    const timeframe = {
      start: new Date(start as string),
      end: new Date(end as string)
    };

    if (!validateTimeRange(timeframe)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TIME_RANGE',
          message: 'Invalid time range or end date before start date'
        },
        timestamp: new Date()
      });
    }

    // Validate radius
    const radiusKm = parseFloat(radius as string);
    if (isNaN(radiusKm) || radiusKm <= 0 || radiusKm > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RADIUS',
          message: 'Radius must be between 0 and 100 km'
        },
        timestamp: new Date()
      });
    }

    logger.info('Generating comprehensive insights', { location, pollutants: pollutantList, timeframe, radius: radiusKm });

    // Run all analyses in parallel
    const promises = [];

    // Trend analysis for each pollutant
    const trendPromises = pollutantList.map(pollutant =>
      insightsEngine.analyzeTrend(location, radiusKm, pollutant, timeframe)
        .catch(error => ({ error: error.message, pollutant }))
    );

    // Correlation analysis if multiple pollutants
    let correlationPromise = null;
    if (pollutantList.length >= 2) {
      correlationPromise = insightsEngine.analyzeCorrelations(location, radiusKm, pollutantList, timeframe)
        .catch(error => ({ error: error.message }));
    }

    // Health impact for each pollutant
    const healthImpactPromises = pollutantList.map(pollutant =>
      insightsEngine.assessHealthImpact(location, radiusKm, pollutant)
        .catch(error => ({ error: error.message, pollutant }))
    );

    // Wait for all analyses to complete
    const [trends, correlations, healthImpacts] = await Promise.all([
      Promise.all(trendPromises),
      correlationPromise,
      Promise.all(healthImpactPromises)
    ]);

    res.json({
      success: true,
      data: {
        location: { ...location, radius: radiusKm },
        timeframe,
        trends,
        correlations,
        healthImpacts: healthImpacts.map((impact: any, index: number) => ({
          pollutant: pollutantList[index],
          ...impact
        }))
      },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error generating comprehensive insights:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    res.status(500).json({
      success: false,
      error: {
        code: 'COMPREHENSIVE_INSIGHTS_ERROR',
        message: errorMessage
      },
      timestamp: new Date()
    });
  }
});

export default router;