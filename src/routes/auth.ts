// Authentication routes for user registration, login, and profile management
// Implements requirements 9.1, 9.2 for user authentication and profile management

import { Router, Request, Response } from 'express';
import { AuthService, RegisterData, LoginCredentials, UpdateProfileData } from '../services/AuthService';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import Joi from 'joi';

const router = Router();
const authService = new AuthService();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    address: Joi.string().optional()
  }).optional(),
  preferences: Joi.object({
    notifications: Joi.boolean().optional(),
    activity_types: Joi.array().items(Joi.string()).optional(),
    health_conditions: Joi.array().items(Joi.string()).optional(),
    notification_radius: Joi.number().min(0).max(100).optional(),
    preferred_units: Joi.object({
      temperature: Joi.string().valid('celsius', 'fahrenheit').optional(),
      distance: Joi.string().valid('metric', 'imperial').optional()
    }).optional()
  }).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const updateProfileSchema = Joi.object({
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    address: Joi.string().optional()
  }).optional(),
  preferences: Joi.object({
    notifications: Joi.boolean().optional(),
    activity_types: Joi.array().items(Joi.string()).optional(),
    health_conditions: Joi.array().items(Joi.string()).optional(),
    notification_radius: Joi.number().min(0).max(100).optional(),
    preferred_units: Joi.object({
      temperature: Joi.string().valid('celsius', 'fahrenheit').optional(),
      distance: Joi.string().valid('metric', 'imperial').optional()
    }).optional()
  }).optional()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required()
});

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const registerData: RegisterData = value;
    const result = await authService.register(registerData);

    res.status(201).json({
      success: true,
      data: result,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Registration error:', error);
    
    const statusCode = error.message.includes('already exists') ? 409 : 400;
    res.status(statusCode).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: error.message
      },
      timestamp: new Date()
    });
  }
});

/**
 * POST /auth/login
 * Login user
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const credentials: LoginCredentials = value;
    const result = await authService.login(credentials);

    res.json({
      success: true,
      data: result,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Login error:', error);
    
    res.status(401).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: error.message
      },
      timestamp: new Date()
    });
  }
});

/**
 * GET /auth/profile
 * Get current user profile
 */
router.get('/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const { password_hash, ...sanitizedUser } = user;

    res.json({
      success: true,
      data: sanitizedUser,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_FETCH_FAILED',
        message: 'Failed to retrieve user profile'
      },
      timestamp: new Date()
    });
  }
});

/**
 * PUT /auth/profile
 * Update user profile
 */
router.put('/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate request body
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const updateData: UpdateProfileData = value;
    const updatedUser = await authService.updateProfile(req.user.id, updateData);
    const { password_hash, ...sanitizedUser } = updatedUser;

    res.json({
      success: true,
      data: sanitizedUser,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_UPDATE_FAILED',
        message: error.message
      },
      timestamp: new Date()
    });
  }
});

/**
 * POST /auth/change-password
 * Change user password
 */
router.post('/change-password', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate request body
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const { currentPassword, newPassword } = value;
    await authService.changePassword(req.user.id, currentPassword, newPassword);

    res.json({
      success: true,
      data: { message: 'Password changed successfully' },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Change password error:', error);
    
    const statusCode = error.message.includes('incorrect') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: 'PASSWORD_CHANGE_FAILED',
        message: error.message
      },
      timestamp: new Date()
    });
  }
});

/**
 * POST /auth/verify-token
 * Verify JWT token (useful for frontend token validation)
 */
router.post('/verify-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Token is required'
        }
      });
    }

    const user = await authService.verifyToken(token);
    const { password_hash, ...sanitizedUser } = user;

    res.json({
      success: true,
      data: { valid: true, user: sanitizedUser },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Token verification error:', error);
    
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token is invalid or expired'
      },
      timestamp: new Date()
    });
  }
});

export default router;