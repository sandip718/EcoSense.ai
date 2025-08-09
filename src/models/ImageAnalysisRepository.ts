// Repository for image analysis CRUD operations
// Implements image analysis data management functionality

import { Pool } from 'pg';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';
import {
  ImageAnalysis,
  CreateImageAnalysis,
  ImageAnalysisQuery,
  DatabaseImageAnalysis,
  PaginatedResponse,
  Location
} from './types';
import { locationToPostGIS, postGISToLocation, createRadiusQuery } from '../utils/geometry';

export class ImageAnalysisRepository {
  private db: Pool;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Create a new image analysis record
   * @param data Image analysis data to create
   * @returns Created image analysis record
   */
  async create(data: CreateImageAnalysis): Promise<ImageAnalysis> {
    const client = await this.db.connect();
    
    try {
      const query = `
        INSERT INTO image_analyses (
          user_id, image_url, location, upload_timestamp, analysis_results, overall_score, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, user_id, image_url, ST_AsText(location) as location, 
                  upload_timestamp, analysis_results, overall_score, status, created_at
      `;

      const values = [
        data.user_id,
        data.image_url,
        data.location ? `ST_SetSRID(ST_GeomFromText('${locationToPostGIS(data.location)}'), 4326)` : null,
        data.upload_timestamp,
        JSON.stringify(data.analysis_results),
        data.overall_score || null,
        data.status || 'pending'
      ];

      const result = await client.query(query, values);
      const row = result.rows[0] as DatabaseImageAnalysis;

      return this.mapDatabaseToModel(row);
    } catch (error) {
      logger.error('Error creating image analysis:', error);
      throw new Error('Failed to create image analysis record');
    } finally {
      client.release();
    }
  }

  /**
   * Get image analysis by ID
   * @param id Image analysis ID
   * @returns Image analysis record or null if not found
   */
  async findById(id: string): Promise<ImageAnalysis | null> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT id, user_id, image_url, ST_AsText(location) as location, 
               upload_timestamp, analysis_results, overall_score, status, created_at
        FROM image_analyses 
        WHERE id = $1
      `;

      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as DatabaseImageAnalysis;
      return this.mapDatabaseToModel(row);
    } catch (error) {
      logger.error('Error finding image analysis by ID:', error);
      throw new Error('Failed to retrieve image analysis record');
    } finally {
      client.release();
    }
  }

  /**
   * Query image analyses with filters and pagination
   * @param query Query parameters
   * @returns Paginated image analysis results
   */
  async findMany(query: ImageAnalysisQuery): Promise<PaginatedResponse<ImageAnalysis>> {
    const client = await this.db.connect();
    
    try {
      const { whereClause, values, countValues } = this.buildWhereClause(query);
      const limit = query.limit || 50;
      const offset = query.offset || 0;

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM image_analyses
        ${whereClause}
      `;
      
      const countResult = await client.query(countQuery, countValues);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data
      const dataQuery = `
        SELECT id, user_id, image_url, ST_AsText(location) as location, 
               upload_timestamp, analysis_results, overall_score, status, created_at
        FROM image_analyses
        ${whereClause}
        ORDER BY upload_timestamp DESC, created_at DESC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `;

      const dataResult = await client.query(dataQuery, [...values, limit, offset]);
      const data = dataResult.rows.map((row: DatabaseImageAnalysis) => 
        this.mapDatabaseToModel(row)
      );

