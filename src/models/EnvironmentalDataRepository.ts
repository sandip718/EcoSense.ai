// Repository for environmental data CRUD operations
// Implements requirements 1.4, 8.1, 8.2

import { Pool, PoolClient } from 'pg';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';
import {
  EnvironmentalDataPoint,
  CreateEnvironmentalDataPoint,
  EnvironmentalDataQuery,
  DatabaseEnvironmentalData,
  PaginatedResponse,
  Location
} from './types';
import { locationToPostGIS, postGISToLocation, createRadiusQuery } from '../utils/geometry';

export class EnvironmentalDataRepository {
  private db: Pool;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Create a new environmental data point
   * @param data Environmental data to create
   * @returns Created environmental data point
   */
  async create(data: CreateEnvironmentalDataPoint): Promise<EnvironmentalDataPoint> {
    const client = await this.db.connect();
    
    try {
      const query = `
        INSERT INTO environmental_data (
          source, pollutant, value, unit, location, address, timestamp, quality_grade
        ) VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromText($5), 4326), $6, $7, $8)
        RETURNING id, source, pollutant, value, unit, 
                  ST_AsText(location) as location, address, timestamp, quality_grade, created_at
      `;

      const values = [
        data.source,
        data.pollutant,
        data.value,
        data.unit,
        locationToPostGIS(data.location),
        data.location.address || null,
        data.timestamp,
        data.quality_grade
      ];

      const result = await client.query(query, values);
      const row = result.rows[0] as DatabaseEnvironmentalData;

      return this.mapDatabaseToModel(row);
    } catch (error) {
      logger.error('Error creating environmental data:', error);
      throw new Error('Failed to create environmental data point');
    } finally {
      client.release();
    }
  }

  /**
   * Get environmental data point by ID
   * @param id Environmental data point ID
   * @returns Environmental data point or null if not found
   */
  async findById(id: string): Promise<EnvironmentalDataPoint | null> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT id, source, pollutant, value, unit, 
               ST_AsText(location) as location, address, timestamp, quality_grade, created_at
        FROM environmental_data 
        WHERE id = $1
      `;

      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as DatabaseEnvironmentalData;
      return this.mapDatabaseToModel(row);
    } catch (error) {
      logger.error('Error finding environmental data by ID:', error);
      throw new Error('Failed to retrieve environmental data point');
    } finally {
      client.release();
    }
  }

  /**
   * Query environmental data with filters and pagination
   * @param query Query parameters
   * @returns Paginated environmental data results
   */
  async findMany(query: EnvironmentalDataQuery): Promise<PaginatedResponse<EnvironmentalDataPoint>> {
    const client = await this.db.connect();
    
    try {
      const { whereClause, values, countValues } = this.buildWhereClause(query);
      const limit = query.limit || 50;
      const offset = query.offset || 0;

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM environmental_data
        ${whereClause}
      `;
      
      const countResult = await client.query(countQuery, countValues);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data
      const dataQuery = `
        SELECT id, source, pollutant, value, unit, 
               ST_AsText(location) as location, address, timestamp, quality_grade, created_at
        FROM environmental_data
        ${whereClause}
        ORDER BY timestamp DESC, created_at DESC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `;

