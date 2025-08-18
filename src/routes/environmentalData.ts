// Environmental Data API Routes
// Implements requirements 5.1, 5.3 for environmental data queries with geospatial filtering

import { Router, Request, Response } from 'express';
import { EnvironmentalDataRepository } from '../models/EnvironmentalDataRepository';
import { validateLocation, validateTimeRange } from '../utils/validation';
import { logger } from '../utils/logger';
import { ApiResponse, EnvironmentalDataQuery, PaginatedResponse, EnvironmentalDataPoint } from '../models/types';

const router = Router();
const environmentalDataRepository = new EnvironmentalDataRepository();

/**
 * GET /api/environmental-data
 * Get environmental data with optional geospatial and temporal filtering
 * Query parameters:
 * - lat: latitude (optional)
 * - lng: longitude (optional)
 * - radius: radius in km (optional, default: 10)
 * - pollutant: pollutant type (optional)
 * - source: data source (optional)
 * - start: start date (ISO string, optional)
 * - end: end date (ISO string, optional)
 * - quality_grade: quality grades (optional, comma-separated: A,B,C,D)
 * - limit: number of results (optional, default: 50, max: 1000)
 * - offset: pagination offset (optional, default: 0)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      lat,
      lng,
      radius = 10,
      pollutant,
      source,
      start,
      end,
      quality_grade,
      limit = 50,
      offset = 0
    } = req.query;

    // Build query object
    const query: EnvironmentalDataQuery = {
      limit: Math.min(parseInt(limit as string) || 50, 1000),
      offset: parseInt(offset as string) || 0
    };

    // Add location filter if coordinates provided
    if (lat && lng) {
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
        } as ApiResponse<null>);
      }

      const radiusKm = parseFloat(radius as string);
      if (isNaN(radiusKm) || radiusKm <= 0 || radiusKm > 1000) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_RADIUS',
            message: 'Radius must be between 0 and 1000 km'
          },
          timestamp: new Date()
        } as ApiResponse<null>);
      }

      query.location = {
        latitude: location.latitude,
        longitude: location.longitude,
        radius_km: radiusKm
      };
    }

    // Add pollutant filter
    if (pollutant) {
      query.pollutant = pollutant as string;
    }

    // Add source filter
    if (source) {
      const validSources = ['openaq', 'water_quality_portal', 'local_sensor'];
      if (!validSources.includes(source as string)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SOURCE',
            message: `Source must be one of: ${validSources.join(', ')}`
          },
          timestamp: new Date()
        } as ApiResponse<null>);
      }
      query.source = source as 'openaq' | 'water_quality_portal' | 'local_sensor';
    }

    // Add time range filter
    if (start || end) {
      const timeframe: any = {};
      
      if (start) {
        timeframe.start = new Date(start as string);
        if (isNaN(timeframe.start.getTime())) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_START_DATE',
              message: 'Invalid start date format'
            },
            timestamp: new Date()
          } as ApiResponse<null>);
        }
      }

      if (end) {
        timeframe.end = new Date(end as string);
        if (isNaN(timeframe.end.getTime())) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_END_DATE',
              message: 'Invalid end date format'
            },
            timestamp: new Date()
          } as ApiResponse<null>);
        }
      }

      if (timeframe.start && timeframe.end && !validateTimeRange(timeframe)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TIME_RANGE',
            message: 'End date must be after start date'
          },
          timestamp: new Date()
        } as ApiResponse<null>);
      }

      query.time_range = timeframe;
    }

    // Add quality grade filter
    if (quality_grade) {
      const grades = (quality_grade as string).split(',').map(g => g.trim().toUpperCase());
      const validGrades = ['A', 'B', 'C', 'D'];
      
      for (const grade of grades) {
        if (!validGrades.includes(grade)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_QUALITY_GRADE',
              message: `Quality grade must be one of: ${validGrades.join(', ')}`
            },
            timestamp: new Date()
          } as ApiResponse<null>);
        }
      }
      
      query.quality_grade = grades as ('A' | 'B' | 'C' | 'D')[];
    }

    logger.info('Querying environmental data', { query });

    const result = await environmentalDataRepository.findMany(query);

    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    } as ApiResponse<PaginatedResponse<EnvironmentalDataPoint>>);

  } catch (error) {
    logger.error('Error querying environmental data:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    res.status(500).json({
      success: false,
      error: {
        code: 'ENVIRONMENTAL_DATA_QUERY_ERROR',
        message: errorMessage
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * GET /api/environmental-data/latest
 * Get latest environmental data for a location and pollutant
 * Query parameters:
 * - lat: latitude (required)
 * - lng: longitude (required)
 * - radius: radius in km (optional, default: 5)
 * - pollutant: pollutant type (required)
 */
