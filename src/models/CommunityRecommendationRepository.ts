// Community Recommendation Repository for database operations
// Implements requirements 4.1, 4.2, 4.3, 4.4

import { Pool } from 'pg';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';
import { 
  CommunityRecommendation, 
  CreateCommunityRecommendation, 
  RecommendationQuery,
  DatabaseCommunityRecommendation,
  PaginatedResponse,
  Location
} from './types';
import { postGISToLocation } from '../utils/geometry';

export class CommunityRecommendationRepository {
  private db: Pool;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Create a new community recommendation
   * Requirement 4.4: Store recommendations in database
   */
  async create(recommendation: CreateCommunityRecommendation): Promise<CommunityRecommendation> {
    const query = `
      INSERT INTO community_recommendations (
        location, radius, priority, category, title, description, steps,
        estimated_impact, feasibility_score, target_pollutants, estimated_cost,
        time_to_implement, success_metrics, expires_at
      ) VALUES (
        ST_SetSRID(ST_MakePoint($1, $2), 4326), $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15
      ) RETURNING *
    `;

    const values = [
      recommendation.location.longitude,
      recommendation.location.latitude,
      recommendation.location.radius,
      recommendation.priority,
      recommendation.category,
      recommendation.title,
      recommendation.description,
      JSON.stringify(recommendation.steps),
      recommendation.estimated_impact,
      recommendation.feasibility_score,
      recommendation.target_pollutants,
      recommendation.estimated_cost || null,
      recommendation.time_to_implement || null,
      JSON.stringify(recommendation.success_metrics),
      recommendation.expires_at || null
    ];

    try {
      const result = await this.db.query(query, values);
      const row = result.rows[0] as DatabaseCommunityRecommendation;
      return this.mapDatabaseToRecommendation(row);
    } catch (error) {
      logger.error('Error creating community recommendation:', error);
      throw new Error('Failed to create community recommendation');
    }
  }

