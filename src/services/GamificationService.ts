// Gamification service for points, badges, and community engagement
// Implements requirements 9.3, 9.4 for points/badge system and leaderboards

import { UserRepository } from '../models/UserRepository';
import { UserProfile, CommunityAction, Location } from '../models/types';
import { logger } from '../utils/logger';
import { Pool } from 'pg';
import { getDatabase } from '../config/database';

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteria: {
    type: 'points' | 'actions' | 'streak' | 'special';
    threshold?: number;
    action_types?: string[];
    special_condition?: string;
  };
}

export interface LeaderboardEntry {
  user_id: string;
  email: string;
  points: number;
  level: number;
  badges: string[];
  contribution_streak: number;
  rank: number;
  location?: Location;
}

export interface LeaderboardQuery {
  location?: {
    latitude: number;
    longitude: number;
    radius_km: number;
  };
  timeframe?: 'all_time' | 'monthly' | 'weekly';
  limit?: number;
  offset?: number;
}

export interface ActionReward {
  points: number;
  badges: string[];
  level_up: boolean;
  previous_level: number;
  new_level: number;
}

export class GamificationService {
  private userRepository: UserRepository;
  private db: Pool;
  private badges: BadgeDefinition[];

  constructor() {
    this.userRepository = new UserRepository();
    this.db = getDatabase();
    this.badges = this.initializeBadges();
  }

  /**
   * Award points for a community action and check for badges/level ups
   * @param userId User ID
   * @param actionType Type of action performed
   * @param basePoints Base points for the action
   * @returns Reward information
   */
  async awardPoints(userId: string, actionType: string, basePoints: number): Promise<ActionReward> {
    try {
      // Get current user data
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const previousLevel = user.level;
      
      // Calculate bonus points based on streak and level
      const bonusMultiplier = this.calculateBonusMultiplier(user.contribution_streak, user.level);
      const totalPoints = Math.floor(basePoints * bonusMultiplier);

      // Add points to user
      const updatedUser = await this.userRepository.addPoints(userId, totalPoints);
      if (!updatedUser) {
        throw new Error('Failed to update user points');
      }

      // Check for new badges
      const newBadges = await this.checkForNewBadges(userId, actionType, updatedUser);
      
      // Award new badges
      for (const badge of newBadges) {
        await this.userRepository.addBadge(userId, badge.id);
      }

      const levelUp = updatedUser.level > previousLevel;

      logger.info(`Awarded ${totalPoints} points to user ${userId} for action ${actionType}`);

      return {
        points: totalPoints,
        badges: newBadges.map(b => b.id),
        level_up: levelUp,
        previous_level: previousLevel,
        new_level: updatedUser.level
      };
    } catch (error) {
      logger.error('Error awarding points:', error);
      throw error;
    }
  }

  /**
   * Update user's contribution streak
   * @param userId User ID
   * @param actionDate Date of the action
   * @returns Updated streak count
   */
  async updateContributionStreak(userId: string, actionDate: Date = new Date()): Promise<number> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get user's last action date
      const lastActionDate = await this.getLastActionDate(userId);
      const newStreak = this.calculateNewStreak(lastActionDate, actionDate, user.contribution_streak);

      // Update streak
      await this.userRepository.updateContributionStreak(userId, newStreak);

