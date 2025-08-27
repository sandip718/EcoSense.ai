// Offline Service for EcoSense.ai Mobile App
// Implements requirement 10.5: Offline data caching for basic functionality without internet

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {EnvironmentalDataPoint, CommunityRecommendation, Location} from '@/types/api';
import {logger} from '@/utils/logger';

export interface CachedData {
  environmentalData: EnvironmentalDataPoint[];
  recommendations: CommunityRecommendation[];
  pendingUploads: PendingUpload[];
  lastSync: Date;
}

export interface PendingUpload {
  id: string;
  type: 'image' | 'user_action' | 'feedback';
  data: any;
  location?: Location;
  timestamp: Date;
  retryCount: number;
}

export class OfflineService {
  private static readonly CACHE_KEYS = {
    ENVIRONMENTAL_DATA: 'cached_environmental_data',
    RECOMMENDATIONS: 'cached_recommendations',
    PENDING_UPLOADS: 'pending_uploads',
    LAST_SYNC: 'last_sync_time',
    USER_PREFERENCES: 'cached_user_preferences',
    OFFLINE_ACTIONS: 'offline_actions',
  };

  private static readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly MAX_RETRY_COUNT = 3;
  private static isOnline = true;

  /**
   * Initialize offline service
   */
  static async initialize(): Promise<void> {
    try {
      logger.info('Initializing OfflineService');

      // Set up network state listener
      NetInfo.addEventListener(state => {
        const wasOnline = this.isOnline;
        this.isOnline = state.isConnected ?? false;
        
        logger.info('Network state changed:', {
          isConnected: state.isConnected,
          type: state.type,
          isInternetReachable: state.isInternetReachable,
        });

        // If we just came back online, sync pending data
        if (!wasOnline && this.isOnline) {
          this.syncPendingData().catch(error => {
            logger.error('Auto-sync failed after coming online:', error);
          });
        }
      });

      // Get initial network state
      const netInfo = await NetInfo.fetch();
      this.isOnline = netInfo.isConnected ?? false;

      logger.info('OfflineService initialized successfully', {isOnline: this.isOnline});
    } catch (error) {
      logger.error('Failed to initialize OfflineService:', error);
      throw error;
    }
  }

  /**
   * Check if device is online
   */
  static isDeviceOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Cache environmental data
   */
  static async cacheEnvironmentalData(data: EnvironmentalDataPoint[]): Promise<void> {
    try {
      const cacheData = {
        data,
        timestamp: new Date().toISOString(),
        location: data[0]?.location,
      };

      await AsyncStorage.setItem(
        this.CACHE_KEYS.ENVIRONMENTAL_DATA,
        JSON.stringify(cacheData)
      );

      logger.debug('Environmental data cached successfully', {count: data.length});
    } catch (error) {
      logger.error('Failed to cache environmental data:', error);
      throw error;
    }
  }

  /**
   * Get cached environmental data
   */
  static async getCachedEnvironmentalData(): Promise<EnvironmentalDataPoint[]> {
    try {
      const cached = await AsyncStorage.getItem(this.CACHE_KEYS.ENVIRONMENTAL_DATA);
      
      if (!cached) {
        return [];
      }

      const cacheData = JSON.parse(cached);
      
      // Check if cache is still valid (e.g., less than 1 hour old)
      const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
      const maxAge = 60 * 60 * 1000; // 1 hour
      
      if (cacheAge > maxAge) {
        logger.debug('Cached environmental data expired');
        return [];
      }

      logger.debug('Retrieved cached environmental data', {count: cacheData.data.length});
      return cacheData.data;
    } catch (error) {
      logger.error('Failed to get cached environmental data:', error);
      return [];
    }
  }

  /**
   * Cache community recommendations
   */
  static async cacheRecommendations(recommendations: CommunityRecommendation[]): Promise<void> {
    try {
      const cacheData = {
        recommendations,
        timestamp: new Date().toISOString(),
      };

      await AsyncStorage.setItem(
        this.CACHE_KEYS.RECOMMENDATIONS,
        JSON.stringify(cacheData)
      );

      logger.debug('Recommendations cached successfully', {count: recommendations.length});
    } catch (error) {
      logger.error('Failed to cache recommendations:', error);
      throw error;
    }
  }

  /**
   * Get cached recommendations
   */
  static async getCachedRecommendations(): Promise<CommunityRecommendation[]> {
    try {
      const cached = await AsyncStorage.getItem(this.CACHE_KEYS.RECOMMENDATIONS);
      
      if (!cached) {
        return [];
      }

      const cacheData = JSON.parse(cached);
      
      // Check if cache is still valid (e.g., less than 24 hours old)
      const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (cacheAge > maxAge) {
        logger.debug('Cached recommendations expired');
        return [];
      }

      logger.debug('Retrieved cached recommendations', {count: cacheData.recommendations.length});
      return cacheData.recommendations;
    } catch (error) {
      logger.error('Failed to get cached recommendations:', error);
      return [];
    }
  }

  /**
   * Add pending upload for when device comes back online
   */
  static async addPendingUpload(upload: Omit<PendingUpload, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    try {
      const pendingUpload: PendingUpload = {
        ...upload,
        id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        retryCount: 0,
      };

      const existing = await this.getPendingUploads();
      existing.push(pendingUpload);

      await AsyncStorage.setItem(
        this.CACHE_KEYS.PENDING_UPLOADS,
        JSON.stringify(existing)
      );

      logger.debug('Added pending upload', {id: pendingUpload.id, type: pendingUpload.type});
    } catch (error) {
      logger.error('Failed to add pending upload:', error);
      throw error;
    }
  }

