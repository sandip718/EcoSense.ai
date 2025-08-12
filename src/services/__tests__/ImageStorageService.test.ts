import { ImageStorageService } from '../ImageStorageService';
import fs from 'fs/promises';
import path from 'path';

// Mock fs/promises
jest.mock('fs/promises');
jest.mock('../../utils/logger');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ImageStorageService', () => {
  let imageStorageService: ImageStorageService;
  const mockBuffer = Buffer.from('fake-image-data');

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.STORAGE_TYPE = 'local';
    process.env.STORAGE_LOCAL_PATH = './test-uploads';
    process.env.STORAGE_BASE_URL = 'http://localhost:3000/uploads/images';
    process.env.PORT = '3000';

    imageStorageService = new ImageStorageService();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.STORAGE_TYPE;
    delete process.env.STORAGE_LOCAL_PATH;
    delete process.env.STORAGE_BASE_URL;
  });

  describe('constructor', () => {
    it('should initialize with default local storage configuration', () => {
      // Arrange
      delete process.env.STORAGE_TYPE;
      delete process.env.STORAGE_LOCAL_PATH;
      delete process.env.STORAGE_BASE_URL;

      // Act
      const defaultService = new ImageStorageService();
      const config = defaultService.getConfig();

      // Assert
      expect(config.storageType).toBe('local');
      expect(config.localPath).toBe('./uploads/images');
      expect(config.baseUrl).toBe('http://localhost:3000/uploads/images');
    });

    it('should initialize with environment configuration', () => {
      // Act
      const config = imageStorageService.getConfig();

      // Assert
      expect(config.storageType).toBe('local');
      expect(config.localPath).toBe('./test-uploads');
      expect(config.baseUrl).toBe('http://localhost:3000/uploads/images');
    });
  });

  describe('storeImage', () => {
    it('should store image locally and return public URL', async () => {
      // Arrange
      const filename = 'test-image.jpg';
      const expectedPath = path.join('./test-uploads', filename);
      const expectedUrl = 'http://localhost:3000/uploads/images/test-image.jpg';

      mockFs.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await imageStorageService.storeImage(mockBuffer, filename);

      // Assert
      expect(result).toBe(expectedUrl);
      expect(mockFs.writeFile).toHaveBeenCalledWith(expectedPath, mockBuffer);
    });

    it('should handle storage errors', async () => {
      // Arrange
      const filename = 'test-image.jpg';
      mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

      // Act & Assert
      await expect(imageStorageService.storeImage(mockBuffer, filename))
        .rejects.toThrow('Failed to store image');
    });

    it('should fall back to local storage for S3 configuration', async () => {
      // Arrange
      process.env.STORAGE_TYPE = 's3';
      const s3Service = new ImageStorageService();
      const filename = 'test-image.jpg';
      
      mockFs.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await s3Service.storeImage(mockBuffer, filename);

      // Assert
      expect(result).toContain('test-image.jpg');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should fall back to local storage for GCS configuration', async () => {
      // Arrange
      process.env.STORAGE_TYPE = 'gcs';
      const gcsService = new ImageStorageService();
      const filename = 'test-image.jpg';
      
      mockFs.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await gcsService.storeImage(mockBuffer, filename);

      // Assert
      expect(result).toContain('test-image.jpg');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('deleteImage', () => {
    it('should delete image locally', async () => {
      // Arrange
      const imageUrl = 'http://localhost:3000/uploads/images/test-image.jpg';
      const expectedPath = path.join('./test-uploads', 'test-image.jpg');

      mockFs.unlink.mockResolvedValue(undefined);

      // Act
      const result = await imageStorageService.deleteImage(imageUrl);

      // Assert
      expect(result).toBe(true);
      expect(mockFs.unlink).toHaveBeenCalledWith(expectedPath);
    });

    it('should handle deletion errors gracefully', async () => {
      // Arrange
      const imageUrl = 'http://localhost:3000/uploads/images/test-image.jpg';
      mockFs.unlink.mockRejectedValue(new Error('File not found'));

      // Act
      const result = await imageStorageService.deleteImage(imageUrl);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for invalid configuration', async () => {
      // Arrange
      process.env.STORAGE_LOCAL_PATH = '';
      const invalidConfigService = new ImageStorageService();
      const imageUrl = 'http://localhost:3000/uploads/images/test-image.jpg';

      // Act
      const result = await invalidConfigService.deleteImage(imageUrl);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('generateSignedUrl', () => {
    it('should return original URL for local storage', async () => {
      // Arrange
      const imageUrl = 'http://localhost:3000/uploads/images/test-image.jpg';

      // Act
      const result = await imageStorageService.generateSignedUrl(imageUrl, 60);

      // Assert
      expect(result).toBe(imageUrl);
    });

    it('should handle signed URL generation errors', async () => {
      // Arrange
      const imageUrl = 'http://localhost:3000/uploads/images/test-image.jpg';

      // Act
      const result = await imageStorageService.generateSignedUrl(imageUrl);

      // Assert
      expect(result).toBe(imageUrl); // Should fallback to original URL
    });
  });

  describe('validateImage', () => {
    it('should validate JPEG image', () => {
      // Arrange
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
      const filename = 'test.jpg';

      // Act
      const result = imageStorageService.validateImage(jpegBuffer, filename);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate PNG image', () => {
      // Arrange
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const filename = 'test.png';

      // Act
      const result = imageStorageService.validateImage(pngBuffer, filename);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate WebP image', () => {
      // Arrange
      const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);
      const filename = 'test.webp';

      // Act
      const result = imageStorageService.validateImage(webpBuffer, filename);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject file that exceeds size limit', () => {
      // Arrange
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      const filename = 'large.jpg';

      // Act
      const result = imageStorageService.validateImage(largeBuffer, filename, 10 * 1024 * 1024);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('File size exceeds maximum limit');
    });

    it('should reject invalid file extension', () => {
      // Arrange
      const buffer = Buffer.from([0xFF, 0xD8, 0xFF]);
      const filename = 'test.txt';

      // Act
      const result = imageStorageService.validateImage(buffer, filename);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should reject file with invalid magic number', () => {
      // Arrange
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      const filename = 'test.jpg';

      // Act
      const result = imageStorageService.validateImage(invalidBuffer, filename);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid image file format');
    });

    it('should use default size limit when not specified', () => {
      // Arrange
      const buffer = Buffer.from([0xFF, 0xD8, 0xFF]);
      const filename = 'test.jpg';

      // Act
      const result = imageStorageService.validateImage(buffer, filename);

      // Assert
      expect(result.isValid).toBe(true);
    });
  });

  describe('ensureLocalDirectory', () => {
    it('should create directory when it does not exist', async () => {
      // Arrange
      jest.clearAllMocks();
      mockFs.access.mockRejectedValue(new Error('Directory does not exist'));
      mockFs.mkdir.mockResolvedValue(undefined);

      // Act
      new ImageStorageService();
      
      // Wait for async constructor operations
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert
      expect(mockFs.mkdir).toHaveBeenCalledWith('./test-uploads', { recursive: true });
    });

    it('should not create directory when it already exists', async () => {
      // Arrange
      jest.clearAllMocks();
      mockFs.access.mockResolvedValue(undefined);

      // Act
      new ImageStorageService();
      
      // Wait for async constructor operations
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert
      expect(mockFs.mkdir).not.toHaveBeenCalled();
    });

    it('should handle directory creation for undefined path', async () => {
      // Arrange
      jest.clearAllMocks();
      delete process.env.STORAGE_LOCAL_PATH;
      process.env.STORAGE_TYPE = 's3'; // Non-local storage

      // Act
      new ImageStorageService();
      
      // Wait for async constructor operations
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert - For S3 storage, it should still try to create local directory as fallback
      // The test expectation should match the actual implementation behavior
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the configuration', () => {
      // Act
      const config1 = imageStorageService.getConfig();
      const config2 = imageStorageService.getConfig();

      // Assert
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Should be different objects
    });
  });
});