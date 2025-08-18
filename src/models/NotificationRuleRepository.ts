import { Pool } from 'pg';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';
import {
  NotificationRule,
  CreateNotificationRule,
  DatabaseNotificationRule,
  Location
} from './types';

export class NotificationRuleRepository {
  private db: Pool;

  constructor() {
    this.db = getDatabase();
  }

  private parseLocationFromPostGIS(locationStr: string): Location & { radius: number } {
    // Parse PostGIS POINT format: "POINT(longitude latitude)"
    const match = locationStr.match(/POINT\(([^)]+)\)/);
    if (!match) {
      throw new Error('Invalid PostGIS POINT format');
    }
    
    const [longitude, latitude] = match[1].split(' ').map(Number);
    return { latitude, longitude, radius: 0 }; // radius will be set separately
  }

  private formatLocationForPostGIS(location: Location): string {
    return `POINT(${location.longitude} ${location.latitude})`;
  }

  private mapDatabaseToNotificationRule(dbRule: DatabaseNotificationRule & { radius: number }): NotificationRule {
    const location = this.parseLocationFromPostGIS(dbRule.location);
    location.radius = dbRule.radius;

    return {
      id: dbRule.id,
      user_id: dbRule.user_id,
      location,
      triggers: dbRule.triggers,
      delivery_methods: dbRule.delivery_methods as ('push' | 'email' | 'sms')[],
      active: dbRule.active,
      created_at: dbRule.created_at,
      updated_at: dbRule.updated_at
    };
  }

  async create(rule: CreateNotificationRule): Promise<NotificationRule> {
    const client = await this.db.connect();
    
    try {
      const locationPoint = this.formatLocationForPostGIS(rule.location);
      
      const query = `
        INSERT INTO notification_rules (
          user_id, location, radius, triggers, delivery_methods, active
        ) VALUES ($1, ST_GeomFromText($2, 4326), $3, $4, $5, $6)
        RETURNING id, user_id, ST_AsText(location) as location, radius, 
                  triggers, delivery_methods, active, created_at, updated_at
      `;
      
      const values = [
        rule.user_id,
        locationPoint,
        rule.location.radius,
        JSON.stringify(rule.triggers),
        rule.delivery_methods,
        rule.active ?? true
      ];
      
      const result = await client.query(query, values);
      const dbRule = result.rows[0] as DatabaseNotificationRule & { radius: number };
      
      logger.info(`Created notification rule ${dbRule.id} for user ${rule.user_id}`);
      return this.mapDatabaseToNotificationRule(dbRule);
    } catch (error) {
      logger.error('Error creating notification rule:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findByUserId(userId: string): Promise<NotificationRule[]> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT id, user_id, ST_AsText(location) as location, radius,
               triggers, delivery_methods, active, created_at, updated_at
        FROM notification_rules
        WHERE user_id = $1 AND active = true
        ORDER BY created_at DESC
      `;
      
      const result = await client.query(query, [userId]);
      return result.rows.map(row => this.mapDatabaseToNotificationRule(row));
    } catch (error) {
      logger.error('Error finding notification rules by user ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findByLocation(location: Location, radiusKm: number): Promise<NotificationRule[]> {
    const client = await this.db.connect();
    
    try {
      const locationPoint = this.formatLocationForPostGIS(location);
      
      const query = `
        SELECT id, user_id, ST_AsText(location) as location, radius,
               triggers, delivery_methods, active, created_at, updated_at
        FROM notification_rules
        WHERE active = true
          AND ST_DWithin(
            location::geography,
            ST_GeomFromText($1, 4326)::geography,
            $2 * 1000
          )
        ORDER BY created_at DESC
      `;
      
      const result = await client.query(query, [locationPoint, radiusKm]);
      return result.rows.map(row => this.mapDatabaseToNotificationRule(row));
    } catch (error) {
      logger.error('Error finding notification rules by location:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findUsersForPollutantAlert(
    location: Location,
    radiusKm: number,
    pollutant: string,
    currentValue: number
  ): Promise<{ user_id: string; delivery_methods: string[] }[]> {
    const client = await this.db.connect();
    
    try {
      const locationPoint = this.formatLocationForPostGIS(location);
      
      const query = `
        SELECT DISTINCT user_id, delivery_methods
        FROM notification_rules
        WHERE active = true
          AND ST_DWithin(
            location::geography,
            ST_GeomFromText($1, 4326)::geography,
            $2 * 1000
          )
          AND (
            triggers->'pollutant_thresholds'->$3 IS NOT NULL
            AND (triggers->'pollutant_thresholds'->>$3)::numeric <= $4
          )
      `;
      
      const result = await client.query(query, [locationPoint, radiusKm, pollutant, currentValue]);
      return result.rows;
    } catch (error) {
      logger.error('Error finding users for pollutant alert:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id: string, updates: Partial<CreateNotificationRule>): Promise<NotificationRule | null> {
    const client = await this.db.connect();
    
    try {
      const setParts: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.location) {
        setParts.push(`location = ST_GeomFromText($${paramIndex}, 4326)`);
        values.push(this.formatLocationForPostGIS(updates.location));
        paramIndex++;
        
        setParts.push(`radius = $${paramIndex}`);
        values.push(updates.location.radius);
        paramIndex++;
      }

      if (updates.triggers) {
        setParts.push(`triggers = $${paramIndex}`);
        values.push(JSON.stringify(updates.triggers));
        paramIndex++;
      }

      if (updates.delivery_methods) {
        setParts.push(`delivery_methods = $${paramIndex}`);
        values.push(updates.delivery_methods);
        paramIndex++;
      }

      if (updates.active !== undefined) {
        setParts.push(`active = $${paramIndex}`);
        values.push(updates.active);
        paramIndex++;
      }

      if (setParts.length === 0) {
        return null;
      }

      setParts.push('updated_at = NOW()');
      values.push(id);

      const query = `
        UPDATE notification_rules
        SET ${setParts.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, user_id, ST_AsText(location) as location, radius,
                  triggers, delivery_methods, active, created_at, updated_at
      `;

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }

      const dbRule = result.rows[0] as DatabaseNotificationRule & { radius: number };
      logger.info(`Updated notification rule ${id}`);
      return this.mapDatabaseToNotificationRule(dbRule);
    } catch (error) {
      logger.error('Error updating notification rule:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<boolean> {
    const client = await this.db.connect();
    
    try {
      const query = 'DELETE FROM notification_rules WHERE id = $1';
      const result = await client.query(query, [id]);
      
      const deleted = result.rowCount > 0;
      if (deleted) {
        logger.info(`Deleted notification rule ${id}`);
      }
      
      return deleted;
    } catch (error) {
      logger.error('Error deleting notification rule:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deactivate(id: string): Promise<boolean> {
    const client = await this.db.connect();
    
    try {
      const query = `
        UPDATE notification_rules
        SET active = false, updated_at = NOW()
        WHERE id = $1
      `;
      
      const result = await client.query(query, [id]);
      
      const updated = result.rowCount > 0;
      if (updated) {
        logger.info(`Deactivated notification rule ${id}`);
      }
      
      return updated;
    } catch (error) {
      logger.error('Error deactivating notification rule:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}