router.get('/latest', async (req: Request, res: Response): Promise<void> => {
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
      } as ApiResponse<null>);
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
      } as ApiResponse<null>);
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
      } as ApiResponse<null>);
    }

    logger.info('Getting latest environmental data', { location, pollutant, radius: radiusKm });

    const latestData = await environmentalDataRepository.findLatestByLocation(
      location,
      radiusKm,
      pollutant as string
    );

    if (!latestData) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_DATA_FOUND',
          message: 'No environmental data found for the specified location and pollutant'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    res.json({
      success: true,
      data: latestData,
      timestamp: new Date()
    } as ApiResponse<EnvironmentalDataPoint>);

  } catch (error) {
    logger.error('Error getting latest environmental data:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    res.status(500).json({
      success: false,
      error: {
        code: 'LATEST_DATA_ERROR',
        message: errorMessage
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * GET /api/environmental-data/summary
 * Get summary statistics for environmental data in a location
 * Query parameters:
 * - lat: latitude (required)
 * - lng: longitude (required)
 * - radius: radius in km (optional, default: 10)
 * - start: start date (ISO string, optional, default: 24 hours ago)
 * - end: end date (ISO string, optional, default: now)
 */
router.get('/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const { lat, lng, radius = 10, start, end } = req.query;

    // Validate required parameters
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Missing required parameters: lat, lng'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
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
      } as ApiResponse<null>);
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
      } as ApiResponse<null>);
    }

    // Set default time range (last 24 hours)
    const endTime = end ? new Date(end as string) : new Date();
    const startTime = start ? new Date(start as string) : new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DATE_FORMAT',
          message: 'Invalid date format'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    const timeframe = { start: startTime, end: endTime };
    if (!validateTimeRange(timeframe)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TIME_RANGE',
          message: 'End date must be after start date'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    logger.info('Getting environmental data summary', { location, radius: radiusKm, timeframe });

    // Query all data for the location and time range
    const query: EnvironmentalDataQuery = {
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        radius_km: radiusKm
      },
      time_range: timeframe,
      limit: 10000 // Large limit to get all data for summary
    };

    const result = await environmentalDataRepository.findMany(query);
    const data = result.data;

    // Calculate summary statistics
    const summary = {
      location: { ...location, radius: radiusKm },
      timeframe,
      total_measurements: data.length,
      pollutants: {} as Record<string, {
        count: number;
        latest_value: number;
        latest_timestamp: Date;
        avg_value: number;
        min_value: number;
        max_value: number;
        quality_distribution: Record<string, number>;
        sources: string[];
      }>
    };

    // Group by pollutant and calculate statistics
    data.forEach(point => {
      if (!summary.pollutants[point.pollutant]) {
        summary.pollutants[point.pollutant] = {
          count: 0,
          latest_value: point.value,
          latest_timestamp: point.timestamp,
          avg_value: 0,
          min_value: point.value,
          max_value: point.value,
          quality_distribution: { A: 0, B: 0, C: 0, D: 0 },
          sources: []
        };
      }

      const pollutantSummary = summary.pollutants[point.pollutant];
      pollutantSummary.count++;
      pollutantSummary.quality_distribution[point.quality_grade]++;
      
      if (point.timestamp > pollutantSummary.latest_timestamp) {
        pollutantSummary.latest_value = point.value;
        pollutantSummary.latest_timestamp = point.timestamp;
      }
      
      pollutantSummary.min_value = Math.min(pollutantSummary.min_value, point.value);
      pollutantSummary.max_value = Math.max(pollutantSummary.max_value, point.value);
      
      if (!pollutantSummary.sources.includes(point.source)) {
        pollutantSummary.sources.push(point.source);
      }
    });

    // Calculate averages
    Object.keys(summary.pollutants).forEach(pollutant => {
      const pollutantData = data.filter(p => p.pollutant === pollutant);
      const sum = pollutantData.reduce((acc, p) => acc + p.value, 0);
      summary.pollutants[pollutant].avg_value = sum / pollutantData.length;
    });

    res.json({
      success: true,
      data: summary,
      timestamp: new Date()
    } as ApiResponse<typeof summary>);

  } catch (error) {
    logger.error('Error getting environmental data summary:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    res.status(500).json({
      success: false,
      error: {
        code: 'SUMMARY_ERROR',
        message: errorMessage
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * GET /api/environmental-data/:id
 * Get a specific environmental data point by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Valid environmental data ID is required'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    const dataPoint = await environmentalDataRepository.findById(id);

    if (!dataPoint) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DATA_POINT_NOT_FOUND',
          message: 'Environmental data point not found'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    res.json({
      success: true,
      data: dataPoint,
      timestamp: new Date()
    } as ApiResponse<EnvironmentalDataPoint>);

  } catch (error) {
    logger.error('Error retrieving environmental data point:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'ENVIRONMENTAL_DATA_FETCH_ERROR',
        message: 'Failed to retrieve environmental data point'
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

export default router;