  /**
   * Find recommendations by query parameters
   * Requirement 4.1: Retrieve location-specific recommendations
   */
  async findMany(query: RecommendationQuery): Promise<PaginatedResponse<CommunityRecommendation>> {
    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    // Location-based filtering
    if (query.location) {
      whereConditions.push(`
        ST_DWithin(
          location,
          ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326),
          $${paramIndex + 2} * 1000
        )
      `);
      queryParams.push(
        query.location.longitude,
        query.location.latitude,
        query.location.radius_km
      );
      paramIndex += 3;
    }

    // Priority filtering
    if (query.priority && query.priority.length > 0) {
      whereConditions.push(`priority = ANY($${paramIndex})`);
      queryParams.push(query.priority);
      paramIndex++;
    }

    // Category filtering
    if (query.category && query.category.length > 0) {
      whereConditions.push(`category = ANY($${paramIndex})`);
      queryParams.push(query.category);
      paramIndex++;
    }

    // Target pollutants filtering
    if (query.target_pollutants && query.target_pollutants.length > 0) {
      whereConditions.push(`target_pollutants && $${paramIndex}`);
      queryParams.push(query.target_pollutants);
      paramIndex++;
    }

    // Active only filtering (not expired)
    if (query.active_only) {
      whereConditions.push(`(expires_at IS NULL OR expires_at > NOW())`);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM community_recommendations
      ${whereClause}
    `;

    // Main query with pagination
    const limit = query.limit || 20;
    const offset = query.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    const mainQuery = `
      SELECT *
      FROM community_recommendations
      ${whereClause}
      ORDER BY 
        CASE priority 
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        estimated_impact DESC,
        created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    try {
      const [countResult, dataResult] = await Promise.all([
        this.db.query(countQuery, queryParams.slice(0, -2)),
        this.db.query(mainQuery, queryParams)
      ]);

      const total = parseInt(countResult.rows[0]?.total || '0');
      const recommendations = dataResult.rows.map((row: DatabaseCommunityRecommendation) =>
        this.mapDatabaseToRecommendation(row)
      );

      return {
        data: recommendations,
        pagination: {
          total,
          page,
          limit,
          has_next: offset + limit < total,
          has_previous: offset > 0
        }
      };
    } catch (error) {
      logger.error('Error finding community recommendations:', error);
      throw new Error('Failed to retrieve community recommendations');
    }
  }

  /**
   * Find recommendation by ID
   */
  async findById(id: string): Promise<CommunityRecommendation | null> {
    const query = `
      SELECT * FROM community_recommendations
      WHERE id = $1
    `;

    try {
      const result = await this.db.query(query, [id]);
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDatabaseToRecommendation(result.rows[0] as DatabaseCommunityRecommendation);
    } catch (error) {
      logger.error('Error finding recommendation by ID:', error);
      throw new Error('Failed to retrieve recommendation');
    }
  }

  /**
   * Update recommendation
   */
  async update(id: string, updates: Partial<CreateCommunityRecommendation>): Promise<CommunityRecommendation | null> {
    const updateFields: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (updates.priority) {
      updateFields.push(`priority = $${paramIndex}`);
      queryParams.push(updates.priority);
      paramIndex++;
    }

    if (updates.category) {
      updateFields.push(`category = $${paramIndex}`);
      queryParams.push(updates.category);
      paramIndex++;
    }

    if (updates.title) {
      updateFields.push(`title = $${paramIndex}`);
      queryParams.push(updates.title);
      paramIndex++;
    }

    if (updates.description) {
      updateFields.push(`description = $${paramIndex}`);
      queryParams.push(updates.description);
      paramIndex++;
    }

    if (updates.steps) {
      updateFields.push(`steps = $${paramIndex}`);
      queryParams.push(JSON.stringify(updates.steps));
      paramIndex++;
    }

    if (updates.estimated_impact !== undefined) {
      updateFields.push(`estimated_impact = $${paramIndex}`);
      queryParams.push(updates.estimated_impact);
      paramIndex++;
    }

    if (updates.feasibility_score !== undefined) {
      updateFields.push(`feasibility_score = $${paramIndex}`);
      queryParams.push(updates.feasibility_score);
      paramIndex++;
    }

    if (updates.target_pollutants) {
      updateFields.push(`target_pollutants = $${paramIndex}`);
      queryParams.push(updates.target_pollutants);
      paramIndex++;
    }

    if (updates.estimated_cost !== undefined) {
      updateFields.push(`estimated_cost = $${paramIndex}`);
      queryParams.push(updates.estimated_cost);
      paramIndex++;
    }

    if (updates.time_to_implement !== undefined) {
      updateFields.push(`time_to_implement = $${paramIndex}`);
      queryParams.push(updates.time_to_implement);
      paramIndex++;
    }

    if (updates.success_metrics) {
      updateFields.push(`success_metrics = $${paramIndex}`);
      queryParams.push(JSON.stringify(updates.success_metrics));
      paramIndex++;
    }

    if (updates.expires_at !== undefined) {
      updateFields.push(`expires_at = $${paramIndex}`);
      queryParams.push(updates.expires_at);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push(`updated_at = NOW()`);
    queryParams.push(id);

    const query = `
      UPDATE community_recommendations
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, queryParams);
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDatabaseToRecommendation(result.rows[0] as DatabaseCommunityRecommendation);
    } catch (error) {
      logger.error('Error updating recommendation:', error);
      throw new Error('Failed to update recommendation');
    }
  }

  /**
   * Delete recommendation
   */
  async delete(id: string): Promise<boolean> {
    const query = `
      DELETE FROM community_recommendations
      WHERE id = $1
    `;

    try {
      const result = await this.db.query(query, [id]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error('Error deleting recommendation:', error);
      throw new Error('Failed to delete recommendation');
    }
  }

  /**
   * Find recommendations by location and pollutant
   * Used by the recommendation engine to avoid duplicates
   */
  async findByLocationAndPollutants(
    location: Location,
    radiusKm: number,
    pollutants: string[]
  ): Promise<CommunityRecommendation[]> {
    const query = `
      SELECT * FROM community_recommendations
      WHERE ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326),
        $3 * 1000
      )
      AND target_pollutants && $4
      AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY priority, estimated_impact DESC
    `;

    try {
      const result = await this.db.query(query, [
        location.longitude,
        location.latitude,
        radiusKm,
        pollutants
      ]);

      return result.rows.map((row: DatabaseCommunityRecommendation) =>
        this.mapDatabaseToRecommendation(row)
      );
    } catch (error) {
      logger.error('Error finding recommendations by location and pollutants:', error);
      throw new Error('Failed to find recommendations');
    }
  }

  /**
   * Map database row to CommunityRecommendation interface
   */
  private mapDatabaseToRecommendation(row: DatabaseCommunityRecommendation): CommunityRecommendation {
    const location = postGISToLocation(row.location);
    
    return {
      id: row.id,
      location: {
        ...location,
        radius: row.radius
      },
      priority: row.priority as 'low' | 'medium' | 'high' | 'urgent',
      category: row.category as 'immediate_action' | 'long_term_strategy' | 'monitoring',
      title: row.title,
      description: row.description,
      steps: Array.isArray(row.steps) ? row.steps : JSON.parse(row.steps as string),
      estimated_impact: row.estimated_impact,
      feasibility_score: row.feasibility_score,
      target_pollutants: row.target_pollutants,
      estimated_cost: row.estimated_cost ?? undefined,
      time_to_implement: row.time_to_implement ?? undefined,
      success_metrics: Array.isArray(row.success_metrics) 
        ? row.success_metrics 
        : JSON.parse(row.success_metrics as string),
      created_at: row.created_at,
      updated_at: row.updated_at,
      expires_at: row.expires_at ?? undefined
    };
  }
}