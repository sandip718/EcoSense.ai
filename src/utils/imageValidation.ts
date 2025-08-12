import { Location } from '../models/types';
import { logger } from './logger';

export interface ImageValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export interface ImageMetadata {
  location?: Location;
  timestamp?: Date;
  deviceInfo?: string;
  imageQuality?: {
    width?: number;
    height?: number;
    fileSize: number;
    format: string;
  };
}

/**
 * Validate uploaded image file
 * @param file Multer file object
 * @returns Validation result
 */
export async function validateImageUpload(file: Express.Multer.File): Promise<ImageValidationResult> {
  const warnings: string[] = [];

  try {
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File size ${(file.size / (1024 * 1024)).toFixed(2)}MB exceeds maximum limit of 10MB`
      };
    }

    // Check minimum file size (1KB)
    const minSize = 1024; // 1KB
    if (file.size < minSize) {
      return {
        isValid: false,
        error: 'File size is too small, minimum 1KB required'
      };
    }

    // Validate MIME type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return {
        isValid: false,
        error: `Invalid MIME type ${file.mimetype}. Allowed types: ${allowedMimeTypes.join(', ')}`
      };
    }

    // Validate file extension matches MIME type
    const extensionMimeMap: { [key: string]: string[] } = {
      '.jpg': ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.png': ['image/png'],
      '.webp': ['image/webp']
    };

    const fileExtension = getFileExtension(file.originalname);
    const expectedMimeTypes = extensionMimeMap[fileExtension];
    
    if (!expectedMimeTypes || !expectedMimeTypes.includes(file.mimetype)) {
      warnings.push(`File extension ${fileExtension} doesn't match MIME type ${file.mimetype}`);
    }

    // Validate magic numbers (file signature)
    const magicNumberValidation = validateMagicNumbers(file.buffer, file.mimetype);
    if (!magicNumberValidation.isValid) {
      return magicNumberValidation;
    }

    // Basic image dimension validation (if we can extract it)
    const dimensionValidation = await validateImageDimensions(file.buffer);
    if (dimensionValidation.warnings) {
      warnings.push(...dimensionValidation.warnings);
    }

    const result: ImageValidationResult = {
      isValid: true
    };
    
    if (warnings.length > 0) {
      result.warnings = warnings;
    }
    
    return result;

  } catch (error) {
    logger.error('Error validating image upload:', error);
    return {
      isValid: false,
      error: 'Failed to validate image file'
    };
  }
}

/**
 * Extract metadata from uploaded image and request body
 * @param file Multer file object
 * @param requestBody Request body containing additional metadata
 * @returns Extracted metadata
 */
export async function extractImageMetadata(
  file: Express.Multer.File, 
  requestBody: any
): Promise<ImageMetadata> {
  const metadata: ImageMetadata = {
    imageQuality: {
      fileSize: file.size,
      format: file.mimetype
    }
  };

  try {
    // Extract location from request body
    if (requestBody.latitude && requestBody.longitude) {
      const latitude = parseFloat(requestBody.latitude);
      const longitude = parseFloat(requestBody.longitude);
      
      if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
        metadata.location = {
          latitude,
          longitude,
          address: requestBody.address || undefined
        };
      }
    }

    // Extract timestamp (use provided timestamp or current time)
    if (requestBody.timestamp) {
      const timestamp = new Date(requestBody.timestamp);
      if (!isNaN(timestamp.getTime())) {
        metadata.timestamp = timestamp;
      }
    }
    
    if (!metadata.timestamp) {
      metadata.timestamp = new Date();
    }

    // Extract device info
    if (requestBody.deviceInfo) {
      metadata.deviceInfo = String(requestBody.deviceInfo).substring(0, 255); // Limit length
    }

    // Try to extract basic image dimensions
    const dimensions = await extractImageDimensions(file.buffer, file.mimetype);
    if (dimensions) {
      metadata.imageQuality = {
        fileSize: metadata.imageQuality!.fileSize,
        format: metadata.imageQuality!.format,
        width: dimensions.width,
        height: dimensions.height
      };
    }

    return metadata;

  } catch (error) {
    logger.error('Error extracting image metadata:', error);
    return metadata; // Return partial metadata
  }
}

/**
 * Validate magic numbers (file signatures) for image files
 */
