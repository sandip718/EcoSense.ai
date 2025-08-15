// Tests for gamification routes
// Tests requirements 9.3, 9.4 for points/badge system and leaderboards

import request from 'supertest';
import express from 'express';
import gamificationRoutes from '../gamification';
import { GamificationService } from '../../services/GamificationService';

// Mock GamificationService
jest.mock('../../services/GamificationService');

const mockGamificationService = GamificationService as jest.MockedClass<typeof GamificationService>;

describe('Gamification Routes', () => {
  let app: express.Application;
  let mockGamificationServiceInstance: jest.Mocked<GamificationService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());
    app.use('/gamification', gamificationRoutes);

    mockGamificationServiceInstance = new mockGamificationService() as jest.Mocked<GamificationService>;
    (GamificationService as any).mockImplementation(() => mockGamificationServiceInstance);
  });

  describe('GET /gamification/leaderboard', () => {
    const mockLeaderboard = [
      {
        user_id: 'user-1',
        email: 'user1@example.com',
        points: 1500,
        level: 2,
        badges: ['first_contribution', 'point_collector'],
        contribution_streak: 10,
        rank: 1
      },
      {
        user_id: 'user-2',
        email: 'user2@example.com',
        points: 1200,
        level: 2,
        badges: ['first_contribution'],
        contribution_streak: 5,
        rank: 2
      }
    ];

    it('should return global leaderboard', async () => {
      mockGamificationServiceInstance.getLeaderboard.mockResolvedValue(mockLeaderboard);

      const response = await request(app)
        .get('/gamification/leaderboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.leaderboard).toEqual(mockLeaderboard);
      expect(response.body.data.query.timeframe).toBe('all_time');
      expect(mockGamificationServiceInstance.getLeaderboard).toHaveBeenCalledWith({
        timeframe: 'all_time',
        limit: 50,
        offset: 0
      });
    });

    it('should return location-filtered leaderboard', async () => {
      mockGamificationServiceInstance.getLeaderboard.mockResolvedValue(mockLeaderboard);

      const response = await request(app)
        .get('/gamification/leaderboard')
        .query({
          latitude: 40.7128,
          longitude: -74.0060,
          radius_km: 10,
          timeframe: 'weekly',
          limit: 25
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockGamificationServiceInstance.getLeaderboard).toHaveBeenCalledWith({
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          radius_km: 10
        },
        timeframe: 'weekly',
        limit: 25,
        offset: 0
      });
    });

    it('should return validation error for invalid coordinates', async () => {
      const response = await request(app)
        .get('/gamification/leaderboard')
        .query({
          latitude: 91, // Invalid latitude
          longitude: -74.0060
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle service errors', async () => {
      mockGamificationServiceInstance.getLeaderboard.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/gamification/leaderboard')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('LEADERBOARD_FETCH_FAILED');
    });
  });

  describe('GET /gamification/my-rank', () => {
    it('should return user rank when authenticated', async () => {
      mockGamificationServiceInstance.getUserRank.mockResolvedValue(15);

      // Mock authentication
      app.use('/gamification/my-rank', (req, res, next) => {
        (req as any).user = { id: 'user-123' };
        next();
      });

      const response = await request(app)
        .get('/gamification/my-rank')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rank).toBe(15);
      expect(response.body.data.location).toBe(null);
      expect(mockGamificationServiceInstance.getUserRank).toHaveBeenCalledWith('user-123', undefined);
    });

    it('should return location-based rank', async () => {
      mockGamificationServiceInstance.getUserRank.mockResolvedValue(8);

      // Mock authentication
      app.use('/gamification/my-rank', (req, res, next) => {
        (req as any).user = { id: 'user-123' };
        next();
      });

      const response = await request(app)
        .get('/gamification/my-rank')
        .query({
          latitude: 40.7128,
          longitude: -74.0060,
          radius_km: 5
        })
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rank).toBe(8);
      expect(response.body.data.location).toEqual({
        latitude: 40.7128,
        longitude: -74.0060,
        radius_km: 5
      });
    });
  });

  describe('GET /gamification/badges', () => {
    const mockBadgeProgress = [
      {
        id: 'first_contribution',
        name: 'First Contribution',
        description: 'Made your first environmental contribution',
        icon: '🌱',
        criteria: { type: 'actions', threshold: 1 },
        earned: true,
        progress: 100
      },
      {
        id: 'point_collector',
        name: 'Point Collector',
        description: 'Earned 1000 points',
        icon: '⭐',
        criteria: { type: 'points', threshold: 1000 },
        earned: false,
        progress: 75
      }
    ];

    it('should return badge progress when authenticated', async () => {
      mockGamificationServiceInstance.getBadgeProgress.mockResolvedValue(mockBadgeProgress);

      // Mock authentication
      app.use('/gamification/badges', (req, res, next) => {
        (req as any).user = { id: 'user-123' };
        next();
      });

      const response = await request(app)
        .get('/gamification/badges')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.badges).toEqual(mockBadgeProgress);
      expect(response.body.data.earned_count).toBe(1);
      expect(response.body.data.total_count).toBe(2);
    });
  });

  describe('POST /gamification/award-points', () => {
    const awardData = {
      actionType: 'photo_upload',
      basePoints: 100
    };

    it('should award points successfully when authenticated', async () => {
      const mockReward = {
        points: 120,
        badges: ['photo_enthusiast'],
        level_up: true,
        previous_level: 1,
        new_level: 2
      };

      mockGamificationServiceInstance.updateContributionStreak.mockResolvedValue(6);
      mockGamificationServiceInstance.awardPoints.mockResolvedValue(mockReward);

      // Mock authentication
      app.use('/gamification/award-points', (req, res, next) => {
        (req as any).user = { id: 'user-123' };
        next();
      });

      const response = await request(app)
        .post('/gamification/award-points')
        .set('Authorization', 'Bearer valid-token')
        .send(awardData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.points).toBe(120);
      expect(response.body.data.badges).toEqual(['photo_enthusiast']);
      expect(response.body.data.level_up).toBe(true);
      expect(response.body.data.new_streak).toBe(6);
      expect(mockGamificationServiceInstance.updateContributionStreak).toHaveBeenCalledWith('user-123');
      expect(mockGamificationServiceInstance.awardPoints).toHaveBeenCalledWith('user-123', 'photo_upload', 100);
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = { actionType: 'photo_upload' }; // Missing basePoints

      // Mock authentication
      app.use('/gamification/award-points', (req, res, next) => {
        (req as any).user = { id: 'user-123' };
        next();
      });

      const response = await request(app)
        .post('/gamification/award-points')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /gamification/stats', () => {
    it('should return user gamification statistics', async () => {
      const mockUser = {
        id: 'user-123',
        points: 750,
        level: 2,
        contribution_streak: 8,
        location: { latitude: 40.7128, longitude: -74.0060 }
      };

      const mockBadgeProgress = [
        { id: 'first_contribution', earned: true, progress: 100 },
        { id: 'point_collector', earned: false, progress: 75 },
        { id: 'streak_master', earned: true, progress: 100 }
      ];

      mockGamificationServiceInstance.getBadgeProgress.mockResolvedValue(mockBadgeProgress as any);
      mockGamificationServiceInstance.getUserRank.mockResolvedValueOnce(12); // Global rank
      mockGamificationServiceInstance.getUserRank.mockResolvedValueOnce(5);  // Local rank

      // Mock authentication
      app.use('/gamification/stats', (req, res, next) => {
        (req as any).user = mockUser;
        next();
      });

      const response = await request(app)
        .get('/gamification/stats')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user_stats).toEqual({
        points: 750,
        level: 2,
        contribution_streak: 8,
        badges_earned: 2,
        total_badges: 3
      });
      expect(response.body.data.rankings).toEqual({
        global_rank: 12,
        local_rank: 5
      });
      expect(response.body.data.recent_badges).toHaveLength(2);
      expect(response.body.data.next_badges).toHaveLength(1);
    });

    it('should handle user without location', async () => {
      const mockUser = {
        id: 'user-123',
        points: 500,
        level: 1,
        contribution_streak: 3,
        location: null
      };

      mockGamificationServiceInstance.getBadgeProgress.mockResolvedValue([]);
      mockGamificationServiceInstance.getUserRank.mockResolvedValue(25);

      // Mock authentication
      app.use('/gamification/stats', (req, res, next) => {
        (req as any).user = mockUser;
        next();
      });

      const response = await request(app)
        .get('/gamification/stats')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rankings.global_rank).toBe(25);
      expect(response.body.data.rankings.local_rank).toBe(null);
    });
  });

  describe('GET /gamification/leaderboard/local', () => {
    it('should return local leaderboard based on user location', async () => {
      const mockUser = {
        id: 'user-123',
        location: { latitude: 40.7128, longitude: -74.0060 }
      };

      const mockLeaderboard = [
        { user_id: 'user-1', points: 1500, rank: 1 },
        { user_id: 'user-2', points: 1200, rank: 2 }
      ];

      mockGamificationServiceInstance.getLeaderboard.mockResolvedValue(mockLeaderboard);
      mockGamificationServiceInstance.getUserRank.mockResolvedValue(3);

      // Mock authentication
      app.use('/gamification/leaderboard/local', (req, res, next) => {
        (req as any).user = mockUser;
        next();
      });

      const response = await request(app)
        .get('/gamification/leaderboard/local')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.leaderboard).toEqual(mockLeaderboard);
      expect(response.body.data.user_rank).toBe(3);
      expect(response.body.data.query.center).toEqual({
        latitude: 40.7128,
        longitude: -74.0060,
        radius_km: 50
      });
    });

    it('should return error for user without location', async () => {
      const mockUser = {
        id: 'user-123',
        location: null
      };

      // Mock authentication
      app.use('/gamification/leaderboard/local', (req, res, next) => {
        (req as any).user = mockUser;
        next();
      });

      const response = await request(app)
        .get('/gamification/leaderboard/local')
        .set('Authorization', 'Bearer valid-token')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_LOCATION');
    });

    it('should handle custom radius and timeframe', async () => {
      const mockUser = {
        id: 'user-123',
        location: { latitude: 40.7128, longitude: -74.0060 }
      };

      mockGamificationServiceInstance.getLeaderboard.mockResolvedValue([]);
      mockGamificationServiceInstance.getUserRank.mockResolvedValue(1);

      // Mock authentication
      app.use('/gamification/leaderboard/local', (req, res, next) => {
        (req as any).user = mockUser;
        next();
      });

      const response = await request(app)
        .get('/gamification/leaderboard/local')
        .query({
          radius_km: 25,
          timeframe: 'monthly',
          limit: 20
        })
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(mockGamificationServiceInstance.getLeaderboard).toHaveBeenCalledWith({
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          radius_km: 25
        },
        timeframe: 'monthly',
        limit: 20,
        offset: 0
      });
    });
  });
});