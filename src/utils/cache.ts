import { getRedisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

export class CacheService {
  private redis = getRedisClient();

  /**
   * Set a value in cache with optional expiration
   */
  async set(key: string, value: string | object, expirationSeconds?: number): Promise<void> {
    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (expirationSeconds) {
        await this.redis.setEx(key, expirationSeconds, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }
      
      logger.debug(`Cache set: ${key}`);
    } catch (error) {
      logger.error(`Failed to set cache key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get a value from cache
   */
  async get<T = string>(key: string, parseJson = false): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      
      if (value === null) {
        return null;
      }

      if (parseJson) {
        return JSON.parse(value) as T;
      }
      
      return value as T;
    } catch (error) {
      logger.error(`Failed to get cache key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      logger.error(`Failed to delete cache key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Failed to check cache key existence ${key}:`, error);
      return false;
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.redis.expire(key, seconds);
      logger.debug(`Cache expiration set for ${key}: ${seconds}s`);
    } catch (error) {
      logger.error(`Failed to set expiration for cache key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    try {
      return await this.redis.mGet(keys);
    } catch (error) {
      logger.error(`Failed to get multiple cache keys:`, error);
      return keys.map(() => null);
    }
  }

  /**
   * Increment a numeric value in cache
   */
  async increment(key: string, by = 1): Promise<number> {
    try {
      return await this.redis.incrBy(key, by);
    } catch (error) {
      logger.error(`Failed to increment cache key ${key}:`, error);
      throw error;
    }
  }
}

export const cacheService = new CacheService();