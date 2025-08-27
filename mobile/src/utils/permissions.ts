// Permissions Utility for EcoSense.ai Mobile App
// Handles all permission requests for the mobile app

import {Platform, PermissionsAndroid, Alert} from 'react-native';
import {check, request, PERMISSIONS, RESULTS, Permission} from 'react-native-permissions';
import {logger} from './logger';

export interface PermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
}

export class PermissionManager {
  /**
   * Request all necessary permissions for the app
   */
  static async requestAllPermissions(): Promise<{
    location: PermissionStatus;
    camera: PermissionStatus;
    notifications: PermissionStatus;
  }> {
    try {
      logger.info('Requesting all app permissions');

      const [location, camera, notifications] = await Promise.all([
        this.requestLocationPermission(),
        this.requestCameraPermission(),
        this.requestNotificationPermission(),
      ]);

      const results = {location, camera, notifications};
      logger.info('Permission request results:', results);

      return results;
    } catch (error) {
      logger.error('Error requesting permissions:', error);
      throw error;
    }
  }

  /**
   * Request location permission
   */
  static async requestLocationPermission(): Promise<PermissionStatus> {
    try {
      const permission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE 
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

      const result = await this.requestPermission(
        permission,
        'Location Access',
        'EcoSense needs access to your location to provide environmental data for your area and enable location-based features.',
        'Location access is required to show environmental data for your area. You can enable it in Settings.'
      );

      return result;
    } catch (error) {
      logger.error('Error requesting location permission:', error);
      return {granted: false, canAskAgain: false, status: 'error'};
    }
  }

  /**
   * Request camera permission
   */
  static async requestCameraPermission(): Promise<PermissionStatus> {
    try {
      const permission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.CAMERA 
        : PERMISSIONS.ANDROID.CAMERA;

      const result = await this.requestPermission(
        permission,
        'Camera Access',
        'EcoSense needs access to your camera to capture environmental photos for analysis.',
        'Camera access is required to capture and analyze environmental photos. You can enable it in Settings.'
      );

      return result;
    } catch (error) {
      logger.error('Error requesting camera permission:', error);
      return {granted: false, canAskAgain: false, status: 'error'};
    }
  }

  /**
   * Request notification permission
   */
  static async requestNotificationPermission(): Promise<PermissionStatus> {
    try {
      if (Platform.OS === 'android') {
        // For Android 13+ (API level 33+), we need to request POST_NOTIFICATIONS permission
        if (Platform.Version >= 33) {
          const permission = PERMISSIONS.ANDROID.POST_NOTIFICATIONS;
          const result = await this.requestPermission(
            permission,
            'Notification Access',
            'EcoSense needs permission to send you important environmental alerts and updates.',
            'Notification permission is required to receive environmental alerts. You can enable it in Settings.'
          );
          return result;
        } else {
          // For older Android versions, notifications are granted by default
          return {granted: true, canAskAgain: true, status: 'granted'};
        }
      }

      const permission = PERMISSIONS.IOS.NOTIFICATIONS;
      const result = await this.requestPermission(
        permission,
        'Notification Access',
        'EcoSense would like to send you notifications about environmental conditions and alerts in your area.',
        'Notifications help you stay informed about environmental conditions. You can enable them in Settings.'
      );

      return result;
    } catch (error) {
      logger.error('Error requesting notification permission:', error);
      return {granted: false, canAskAgain: false, status: 'error'};
    }
  }

  /**
   * Generic permission request handler
   */
  private static async requestPermission(
    permission: Permission,
    title: string,
    message: string,
    deniedMessage: string
  ): Promise<PermissionStatus> {
    try {
      // Check current status
      const currentStatus = await check(permission);
      
      if (currentStatus === RESULTS.GRANTED) {
        return {granted: true, canAskAgain: true, status: currentStatus};
      }

      if (currentStatus === RESULTS.DENIED) {
        // Show rationale and request permission
        const shouldRequest = await this.showPermissionRationale(title, message);
        
        if (!shouldRequest) {
          return {granted: false, canAskAgain: true, status: 'denied_by_user'};
        }

        const result = await request(permission);
        
        return {
          granted: result === RESULTS.GRANTED,
          canAskAgain: result !== RESULTS.BLOCKED,
          status: result,
        };
      }

      if (currentStatus === RESULTS.BLOCKED) {
        // Permission is permanently denied, show settings alert
        this.showSettingsAlert(title, deniedMessage);
        return {granted: false, canAskAgain: false, status: currentStatus};
      }

      return {granted: false, canAskAgain: false, status: currentStatus};
    } catch (error) {
      logger.error('Error in permission request:', error);
      return {granted: false, canAskAgain: false, status: 'error'};
    }
  }

  /**
   * Show permission rationale dialog
   */
  private static async showPermissionRationale(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        title,
        message,
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Allow',
            onPress: () => resolve(true),
          },
        ],
        {cancelable: false}
      );
    });
  }

  /**
   * Show settings alert for blocked permissions
   */
  private static showSettingsAlert(title: string, message: string): void {
    Alert.alert(
      `${title} Required`,
      `${message}\n\nWould you like to open Settings to enable this permission?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Open Settings',
          onPress: () => {
            // This would typically open the app settings
            // Implementation depends on the library used
            logger.info('User chose to open settings for permission');
          },
        },
      ]
    );
  }

  /**
   * Check if all critical permissions are granted
   */
  static async checkCriticalPermissions(): Promise<boolean> {
    try {
      const locationStatus = await check(
        Platform.OS === 'ios' 
          ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE 
          : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
      );

      // Location is the only critical permission for basic functionality
      return locationStatus === RESULTS.GRANTED;
    } catch (error) {
      logger.error('Error checking critical permissions:', error);
      return false;
    }
  }

  /**
   * Get status of all permissions
   */
  static async getAllPermissionStatuses(): Promise<{
    location: string;
    camera: string;
    notifications: string;
  }> {
    try {
      const [location, camera, notifications] = await Promise.all([
        check(Platform.OS === 'ios' ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION),
        check(Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA),
        Platform.OS === 'ios' ? check(PERMISSIONS.IOS.NOTIFICATIONS) : Promise.resolve(RESULTS.GRANTED),
      ]);

      return {
        location,
        camera,
        notifications,
      };
    } catch (error) {
      logger.error('Error getting permission statuses:', error);
      return {
        location: RESULTS.UNAVAILABLE,
        camera: RESULTS.UNAVAILABLE,
        notifications: RESULTS.UNAVAILABLE,
      };
    }
  }
}

/**
 * Convenience function to request all permissions
 */
export const requestPermissions = PermissionManager.requestAllPermissions;

/**
 * Check if permission is granted
 */
export const isPermissionGranted = (status: string): boolean => {
  return status === RESULTS.GRANTED;
};

/**
 * Check if permission can be requested again
 */
export const canRequestPermission = (status: string): boolean => {
  return status === RESULTS.DENIED;
};

export default PermissionManager;