function validateMagicNumbers(buffer: Buffer, mimeType: string): ImageValidationResult {
  if (buffer.length < 4) {
    return {
      isValid: false,
      error: 'File is too small to validate'
    };
  }

  const magicNumbers = {
    'image/jpeg': [
      [0xFF, 0xD8, 0xFF], // JPEG
    ],
    'image/png': [
      [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
    ],
    'image/webp': [
      [0x52, 0x49, 0x46, 0x46], // RIFF (WebP container)
    ]
  };

  const expectedSignatures = magicNumbers[mimeType as keyof typeof magicNumbers];
  if (!expectedSignatures) {
    return { isValid: true }; // Unknown type, skip validation
  }

  for (const signature of expectedSignatures) {
    let matches = true;
    for (let i = 0; i < signature.length && i < buffer.length; i++) {
      if (buffer[i] !== signature[i]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return { isValid: true };
    }
  }

  return {
    isValid: false,
    error: `File signature doesn't match expected format for ${mimeType}`
  };
}

/**
 * Basic image dimension validation
 */
async function validateImageDimensions(buffer: Buffer): Promise<{ warnings?: string[] }> {
  const warnings: string[] = [];

  try {
    // Basic dimension extraction (simplified)
    const dimensions = await extractImageDimensions(buffer);
    
    if (dimensions) {
      // Check for reasonable dimensions
      const maxDimension = 8192; // 8K resolution
      const minDimension = 32; // Minimum reasonable size
      
      if (dimensions.width > maxDimension || dimensions.height > maxDimension) {
        warnings.push(`Image dimensions ${dimensions.width}x${dimensions.height} are very large`);
      }
      
      if (dimensions.width < minDimension || dimensions.height < minDimension) {
        warnings.push(`Image dimensions ${dimensions.width}x${dimensions.height} are very small`);
      }

      // Check aspect ratio
      const aspectRatio = dimensions.width / dimensions.height;
      if (aspectRatio > 10 || aspectRatio < 0.1) {
        warnings.push(`Unusual aspect ratio: ${aspectRatio.toFixed(2)}`);
      }
    }

    const result: { warnings?: string[] } = {};
    if (warnings.length > 0) {
      result.warnings = warnings;
    }
    return result;

  } catch (error) {
    // Dimension extraction failed, but this is not critical
    return {};
  }
}

/**
 * Extract basic image dimensions from buffer
 * This is a simplified implementation - in production, you'd use a proper image library
 */
async function extractImageDimensions(buffer: Buffer, mimeType?: string): Promise<{ width: number; height: number } | null> {
  try {
    // PNG dimensions extraction
    if (mimeType === 'image/png' && buffer.length >= 24) {
      // PNG IHDR chunk starts at byte 16
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    // JPEG dimensions extraction (simplified)
    if (mimeType === 'image/jpeg') {
      // This is a very basic JPEG dimension extraction
      // In production, use a proper library like 'image-size'
      for (let i = 0; i < buffer.length - 9; i++) {
        if (buffer[i] === 0xFF && (buffer[i + 1] === 0xC0 || buffer[i + 1] === 0xC2)) {
          const height = buffer.readUInt16BE(i + 5);
          const width = buffer.readUInt16BE(i + 7);
          return { width, height };
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return '';
  }
  return filename.substring(lastDotIndex).toLowerCase();
}

/**
 * Validate latitude value
 */
function isValidLatitude(lat: number): boolean {
  return !isNaN(lat) && lat >= -90 && lat <= 90;
}

/**
 * Validate longitude value
 */
function isValidLongitude(lng: number): boolean {
  return !isNaN(lng) && lng >= -180 && lng <= 180;
}

/**
 * Sanitize filename for storage
 */
export function sanitizeFilename(filename: string): string {
  // Remove or replace dangerous characters
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace non-alphanumeric chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .substring(0, 255); // Limit length
}

/**
 * Generate thumbnail filename from original filename
 */
export function generateThumbnailFilename(originalFilename: string, size: string = 'thumb'): string {
  const extension = getFileExtension(originalFilename);
  const nameWithoutExt = originalFilename.substring(0, originalFilename.lastIndexOf('.'));
  return `${nameWithoutExt}_${size}${extension}`;
}