// Dashboard API Routes
// Implements requirements 5.1, 5.3, 10.2 for user dashboard data aggregation

import { Router, Request, Response } from 'express';
import { EnvironmentalDataRepository } from '../models/EnvironmentalDataRepository';
import { ImageAnalysisRepository } from '../models/ImageAnalysisRepository';
import { CommunityRecommendationRepository } from '../models/CommunityRecommendationRepository';
import { UserRepository } from '../models/UserRepository';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validateLocation } from '../utils/validation';
import { logger } from '../utils/logger';
import { ApiResponse, EnvironmentalDataQuery, ImageAnalysisQuery, RecommendationQuery } from '../models/types';
import { 
  cacheUserDashboard, 
  addCacheHeaders, 
  handleConditionalRequests 
} from '../middleware/cache';

const router = Router();
const environmentalDataRepository = new EnvironmentalDataRepository();
const imageAnalysisRepository = new ImageAnalysisRepository();
const recommendationRepository = new CommunityRecommendationRepository();
const userRepository = new UserRepository();

/**
 * GET /api/dashboard/overview
 * Get comprehensive dashboard overview for authenticated user
 * Query parameters:
 * - radius: radius in km for location-based data (optional, default: 10)
 */
router.get('/overview', 
  authenticate,
  handleConditionalRequests(),
  addCacheHeaders(600), // 10 minutes cache
  cacheUserDashboard({ ttl: 600 }),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const radius = parseFloat(req.query.radius as string) || 10;

    if (radius <= 0 || radius > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RADIUS',
          message: 'Radius must be between 0 and 100 km'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Initialize dashboard data
    const dashboardData = {
      user: {
        id: user.id,
        email: user.email,
        points: user.points,
        level: user.level,
        contribution_streak: user.contribution_streak,
        badges_count: user.badges.length,
        location: user.location
      },
      environmental_conditions: {
        current: [] as any[],
        summary: null as any,
        alerts: [] as any[]
      },
      user_contributions: {
        total_images: 0,
        recent_images: [] as any[],
        points_this_week: 0
      },
      recommendations: {
        active: [] as any[],
        priority_count: { low: 0, medium: 0, high: 0, urgent: 0 }
      },
      community_stats: {
        local_rank: null as any,
        nearby_contributors: 0
      }
    };

    // Get location-based data if user has location
    if (user.location) {
      const location = user.location;

      // Get current environmental conditions
      const environmentalQuery: EnvironmentalDataQuery = {
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          radius_km: radius
        },
        time_range: {
          start: last24Hours,
          end: now
        },
        limit: 100
      };

      const environmentalData = await environmentalDataRepository.findMany(environmentalQuery);
      
      // Group by pollutant and get latest values
      const pollutantMap = new Map();
      environmentalData.data.forEach(point => {
        const existing = pollutantMap.get(point.pollutant);
        if (!existing || point.timestamp > existing.timestamp) {
          pollutantMap.set(point.pollutant, point);
        }
      });

      dashboardData.environmental_conditions.current = Array.from(pollutantMap.values());

      // Calculate summary statistics
      if (environmentalData.data.length > 0) {
        const qualityGrades = environmentalData.data.map(p => p.quality_grade);
        const gradeCount = qualityGrades.reduce((acc, grade) => {
          acc[grade] = (acc[grade] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        dashboardData.environmental_conditions.summary = {
          total_measurements: environmentalData.data.length,
          quality_distribution: gradeCount,
          unique_pollutants: pollutantMap.size,
          data_freshness: Math.max(...environmentalData.data.map(p => p.timestamp.getTime()))
        };
      }

      // Get active recommendations for the area
      const recommendationQuery: RecommendationQuery = {
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          radius_km: radius
        },
        active_only: true,
        limit: 10
      };

      const recommendations = await recommendationRepository.findMany(recommendationQuery);
      dashboardData.recommendations.active = recommendations.data;
      
      // Count recommendations by priority
      recommendations.data.forEach(rec => {
        dashboardData.recommendations.priority_count[rec.priority]++;
      });

      // Get nearby contributors count (users within radius)
      // This is a simplified version - in production you might want to cache this
      try {
        const nearbyUsers = await userRepository.findNearby(location, radius);
        dashboardData.community_stats.nearby_contributors = nearbyUsers.length - 1; // Exclude current user
      } catch (error) {
        logger.warn('Could not fetch nearby contributors:', error);
        dashboardData.community_stats.nearby_contributors = 0;
      }
    }

    // Get user's image contributions
    const imageQuery: ImageAnalysisQuery = {
      user_id: user.id,
      time_range: {
        start: lastWeek,
        end: now
      },
      limit: 10
    };

    const userImages = await imageAnalysisRepository.findMany(imageQuery);
    dashboardData.user_contributions.recent_images = userImages.data;
    
    // Get total image count for user
    const totalImagesQuery: ImageAnalysisQuery = {
      user_id: user.id,
      limit: 1
    };
    const totalImagesResult = await imageAnalysisRepository.findMany(totalImagesQuery);
    dashboardData.user_contributions.total_images = totalImagesResult.pagination.total;

    // Calculate points earned this week (simplified - would need community actions table)
    // For now, estimate based on recent image uploads
    dashboardData.user_contributions.points_this_week = userImages.data.length * 10; // Assume 10 points per image

    logger.info('Dashboard overview generated', { 
      userId: user.id, 
      hasLocation: !!user.location,
      environmentalDataPoints: dashboardData.environmental_conditions.current.length,
      recommendations: dashboardData.recommendations.active.length
    });

    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date()
    } as ApiResponse<typeof dashboardData>);

  } catch (error) {
    logger.error('Error generating dashboard overview:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    res.status(500).json({
      success: false,
      error: {
        code: 'DASHBOARD_OVERVIEW_ERROR',
        message: errorMessage
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * GET /api/dashboard/environmental-summary
 * Get environmental data summary for user's location or specified location
 * Query parameters:
 * - lat: latitude (optional, uses user location if not provided)
 * - lng: longitude (optional, uses user location if not provided)
 * - radius: radius in km (optional, default: 10)
 * - hours: time range in hours (optional, default: 24)
 */
router.get('/environmental-summary', 
  authenticate,
  handleConditionalRequests(),
  addCacheHeaders(900), // 15 minutes cache
  cacheUserDashboard({ ttl: 900 }),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { lat, lng, radius = 10, hours = 24 } = req.query;

    let location = user.location;

    // Use provided coordinates if available
    if (lat && lng) {
      location = {
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
    }

    if (!location) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_LOCATION',
          message: 'User location not set and no coordinates provided'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

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

    const hoursBack = parseInt(hours as string);
    if (isNaN(hoursBack) || hoursBack <= 0 || hoursBack > 168) { // Max 1 week
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_HOURS',
          message: 'Hours must be between 1 and 168 (1 week)'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    const now = new Date();
    const startTime = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

    const query: EnvironmentalDataQuery = {
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        radius_km: radiusKm
      },
      time_range: {
        start: startTime,
        end: now
      },
      limit: 5000 // Large limit for comprehensive summary
    };

    const result = await environmentalDataRepository.findMany(query);
    const data = result.data;

    // Calculate comprehensive summary
    const summary = {
      location: { ...location, radius: radiusKm },
      timeframe: { start: startTime, end: now, hours: hoursBack },
      total_measurements: data.length,
      data_sources: Array.from(new Set(data.map(d => d.source))),
      pollutants: {} as Record<string, {
        count: number;
        latest: { value: number; timestamp: Date; quality_grade: string };
        statistics: {
          min: number;
          max: number;
          avg: number;
          median: number;
        };
        quality_distribution: Record<string, number>;
        trend: 'improving' | 'worsening' | 'stable' | 'insufficient_data';
      }>,
      overall_quality: {
        current_grade: 'unknown' as string,
        grade_distribution: { A: 0, B: 0, C: 0, D: 0 },
        quality_score: 0 // 0-100 scale
      }
    };

    if (data.length === 0) {
      return res.json({
        success: true,
        data: {
          ...summary,
          message: 'No environmental data found for the specified location and time range'
        },
        timestamp: new Date()
      } as ApiResponse<typeof summary>);
    }

    // Group by pollutant and calculate statistics
    const pollutantGroups = data.reduce((groups, point) => {
      if (!groups[point.pollutant]) {
        groups[point.pollutant] = [];
      }
      groups[point.pollutant].push(point);
      return groups;
    }, {} as Record<string, typeof data>);

    Object.entries(pollutantGroups).forEach(([pollutant, points]) => {
      // Sort by timestamp
      points.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      const values = points.map(p => p.value);
      const sortedValues = [...values].sort((a, b) => a - b);
      
      const latest = points[0];
      const qualityDist = points.reduce((acc, p) => {
        acc[p.quality_grade] = (acc[p.quality_grade] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Simple trend calculation (compare first and last quartile)
      let trend: 'improving' | 'worsening' | 'stable' | 'insufficient_data' = 'insufficient_data';
      if (points.length >= 4) {
        const quartileSize = Math.floor(points.length / 4);
        const recentAvg = points.slice(0, quartileSize).reduce((sum, p) => sum + p.value, 0) / quartileSize;
        const olderAvg = points.slice(-quartileSize).reduce((sum, p) => sum + p.value, 0) / quartileSize;
        const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;
        
        if (Math.abs(changePercent) < 5) {
          trend = 'stable';
        } else if (changePercent < 0) {
          trend = 'improving'; // Lower pollution is better
        } else {
          trend = 'worsening';
        }
      }

      summary.pollutants[pollutant] = {
        count: points.length,
        latest: {
          value: latest.value,
          timestamp: latest.timestamp,
          quality_grade: latest.quality_grade
        },
        statistics: {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((sum, v) => sum + v, 0) / values.length,
          median: sortedValues[Math.floor(sortedValues.length / 2)]
        },
        quality_distribution: qualityDist,
        trend
      };
    });

    // Calculate overall quality
    const allGrades = data.map(d => d.quality_grade);
    summary.overall_quality.grade_distribution = allGrades.reduce((acc, grade) => {
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, { A: 0, B: 0, C: 0, D: 0 });

    // Determine current overall grade (most recent data points)
    const recentData = data.slice(0, Math.min(10, data.length));
    const recentGrades = recentData.map(d => d.quality_grade);
    const gradeWeights = { A: 4, B: 3, C: 2, D: 1 };
    const avgGradeWeight = recentGrades.reduce((sum, grade) => sum + gradeWeights[grade], 0) / recentGrades.length;
    
    if (avgGradeWeight >= 3.5) summary.overall_quality.current_grade = 'A';
    else if (avgGradeWeight >= 2.5) summary.overall_quality.current_grade = 'B';
    else if (avgGradeWeight >= 1.5) summary.overall_quality.current_grade = 'C';
    else summary.overall_quality.current_grade = 'D';

    summary.overall_quality.quality_score = Math.round((avgGradeWeight / 4) * 100);

    logger.info('Environmental summary generated', { 
      userId: user.id, 
      location, 
      dataPoints: data.length,
      pollutants: Object.keys(summary.pollutants).length
    });

    res.json({
      success: true,
      data: summary,
      timestamp: new Date()
    } as ApiResponse<typeof summary>);

  } catch (error) {
    logger.error('Error generating environmental summary:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    res.status(500).json({
      success: false,
      error: {
        code: 'ENVIRONMENTAL_SUMMARY_ERROR',
        message: errorMessage
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * GET /api/dashboard/user-activity
 * Get user's recent activity and contributions
 * Query parameters:
 * - days: number of days to look back (optional, default: 30, max: 365)
 * - limit: number of activities to return (optional, default: 50, max: 200)
 */
router.get('/user-activity', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const days = Math.min(parseInt(req.query.days as string) || 30, 365);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const now = new Date();
    const startTime = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Get user's image analyses
    const imageQuery: ImageAnalysisQuery = {
      user_id: user.id,
      time_range: {
        start: startTime,
        end: now
      },
      limit: limit
    };

    const userImages = await imageAnalysisRepository.findMany(imageQuery);

    // Transform to activity format
    const activities = userImages.data.map(image => ({
      id: image.id,
      type: 'image_analysis',
      timestamp: image.upload_timestamp,
      data: {
        image_url: image.image_url,
        status: image.status,
        location: image.location,
        overall_score: image.overall_score
      },
      points_earned: image.status === 'completed' ? 10 : 0 // Estimate points
    }));

    // Sort by timestamp (most recent first)
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Calculate summary statistics
    const summary = {
      total_activities: activities.length,
      points_earned: activities.reduce((sum, activity) => sum + activity.points_earned, 0),
      activity_types: {
        image_analysis: activities.filter(a => a.type === 'image_analysis').length
      },
      recent_streak: user.contribution_streak,
      timeframe: {
        start: startTime,
        end: now,
        days: days
      }
    };

    logger.info('User activity retrieved', { 
      userId: user.id, 
      activities: activities.length,
      days: days
    });

    res.json({
      success: true,
      data: {
        activities: activities.slice(0, limit),
        summary,
        pagination: {
          total: activities.length,
          limit: limit,
          has_more: activities.length > limit
        }
      },
      timestamp: new Date()
    } as ApiResponse<any>);

  } catch (error) {
    logger.error('Error retrieving user activity:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_ACTIVITY_ERROR',
        message: errorMessage
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

export default router;