import { Pool } from 'pg';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';
import {
  Alert,
  CreateAlert,
  Location
} from './types';

export class AlertRepository {
  private db: Pool;

  constructor() {
    this.db = getDatabase();
  }

  private parseLocationFromPostGIS(locationStr: string): Location {
    // Parse PostGIS POINT format: "POINT(longitude latitude)"
    const match = locationStr.match(/POINT\(([^)]+)\)/);
    if (!match) {
      throw new Error('Invalid PostGIS POINT format');
    }
    
    const [longitude, latitude] = match[1].split(' ').map(Number);
    return { latitude, longitude };
  }

  private formatLocationForPostGIS(location: Location): string {
    return `POINT(${location.longitude} ${location.latitude})`;
  }

  private mapDatabaseToAlert(dbAlert: any): Alert {
    return {
      id: dbAlert.id,
      type: dbAlert.type,
      severity: dbAlert.severity,
      title: dbAlert.title,
      message: dbAlert.message,
      location: this.parseLocationFromPostGIS(dbAlert.location),
      affected_radius: parseFloat(dbAlert.affected_radius),
      pollutant: dbAlert.pollutant,
      current_value: dbAlert.current_value ? parseFloat(dbAlert.current_value) : undefined,
      threshold_value: dbAlert.threshold_value ? parseFloat(dbAlert.threshold_value) : undefined,
      expires_at: dbAlert.expires_at,
      created_at: dbAlert.created_at
    };
  }

  async create(alert: CreateAlert): Promise<Alert> {
    const client = await this.db.connect();
    
    try {
      const locationPoint = this.formatLocationForPostGIS(alert.location);
      
      const query = `
        INSERT INTO alerts (
          type, severity, title, message, location, affected_radius,
          pollutant, current_value, threshold_value, expires_at
        ) VALUES ($1, $2, $3, $4, ST_GeomFromText($5, 4326), $6, $7, $8, $9, $10)
        RETURNING id, type, severity, title, message, ST_AsText(location) as location,
                  affected_radius, pollutant, current_value, threshold_value,
                  expires_at, created_at
      `;
      
      const values = [
        alert.type,
        alert.severity,
        alert.title,
        alert.message,
        locationPoint,
        alert.affected_radius,
        alert.pollutant,
        alert.current_value,
        alert.threshold_value,
        alert.expires_at
      ];
      
      const result = await client.query(query, values);
      const dbAlert = result.rows[0];
      
      logger.info(`Created alert ${dbAlert.id} of type ${alert.type} at location ${alert.location.latitude}, ${alert.location.longitude}`);
      return this.mapDatabaseToAlert(dbAlert);
    } catch (error) {
      logger.error('Error creating alert:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findActiveByLocation(location: Location, radiusKm: number): Promise<Alert[]> {
    const client = await this.db.connect();
    
    try {
      const locationPoint = this.formatLocationForPostGIS(location);
      
      const query = `
        SELECT id, type, severity, title, message, ST_AsText(location) as location,
               affected_radius, pollutant, current_value, threshold_value,
               expires_at, created_at
        FROM alerts
        WHERE expires_at > NOW()
          AND ST_DWithin(
            location::geography,
            ST_GeomFromText($1, 4326)::geography,
            $2 * 1000
          )
        ORDER BY severity DESC, created_at DESC
      `;
      
      const result = await client.query(query, [locationPoint, radiusKm]);
      return result.rows.map(row => this.mapDatabaseToAlert(row));
    } catch (error) {
      logger.error('Error finding active alerts by location:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<Alert | null> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT id, type, severity, title, message, ST_AsText(location) as location,
               affected_radius, pollutant, current_value, threshold_value,
               expires_at, created_at
        FROM alerts
        WHERE id = $1
      `;
      
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapDatabaseToAlert(result.rows[0]);
    } catch (error) {
      logger.error('Error finding alert by ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findRecentBySeverity(severity: 'info' | 'warning' | 'critical', limit: number = 10): Promise<Alert[]> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT id, type, severity, title, message, ST_AsText(location) as location,
               affected_radius, pollutant, current_value, threshold_value,
               expires_at, created_at
        FROM alerts
        WHERE severity = $1 AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT $2
      `;
      
      const result = await client.query(query, [severity, limit]);
      return result.rows.map(row => this.mapDatabaseToAlert(row));
    } catch (error) {
      logger.error('Error finding recent alerts by severity:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findByPollutant(pollutant: string, location?: Location, radiusKm?: number): Promise<Alert[]> {
    const client = await this.db.connect();
    
    try {
      let query = `
        SELECT id, type, severity, title, message, ST_AsText(location) as location,
               affected_radius, pollutant, current_value, threshold_value,
               expires_at, created_at
        FROM alerts
        WHERE pollutant = $1 AND expires_at > NOW()
      `;
      
      const values: any[] = [pollutant];
      
      if (location && radiusKm) {
        const locationPoint = this.formatLocationForPostGIS(location);
        query += ` AND ST_DWithin(
          location::geography,
          ST_GeomFromText($2, 4326)::geography,
          $3 * 1000
        )`;
        values.push(locationPoint, radiusKm);
      }
      
      query += ' ORDER BY severity DESC, created_at DESC';
      
      const result = await client.query(query, values);
      return result.rows.map(row => this.mapDatabaseToAlert(row));
    } catch (error) {
      logger.error('Error finding alerts by pollutant:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async cleanupExpiredAlerts(): Promise<number> {
    const client = await this.db.connect();
    
    try {
      const query = 'DELETE FROM alerts WHERE expires_at <= NOW()';
      const result = await client.query(query);
      
      const deletedCount = result.rowCount;
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} expired alerts`);
      }
      
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up expired alerts:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getAlertStatistics(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<{
    total: number;
    by_severity: { [key: string]: number };
    by_type: { [key: string]: number };
  }> {
    const client = await this.db.connect();
    
    try {
      let timeCondition = '';
      switch (timeframe) {
        case 'hour':
          timeCondition = "created_at >= NOW() - INTERVAL '1 hour'";
          break;
        case 'day':
          timeCondition = "created_at >= NOW() - INTERVAL '1 day'";
          break;
        case 'week':
          timeCondition = "created_at >= NOW() - INTERVAL '1 week'";
          break;
      }
      
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE severity = 'info') as info_count,
          COUNT(*) FILTER (WHERE severity = 'warning') as warning_count,
          COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
          COUNT(*) FILTER (WHERE type = 'health_warning') as health_warning_count,
          COUNT(*) FILTER (WHERE type = 'trend_alert') as trend_alert_count,
          COUNT(*) FILTER (WHERE type = 'community_update') as community_update_count,
          COUNT(*) FILTER (WHERE type = 'threshold_breach') as threshold_breach_count
        FROM alerts
        WHERE ${timeCondition}
      `;
      
      const result = await client.query(query);
      const row = result.rows[0];
      
      return {
        total: parseInt(row.total),
        by_severity: {
          info: parseInt(row.info_count),
          warning: parseInt(row.warning_count),
          critical: parseInt(row.critical_count)
        },
        by_type: {
          health_warning: parseInt(row.health_warning_count),
          trend_alert: parseInt(row.trend_alert_count),
          community_update: parseInt(row.community_update_count),
          threshold_breach: parseInt(row.threshold_breach_count)
        }
      };
    } catch (error) {
      logger.error('Error getting alert statistics:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}