      return {
        data,
        pagination: {
          total,
          page: Math.floor(offset / limit) + 1,
          limit,
          has_next: offset + limit < total,
          has_previous: offset > 0
        }
      };
    } catch (error) {
      logger.error('Error querying image analyses:', error);
      throw new Error('Failed to query image analyses');
    } finally {
      client.release();
    }
  }

  /**
   * Update image analysis record
   * @param id Image analysis ID
   * @param updates Partial updates to apply
   * @returns Updated image analysis record or null if not found
   */
  async update(id: string, updates: Partial<CreateImageAnalysis>): Promise<ImageAnalysis | null> {
    const client = await this.db.connect();
    
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.image_url !== undefined) {
        setClauses.push(`image_url = $${paramIndex++}`);
        values.push(updates.image_url);
      }
      if (updates.location !== undefined) {
        if (updates.location === null) {
          setClauses.push(`location = NULL`);
        } else {
          setClauses.push(`location = ST_SetSRID(ST_GeomFromText($${paramIndex++}), 4326)`);
          values.push(locationToPostGIS(updates.location));
        }
      }
      if (updates.upload_timestamp !== undefined) {
        setClauses.push(`upload_timestamp = $${paramIndex++}`);
        values.push(updates.upload_timestamp);
      }
      if (updates.analysis_results !== undefined) {
        setClauses.push(`analysis_results = $${paramIndex++}`);
        values.push(JSON.stringify(updates.analysis_results));
      }
      if (updates.overall_score !== undefined) {
        setClauses.push(`overall_score = $${paramIndex++}`);
        values.push(updates.overall_score);
      }
      if (updates.status !== undefined) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }

      if (setClauses.length === 0) {
        throw new Error('No updates provided');
      }

      values.push(id);

      const query = `
        UPDATE image_analyses 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, user_id, image_url, ST_AsText(location) as location, 
                  upload_timestamp, analysis_results, overall_score, status, created_at
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as DatabaseImageAnalysis;
      return this.mapDatabaseToModel(row);
    } catch (error) {
      logger.error('Error updating image analysis:', error);
      throw new Error('Failed to update image analysis record');
    } finally {
      client.release();
    }
  }

  /**
   * Delete image analysis record
   * @param id Image analysis ID
   * @returns true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    const client = await this.db.connect();
    
    try {
      const query = 'DELETE FROM image_analyses WHERE id = $1';
      const result = await client.query(query, [id]);
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Error deleting image analysis:', error);
      throw new Error('Failed to delete image analysis record');
    } finally {
      client.release();
    }
  }

  /**
   * Find image analyses by user ID
   * @param userId User ID
   * @param limit Maximum number of results
   * @param offset Offset for pagination
   * @returns Array of image analysis records
   */
  async findByUserId(userId: string, limit: number = 50, offset: number = 0): Promise<ImageAnalysis[]> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT id, user_id, image_url, ST_AsText(location) as location, 
               upload_timestamp, analysis_results, overall_score, status, created_at
        FROM image_analyses
        WHERE user_id = $1
        ORDER BY upload_timestamp DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await client.query(query, [userId, limit, offset]);
      
      return result.rows.map((row: DatabaseImageAnalysis) => 
        this.mapDatabaseToModel(row)
      );
    } catch (error) {
      logger.error('Error finding image analyses by user ID:', error);
      throw new Error('Failed to retrieve user image analyses');
    } finally {
      client.release();
    }
  }

  /**
   * Find pending image analyses for processing
   * @param limit Maximum number of results
   * @returns Array of pending image analysis records
   */
  async findPendingAnalyses(limit: number = 10): Promise<ImageAnalysis[]> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT id, user_id, image_url, ST_AsText(location) as location, 
               upload_timestamp, analysis_results, overall_score, status, created_at
        FROM image_analyses
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT $1
      `;

      const result = await client.query(query, [limit]);
      
      return result.rows.map((row: DatabaseImageAnalysis) => 
        this.mapDatabaseToModel(row)
      );
    } catch (error) {
      logger.error('Error finding pending image analyses:', error);
      throw new Error('Failed to retrieve pending image analyses');
    } finally {
      client.release();
    }
  }

  /**
   * Update analysis status
   * @param id Image analysis ID
   * @param status New status
   * @returns Updated image analysis record or null if not found
   */
  async updateStatus(id: string, status: 'pending' | 'processing' | 'completed' | 'failed'): Promise<ImageAnalysis | null> {
    return this.update(id, { status });
  }

  /**
   * Get image analyses within a geographic area
   * @param location Center location
   * @param radiusKm Search radius in kilometers
   * @param limit Maximum number of results
   * @returns Array of image analysis records
   */
  async findByLocation(location: Location, radiusKm: number, limit: number = 50): Promise<ImageAnalysis[]> {
    const client = await this.db.connect();
    
    try {
      const radiusCondition = createRadiusQuery(location, radiusKm);
      
      const query = `
        SELECT id, user_id, image_url, ST_AsText(location) as location, 
               upload_timestamp, analysis_results, overall_score, status, created_at
        FROM image_analyses
        WHERE ${radiusCondition} AND status = 'completed'
        ORDER BY upload_timestamp DESC
        LIMIT $1
      `;

      const result = await client.query(query, [limit]);
      
      return result.rows.map((row: DatabaseImageAnalysis) => 
        this.mapDatabaseToModel(row)
      );
    } catch (error) {
      logger.error('Error finding image analyses by location:', error);
      throw new Error('Failed to retrieve image analyses by location');
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to model interface
   * @param row Database row
   * @returns Image analysis model
   */
  private mapDatabaseToModel(row: DatabaseImageAnalysis): ImageAnalysis {
    let location: Location | undefined;
    
    if (row.location) {
      location = postGISToLocation(row.location);
    }

    return {
      id: row.id,
      user_id: row.user_id,
      image_url: row.image_url,
      location,
      upload_timestamp: row.upload_timestamp,
      analysis_results: row.analysis_results,
      overall_score: row.overall_score ? parseFloat(row.overall_score) : undefined,
      status: row.status as 'pending' | 'processing' | 'completed' | 'failed',
      created_at: row.created_at
    };
  }

  /**
   * Build WHERE clause for queries
   * @param query Query parameters
   * @returns WHERE clause, values array, and count values array
   */
  private buildWhereClause(query: ImageAnalysisQuery): {
    whereClause: string;
    values: any[];
    countValues: any[];
  } {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (query.user_id) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(query.user_id);
    }

    if (query.status && query.status.length > 0) {
      conditions.push(`status = ANY($${paramIndex++})`);
      values.push(query.status);
    }

    if (query.location) {
      const radiusCondition = createRadiusQuery(query.location, query.location.radius_km);
      conditions.push(radiusCondition);
    }

    if (query.time_range) {
      conditions.push(`upload_timestamp >= $${paramIndex++}`);
      values.push(query.time_range.start);
      conditions.push(`upload_timestamp <= $${paramIndex++}`);
      values.push(query.time_range.end);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    return {
      whereClause,
      values,
      countValues: values.slice() // Copy for count query
    };
  }
}