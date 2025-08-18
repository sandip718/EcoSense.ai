// Repository for user CRUD operations
// Implements user management functionality

import { Pool } from 'pg';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';
import {
  UserProfile,
  CreateUserProfile,
  DatabaseUser,
  Location,
  UserPreferences
} from './types';
import { locationToPostGIS, postGISToLocation } from '../utils/geometry';

export class UserRepository {
  private db: Pool;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Create a new user
   * @param userData User data to create
   * @returns Created user profile
   */
  async create(userData: CreateUserProfile): Promise<UserProfile> {
    const client = await this.db.connect();
    
    try {
      const query = `
        INSERT INTO users (
          email, password_hash, location, preferences
        ) VALUES ($1, $2, $3, $4)
        RETURNING id, email, password_hash, ST_AsText(location) as location, 
                  preferences, points, level, badges, contribution_streak, created_at, updated_at
      `;

      const values = [
        userData.email,
        userData.password_hash,
        userData.location ? `ST_SetSRID(ST_GeomFromText('${locationToPostGIS(userData.location)}'), 4326)` : null,
        JSON.stringify(userData.preferences || {})
      ];

      const result = await client.query(query, values);
      const row = result.rows[0] as DatabaseUser;

      return this.mapDatabaseToModel(row);
    } catch (error) {
      logger.error('Error creating user:', error);
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('User with this email already exists');
      }
      throw new Error('Failed to create user');
    } finally {
      client.release();
    }
  }

  /**
   * Find user by ID
   * @param id User ID
   * @returns User profile or null if not found
   */
  async findById(id: string): Promise<UserProfile | null> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT id, email, password_hash, ST_AsText(location) as location, 
               preferences, points, level, badges, contribution_streak, created_at, updated_at
        FROM users 
        WHERE id = $1
      `;

      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as DatabaseUser;
      return this.mapDatabaseToModel(row);
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw new Error('Failed to retrieve user');
    } finally {
      client.release();
    }
  }

  /**
   * Find user by email
   * @param email User email
   * @returns User profile or null if not found
   */
  async findByEmail(email: string): Promise<UserProfile | null> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT id, email, password_hash, ST_AsText(location) as location, 
               preferences, points, level, badges, contribution_streak, created_at, updated_at
        FROM users 
        WHERE email = $1
      `;

      const result = await client.query(query, [email]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as DatabaseUser;
      return this.mapDatabaseToModel(row);
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw new Error('Failed to retrieve user');
    } finally {
      client.release();
    }
  }

  /**
   * Update user profile
   * @param id User ID
   * @param updates Partial updates to apply
   * @returns Updated user profile or null if not found
   */
  async update(id: string, updates: Partial<CreateUserProfile & {
    points?: number;
    level?: number;
    badges?: string[];
    contribution_streak?: number;
  }>): Promise<UserProfile | null> {
    const client = await this.db.connect();
    
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.email !== undefined) {
        setClauses.push(`email = $${paramIndex++}`);
        values.push(updates.email);
      }
      if (updates.password_hash !== undefined) {
        setClauses.push(`password_hash = $${paramIndex++}`);
        values.push(updates.password_hash);
      }
      if (updates.location !== undefined) {
        if (updates.location === null) {
          setClauses.push(`location = NULL`);
        } else {
          setClauses.push(`location = ST_SetSRID(ST_GeomFromText($${paramIndex++}), 4326)`);
          values.push(locationToPostGIS(updates.location));
        }
      }
      if (updates.preferences !== undefined) {
        setClauses.push(`preferences = $${paramIndex++}`);
        values.push(JSON.stringify(updates.preferences));
      }
      if (updates.points !== undefined) {
        setClauses.push(`points = $${paramIndex++}`);
        values.push(updates.points);
      }
      if (updates.level !== undefined) {
        setClauses.push(`level = $${paramIndex++}`);
        values.push(updates.level);
      }
      if (updates.badges !== undefined) {
        setClauses.push(`badges = $${paramIndex++}`);
        values.push(updates.badges);
      }
      if (updates.contribution_streak !== undefined) {
        setClauses.push(`contribution_streak = $${paramIndex++}`);
        values.push(updates.contribution_streak);
      }

      if (setClauses.length === 0) {
        throw new Error('No updates provided');
      }

      // Add updated_at timestamp
      setClauses.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
        UPDATE users 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, email, password_hash, ST_AsText(location) as location, 
                  preferences, points, level, badges, contribution_streak, created_at, updated_at
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as DatabaseUser;
      return this.mapDatabaseToModel(row);
    } catch (error) {
      logger.error('Error updating user:', error);
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('User with this email already exists');
      }
      throw new Error('Failed to update user');
    } finally {
      client.release();
    }
  }

  /**
   * Delete user
   * @param id User ID
   * @returns true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    const client = await this.db.connect();
    
    try {
      const query = 'DELETE FROM users WHERE id = $1';
      const result = await client.query(query, [id]);
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    } finally {
      client.release();
    }
  }

  /**
   * Add points to user and potentially level up
   * @param id User ID
   * @param points Points to add
   * @returns Updated user profile or null if not found
   */
  async addPoints(id: string, points: number): Promise<UserProfile | null> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Get current user data
      const currentUser = await this.findById(id);
      if (!currentUser) {
        await client.query('ROLLBACK');
        return null;
      }

      const newPoints = currentUser.points + points;
      const newLevel = this.calculateLevel(newPoints);

      const query = `
        UPDATE users 
        SET points = $1, level = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING id, email, password_hash, ST_AsText(location) as location, 
                  preferences, points, level, badges, contribution_streak, created_at, updated_at
      `;

      const result = await client.query(query, [newPoints, newLevel, id]);
      await client.query('COMMIT');

      const row = result.rows[0] as DatabaseUser;
      return this.mapDatabaseToModel(row);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error adding points to user:', error);
      throw new Error('Failed to add points to user');
    } finally {
      client.release();
    }
  }

  /**
   * Add badge to user
   * @param id User ID
   * @param badge Badge to add
   * @returns Updated user profile or null if not found
   */
  async addBadge(id: string, badge: string): Promise<UserProfile | null> {
    const client = await this.db.connect();
    
    try {
      const query = `
        UPDATE users 
        SET badges = array_append(badges, $1), updated_at = NOW()
        WHERE id = $2 AND NOT ($1 = ANY(badges))
        RETURNING id, email, password_hash, ST_AsText(location) as location, 
                  preferences, points, level, badges, contribution_streak, created_at, updated_at
      `;

      const result = await client.query(query, [badge, id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as DatabaseUser;
      return this.mapDatabaseToModel(row);
    } catch (error) {
      logger.error('Error adding badge to user:', error);
      throw new Error('Failed to add badge to user');
    } finally {
      client.release();
    }
  }

  /**
   * Update contribution streak
   * @param id User ID
   * @param streak New streak value
   * @returns Updated user profile or null if not found
   */
  async updateContributionStreak(id: string, streak: number): Promise<UserProfile | null> {
    const client = await this.db.connect();
    
    try {
      const query = `
        UPDATE users 
        SET contribution_streak = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, email, password_hash, ST_AsText(location) as location, 
                  preferences, points, level, badges, contribution_streak, created_at, updated_at
      `;

      const result = await client.query(query, [streak, id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as DatabaseUser;
      return this.mapDatabaseToModel(row);
    } catch (error) {
      logger.error('Error updating contribution streak:', error);
      throw new Error('Failed to update contribution streak');
    } finally {
      client.release();
    }
  }

  /**
   * Find users near a location
   * @param location Center location
   * @param radiusKm Radius in kilometers
   * @param limit Maximum number of users to return
   * @returns Array of nearby users
   */
  async findNearby(location: Location, radiusKm: number, limit: number = 100): Promise<UserProfile[]> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT id, email, password_hash, ST_AsText(location) as location, 
               preferences, points, level, badges, contribution_streak, created_at, updated_at,
               ST_Distance(location, ST_SetSRID(ST_GeomFromText($1), 4326)::geography) / 1000 as distance_km
        FROM users 
        WHERE location IS NOT NULL
          AND ST_DWithin(location, ST_SetSRID(ST_GeomFromText($1), 4326)::geography, $2 * 1000)
        ORDER BY distance_km ASC
        LIMIT $3
      `;

      const centerPoint = locationToPostGIS(location);
      const result = await client.query(query, [centerPoint, radiusKm, limit]);
      
      return result.rows.map((row: DatabaseUser) => this.mapDatabaseToModel(row));
    } catch (error) {
      logger.error('Error finding nearby users:', error);
      throw new Error('Failed to find nearby users');
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to model interface
   * @param row Database row
   * @returns User profile model
   */
  private mapDatabaseToModel(row: DatabaseUser): UserProfile {
    let location: Location | undefined;
    
    if (row.location) {
      location = postGISToLocation(row.location);
    }

    return {
      id: row.id,
      email: row.email,
      password_hash: row.password_hash,
      location,
      preferences: row.preferences as UserPreferences,
      points: row.points,
      level: row.level,
      badges: row.badges,
      contribution_streak: row.contribution_streak,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * Calculate user level based on points
   * @param points Total points
   * @returns User level
   */
  private calculateLevel(points: number): number {
    // Simple level calculation: every 1000 points = 1 level
    // Level 1 starts at 0 points
    return Math.floor(points / 1000) + 1;
  }
}