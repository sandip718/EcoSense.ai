import * as fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

export interface StorageConfig {
  storageType: 'local' | 's3' | 'gcs';
  localPath?: string;
  baseUrl?: string;
  s3Config?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export class ImageStorageService {
  private config: StorageConfig;

  constructor() {
    this.config = {
      storageType: (process.env.STORAGE_TYPE as 'local' | 's3' | 'gcs') || 'local',
      localPath: process.env.STORAGE_LOCAL_PATH || './uploads/images',
      baseUrl: process.env.STORAGE_BASE_URL || `http://localhost:${process.env.PORT || 3000}/uploads/images`
    };

    // Ensure local storage directory exists
    if (this.config.storageType === 'local') {
      this.ensureLocalDirectory();
    }
  }

  /**
   * Store an image file and return the public URL
   * @param buffer Image file buffer
   * @param filename Unique filename for the image
   * @returns Public URL to access the image
   */
  async storeImage(buffer: Buffer, filename: string): Promise<string> {
    try {
      switch (this.config.storageType) {
        case 'local':
          return await this.storeImageLocally(buffer, filename);
        case 's3':
          return await this.storeImageInS3(buffer, filename);
        case 'gcs':
          return await this.storeImageInGCS(buffer, filename);
        default:
          throw new Error(`Unsupported storage type: ${this.config.storageType}`);
      }
    } catch (error) {
      logger.error('Error storing image:', error);
      throw new Error('Failed to store image');
    }
  }

  /**
   * Delete an image file
   * @param imageUrl URL of the image to delete
   * @returns true if deleted successfully
   */
  async deleteImage(imageUrl: string): Promise<boolean> {
    try {
      switch (this.config.storageType) {
        case 'local':
          return await this.deleteImageLocally(imageUrl);
        case 's3':
          return await this.deleteImageFromS3(imageUrl);
        case 'gcs':
          return await this.deleteImageFromGCS(imageUrl);
        default:
          throw new Error(`Unsupported storage type: ${this.config.storageType}`);
      }
    } catch (error) {
      logger.error('Error deleting image:', error);
      return false;
    }
  }

  /**
   * Generate a signed URL for temporary access (useful for S3/GCS)
   * @param imageUrl Image URL
   * @param expirationMinutes Expiration time in minutes
   * @returns Signed URL or original URL for local storage
   */
  async generateSignedUrl(imageUrl: string, expirationMinutes: number = 60): Promise<string> {
    try {
      switch (this.config.storageType) {
        case 'local':
          // Local storage doesn't need signed URLs
          return imageUrl;
        case 's3':
          return await this.generateS3SignedUrl(imageUrl, expirationMinutes);
        case 'gcs':
          return await this.generateGCSSignedUrl(imageUrl, expirationMinutes);
        default:
          return imageUrl;
      }
    } catch (error) {
      logger.error('Error generating signed URL:', error);
      return imageUrl; // Fallback to original URL
    }
  }

  /**
   * Store image locally on filesystem
   */
  private async storeImageLocally(buffer: Buffer, filename: string): Promise<string> {
    if (!this.config.localPath) {
      throw new Error('Local storage path not configured');
    }

    const filePath = path.join(this.config.localPath, filename);
    await fs.writeFile(filePath, buffer);

    const publicUrl = `${this.config.baseUrl}/${filename}`;
    logger.info(`Image stored locally: ${publicUrl}`);
    
    return publicUrl;
  }

  /**
   * Delete image from local filesystem
   */
  private async deleteImageLocally(imageUrl: string): Promise<boolean> {
    try {
      if (!this.config.localPath || !this.config.baseUrl) {
        return false;
      }

      // Extract filename from URL
      const filename = imageUrl.replace(this.config.baseUrl + '/', '');
      const filePath = path.join(this.config.localPath, filename);

      await fs.unlink(filePath);
      logger.info(`Image deleted locally: ${filename}`);
      return true;
    } catch (error) {
      logger.error('Error deleting local image:', error);
      return false;
    }
  }

  /**
   * Store image in AWS S3 (placeholder implementation)
   */
  private async storeImageInS3(buffer: Buffer, filename: string): Promise<string> {
    // TODO: Implement S3 storage using AWS SDK
    // This is a placeholder for future S3 integration
    logger.warn('S3 storage not implemented, falling back to local storage');
    return await this.storeImageLocally(buffer, filename);
  }

  /**
   * Delete image from AWS S3 (placeholder implementation)
   */
  private async deleteImageFromS3(imageUrl: string): Promise<boolean> {
    // TODO: Implement S3 deletion using AWS SDK
    logger.warn('S3 deletion not implemented');
    return false;
  }

  /**
   * Generate S3 signed URL (placeholder implementation)
   */
  private async generateS3SignedUrl(imageUrl: string, expirationMinutes: number): Promise<string> {
    // TODO: Implement S3 signed URL generation
    logger.warn('S3 signed URL generation not implemented');
    return imageUrl;
  }

  /**
   * Store image in Google Cloud Storage (placeholder implementation)
   */
  private async storeImageInGCS(buffer: Buffer, filename: string): Promise<string> {
    // TODO: Implement GCS storage using Google Cloud SDK
    logger.warn('GCS storage not implemented, falling back to local storage');
    return await this.storeImageLocally(buffer, filename);
  }

  /**
   * Delete image from Google Cloud Storage (placeholder implementation)
   */
  private async deleteImageFromGCS(imageUrl: string): Promise<boolean> {
    // TODO: Implement GCS deletion
    logger.warn('GCS deletion not implemented');
    return false;
  }

  /**
   * Generate GCS signed URL (placeholder implementation)
   */
  private async generateGCSSignedUrl(imageUrl: string, expirationMinutes: number): Promise<string> {
    // TODO: Implement GCS signed URL generation
    logger.warn('GCS signed URL generation not implemented');
    return imageUrl;
  }

  /**
   * Ensure local storage directory exists
   */
  private async ensureLocalDirectory(): Promise<void> {
    if (!this.config.localPath) {
      return;
    }

    try {
      await fs.access(this.config.localPath);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(this.config.localPath, { recursive: true });
      logger.info(`Created local storage directory: ${this.config.localPath}`);
    }
  }

  /**
   * Get storage configuration
   */
  getConfig(): StorageConfig {
    return { ...this.config };
  }

  /**
   * Validate image file type and size
   * @param buffer Image buffer
   * @param filename Original filename
   * @param maxSizeBytes Maximum file size in bytes
   * @returns Validation result
   */
  validateImage(buffer: Buffer, filename: string, maxSizeBytes: number = 10 * 1024 * 1024): {
    isValid: boolean;
    error?: string;
  } {
    // Check file size
    if (buffer.length > maxSizeBytes) {
      return {
        isValid: false,
        error: `File size exceeds maximum limit of ${maxSizeBytes / (1024 * 1024)}MB`
      };
    }

    // Check file extension
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const extension = path.extname(filename).toLowerCase();
    
    if (!allowedExtensions.includes(extension)) {
      return {
        isValid: false,
        error: `Invalid file type. Allowed types: ${allowedExtensions.join(', ')}`
      };
    }

    // Basic magic number validation for common image types
    const magicNumbers = {
      jpeg: [0xFF, 0xD8, 0xFF],
      png: [0x89, 0x50, 0x4E, 0x47],
      webp: [0x52, 0x49, 0x46, 0x46] // RIFF header for WebP
    };

    let isValidMagicNumber = false;
    
    // Check JPEG
    if (buffer.length >= 3 && 
        buffer[0] === magicNumbers.jpeg[0] && 
        buffer[1] === magicNumbers.jpeg[1] && 
        buffer[2] === magicNumbers.jpeg[2]) {
      isValidMagicNumber = true;
    }
    
    // Check PNG
    if (buffer.length >= 4 && 
        buffer[0] === magicNumbers.png[0] && 
        buffer[1] === magicNumbers.png[1] && 
        buffer[2] === magicNumbers.png[2] && 
        buffer[3] === magicNumbers.png[3]) {
      isValidMagicNumber = true;
    }
    
    // Check WebP (RIFF header)
    if (buffer.length >= 4 && 
        buffer[0] === magicNumbers.webp[0] && 
        buffer[1] === magicNumbers.webp[1] && 
        buffer[2] === magicNumbers.webp[2] && 
        buffer[3] === magicNumbers.webp[3]) {
      isValidMagicNumber = true;
    }

    if (!isValidMagicNumber) {
      return {
        isValid: false,
        error: 'Invalid image file format'
      };
    }

    return { isValid: true };
  }
}