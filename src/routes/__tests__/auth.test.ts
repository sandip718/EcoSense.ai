// Tests for authentication routes
// Tests requirements 9.1, 9.2 for user authentication and profile management

import request from 'supertest';
import express from 'express';
import authRoutes from '../auth';
import { AuthService } from '../../services/AuthService';

// Mock AuthService
jest.mock('../../services/AuthService');

const mockAuthService = AuthService as jest.MockedClass<typeof AuthService>;

describe('Auth Routes', () => {
  let app: express.Application;
  let mockAuthServiceInstance: jest.Mocked<AuthService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);

    mockAuthServiceInstance = new mockAuthService() as jest.Mocked<AuthService>;
    (AuthService as any).mockImplementation(() => mockAuthServiceInstance);
  });

  describe('POST /auth/register', () => {
    const validRegisterData = {
      email: 'test@example.com',
      password: 'Password123!',
      location: { latitude: 40.7128, longitude: -74.0060 },
      preferences: { notifications: true }
    };

    it('should register user successfully', async () => {
      const mockResponse = {
        token: 'jwt-token',
        expiresIn: '7d',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          points: 0,
          level: 1,
          badges: [],
          contribution_streak: 0
        }
      };

      mockAuthServiceInstance.register.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/auth/register')
        .send(validRegisterData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResponse);
      expect(mockAuthServiceInstance.register).toHaveBeenCalledWith(validRegisterData);
    });

    it('should return validation error for invalid email', async () => {
      const invalidData = { ...validRegisterData, email: 'invalid-email' };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for short password', async () => {
      const invalidData = { ...validRegisterData, password: 'short' };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return conflict error for existing user', async () => {
      mockAuthServiceInstance.register.mockRejectedValue(new Error('User with this email already exists'));

      const response = await request(app)
        .post('/auth/register')
        .send(validRegisterData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('REGISTRATION_FAILED');
    });
  });

  describe('POST /auth/login', () => {
    const validCredentials = {
      email: 'test@example.com',
      password: 'Password123!'
    };

    it('should login user successfully', async () => {
      const mockResponse = {
        token: 'jwt-token',
        expiresIn: '7d',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          points: 100,
          level: 2,
          badges: ['first_contribution'],
          contribution_streak: 5
        }
      };

      mockAuthServiceInstance.login.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/auth/login')
        .send(validCredentials)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResponse);
      expect(mockAuthServiceInstance.login).toHaveBeenCalledWith(validCredentials);
    });

    it('should return validation error for invalid email format', async () => {
      const invalidCredentials = { ...validCredentials, email: 'invalid-email' };

      const response = await request(app)
        .post('/auth/login')
        .send(invalidCredentials)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return unauthorized for invalid credentials', async () => {
      mockAuthServiceInstance.login.mockRejectedValue(new Error('Invalid email or password'));

      const response = await request(app)
        .post('/auth/login')
        .send(validCredentials)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('LOGIN_FAILED');
    });
  });

  describe('GET /auth/profile', () => {
    it('should return user profile when authenticated', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        points: 100,
        level: 2,
        badges: ['first_contribution'],
        contribution_streak: 5,
        location: { latitude: 40.7128, longitude: -74.0060 },
        preferences: { notifications: true },
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock the authentication middleware by setting req.user
      app.use('/auth/profile', (req, res, next) => {
        (req as any).user = mockUser;
        next();
      });

      const response = await request(app)
        .get('/auth/profile')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('user-123');
      expect(response.body.data.email).toBe('test@example.com');
      expect(response.body.data).not.toHaveProperty('password_hash');
    });

    it('should return unauthorized without token', async () => {
      const response = await request(app)
        .get('/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('PUT /auth/profile', () => {
    const updateData = {
      location: { latitude: 41.8781, longitude: -87.6298 },
      preferences: { notifications: false }
    };

    it('should update profile successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        location: updateData.location,
        preferences: updateData.preferences
      };

      const updatedUser = { ...mockUser, updated_at: new Date() };

      mockAuthServiceInstance.updateProfile.mockResolvedValue(updatedUser as any);

      // Mock authentication
      app.use('/auth/profile', (req, res, next) => {
        (req as any).user = mockUser;
        next();
      });

      const response = await request(app)
        .put('/auth/profile')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.location).toEqual(updateData.location);
      expect(response.body.data.preferences).toEqual(updateData.preferences);
    });

    it('should return validation error for invalid location', async () => {
      const invalidData = {
        location: { latitude: 91, longitude: -74.0060 } // Invalid latitude
      };

      // Mock authentication
      app.use('/auth/profile', (req, res, next) => {
        (req as any).user = { id: 'user-123' };
        next();
      });

      const response = await request(app)
        .put('/auth/profile')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/change-password', () => {
    const passwordData = {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!'
    };

    it('should change password successfully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockAuthServiceInstance.changePassword.mockResolvedValue(mockUser as any);

      // Mock authentication
      app.use('/auth/change-password', (req, res, next) => {
        (req as any).user = mockUser;
        next();
      });

      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send(passwordData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Password changed successfully');
      expect(mockAuthServiceInstance.changePassword).toHaveBeenCalledWith(
        'user-123',
        'OldPassword123!',
        'NewPassword123!'
      );
    });

    it('should return validation error for short new password', async () => {
      const invalidData = { ...passwordData, newPassword: 'short' };

      // Mock authentication
      app.use('/auth/change-password', (req, res, next) => {
        (req as any).user = { id: 'user-123' };
        next();
      });

      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return error for incorrect current password', async () => {
      mockAuthServiceInstance.changePassword.mockRejectedValue(new Error('Current password is incorrect'));

      // Mock authentication
      app.use('/auth/change-password', (req, res, next) => {
        (req as any).user = { id: 'user-123' };
        next();
      });

      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer valid-token')
        .send(passwordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PASSWORD_CHANGE_FAILED');
    });
  });

  describe('POST /auth/verify-token', () => {
    it('should verify valid token', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        points: 100,
        level: 2
      };

      mockAuthServiceInstance.verifyToken.mockResolvedValue(mockUser as any);

      const response = await request(app)
        .post('/auth/verify-token')
        .send({ token: 'valid-token' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.user.id).toBe('user-123');
      expect(response.body.data.user).not.toHaveProperty('password_hash');
    });

    it('should return error for missing token', async () => {
      const response = await request(app)
        .post('/auth/verify-token')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should return error for invalid token', async () => {
      mockAuthServiceInstance.verifyToken.mockRejectedValue(new Error('Invalid token'));

      const response = await request(app)
        .post('/auth/verify-token')
        .send({ token: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });
});