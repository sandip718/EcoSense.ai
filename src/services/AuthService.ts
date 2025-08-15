// Authentication service for user registration and login
// Implements requirements 9.1, 9.2 for user authentication and profile management

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../models/UserRepository';
import { UserProfile, CreateUserProfile, Location, UserPreferences } from '../models/types';
import { logger } from '../utils/logger';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  location?: Location;
  preferences?: UserPreferences;
}

export interface AuthToken {
  token: string;
  expiresIn: string;
  user: Omit<UserProfile, 'password_hash'>;
}

export interface UpdateProfileData {
  location?: Location;
  preferences?: UserPreferences;
}

export class AuthService {
  private userRepository: UserRepository;
  private jwtSecret: string;
  private jwtExpiresIn: string;

  constructor() {
    this.userRepository = new UserRepository();
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
  }

  /**
   * Register a new user
   * @param registerData User registration data
   * @returns Authentication token and user profile
   */
  async register(registerData: RegisterData): Promise<AuthToken> {
    try {
      // Validate email format
      if (!this.isValidEmail(registerData.email)) {
        throw new Error('Invalid email format');
      }

      // Validate password strength
      if (!this.isValidPassword(registerData.password)) {
        throw new Error('Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character');
      }

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(registerData.email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(registerData.password, saltRounds);

      // Create user
      const userData: CreateUserProfile = {
        email: registerData.email.toLowerCase(),
        password_hash: passwordHash,
        location: registerData.location,
        preferences: registerData.preferences || {}
      };

      const user = await this.userRepository.create(userData);

      // Generate JWT token
      const token = this.generateToken(user.id);

      logger.info(`User registered successfully: ${user.email}`);

      return {
        token,
        expiresIn: this.jwtExpiresIn,
        user: this.sanitizeUser(user)
      };
    } catch (error) {
      logger.error('Error during user registration:', error);
      throw error;
    }
  }

  /**
   * Login user with email and password
   * @param credentials Login credentials
   * @returns Authentication token and user profile
   */
  async login(credentials: LoginCredentials): Promise<AuthToken> {
    try {
      // Find user by email
      const user = await this.userRepository.findByEmail(credentials.email.toLowerCase());
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Generate JWT token
      const token = this.generateToken(user.id);

      logger.info(`User logged in successfully: ${user.email}`);

      return {
        token,
        expiresIn: this.jwtExpiresIn,
        user: this.sanitizeUser(user)
      };
    } catch (error) {
      logger.error('Error during user login:', error);
      throw error;
    }
  }

  /**
   * Verify JWT token and return user
   * @param token JWT token
   * @returns User profile
   */
  async verifyToken(token: string): Promise<UserProfile> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string };
      const user = await this.userRepository.findById(decoded.userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      logger.error('Error verifying token:', error);
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Update user profile
   * @param userId User ID
   * @param updateData Profile update data
   * @returns Updated user profile
   */
  async updateProfile(userId: string, updateData: UpdateProfileData): Promise<UserProfile> {
    try {
      const updatedUser = await this.userRepository.update(userId, updateData);
      
      if (!updatedUser) {
        throw new Error('User not found');
      }

      logger.info(`User profile updated: ${updatedUser.email}`);
      return updatedUser;
    } catch (error) {
      logger.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Change user password
   * @param userId User ID
   * @param currentPassword Current password
   * @param newPassword New password
   * @returns Updated user profile
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<UserProfile> {
    try {
      // Get current user
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Validate new password
      if (!this.isValidPassword(newPassword)) {
        throw new Error('New password must be at least 8 characters long and contain uppercase, lowercase, number, and special character');
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      const updatedUser = await this.userRepository.update(userId, {
        password_hash: newPasswordHash
      });

      if (!updatedUser) {
        throw new Error('Failed to update password');
      }

      logger.info(`Password changed for user: ${updatedUser.email}`);
      return updatedUser;
    } catch (error) {
      logger.error('Error changing password:', error);
      throw error;
    }
  }

  /**
   * Get user profile by ID
   * @param userId User ID
   * @returns User profile
   */
  async getProfile(userId: string): Promise<UserProfile> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      logger.error('Error getting user profile:', error);
      throw error;
    }
  }

  /**
   * Generate JWT token for user
   * @param userId User ID
   * @returns JWT token
   */
  private generateToken(userId: string): string {
    return jwt.sign({ userId }, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
  }

  /**
   * Remove sensitive data from user object
   * @param user User profile
   * @returns Sanitized user profile
   */
  private sanitizeUser(user: UserProfile): Omit<UserProfile, 'password_hash'> {
    const { password_hash, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  /**
   * Validate email format
   * @param email Email address
   * @returns true if valid
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   * @param password Password
   * @returns true if valid
   */
  private isValidPassword(password: string): boolean {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }
}