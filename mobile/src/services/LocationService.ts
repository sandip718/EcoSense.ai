// Location Service for EcoSense.ai Mobile App
// Implements requirement 10.2: Location services integration for automatic location detection

import Geolocation from '@react-native-community/geolocation';
import {PermissionsAndroid, Platform} from 'react-native';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';
import {Location} from '@/types/api';
import {logger} from '@/utils/logger';

export class LocationService {
  private static watchId: number | null = null;
  private static locationCallback: ((location: Location) => void) | null = null;

  /**
   * Initialize location service
   */
  static async initialize(): Promise<void> {
    try {
      logger.info('Initializing LocationService');
      
      // Configure geolocation
      Geolocation.setRNConfiguration({
        skipPermissionRequests: false,
        authorizationLevel: 'whenInUse',
        enableBackgroundLocationUpdates: false,
        locationProvider: 'auto',
      });

      logger.info('LocationService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize LocationService:', error);
      throw error;
    }
  }

  /**
   * Request location permission
   */
  static async requestPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'EcoSense Location Permission',
            message: 'EcoSense needs access to your location to provide environmental data for your area.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const result = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
        return result === RESULTS.GRANTED;
      }
    } catch (error) {
      logger.error('Error requesting location permission:', error);
      return false;
    }
  }

  /**
   * Check location permission status
   */
  static async checkPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const result = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
        return result === RESULTS.GRANTED;
      } else {
        const result = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
        return result === RESULTS.GRANTED;
      }
    } catch (error) {
      logger.error('Error checking location permission:', error);
      return false;
    }
  }

  /**
   * Get current location
   */
  static async getCurrentLocation(): Promise<Location> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const location: Location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          
          logger.debug('Current location obtained:', location);
          resolve(location);
        },
        (error) => {
          logger.error('Error getting current location:', error);
          reject(new Error(`Location error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  }

  /**
   * Start location tracking
   */
  static async startTracking(callback?: (location: Location) => void): Promise<void> {
    try {
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        throw new Error('Location permission not granted');
      }

      if (callback) {
        this.locationCallback = callback;
      }

      this.watchId = Geolocation.watchPosition(
        (position) => {
          const location: Location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          
          logger.debug('Location update:', location);
          
          if (this.locationCallback) {
            this.locationCallback(location);
          }
        },
        (error) => {
          logger.error('Location tracking error:', error);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10, // Update every 10 meters
          interval: 30000, // Update every 30 seconds
          fastestInterval: 10000, // Fastest update every 10 seconds
        }
      );

      logger.info('Location tracking started');
    } catch (error) {
      logger.error('Failed to start location tracking:', error);
      throw error;
    }
  }

  /**
   * Stop location tracking
   */
  static async stopTracking(): Promise<void> {
    try {
      if (this.watchId !== null) {
        Geolocation.clearWatch(this.watchId);
        this.watchId = null;
        this.locationCallback = null;
        logger.info('Location tracking stopped');
      }
    } catch (error) {
      logger.error('Failed to stop location tracking:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two locations (in kilometers)
   */
  static calculateDistance(location1: Location, location2: Location): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(location2.latitude - location1.latitude);
    const dLon = this.toRadians(location2.longitude - location1.longitude);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(location1.latitude)) * 
      Math.cos(this.toRadians(location2.latitude)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  /**
   * Convert degrees to radians
   */
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get location from address (geocoding)
   */
  static async geocodeAddress(address: string): Promise<Location> {
    // This would typically use a geocoding service like Google Maps
    // For now, return a placeholder implementation
    throw new Error('Geocoding not implemented yet');
  }

  /**
   * Get address from location (reverse geocoding)
   */
  static async reverseGeocode(location: Location): Promise<string> {
    // This would typically use a reverse geocoding service
    // For now, return a placeholder implementation
    return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
  }

  /**
   * Check if location services are enabled
   */
  static async isLocationEnabled(): Promise<boolean> {
    try {
      // This is a simplified check - in a real app you might want to use
      // a library like react-native-device-info for more accurate detection
      const hasPermission = await this.checkPermission();
      return hasPermission;
    } catch (error) {
      logger.error('Error checking if location is enabled:', error);
      return false;
    }
  }
}

export default LocationService;