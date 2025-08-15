// Example usage of User Management and Gamification System
// Demonstrates requirements 9.1, 9.2, 9.3, 9.4 implementation

import { AuthService } from '../AuthService';
import { GamificationService } from '../GamificationService';
import { CommunityActionRepository } from '../../models/CommunityActionRepository';

async function demonstrateUserManagement() {
  console.log('=== EcoSense.ai User Management & Gamification Demo ===\n');

  const authService = new AuthService();
  const gamificationService = new GamificationService();
  const actionRepository = new CommunityActionRepository();

  try {
    // 1. User Registration
    console.log('1. User Registration');
    console.log('-------------------');
    
    const newUser = await authService.register({
      email: 'eco.warrior@example.com',
      password: 'SecurePassword123!',
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        address: 'New York, NY'
      },
      preferences: {
        notifications: true,
        activity_types: ['air_quality', 'water_quality'],
        health_conditions: ['asthma'],
        notification_radius: 10,
        preferred_units: {
          temperature: 'fahrenheit',
          distance: 'imperial'
        }
      }
    });

    console.log(`✅ User registered successfully:`);
    console.log(`   - ID: ${newUser.user.id}`);
    console.log(`   - Email: ${newUser.user.email}`);
    console.log(`   - Points: ${newUser.user.points}`);
    console.log(`   - Level: ${newUser.user.level}`);
    console.log(`   - Token: ${newUser.token.substring(0, 20)}...`);
    console.log();

    // 2. User Login
    console.log('2. User Login');
    console.log('-------------');
    
    const loginResult = await authService.login({
      email: 'eco.warrior@example.com',
      password: 'SecurePassword123!'
    });

    console.log(`✅ User logged in successfully:`);
    console.log(`   - Welcome back: ${loginResult.user.email}`);
    console.log(`   - Current points: ${loginResult.user.points}`);
    console.log(`   - Current level: ${loginResult.user.level}`);
    console.log();

    const userId = loginResult.user.id;

    // 3. Community Actions and Point System
    console.log('3. Community Actions & Points');
    console.log('-----------------------------');

    // Simulate various community actions
    const actions = [
      { type: 'photo_upload', points: 50, description: 'Uploaded air quality photo' },
      { type: 'data_contribution', points: 30, description: 'Contributed sensor data' },
      { type: 'report_issue', points: 40, description: 'Reported pollution issue' },
      { type: 'photo_upload', points: 50, description: 'Uploaded water quality photo' },
      { type: 'community_cleanup', points: 100, description: 'Participated in cleanup event' }
    ];

    for (const action of actions) {
      // Record the community action
      await actionRepository.create({
        user_id: userId,
        action_type: action.type,
        location: {
          latitude: 40.7128 + (Math.random() - 0.5) * 0.01,
          longitude: -74.0060 + (Math.random() - 0.5) * 0.01
        },
        timestamp: new Date(),
        points_earned: action.points,
        impact_description: action.description,
        metadata: { source: 'demo' }
      });

      // Award points and update streak
      const reward = await gamificationService.awardPoints(userId, action.type, action.points);
      await gamificationService.updateContributionStreak(userId);

      console.log(`✅ Action: ${action.description}`);
      console.log(`   - Base points: ${action.points}`);
      console.log(`   - Total awarded: ${reward.points} (with bonuses)`);
      console.log(`   - New badges: ${reward.badges.length > 0 ? reward.badges.join(', ') : 'None'}`);
      if (reward.level_up) {
        console.log(`   - 🎉 LEVEL UP! ${reward.previous_level} → ${reward.new_level}`);
      }
      console.log();
    }

    // 4. Badge Progress
    console.log('4. Badge Progress');
    console.log('----------------');
    
    const badgeProgress = await gamificationService.getBadgeProgress(userId);
    const earnedBadges = badgeProgress.filter(b => b.earned);
    const inProgressBadges = badgeProgress.filter(b => !b.earned && (b.progress || 0) > 0);

    console.log(`✅ Earned Badges (${earnedBadges.length}):`);
    earnedBadges.forEach(badge => {
      console.log(`   ${badge.icon} ${badge.name}: ${badge.description}`);
    });
    console.log();

    console.log(`📈 Badges in Progress (${inProgressBadges.length}):`);
    inProgressBadges.forEach(badge => {
      console.log(`   ${badge.icon} ${badge.name}: ${Math.round(badge.progress || 0)}% complete`);
    });
    console.log();

    // 5. Leaderboards
    console.log('5. Leaderboards');
    console.log('---------------');

    // Global leaderboard
    const globalLeaderboard = await gamificationService.getLeaderboard({
      limit: 5
    });

    console.log('🌍 Global Leaderboard (Top 5):');
    globalLeaderboard.forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.email} - ${entry.points} points (Level ${entry.level})`);
    });
    console.log();

    // Local leaderboard
    const localLeaderboard = await gamificationService.getLeaderboard({
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        radius_km: 50
      },
      limit: 5
    });

    console.log('📍 Local Leaderboard (50km radius):');
    localLeaderboard.forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.email} - ${entry.points} points`);
    });
    console.log();

    // User's rank
    const globalRank = await gamificationService.getUserRank(userId);
    const localRank = await gamificationService.getUserRank(userId, {
      latitude: 40.7128,
      longitude: -74.0060,
      radius_km: 50
    });

    console.log(`🏆 User Rankings:`);
    console.log(`   - Global rank: #${globalRank}`);
    console.log(`   - Local rank: #${localRank}`);
    console.log();

    // 6. Profile Management
    console.log('6. Profile Management');
    console.log('--------------------');

    // Update user profile
    const updatedProfile = await authService.updateProfile(userId, {
      location: {
        latitude: 41.8781,
        longitude: -87.6298,
        address: 'Chicago, IL'
      },
      preferences: {
        notifications: true,
        activity_types: ['air_quality', 'water_quality', 'noise_pollution'],
        notification_radius: 15
      }
    });

    console.log(`✅ Profile updated:`);
    console.log(`   - New location: Chicago, IL`);
    console.log(`   - Activity types: ${updatedProfile.preferences.activity_types?.join(', ')}`);
    console.log(`   - Notification radius: ${updatedProfile.preferences.notification_radius}km`);
    console.log();

    // 7. User Statistics
    console.log('7. User Statistics');
    console.log('-----------------');

    const userStats = await actionRepository.getUserStats(userId);
    const currentUser = await authService.getProfile(userId);

    console.log(`📊 User Statistics:`);
    console.log(`   - Total actions: ${userStats.total_actions}`);
    console.log(`   - Total points earned: ${userStats.total_points}`);
    console.log(`   - Current points: ${currentUser.points}`);
    console.log(`   - Current level: ${currentUser.level}`);
    console.log(`   - Contribution streak: ${currentUser.contribution_streak} days`);
    console.log(`   - Badges earned: ${currentUser.badges.length}`);
    console.log();

    console.log(`📈 Action Breakdown:`);
    Object.entries(userStats.action_types).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count} actions`);
    });
    console.log();

    // 8. Weekly Leaderboard
    console.log('8. Weekly Leaderboard');
    console.log('--------------------');

    const weeklyLeaderboard = await gamificationService.getLeaderboard({
      timeframe: 'weekly',
      limit: 3
    });

    console.log('📅 Weekly Leaderboard (Top 3):');
    weeklyLeaderboard.forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.email} - ${entry.points} points this week`);
    });
    console.log();

    console.log('🎉 Demo completed successfully!');
    console.log('The user management and gamification system is fully functional.');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    throw error;
  }
}

// Export for use in other files
export { demonstrateUserManagement };

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateUserManagement()
    .then(() => {
      console.log('\n✅ User Management & Gamification Demo completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Demo failed:', error);
      process.exit(1);
    });
}