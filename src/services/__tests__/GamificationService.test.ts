// Tests for GamificationService
// Tests requirements 9.3, 9.4 for points/badge system and leaderboards

import { GamificationService } from '../GamificationService';
import { UserRepository } from '../../models/UserRepository';
import { Pool } from 'pg';

// Mock dependencies
jest.mock('../../models/UserRepository');
jest.mock('../../config/database');

const mockUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;

describe('GamificationService', () => {
  let gamificationService: GamificationService;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let mockDb: jest.Mocked<Pool>;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    mockDb = {
      connect: jest.fn().mockResolvedValue(mockClient)
    } as any;

    mockUserRepo = new mockUserRepository() as jest.Mocked<UserRepository>;
    gamificationService = new GamificationService();
    (gamificationService as any).userRepository = mockUserRepo;
    (gamificationService as any).db = mockDb;
  });

  describe('awardPoints', () => {
    it('should award points and check for badges', async () => {
      const mockUser = {
        id: 'user-123',
        points: 500,
        level: 1,
        contribution_streak: 3,
        badges: []
      } as any;

      const updatedUser = {
        ...mockUser,
        points: 650,
        level: 1
      };

      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockUserRepo.addPoints.mockResolvedValue(updatedUser);
      mockClient.query.mockResolvedValue({ rows: [] }); // No action stats

      const result = await gamificationService.awardPoints('user-123', 'photo_upload', 100);

      expect(mockUserRepo.findById).toHaveBeenCalledWith('user-123');
      expect(mockUserRepo.addPoints).toHaveBeenCalledWith('user-123', expect.any(Number));
      expect(result.points).toBeGreaterThan(100); // Should include bonus
      expect(result.level_up).toBe(false);
      expect(result.previous_level).toBe(1);
      expect(result.new_level).toBe(1);
    });

    it('should detect level up', async () => {
      const mockUser = {
        id: 'user-123',
        points: 950,
        level: 1,
        contribution_streak: 0,
        badges: []
      } as any;

      const updatedUser = {
        ...mockUser,
        points: 1050,
        level: 2
      };

      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockUserRepo.addPoints.mockResolvedValue(updatedUser);
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await gamificationService.awardPoints('user-123', 'data_contribution', 100);

      expect(result.level_up).toBe(true);
      expect(result.previous_level).toBe(1);
      expect(result.new_level).toBe(2);
    });

    it('should award new badges', async () => {
      const mockUser = {
        id: 'user-123',
        points: 900,
        level: 1,
        contribution_streak: 0,
        badges: []
      } as any;

      const updatedUser = {
        ...mockUser,
        points: 1100,
        level: 2
      };

      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockUserRepo.addPoints.mockResolvedValue(updatedUser);
      mockClient.query.mockResolvedValue({ rows: [{ action_type: 'photo_upload', count: '1' }] });
      mockUserRepo.addBadge.mockResolvedValue(updatedUser);

      const result = await gamificationService.awardPoints('user-123', 'photo_upload', 200);

      expect(result.badges.length).toBeGreaterThan(0);
      expect(mockUserRepo.addBadge).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(gamificationService.awardPoints('user-123', 'action', 100))
        .rejects.toThrow('User not found');
    });
  });

  describe('updateContributionStreak', () => {
    it('should start new streak for first action', async () => {
      const mockUser = {
        id: 'user-123',
        contribution_streak: 0
      } as any;

      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockClient.query.mockResolvedValue({ rows: [{ last_action: null }] });
      mockUserRepo.updateContributionStreak.mockResolvedValue(1);

      const result = await gamificationService.updateContributionStreak('user-123');

      expect(result).toBe(1);
      expect(mockUserRepo.updateContributionStreak).toHaveBeenCalledWith('user-123', 1);
    });

    it('should increment streak for consecutive day', async () => {
      const mockUser = {
        id: 'user-123',
        contribution_streak: 5
      } as any;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockClient.query.mockResolvedValue({ rows: [{ last_action: yesterday }] });
      mockUserRepo.updateContributionStreak.mockResolvedValue(6);

      const result = await gamificationService.updateContributionStreak('user-123');

      expect(result).toBe(6);
      expect(mockUserRepo.updateContributionStreak).toHaveBeenCalledWith('user-123', 6);
    });

    it('should reset streak if gap is more than one day', async () => {
      const mockUser = {
        id: 'user-123',
        contribution_streak: 10
      } as any;

      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockClient.query.mockResolvedValue({ rows: [{ last_action: threeDaysAgo }] });
      mockUserRepo.updateContributionStreak.mockResolvedValue(1);

      const result = await gamificationService.updateContributionStreak('user-123');

      expect(result).toBe(1);
      expect(mockUserRepo.updateContributionStreak).toHaveBeenCalledWith('user-123', 1);
    });
  });

  describe('getLeaderboard', () => {
    it('should return global leaderboard', async () => {
      const mockLeaderboard = [
        {
          user_id: 'user-1',
          email: 'user1@example.com',
          points: '1500',
          level: 2,
          badges: ['first_contribution', 'point_collector'],
          contribution_streak: 10,
          location: null,
          rank: '1'
        },
        {
          user_id: 'user-2',
          email: 'user2@example.com',
          points: '1200',
          level: 2,
          badges: ['first_contribution'],
          contribution_streak: 5,
          location: null,
          rank: '2'
        }
      ];

      mockClient.query.mockResolvedValue({ rows: mockLeaderboard });

      const result = await gamificationService.getLeaderboard();

      expect(result).toHaveLength(2);
      expect(result[0].user_id).toBe('user-1');
      expect(result[0].points).toBe(1500);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
    });

    it('should return location-filtered leaderboard', async () => {
      const query = {
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          radius_km: 10
        },
        limit: 25
      };

      mockClient.query.mockResolvedValue({ rows: [] });

      await gamificationService.getLeaderboard(query);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ST_DWithin'),
        expect.arrayContaining([-74.0060, 40.7128, 10000, 25, 0])
      );
    });

    it('should handle timeframe filtering', async () => {
      const query = {
        timeframe: 'weekly' as const,
        limit: 10
      };

      mockClient.query.mockResolvedValue({ rows: [] });

      await gamificationService.getLeaderboard(query);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('period_points'),
        expect.arrayContaining([10, 0])
      );
    });
  });

  describe('getUserRank', () => {
    it('should return user rank', async () => {
      mockClient.query.mockResolvedValue({ rows: [{ rank: '15' }] });

      const result = await gamificationService.getUserRank('user-123');

      expect(result).toBe(15);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) + 1 as rank'),
        ['user-123']
      );
    });

    it('should return location-based rank', async () => {
      const location = {
        latitude: 40.7128,
        longitude: -74.0060,
        radius_km: 5
      };

      mockClient.query.mockResolvedValue({ rows: [{ rank: '8' }] });

      const result = await gamificationService.getUserRank('user-123', location);

      expect(result).toBe(8);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('ST_DWithin'),
        ['user-123', -74.0060, 40.7128, 5000]
      );
    });
  });

  describe('getBadgeProgress', () => {
    it('should return badge progress for user', async () => {
      const mockUser = {
        id: 'user-123',
        points: 750,
        contribution_streak: 5,
        badges: ['first_contribution']
      } as any;

      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockClient.query.mockResolvedValue({ rows: [{ action_type: 'photo_upload', count: '8' }] });

      const result = await gamificationService.getBadgeProgress('user-123');

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      const firstContributionBadge = result.find(b => b.id === 'first_contribution');
      expect(firstContributionBadge?.earned).toBe(true);
      expect(firstContributionBadge?.progress).toBe(100);

      const pointCollectorBadge = result.find(b => b.id === 'point_collector');
      expect(pointCollectorBadge?.earned).toBe(false);
      expect(pointCollectorBadge?.progress).toBe(75); // 750/1000 * 100
    });

    it('should throw error if user not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(gamificationService.getBadgeProgress('user-123'))
        .rejects.toThrow('User not found');
    });
  });
});