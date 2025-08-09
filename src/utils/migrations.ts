// Database migration utility
// Handles running migration scripts and tracking migration state

import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';

interface Migration {
  id: string;
  filename: string;
  applied_at: Date;
}

export class MigrationRunner {
  private db: Pool;
  private migrationsPath: string;

  constructor(migrationsPath: string = 'database/migrations') {
    this.db = getDatabase();
    this.migrationsPath = migrationsPath;
  }

  /**
   * Initialize migration tracking table
   */
  async initializeMigrationTable(): Promise<void> {
    const client = await this.db.connect();
    
    try {
      const query = `
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id VARCHAR(255) PRIMARY KEY,
          filename VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;
      
      await client.query(query);
      logger.info('Migration tracking table initialized');
    } catch (error) {
      logger.error('Error initializing migration table:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations(): Promise<Migration[]> {
    const client = await this.db.connect();
    
    try {
      const query = 'SELECT id, filename, applied_at FROM schema_migrations ORDER BY id';
      const result = await client.query(query);
      
      return result.rows.map(row => ({
        id: row.id,
        filename: row.filename,
        applied_at: row.applied_at
      }));
    } catch (error) {
      logger.error('Error getting applied migrations:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get list of pending migrations
   */
  async getPendingMigrations(): Promise<string[]> {
    try {
      // Get all migration files
      const migrationFiles = readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      // Get applied migrations
      const appliedMigrations = await this.getAppliedMigrations();
      const appliedIds = new Set(appliedMigrations.map(m => m.id));

      // Find pending migrations
      return migrationFiles.filter(file => {
        const migrationId = file.replace('.sql', '');
        return !appliedIds.has(migrationId);
      });
    } catch (error) {
      logger.error('Error getting pending migrations:', error);
      throw error;
    }
  }

  /**
   * Run a single migration
   */
  async runMigration(filename: string): Promise<void> {
    const client = await this.db.connect();
    
    try {
      const migrationId = filename.replace('.sql', '');
      const migrationPath = join(this.migrationsPath, filename);
      const migrationSQL = readFileSync(migrationPath, 'utf8');

      logger.info(`Running migration: ${filename}`);

      await client.query('BEGIN');

      // Execute migration SQL
      await client.query(migrationSQL);

      // Record migration as applied
      const recordQuery = `
        INSERT INTO schema_migrations (id, filename, applied_at)
        VALUES ($1, $2, NOW())
      `;
      await client.query(recordQuery, [migrationId, filename]);

      await client.query('COMMIT');
      logger.info(`Migration completed: ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Migration failed: ${filename}`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run all pending migrations
   */
  async runPendingMigrations(): Promise<void> {
    try {
      await this.initializeMigrationTable();
      
      const pendingMigrations = await this.getPendingMigrations();
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations to run');
        return;
      }

      logger.info(`Found ${pendingMigrations.length} pending migrations`);

      for (const migration of pendingMigrations) {
        await this.runMigration(migration);
      }

      logger.info('All pending migrations completed successfully');
    } catch (error) {
      logger.error('Error running pending migrations:', error);
      throw error;
    }
  }

  /**
   * Check migration status
   */
  async getMigrationStatus(): Promise<{
    applied: Migration[];
    pending: string[];
  }> {
    try {
      await this.initializeMigrationTable();
      
      const applied = await this.getAppliedMigrations();
      const pending = await this.getPendingMigrations();

      return { applied, pending };
    } catch (error) {
      logger.error('Error getting migration status:', error);
      throw error;
    }
  }

  /**
   * Rollback last migration (use with caution)
   */
  async rollbackLastMigration(): Promise<void> {
    const client = await this.db.connect();
    
    try {
      // Get last applied migration
      const query = `
        SELECT id, filename FROM schema_migrations 
        ORDER BY applied_at DESC 
        LIMIT 1
      `;
      const result = await client.query(query);
      
      if (result.rows.length === 0) {
        logger.info('No migrations to rollback');
        return;
      }

      const lastMigration = result.rows[0];
      logger.warn(`Rolling back migration: ${lastMigration.filename}`);

      await client.query('BEGIN');

      // Remove migration record
      const deleteQuery = 'DELETE FROM schema_migrations WHERE id = $1';
      await client.query(deleteQuery, [lastMigration.id]);

      await client.query('COMMIT');
      
      logger.warn(`Migration rollback completed: ${lastMigration.filename}`);
      logger.warn('Note: This only removes the migration record. Manual schema changes may be required.');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error rolling back migration:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}