      const dataResult = await client.query(dataQuery, [...values, limit, offset]);
      const data = dataResult.rows.map((row: DatabaseEnvironmentalData) => 
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
      logger.error('Error querying environmental data:', error);
      throw new Error('Failed to query environmental data');
    } finally {
      client.release();
    }
  }

  /**
   * Update environmental data point
   * @param id Environmental data point ID
   * @param updates Partial updates to apply
   * @returns Updated environmental data point or null if not found
   */
  async update(id: string, updates: Partial<CreateEnvironmentalDataPoint>): Promise<EnvironmentalDataPoint | null> {
    const client = await this.db.connect();
    
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.source !== undefined) {
        setClauses.push(`source = $${paramIndex++}`);
        values.push(updates.source);
      }
      if (updates.pollutant !== undefined) {
        setClauses.push(`pollutant = $${paramIndex++}`);
        values.push(updates.pollutant);
      }
      if (updates.value !== undefined) {
        setClauses.push(`value = $${paramIndex++}`);
        values.push(updates.value);
      }
      if (updates.unit !== undefined) {
        setClauses.push(`unit = $${paramIndex++}`);
        values.push(updates.unit);
      }
      if (updates.location !== undefined) {
        setClauses.push(`location = ST_SetSRID(ST_GeomFromText($${paramIndex++}), 4326)`);
        values.push(locationToPostGIS(updates.location));
        if (updates.location.address !== undefined) {
          setClauses.push(`address = $${paramIndex++}`);
          values.push(updates.location.address);
        }
      }
      if (updates.timestamp !== undefined) {
        setClauses.push(`timestamp = $${paramIndex++}`);
        values.push(updates.timestamp);
      }
      if (updates.quality_grade !== undefined) {
        setClauses.push(`quality_grade = $${paramIndex++}`);
        values.push(updates.quality_grade);
      }

      if (setClauses.length === 0) {
        throw new Error('No updates provided');
      }

      values.push(id);

      const query = `
        UPDATE environmental_data 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, source, pollutant, value, unit, 
                  ST_AsText(location) as location, address, timestamp, quality_grade, created_at
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as DatabaseEnvironmentalData;
      return this.mapDatabaseToModel(row);
    } catch (error) {
      logger.error('Error updating environmental data:', error);
      throw new Error('Failed to update environmental data point');
    } finally {
      client.release();
    }
  }

  /**
   * Delete environmental data point
   * @param id Environmental data point ID
   * @returns true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    const client = await this.db.connect();
    
    try {
      const query = 'DELETE FROM environmental_data WHERE id = $1';
      const result = await client.query(query, [id]);
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Error deleting environmental data:', error);
      throw new Error('Failed to delete environmental data point');
    } finally {
      client.release();
    }
  }

  /**
   * Get latest environmental data for a specific location and pollutant
   * @param location Location to search around
   * @param radiusKm Search radius in kilometers
   * @param pollutant Pollutant type
   * @returns Latest environmental data point or null
   */
  async findLatestByLocationAndPollutant(
    location: Location, 
    radiusKm: number, 
    pollutant: string
  ): Promise<EnvironmentalDataPoint | null> {
    const client = await this.db.connect();
    
    try {
      const radiusCondition = createRadiusQuery(location, radiusKm);
      
      const query = `
        SELECT id, source, pollutant, value, unit, 
               ST_AsText(location) as location, address, timestamp, quality_grade, created_at
        FROM environmental_data
        WHERE pollutant = $1 AND ${radiusCondition}
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      const result = await client.query(query, [pollutant]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as DatabaseEnvironmentalData;
      return this.mapDatabaseToModel(row);
    } catch (error) {
      logger.error('Error finding latest environmental data:', error);
      throw new Error('Failed to retrieve latest environmental data');
    } finally {
      client.release();
    }
  }

  /**
   * Bulk insert environmental data points
   * @param dataPoints Array of environmental data points to insert
   * @returns Number of inserted records
   */
  async bulkCreate(dataPoints: CreateEnvironmentalDataPoint[]): Promise<number> {
    if (dataPoints.length === 0) {
      return 0;
    }

    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO environmental_data (
          source, pollutant, value, unit, location, address, timestamp, quality_grade
        ) VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromText($5), 4326), $6, $7, $8)
      `;

      let insertedCount = 0;

      for (const data of dataPoints) {
        const values = [
          data.source,
          data.pollutant,
          data.value,
          data.unit,
          locationToPostGIS(data.location),
          data.location.address || null,
          data.timestamp,
          data.quality_grade
        ];

        try {
          await client.query(query, values);
          insertedCount++;
        } catch (error) {
          logger.warn('Failed to insert environmental data point:', { data, error });
          // Continue with other inserts
        }
      }

      await client.query('COMMIT');
      return insertedCount;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error bulk creating environmental data:', error);
      throw new Error('Failed to bulk create environmental data points');
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to model interface
   * @param row Database row
   * @returns Environmental data point model
   */
  private mapDatabaseToModel(row: DatabaseEnvironmentalData): EnvironmentalDataPoint {
    const location = postGISToLocation(row.location);
    if (row.address) {
      location.address = row.address;
    }

    return {
      id: row.id,
      source: row.source as 'openaq' | 'water_quality_portal' | 'local_sensor',
      pollutant: row.pollutant,
      value: parseFloat(row.value),
      unit: row.unit,
      location,
      timestamp: row.timestamp,
      quality_grade: row.quality_grade as 'A' | 'B' | 'C' | 'D',
      created_at: row.created_at
    };
  }

  /**
   * Build WHERE clause for queries
   * @param query Query parameters
   * @returns WHERE clause, values array, and count values array
   */
  private buildWhereClause(query: EnvironmentalDataQuery): {
    whereClause: string;
    values: any[];
    countValues: any[];
  } {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (query.pollutant) {
      conditions.push(`pollutant = $${paramIndex++}`);
      values.push(query.pollutant);
    }

    if (query.source) {
      conditions.push(`source = $${paramIndex++}`);
      values.push(query.source);
    }

    if (query.quality_grade && query.quality_grade.length > 0) {
      conditions.push(`quality_grade = ANY($${paramIndex++})`);
      values.push(query.quality_grade);
    }

    if (query.location) {
      const radiusCondition = createRadiusQuery(query.location, query.location.radius_km);
      conditions.push(radiusCondition);
    }

    if (query.time_range) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      values.push(query.time_range.start);
      conditions.push(`timestamp <= $${paramIndex++}`);
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