      logger.info(`Updated contribution streak for user ${userId}: ${newStreak}`);
      return newStreak;
    } catch (error) {
      logger.error('Error updating contribution streak:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard with optional location filtering
   * @param query Leaderboard query parameters
   * @returns Leaderboard entries
   */
  async getLeaderboard(query: LeaderboardQuery = {}): Promise<LeaderboardEntry[]> {
    const client = await this.db.connect();
    
    try {
      let whereClause = '';
      let joinClause = '';
      const values: any[] = [];
      let paramIndex = 1;

      // Add location filtering if specified
      if (query.location) {
        whereClause = `WHERE ST_DWithin(
          u.location::geography, 
          ST_SetSRID(ST_Point($${paramIndex}, $${paramIndex + 1}), 4326)::geography, 
          $${paramIndex + 2}
        )`;
        values.push(query.location.longitude, query.location.latitude, query.location.radius_km * 1000);
        paramIndex += 3;
      }

      // Add timeframe filtering for points calculation
      if (query.timeframe && query.timeframe !== 'all_time') {
        const timeframeClause = query.timeframe === 'monthly' 
          ? "ca.timestamp >= NOW() - INTERVAL '30 days'"
          : "ca.timestamp >= NOW() - INTERVAL '7 days'";
        
        joinClause = `
          LEFT JOIN (
            SELECT user_id, SUM(points_earned) as period_points
            FROM community_actions ca
            WHERE ${timeframeClause}
            GROUP BY user_id
          ) period_points ON u.id = period_points.user_id
        `;
        
        // Use period points for ranking if timeframe is specified
        const orderBy = 'COALESCE(period_points.period_points, 0) DESC';
      }

      const limit = query.limit || 50;
      const offset = query.offset || 0;

      const sql = `
        SELECT 
          u.id as user_id,
          u.email,
          ${query.timeframe && query.timeframe !== 'all_time' 
            ? 'COALESCE(period_points.period_points, 0) as points' 
            : 'u.points'
          },
          u.level,
          u.badges,
          u.contribution_streak,
          ST_AsText(u.location) as location,
          ROW_NUMBER() OVER (ORDER BY ${
            query.timeframe && query.timeframe !== 'all_time' 
              ? 'COALESCE(period_points.period_points, 0) DESC' 
              : 'u.points DESC'
          }) as rank
        FROM users u
        ${joinClause}
        ${whereClause}
        ORDER BY ${
          query.timeframe && query.timeframe !== 'all_time' 
            ? 'COALESCE(period_points.period_points, 0) DESC' 
            : 'u.points DESC'
        }
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);

      const result = await client.query(sql, values);

      return result.rows.map(row => ({
        user_id: row.user_id,
        email: row.email,
        points: parseInt(row.points),
        level: row.level,
        badges: row.badges,
        contribution_streak: row.contribution_streak,
        rank: parseInt(row.rank),
        location: row.location ? this.parseLocation(row.location) : undefined
      }));
    } catch (error) {
      logger.error('Error getting leaderboard:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user's rank in leaderboard
   * @param userId User ID
   * @param location Optional location for local ranking
   * @returns User's rank
   */
  async getUserRank(userId: string, location?: { latitude: number; longitude: number; radius_km: number }): Promise<number> {
    const client = await this.db.connect();
    
    try {
      let whereClause = '';
      const values: any[] = [userId];
      let paramIndex = 2;

      if (location) {
        whereClause = `AND ST_DWithin(
          u.location::geography, 
          ST_SetSRID(ST_Point($${paramIndex}, $${paramIndex + 1}), 4326)::geography, 
          $${paramIndex + 2}
        )`;
        values.push(location.longitude, location.latitude, location.radius_km * 1000);
      }

      const sql = `
        SELECT COUNT(*) + 1 as rank
        FROM users u
        WHERE u.points > (SELECT points FROM users WHERE id = $1)
        ${whereClause}
      `;

      const result = await client.query(sql, values);
      return parseInt(result.rows[0].rank);
    } catch (error) {
      logger.error('Error getting user rank:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get available badges and user's progress
   * @param userId User ID
   * @returns Badge definitions with user progress
   */
  async getBadgeProgress(userId: string): Promise<Array<BadgeDefinition & { earned: boolean; progress?: number }>> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const userActions = await this.getUserActionStats(userId);

      return this.badges.map(badge => {
        const earned = user.badges.includes(badge.id);
        let progress = 0;

        if (!earned && badge.criteria.threshold) {
          switch (badge.criteria.type) {
            case 'points':
              progress = Math.min(100, (user.points / badge.criteria.threshold) * 100);
              break;
            case 'actions':
              const actionCount = badge.criteria.action_types
                ? badge.criteria.action_types.reduce((sum, type) => sum + (userActions[type] || 0), 0)
                : Object.values(userActions).reduce((sum, count) => sum + count, 0);
              progress = Math.min(100, (actionCount / badge.criteria.threshold) * 100);
              break;
            case 'streak':
              progress = Math.min(100, (user.contribution_streak / badge.criteria.threshold) * 100);
              break;
          }
        }

        return {
          ...badge,
          earned,
          progress: earned ? 100 : progress
        };
      });
    } catch (error) {
      logger.error('Error getting badge progress:', error);
      throw error;
    }
  }

  /**
   * Initialize badge definitions
   * @returns Array of badge definitions
   */
  private initializeBadges(): BadgeDefinition[] {
    return [
      {
        id: 'first_contribution',
        name: 'First Contribution',
        description: 'Made your first environmental contribution',
        icon: '🌱',
        criteria: { type: 'actions', threshold: 1 }
      },
      {
        id: 'photo_enthusiast',
        name: 'Photo Enthusiast',
        description: 'Uploaded 10 environmental photos',
        icon: '📸',
        criteria: { type: 'actions', threshold: 10, action_types: ['photo_upload'] }
      },
      {
        id: 'data_collector',
        name: 'Data Collector',
        description: 'Contributed 50 data points',
        icon: '📊',
        criteria: { type: 'actions', threshold: 50 }
      },
      {
        id: 'streak_master',
        name: 'Streak Master',
        description: 'Maintained a 7-day contribution streak',
        icon: '🔥',
        criteria: { type: 'streak', threshold: 7 }
      },
      {
        id: 'point_collector',
        name: 'Point Collector',
        description: 'Earned 1000 points',
        icon: '⭐',
        criteria: { type: 'points', threshold: 1000 }
      },
      {
        id: 'environmental_champion',
        name: 'Environmental Champion',
        description: 'Earned 10000 points',
        icon: '🏆',
        criteria: { type: 'points', threshold: 10000 }
      },
      {
        id: 'community_leader',
        name: 'Community Leader',
        description: 'Maintained a 30-day contribution streak',
        icon: '👑',
        criteria: { type: 'streak', threshold: 30 }
      }
    ];
  }

  /**
   * Check for new badges earned by user
   * @param userId User ID
   * @param actionType Action type performed
   * @param user Updated user profile
   * @returns Array of newly earned badges
   */
  private async checkForNewBadges(userId: string, actionType: string, user: UserProfile): Promise<BadgeDefinition[]> {
    const newBadges: BadgeDefinition[] = [];
    const userActions = await this.getUserActionStats(userId);

    for (const badge of this.badges) {
      // Skip if user already has this badge
      if (user.badges.includes(badge.id)) {
        continue;
      }

      let earned = false;

      switch (badge.criteria.type) {
        case 'points':
          earned = user.points >= (badge.criteria.threshold || 0);
          break;
        case 'actions':
          const actionCount = badge.criteria.action_types
            ? badge.criteria.action_types.reduce((sum, type) => sum + (userActions[type] || 0), 0)
            : Object.values(userActions).reduce((sum, count) => sum + count, 0);
          earned = actionCount >= (badge.criteria.threshold || 0);
          break;
        case 'streak':
          earned = user.contribution_streak >= (badge.criteria.threshold || 0);
          break;
        case 'special':
          // Handle special conditions here
          break;
      }

      if (earned) {
        newBadges.push(badge);
      }
    }

    return newBadges;
  }

  /**
   * Calculate bonus multiplier based on streak and level
   * @param streak Current contribution streak
   * @param level User level
   * @returns Bonus multiplier
   */
  private calculateBonusMultiplier(streak: number, level: number): number {
    const streakBonus = Math.min(0.5, streak * 0.05); // Max 50% bonus from streak
    const levelBonus = Math.min(0.3, (level - 1) * 0.02); // Max 30% bonus from level
    return 1 + streakBonus + levelBonus;
  }

  /**
   * Get user's last action date
   * @param userId User ID
   * @returns Last action date or null
   */
  private async getLastActionDate(userId: string): Promise<Date | null> {
    const client = await this.db.connect();
    
    try {
      const result = await client.query(
        'SELECT MAX(timestamp) as last_action FROM community_actions WHERE user_id = $1',
        [userId]
      );
      
      return result.rows[0].last_action;
    } catch (error) {
      logger.error('Error getting last action date:', error);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Calculate new contribution streak
   * @param lastActionDate Last action date
   * @param currentActionDate Current action date
   * @param currentStreak Current streak
   * @returns New streak count
   */
  private calculateNewStreak(lastActionDate: Date | null, currentActionDate: Date, currentStreak: number): number {
    if (!lastActionDate) {
      return 1; // First action
    }

    const daysDiff = Math.floor((currentActionDate.getTime() - lastActionDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      return currentStreak; // Same day, no change
    } else if (daysDiff === 1) {
      return currentStreak + 1; // Consecutive day
    } else {
      return 1; // Streak broken, start over
    }
  }

  /**
   * Get user's action statistics
   * @param userId User ID
   * @returns Action type counts
   */
  private async getUserActionStats(userId: string): Promise<Record<string, number>> {
    const client = await this.db.connect();
    
    try {
      const result = await client.query(
        'SELECT action_type, COUNT(*) as count FROM community_actions WHERE user_id = $1 GROUP BY action_type',
        [userId]
      );
      
      const stats: Record<string, number> = {};
      result.rows.forEach(row => {
        stats[row.action_type] = parseInt(row.count);
      });
      
      return stats;
    } catch (error) {
      logger.error('Error getting user action stats:', error);
      return {};
    } finally {
      client.release();
    }
  }

  /**
   * Parse PostGIS location string to Location object
   * @param locationString PostGIS location string
   * @returns Location object
   */
  private parseLocation(locationString: string): Location {
    // Parse "POINT(longitude latitude)" format
    const match = locationString.match(/POINT\(([^)]+)\)/);
    if (match) {
      const [longitude, latitude] = match[1].split(' ').map(Number);
      return { latitude, longitude };
    }
    throw new Error('Invalid location format');
  }
}