  /**
   * Get pending uploads
   */
  static async getPendingUploads(): Promise<PendingUpload[]> {
    try {
      const cached = await AsyncStorage.getItem(this.CACHE_KEYS.PENDING_UPLOADS);
      
      if (!cached) {
        return [];
      }

      const uploads = JSON.parse(cached);
      logger.debug('Retrieved pending uploads', {count: uploads.length});
      return uploads;
    } catch (error) {
      logger.error('Failed to get pending uploads:', error);
      return [];
    }
  }

  /**
   * Remove pending upload after successful sync
   */
  static async removePendingUpload(uploadId: string): Promise<void> {
    try {
      const existing = await this.getPendingUploads();
      const filtered = existing.filter(upload => upload.id !== uploadId);

      await AsyncStorage.setItem(
        this.CACHE_KEYS.PENDING_UPLOADS,
        JSON.stringify(filtered)
      );

      logger.debug('Removed pending upload', {id: uploadId});
    } catch (error) {
      logger.error('Failed to remove pending upload:', error);
      throw error;
    }
  }

  /**
   * Sync pending data when device comes back online
   */
  static async syncPendingData(): Promise<{synced: number; failed: number; remainingUploads: PendingUpload[]}> {
    try {
      if (!this.isOnline) {
        throw new Error('Device is offline, cannot sync');
      }

      logger.info('Starting sync of pending data');

      const pendingUploads = await this.getPendingUploads();
      let synced = 0;
      let failed = 0;
      const remainingUploads: PendingUpload[] = [];

      for (const upload of pendingUploads) {
        try {
          await this.processPendingUpload(upload);
          synced++;
          logger.debug('Successfully synced upload', {id: upload.id});
        } catch (error) {
          upload.retryCount++;
          
          if (upload.retryCount >= this.MAX_RETRY_COUNT) {
            failed++;
            logger.error('Upload failed after max retries', {id: upload.id, error});
          } else {
            remainingUploads.push(upload);
            logger.warn('Upload failed, will retry', {id: upload.id, retryCount: upload.retryCount});
          }
        }
      }

      // Update pending uploads list
      await AsyncStorage.setItem(
        this.CACHE_KEYS.PENDING_UPLOADS,
        JSON.stringify(remainingUploads)
      );

      // Update last sync time
      await AsyncStorage.setItem(
        this.CACHE_KEYS.LAST_SYNC,
        new Date().toISOString()
      );

      logger.info('Sync completed', {synced, failed, remaining: remainingUploads.length});

      return {synced, failed, remainingUploads};
    } catch (error) {
      logger.error('Failed to sync pending data:', error);
      throw error;
    }
  }

  /**
   * Process a single pending upload
   */
  private static async processPendingUpload(upload: PendingUpload): Promise<void> {
    // This would integrate with your API service to actually upload the data
    // For now, we'll simulate the upload
    logger.debug('Processing pending upload', {id: upload.id, type: upload.type});
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate occasional failures for testing
    if (Math.random() < 0.1) {
      throw new Error('Simulated upload failure');
    }
  }

  /**
   * Get all cached data
   */
  static async getCachedData(): Promise<{
    environmentalData: EnvironmentalDataPoint[];
    recommendations: CommunityRecommendation[];
    pendingUploads: PendingUpload[];
  }> {
    try {
      const [environmentalData, recommendations, pendingUploads] = await Promise.all([
        this.getCachedEnvironmentalData(),
        this.getCachedRecommendations(),
        this.getPendingUploads(),
      ]);

      return {
        environmentalData,
        recommendations,
        pendingUploads,
      };
    } catch (error) {
      logger.error('Failed to get cached data:', error);
      throw error;
    }
  }

  /**
   * Clear all cached data
   */
  static async clearCache(): Promise<void> {
    try {
      const keys = Object.values(this.CACHE_KEYS);
      await AsyncStorage.multiRemove(keys);
      logger.info('All cached data cleared');
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Get cache size in bytes
   */
  static async getCacheSize(): Promise<number> {
    try {
      const keys = Object.values(this.CACHE_KEYS);
      let totalSize = 0;

      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += new Blob([value]).size;
        }
      }

      return totalSize;
    } catch (error) {
      logger.error('Failed to calculate cache size:', error);
      return 0;
    }
  }

  /**
   * Check if cache size exceeds limit and clean up if necessary
   */
  static async manageCacheSize(): Promise<void> {
    try {
      const currentSize = await this.getCacheSize();
      
      if (currentSize > this.MAX_CACHE_SIZE) {
        logger.warn('Cache size exceeded limit, cleaning up', {
          currentSize,
          maxSize: this.MAX_CACHE_SIZE,
        });

        // Clear oldest cached data first
        await AsyncStorage.removeItem(this.CACHE_KEYS.ENVIRONMENTAL_DATA);
        await AsyncStorage.removeItem(this.CACHE_KEYS.RECOMMENDATIONS);
      }
    } catch (error) {
      logger.error('Failed to manage cache size:', error);
    }
  }

  /**
   * Get last sync time
   */
  static async getLastSyncTime(): Promise<Date | null> {
    try {
      const lastSync = await AsyncStorage.getItem(this.CACHE_KEYS.LAST_SYNC);
      return lastSync ? new Date(lastSync) : null;
    } catch (error) {
      logger.error('Failed to get last sync time:', error);
      return null;
    }
  }
}

export default OfflineService;