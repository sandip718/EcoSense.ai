// Repository for community action CRUD operations
// Implements community contribution tracking for gamification

import { Pool } from 'pg';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';
import {
  CommunityAction,
  CreateCommunityAction,
  Location
} from './types';
import { locationToPostGIS, postGISToLocation } from '../utils/geometry';

export interface CommunityActionQuery {
  user_id?: string;
  action_type?: string;
  location?: {
    latitude: number;
    longitude: number;
    radius_km: number;
  };
  time_range?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  offset?: number;
}

export class CommunityActionRepository {
  private db: Pool;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Create a new community action
   * @param actionData Community action data
   * @returns Created community action
   */
  async create(actionData: CreateCommunityAction): Promise<CommunityAction> {
    const client = await this.db.connect();
    
    try {
      const query = `
        INSERT INTO community_actions (
          user_id, action_type, location, timestamp, points_earned, impact_description, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, user_id, action_type, ST_AsText(location) as location, 
                  timestamp, points_earned, impact_description, metadata, created_at
      `;

      const values = [
        actionData.user_id,
        actionData.action_type,
        actionData.location ? `ST_SetSRID(ST_GeomFromText('${locationToPostGIS(actionData.location)}'), 4326)` : null,
        actionData.timestamp,
        actionData.points_earned || 0,
        actionData.impact_description,
        JSON.stringify(actionData.metadata || {})
      ];

      const result = await client.query(query, values);
      const row = result.rows[0];

      return this.mapDatabaseToModel(row);
    } catch (error) {
      logger.error('Error creating community action:', error);
      throw new Error('Failed to create community action');
    } finally {
      client.release();
    }
  }

  /**
   * Find community action by ID
   * @param id Action ID
   * @returns Community action or null if not found
   */
  async findById(id: string): Promise<CommunityAction | null> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT id, user_id, action_type, ST_AsText(location) as location, 
               timestamp, points_earned, impact_description, metadata, created_at
        FROM community_actions 
        WHERE id = $1
      `;

      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDatabaseToModel(result.rows[0]);
    } catch (error) {
      logger.error('Error finding community action by ID:', error);
      throw new Error('Failed to retrieve community action');
    } finally {
      client.release();
    }
  }

  /**
   * Query community actions with filters
   * @param query Query parameters
   * @returns Array of community actions
   */
  async query(query: CommunityActionQuery = {}): Promise<CommunityAction[]> {
    const client = await this.db.connect();
    
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Add user filter
      if (query.user_id) {
        conditions.push(`user_id = $${paramIndex++}`);
        values.push(query.user_id);
      }

      // Add action type filter
      if (query.action_type) {
        conditions.push(`action_type = $${paramIndex++}`);
        values.push(query.action_type);
      }

      // Add location filter
      if (query.location) {
        conditions.push(`ST_DWithin(
          location::geography, 
          ST_SetSRID(ST_Point($${paramIndex}, $${paramIndex + 1}), 4326)::geography, 
          $${paramIndex + 2}
        )`);
        values.push(query.location.longitude, query.location.latitude, query.location.radius_km * 1000);
        paramIndex += 3;
      }

      // Add time range filter
      if (query.time_range) {
        conditions.push(`timestamp >= $${paramIndex++} AND timestamp <= $${paramIndex++}`);
        values.push(query.time_range.start, query.time_range.end);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = query.limit || 100;
      const offset = query.offset || 0;

      const sql = `
        SELECT id, user_id, action_type, ST_AsText(location) as location, 
               timestamp, points_earned, impact_description, metadata, created_at
        FROM community_actions 
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;

      values.push(limit, offset);

