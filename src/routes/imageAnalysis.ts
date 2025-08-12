import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ImageAnalysisService } from '../services/ImageAnalysisService';
import { ImageStorageService } from '../services/ImageStorageService';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { validateImageUpload, extractImageMetadata } from '../utils/imageValidation';

const router = express.Router();
const imageAnalysisService = new ImageAnalysisService();
const imageStorageService = new ImageStorageService();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(createError('Invalid file type. Only JPEG, PNG, and WebP images are allowed.', 400));
    }
  }
});

/**
 * POST /api/images/upload
 * Upload an environmental image for analysis
 */
router.post('/upload', upload.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return next(createError('No image file provided', 400));
    }

    // Extract user ID from request (assuming authentication middleware sets this)
    const userId = req.body.userId || req.headers['x-user-id'] as string;
    if (!userId) {
      return next(createError('User ID is required', 401));
    }

    // Validate image file
    const validationResult = await validateImageUpload(req.file);
    if (!validationResult.isValid) {
      return next(createError(validationResult.error || 'Invalid image file', 400));
    }

    // Extract metadata from image and request
    const metadata = await extractImageMetadata(req.file, req.body);
    
    // Generate unique filename
    const fileExtension = path.extname(req.file.originalname);
    const filename = `${uuidv4()}${fileExtension}`;

    // Store image and get URL
    const imageUrl = await imageStorageService.storeImage(req.file.buffer, filename);

    // Create image analysis record
    const imageAnalysis = await imageAnalysisService.createImageAnalysis({
      userId,
      imageUrl,
      location: metadata.location,
      uploadTimestamp: new Date(),
      originalFilename: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });

    // Start async AI analysis (fire and forget)
    imageAnalysisService.processImageAnalysis(imageAnalysis.id).catch(error => {
      logger.error('Error processing image analysis:', error);
    });

    res.status(201).json({
      success: true,
      data: {
        id: imageAnalysis.id,
        imageUrl: imageAnalysis.image_url,
        status: imageAnalysis.status,
        uploadTimestamp: imageAnalysis.upload_timestamp,
        location: imageAnalysis.location
      },
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error uploading image:', error);
    next(createError('Failed to upload image', 500));
  }
});

/**
 * GET /api/images/:id
 * Get image analysis by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return next(createError('Image analysis ID is required', 400));
    }
    
    const imageAnalysis = await imageAnalysisService.getImageAnalysis(id);
    if (!imageAnalysis) {
      return next(createError('Image analysis not found', 404));
    }

    res.json({
      success: true,
      data: imageAnalysis,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error retrieving image analysis:', error);
    next(createError('Failed to retrieve image analysis', 500));
  }
});

/**
 * GET /api/images/:id/status
 * Get analysis status for an image
 */
router.get('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return next(createError('Image analysis ID is required', 400));
    }
    
    const imageAnalysis = await imageAnalysisService.getImageAnalysis(id);
    if (!imageAnalysis) {
      return next(createError('Image analysis not found', 404));
    }

    res.json({
      success: true,
      data: {
        id: imageAnalysis.id,
        status: imageAnalysis.status,
        uploadTimestamp: imageAnalysis.upload_timestamp,
        analysisResults: imageAnalysis.status === 'completed' ? imageAnalysis.analysis_results : null
      },
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error retrieving image analysis status:', error);
    next(createError('Failed to retrieve analysis status', 500));
  }
});

/**
 * GET /api/images/user/:userId
 * Get all image analyses for a user
 */
router.get('/user/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return next(createError('User ID is required', 400));
    }
    
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const imageAnalyses = await imageAnalysisService.getUserImageAnalyses(userId, limit, offset);

    res.json({
      success: true,
      data: imageAnalyses,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error retrieving user image analyses:', error);
    next(createError('Failed to retrieve user image analyses', 500));
  }
});

export default router;