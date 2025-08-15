// Authentication middleware for protecting routes
// Implements requirement 9.1 for user authentication

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { UserProfile } from '../models/types';
import { logger } from '../utils/logger';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: UserProfile;
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Middleware to authenticate JWT token
   * @param req Express request
   * @param res Express response
   * @param next Next function
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Authorization header is required'
          }
        });
        return;
      }

      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : authHeader;

      if (!token) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN_FORMAT',
            message: 'Token must be provided in Authorization header'
          }
        });
        return;
      }

      // Verify token and get user
      const user = await this.authService.verifyToken(token);
      req.user = user;
      
      next();
    } catch (error) {
      logger.error('Authentication error:', error);
      
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: 'Invalid or expired token'
        }
      });
    }
  };

  /**
   * Optional authentication middleware - doesn't fail if no token provided
   * @param req Express request
   * @param res Express response
   * @param next Next function
   */
  optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        next();
        return;
      }

      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : authHeader;

      if (!token) {
        next();
        return;
      }

      // Try to verify token and get user
      try {
        const user = await this.authService.verifyToken(token);
        req.user = user;
      } catch (error) {
        // Ignore token verification errors for optional auth
        logger.debug('Optional authentication failed:', error);
      }
      
      next();
    } catch (error) {
      logger.error('Optional authentication error:', error);
      next();
    }
  };
}

// Create singleton instance
export const authMiddleware = new AuthMiddleware();

// Export middleware functions
export const authenticate = authMiddleware.authenticate;
export const optionalAuthenticate = authMiddleware.optionalAuthenticate;