      const result = await client.query(sql, values);
      return result.rows.map(row => this.mapDatabaseToModel(row));
    } catch (error) {
      logger.error('Error querying community actions:', error);
      throw new Error('Failed to query community actions');
    } finally {
      client.release();
    }
  }

  /**
   * Get user's action statistics
   * @param userId User ID
   * @returns Action statistics
   */
  async getUserStats(userId: string): Promise<{
    total_actions: number;
    total_points: number;
    action_types: Record<string, number>;
    recent_actions: CommunityAction[];
  }> {
    const client = await this.db.connect();
    
    try {
      // Get total actions and points
      const totalQuery = `
        SELECT COUNT(*) as total_actions, COALESCE(SUM(points_earned), 0) as total_points
        FROM community_actions 
        WHERE user_id = $1
      `;
      const totalResult = await client.query(totalQuery, [userId]);
      const { total_actions, total_points } = totalResult.rows[0];

      // Get action type breakdown
      const typeQuery = `
        SELECT action_type, COUNT(*) as count
        FROM community_actions 
        WHERE user_id = $1
        GROUP BY action_type
      `;
      const typeResult = await client.query(typeQuery, [userId]);
      const action_types: Record<string, number> = {};
      typeResult.rows.forEach(row => {
        action_types[row.action_type] = parseInt(row.count);
      });

      // Get recent actions
      const recentActions = await this.query({
        user_id: userId,
        limit: 10,
        offset: 0
      });

      return {
        total_actions: parseInt(total_actions),
        total_points: parseInt(total_points),
        action_types,
        recent_actions: recentActions
      };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw new Error('Failed to retrieve user statistics');
    } finally {
      client.release();
    }
  }

  /**
   * Get community action leaderboard
   * @param location Optional location filter
   * @param timeframe Time period for leaderboard
   * @param limit Number of results
   * @returns Leaderboard data
   */
  async getLeaderboard(
    location?: { latitude: number; longitude: number; radius_km: number },
    timeframe: 'all_time' | 'monthly' | 'weekly' = 'all_time',
    limit: number = 50
  ): Promise<Array<{
    user_id: string;
    total_actions: number;
    total_points: number;
    rank: number;
  }>> {
    const client = await this.db.connect();
    
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Add location filter
      if (location) {
        conditions.push(`ST_DWithin(
          location::geography, 
          ST_SetSRID(ST_Point($${paramIndex}, $${paramIndex + 1}), 4326)::geography, 
          $${paramIndex + 2}
        )`);
        values.push(location.longitude, location.latitude, location.radius_km * 1000);
        paramIndex += 3;
      }

      // Add timeframe filter
      if (timeframe === 'monthly') {
        conditions.push(`timestamp >= NOW() - INTERVAL '30 days'`);
      } else if (timeframe === 'weekly') {
        conditions.push(`timestamp >= NOW() - INTERVAL '7 days'`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const sql = `
        SELECT 
          user_id,
          COUNT(*) as total_actions,
          COALESCE(SUM(points_earned), 0) as total_points,
          ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(points_earned), 0) DESC) as rank
        FROM community_actions 
        ${whereClause}
        GROUP BY user_id
        ORDER BY total_points DESC
        LIMIT $${paramIndex++}
      `;

      values.push(limit);

      const result = await client.query(sql, values);
      return result.rows.map(row => ({
        user_id: row.user_id,
        total_actions: parseInt(row.total_actions),
        total_points: parseInt(row.total_points),
        rank: parseInt(row.rank)
      }));
    } catch (error) {
      logger.error('Error getting leaderboard:', error);
      throw new Error('Failed to retrieve leaderboard');
    } finally {
      client.release();
    }
  }

  /**
   * Delete community action
   * @param id Action ID
   * @returns true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    const client = await this.db.connect();
    
    try {
      const query = 'DELETE FROM community_actions WHERE id = $1';
      const result = await client.query(query, [id]);
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Error deleting community action:', error);
      throw new Error('Failed to delete community action');
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to model interface
   * @param row Database row
   * @returns Community action model
   */
  private mapDatabaseToModel(row: any): CommunityAction {
    let location: Location | undefined;
    
    if (row.location) {
      location = postGISToLocation(row.location);
    }

    return {
      id: row.id,
      user_id: row.user_id,
      action_type: row.action_type,
      location,
      timestamp: row.timestamp,
      points_earned: row.points_earned,
      impact_description: row.impact_description,
      metadata: row.metadata,
      created_at: row.created_at
    };
  }
}