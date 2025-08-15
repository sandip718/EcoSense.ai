# User Management and Gamification System

This document describes the implementation of the User Management and Gamification System for EcoSense.ai, which implements requirements 9.1, 9.2, 9.3, and 9.4.

## Overview

The system provides comprehensive user authentication, profile management, and gamification features to encourage community participation in environmental monitoring and action.

## Components

### 1. Authentication Service (`AuthService`)

**Purpose**: Handles user registration, login, and profile management.

**Key Features**:
- Secure user registration with email validation
- Password strength validation (8+ chars, uppercase, lowercase, number, special char)
- JWT-based authentication
- Profile management with location and preferences
- Password change functionality

**Usage**:
```typescript
import { AuthService } from './services/AuthService';

const authService = new AuthService();

// Register new user
const result = await authService.register({
  email: 'user@example.com',
  password: 'SecurePassword123!',
  location: { latitude: 40.7128, longitude: -74.0060 },
  preferences: { notifications: true }
});

// Login user
const loginResult = await authService.login({
  email: 'user@example.com',
  password: 'SecurePassword123!'
});
```

### 2. Gamification Service (`GamificationService`)

**Purpose**: Manages points, badges, leaderboards, and user engagement.

**Key Features**:
- Point system with streak and level bonuses
- Badge system with progress tracking
- Global and location-based leaderboards
- Contribution streak tracking
- Automated badge awarding

**Badge System**:
- **First Contribution**: Made your first environmental contribution
- **Photo Enthusiast**: Uploaded 10 environmental photos
- **Data Collector**: Contributed 50 data points
- **Streak Master**: Maintained a 7-day contribution streak
- **Point Collector**: Earned 1000 points
- **Environmental Champion**: Earned 10000 points
- **Community Leader**: Maintained a 30-day contribution streak

**Usage**:
```typescript
import { GamificationService } from './services/GamificationService';

const gamificationService = new GamificationService();

// Award points for action
const reward = await gamificationService.awardPoints(userId, 'photo_upload', 50);

// Get leaderboard
const leaderboard = await gamificationService.getLeaderboard({
  location: { latitude: 40.7128, longitude: -74.0060, radius_km: 10 },
  limit: 50
});

// Get badge progress
const badges = await gamificationService.getBadgeProgress(userId);
```

### 3. Community Action Repository (`CommunityActionRepository`)

**Purpose**: Tracks user contributions and community actions.

**Key Features**:
- Record community actions with location and metadata
- Query actions by user, type, location, and time
- Generate user statistics and action breakdowns
- Support leaderboard calculations

**Usage**:
```typescript
import { CommunityActionRepository } from './models/CommunityActionRepository';

const actionRepo = new CommunityActionRepository();

// Record action
await actionRepo.create({
  user_id: userId,
  action_type: 'photo_upload',
  location: { latitude: 40.7128, longitude: -74.0060 },
  timestamp: new Date(),
  points_earned: 50,
  impact_description: 'Uploaded air quality photo'
});

// Get user stats
const stats = await actionRepo.getUserStats(userId);
```

## API Endpoints

### Authentication Routes (`/api/auth`)

- `POST /register` - Register new user
- `POST /login` - Login user
- `GET /profile` - Get current user profile (authenticated)
- `PUT /profile` - Update user profile (authenticated)
- `POST /change-password` - Change password (authenticated)
- `POST /verify-token` - Verify JWT token

### Gamification Routes (`/api/gamification`)

- `GET /leaderboard` - Get global/local leaderboard
- `GET /my-rank` - Get current user's rank (authenticated)
- `GET /badges` - Get badge progress (authenticated)
- `POST /award-points` - Award points for action (authenticated)
- `GET /stats` - Get user gamification statistics (authenticated)
- `GET /leaderboard/local` - Get local leaderboard based on user location (authenticated)

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    location GEOMETRY(POINT, 4326),
    preferences JSONB DEFAULT '{}',
    points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    badges TEXT[] DEFAULT '{}',
    contribution_streak INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Community Actions Table
```sql
CREATE TABLE community_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    location GEOMETRY(POINT, 4326),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    points_earned INTEGER DEFAULT 0,
    impact_description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Security Features

1. **Password Security**:
   - Bcrypt hashing with salt rounds of 12
   - Strong password requirements
   - Secure password change process

2. **JWT Authentication**:
   - Configurable expiration time
   - Secure token verification
   - Middleware for route protection

3. **Input Validation**:
   - Joi schema validation for all endpoints
   - Email format validation
   - Location coordinate validation

4. **Data Sanitization**:
   - Password hashes never returned in API responses
   - User input sanitization
   - SQL injection prevention through parameterized queries

## Gamification Mechanics

### Point System
- Base points awarded for different actions
- Streak bonus: Up to 50% bonus based on contribution streak
- Level bonus: Up to 30% bonus based on user level
- Level calculation: Every 1000 points = 1 level

### Streak System
- Daily contribution tracking
- Consecutive day bonuses
- Streak resets if gap > 1 day
- Streak-based badges and rewards

### Leaderboard System
- Global rankings by total points
- Location-based rankings within radius
- Time-based rankings (weekly, monthly, all-time)
- Real-time rank calculations

## Testing

The system includes comprehensive tests for:
- Authentication flows
- Password validation
- Profile management
- Point awarding and calculations
- Badge system
- Leaderboard functionality
- API endpoint validation

Run tests with:
```bash
npm test -- --testPathPattern="AuthService|GamificationService|auth.test|gamification.test"
```

## Example Usage

See `src/services/examples/user-management-example.ts` for a complete demonstration of the system functionality.

## Configuration

Required environment variables:
```env
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
DATABASE_URL=postgresql://...
```

## Integration

The system integrates with:
- Express.js application
- PostgreSQL with PostGIS
- Redis for caching (optional)
- Image analysis system for photo contributions
- Community recommendation system

## Future Enhancements

Potential improvements:
- Social features (friend connections, team challenges)
- Achievement sharing
- Seasonal events and special badges
- Integration with external environmental APIs
- Mobile push notifications
- Advanced analytics and insights