// Camera Service for EcoSense.ai Mobile App
// Implements requirement 10.2: Camera integration for environmental photo capture

import {launchCamera, launchImageLibrary, ImagePickerResponse, MediaType} from 'react-native-image-picker';
import {PermissionsAndroid, Platform} from 'react-native';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';
import {ApiService} from './ApiService';
import {ImageAnalysis, Location} from '@/types/api';
import {logger} from '@/utils/logger';

export interface CameraOptions {
  mediaType?: MediaType;
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  includeBase64?: boolean;
  saveToPhotos?: boolean;
}

export class CameraService {
  /**
   * Request camera permission
   */
  static async requestPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'EcoSense Camera Permission',
            message: 'EcoSense needs access to your camera to capture environmental photos for analysis.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const result = await request(PERMISSIONS.IOS.CAMERA);
        return result === RESULTS.GRANTED;
      }
    } catch (error) {
      logger.error('Error requesting camera permission:', error);
      return false;
    }
  }

  /**
   * Check camera permission status
   */
  static async checkPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const result = await check(PERMISSIONS.ANDROID.CAMERA);
        return result === RESULTS.GRANTED;
      } else {
        const result = await check(PERMISSIONS.IOS.CAMERA);
        return result === RESULTS.GRANTED;
      }
    } catch (error) {
      logger.error('Error checking camera permission:', error);
      return false;
    }
  }

  /**
   * Capture image using camera
   */
  static async captureImage(options: CameraOptions = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      const defaultOptions = {
        mediaType: 'photo' as MediaType,
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1080,
        includeBase64: false,
        saveToPhotos: true,
        ...options,
      };

      launchCamera(defaultOptions, (response: ImagePickerResponse) => {
        if (response.didCancel) {
          reject(new Error('User cancelled camera'));
          return;
        }

        if (response.errorMessage) {
          reject(new Error(response.errorMessage));
          return;
        }

        if (response.assets && response.assets.length > 0) {
          const asset = response.assets[0];
          if (asset.uri) {
            logger.info('Image captured successfully:', asset.uri);
            resolve(asset.uri);
          } else {
            reject(new Error('No image URI received'));
          }
        } else {
          reject(new Error('No image captured'));
        }
      });
    });
  }

  /**
   * Select image from gallery
   */
  static async selectFromGallery(options: CameraOptions = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      const defaultOptions = {
        mediaType: 'photo' as MediaType,
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1080,
        includeBase64: false,
        ...options,
      };

      launchImageLibrary(defaultOptions, (response: ImagePickerResponse) => {
        if (response.didCancel) {
          reject(new Error('User cancelled gallery selection'));
          return;
        }

        if (response.errorMessage) {
          reject(new Error(response.errorMessage));
          return;
        }

        if (response.assets && response.assets.length > 0) {
          const asset = response.assets[0];
          if (asset.uri) {
            logger.info('Image selected from gallery:', asset.uri);
            resolve(asset.uri);
          } else {
            reject(new Error('No image URI received'));
          }
        } else {
          reject(new Error('No image selected'));
        }
      });
    });
  }

  /**
   * Upload image to server
   */
  static async uploadImage(
    imageUri: string,
    location?: Location,
    metadata?: any
  ): Promise<{imageUrl: string; analysisId: string}> {
    try {
      logger.info('Uploading image:', imageUri);

      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'environmental_photo.jpg',
      } as any);

      if (location) {
        formData.append('location', JSON.stringify(location));
      }

      if (metadata) {
        formData.append('metadata', JSON.stringify(metadata));
      }

      const response = await ApiService.uploadImage(formData);
      
      logger.info('Image uploaded successfully:', response);
      return response;
    } catch (error) {
      logger.error('Failed to upload image:', error);
      throw error;
    }
  }

  /**
   * Analyze image for environmental indicators
   */
  static async analyzeImage(imageUri: string, location?: Location): Promise<ImageAnalysis> {
    try {
      logger.info('Starting image analysis:', imageUri);

      // First upload the image
      const uploadResult = await this.uploadImage(imageUri, location);
      
      // Then get the analysis results
      const analysis = await ApiService.getImageAnalysis(uploadResult.analysisId);
      
      logger.info('Image analysis completed:', analysis);
      return analysis;
    } catch (error) {
      logger.error('Failed to analyze image:', error);
      throw error;
    }
  }

  /**
   * Get analysis status
   */
  static async getAnalysisStatus(analysisId: string): Promise<ImageAnalysis> {
    try {
      const analysis = await ApiService.getImageAnalysis(analysisId);
      return analysis;
    } catch (error) {
      logger.error('Failed to get analysis status:', error);
      throw error;
    }
  }

  /**
   * Validate image for environmental analysis
   */
  static validateImageForAnalysis(imageUri: string): {valid: boolean; message?: string} {
    // Basic validation - in a real app you might check file size, format, etc.
    if (!imageUri) {
      return {valid: false, message: 'No image provided'};
    }

    if (!imageUri.startsWith('file://') && !imageUri.startsWith('content://')) {
      return {valid: false, message: 'Invalid image URI format'};
    }

    return {valid: true};
  }

  /**
   * Compress image for upload
   */
  static async compressImage(imageUri: string, quality: number = 0.8): Promise<string> {
    // This would typically use a library like react-native-image-resizer
    // For now, return the original URI
    logger.info('Image compression not implemented, returning original URI');
    return imageUri;
  }

  /**
   * Get image metadata
   */
  static async getImageMetadata(imageUri: string): Promise<any> {
    // This would typically extract EXIF data and other metadata
    // For now, return basic metadata
    return {
      uri: imageUri,
      timestamp: new Date().toISOString(),
      source: 'camera',
    };
  }

  /**
   * Delete local image file
   */
  static async deleteLocalImage(imageUri: string): Promise<void> {
    try {
      // This would typically delete the local file
      // Implementation depends on the file system library used
      logger.info('Local image deletion not implemented');
    } catch (error) {
      logger.error('Failed to delete local image:', error);
      throw error;
    }
  }
}

export default CameraService;