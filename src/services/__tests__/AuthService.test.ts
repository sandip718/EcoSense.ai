// Tests for AuthService
// Tests requirements 9.1, 9.2 for user authentication and profile management

import { AuthService, RegisterData, LoginCredentials } from '../AuthService';
import { UserRepository } from '../../models/UserRepository';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../models/UserRepository');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

const mockUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepo = new mockUserRepository() as jest.Mocked<UserRepository>;
    authService = new AuthService();
    (authService as any).userRepository = mockUserRepo;
  });

  describe('register', () => {
    const validRegisterData: RegisterData = {
      email: 'test@example.com',
      password: 'Password123!',
      location: { latitude: 40.7128, longitude: -74.0060 },
      preferences: { notifications: true }
    };

    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        location: { latitude: 40.7128, longitude: -74.0060 },
        preferences: { notifications: true },
        points: 0,
        level: 1,
        badges: [],
        contribution_streak: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue('hashed-password');
      mockUserRepo.create.mockResolvedValue(mockUser);
      mockJwt.sign.mockReturnValue('jwt-token');

      const result = await authService.register(validRegisterData);

      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockBcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
      expect(mockUserRepo.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        password_hash: 'hashed-password',
        location: validRegisterData.location,
        preferences: validRegisterData.preferences
      });
      expect(result.token).toBe('jwt-token');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user).not.toHaveProperty('password_hash');
    });

    it('should throw error for invalid email', async () => {
      const invalidData = { ...validRegisterData, email: 'invalid-email' };

      await expect(authService.register(invalidData)).rejects.toThrow('Invalid email format');
    });

    it('should throw error for weak password', async () => {
      const invalidData = { ...validRegisterData, password: 'weak' };

      await expect(authService.register(invalidData)).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should throw error if user already exists', async () => {
      const existingUser = { id: 'existing-user' } as any;
      mockUserRepo.findByEmail.mockResolvedValue(existingUser);

      await expect(authService.register(validRegisterData)).rejects.toThrow('User with this email already exists');
    });
  });

  describe('login', () => {
    const validCredentials: LoginCredentials = {
      email: 'test@example.com',
      password: 'Password123!'
    };

    it('should login user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        points: 100,
        level: 2,
        badges: ['first_contribution'],
        contribution_streak: 5,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockUserRepo.findByEmail.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('jwt-token');

      const result = await authService.login(validCredentials);

      expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockBcrypt.compare).toHaveBeenCalledWith('Password123!', 'hashed-password');
      expect(result.token).toBe('jwt-token');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user).not.toHaveProperty('password_hash');
    });

    it('should throw error for non-existent user', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      await expect(authService.login(validCredentials)).rejects.toThrow('Invalid email or password');
    });

    it('should throw error for incorrect password', async () => {
      const mockUser = { id: 'user-123', password_hash: 'hashed-password' } as any;
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(authService.login(validCredentials)).rejects.toThrow('Invalid email or password');
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token and return user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        points: 100,
        level: 2
      } as any;

      mockJwt.verify.mockReturnValue({ userId: 'user-123' } as any);
      mockUserRepo.findById.mockResolvedValue(mockUser);

      const result = await authService.verifyToken('valid-token');

      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', expect.any(String));
      expect(mockUserRepo.findById).toHaveBeenCalledWith('user-123');
      expect(result).toBe(mockUser);
    });

    it('should throw error for invalid token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.verifyToken('invalid-token')).rejects.toThrow('Invalid or expired token');
    });

    it('should throw error if user not found', async () => {
      mockJwt.verify.mockReturnValue({ userId: 'user-123' } as any);
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(authService.verifyToken('valid-token')).rejects.toThrow('Invalid or expired token');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const updateData = {
        location: { latitude: 41.8781, longitude: -87.6298 },
        preferences: { notifications: false }
      };

      const updatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        location: updateData.location,
        preferences: updateData.preferences
      } as any;

      mockUserRepo.update.mockResolvedValue(updatedUser);

      const result = await authService.updateProfile('user-123', updateData);

      expect(mockUserRepo.update).toHaveBeenCalledWith('user-123', updateData);
      expect(result).toBe(updatedUser);
    });

    it('should throw error if user not found', async () => {
      mockUserRepo.update.mockResolvedValue(null);

      await expect(authService.updateProfile('user-123', {})).rejects.toThrow('User not found');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockUser = {
        id: 'user-123',
        password_hash: 'old-hashed-password'
      } as any;

      const updatedUser = {
        id: 'user-123',
        email: 'test@example.com'
      } as any;

      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockBcrypt.hash.mockResolvedValue('new-hashed-password');
      mockUserRepo.update.mockResolvedValue(updatedUser);

      const result = await authService.changePassword('user-123', 'oldPassword', 'NewPassword123!');

      expect(mockUserRepo.findById).toHaveBeenCalledWith('user-123');
      expect(mockBcrypt.compare).toHaveBeenCalledWith('oldPassword', 'old-hashed-password');
      expect(mockBcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 12);
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-123', {
        password_hash: 'new-hashed-password'
      });
      expect(result).toBe(updatedUser);
    });

    it('should throw error for incorrect current password', async () => {
      const mockUser = { id: 'user-123', password_hash: 'hashed-password' } as any;
      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(authService.changePassword('user-123', 'wrongPassword', 'NewPassword123!'))
        .rejects.toThrow('Current password is incorrect');
    });

    it('should throw error for weak new password', async () => {
      const mockUser = { id: 'user-123', password_hash: 'hashed-password' } as any;
      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);

      await expect(authService.changePassword('user-123', 'oldPassword', 'weak'))
        .rejects.toThrow('New password must be at least 8 characters');
    });
  });
});