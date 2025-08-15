// Gamification routes for points, badges, and leaderboards
// Implements requirements 9.3, 9.4 for points/badge system and leaderboards

import { Router, Request, Response } from 'express';
import { GamificationService, LeaderboardQuery } from '../services/GamificationService';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import Joi from 'joi';

const router = Router();
const gamificationService = new GamificationService();

// Validation schemas
const leaderboardQuerySchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  radius_km: Joi.number().min(0.1).max(1000).optional(),
  timeframe: Joi.string().valid('all_time', 'monthly', 'weekly').default('all_time'),
  limit: Joi.number().min(1).max(100).default(50),
  offset: Joi.number().min(0).default(0)
});

const awardPointsSchema = Joi.object({
  actionType: Joi.string().required(),
  basePoints: Joi.number().min(1).max(1000).required()
});

/**
 * GET /gamification/leaderboard
 * Get leaderboard with optional location filtering
 */
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const { error, value } = leaderboardQuerySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const query: LeaderboardQuery = {
      timeframe: value.timeframe,
      limit: value.limit,
      offset: value.offset
    };

    // Add location filter if coordinates provided
    if (value.latitude && value.longitude) {
      query.location = {
        latitude: value.latitude,
        longitude: value.longitude,
        radius_km: value.radius_km || 10 // Default 10km radius
      };
    }

    const leaderboard = await gamificationService.getLeaderboard(query);

    res.json({
      success: true,
      data: {
        leaderboard,
        query: {
          timeframe: query.timeframe,
          location: query.location,
          limit: query.limit,
          offset: query.offset
        }
      },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Leaderboard error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'LEADERBOARD_FETCH_FAILED',
        message: 'Failed to retrieve leaderboard'
      },
      timestamp: new Date()
    });
  }
});

/**
 * GET /gamification/my-rank
 * Get current user's rank in leaderboard
 */
router.get('/my-rank', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { latitude, longitude, radius_km } = req.query;
    
    let location;
    if (latitude && longitude) {
      location = {
        latitude: parseFloat(latitude as string),
        longitude: parseFloat(longitude as string),
        radius_km: radius_km ? parseFloat(radius_km as string) : 10
      };
    }

    const rank = await gamificationService.getUserRank(req.user.id, location);

    res.json({
      success: true,
      data: {
        rank,
        location: location || null
      },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('User rank error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'RANK_FETCH_FAILED',
        message: 'Failed to retrieve user rank'
      },
      timestamp: new Date()
    });
  }
});

/**
 * GET /gamification/badges
 * Get available badges and user's progress
 */
router.get('/badges', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const badgeProgress = await gamificationService.getBadgeProgress(req.user.id);

    res.json({
      success: true,
      data: {
        badges: badgeProgress,
        earned_count: badgeProgress.filter(b => b.earned).length,
        total_count: badgeProgress.length
      },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Badge progress error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'BADGE_FETCH_FAILED',
        message: 'Failed to retrieve badge progress'
      },
      timestamp: new Date()
    });
  }
});

/**
 * POST /gamification/award-points
 * Award points for a community action (internal use)
 */
router.post('/award-points', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate request body
    const { error, value } = awardPointsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const { actionType, basePoints } = value;
    
    // Update contribution streak
    const newStreak = await gamificationService.updateContributionStreak(req.user.id);
    
    // Award points and check for badges/level ups
    const reward = await gamificationService.awardPoints(req.user.id, actionType, basePoints);

    res.json({
      success: true,
      data: {
        ...reward,
        new_streak: newStreak
      },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Award points error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'AWARD_POINTS_FAILED',
        message: error.message
      },
      timestamp: new Date()
    });
  }
});

/**
 * GET /gamification/stats
 * Get user's gamification statistics
 */
router.get('/stats', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const badgeProgress = await gamificationService.getBadgeProgress(user.id);
    const globalRank = await gamificationService.getUserRank(user.id);
    
    let localRank = null;
    if (user.location) {
      localRank = await gamificationService.getUserRank(user.id, {
        latitude: user.location.latitude,
        longitude: user.location.longitude,
        radius_km: 50 // 50km radius for local ranking
      });
    }

    const earnedBadges = badgeProgress.filter(b => b.earned);
    const nextBadges = badgeProgress
      .filter(b => !b.earned && b.progress !== undefined && b.progress > 0)
      .sort((a, b) => (b.progress || 0) - (a.progress || 0))
      .slice(0, 3);

    res.json({
      success: true,
      data: {
        user_stats: {
          points: user.points,
          level: user.level,
          contribution_streak: user.contribution_streak,
          badges_earned: earnedBadges.length,
          total_badges: badgeProgress.length
        },
        rankings: {
          global_rank: globalRank,
          local_rank: localRank
        },
        recent_badges: earnedBadges.slice(-5), // Last 5 earned badges
        next_badges: nextBadges // Next badges to earn
      },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Gamification stats error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'STATS_FETCH_FAILED',
        message: 'Failed to retrieve gamification statistics'
      },
      timestamp: new Date()
    });
  }
});

/**
 * GET /gamification/leaderboard/local
 * Get local leaderboard based on user's location
 */
router.get('/leaderboard/local', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    
    if (!user.location) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_LOCATION',
          message: 'User location is required for local leaderboard'
        }
      });
    }

    const { radius_km = 50, timeframe = 'all_time', limit = 50, offset = 0 } = req.query;

    const query: LeaderboardQuery = {
      location: {
        latitude: user.location.latitude,
        longitude: user.location.longitude,
        radius_km: parseFloat(radius_km as string)
      },
      timeframe: timeframe as 'all_time' | 'monthly' | 'weekly',
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };

    const leaderboard = await gamificationService.getLeaderboard(query);
    const userRank = await gamificationService.getUserRank(user.id, query.location);

    res.json({
      success: true,
      data: {
        leaderboard,
        user_rank: userRank,
        query: {
          center: query.location,
          timeframe: query.timeframe,
          limit: query.limit,
          offset: query.offset
        }
      },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Local leaderboard error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'LOCAL_LEADERBOARD_FAILED',
        message: 'Failed to retrieve local leaderboard'
      },
      timestamp: new Date()
    });
  }
});

export default router;