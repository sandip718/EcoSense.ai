# EcoSense.ai Data Models

This directory contains the core data models, repositories, and database utilities for the EcoSense.ai platform.

## Overview

The data layer implements:
- TypeScript interfaces for all environmental data types
- Repository pattern for database operations
- PostGIS geometry utilities for spatial data
- Data validation utilities
- Database migration management

## Components

### Types (`types.ts`)
Defines all TypeScript interfaces for:
- `EnvironmentalDataPoint` - Environmental sensor data
- `UserProfile` - User account and preferences
- `ImageAnalysis` - AI-powered image analysis results
- `CommunityAction` - User community contributions
- `Notification` - System notifications

### Repositories
- `EnvironmentalDataRepository` - CRUD operations for environmental data
- `UserRepository` - User management operations
- `ImageAnalysisRepository` - Image analysis data management

### Utilities
- `geometry.ts` - PostGIS spatial data utilities
- `validation.ts` - Data validation functions
- `migrations.ts` - Database migration runner

## Database Schema

The database uses PostgreSQL with PostGIS extension for spatial data:

### Core Tables
- `environmental_data` - Environmental measurements with geospatial indexing
- `users` - User profiles with location and gamification data
- `image_analyses` - AI analysis results for user-uploaded images
- `community_actions` - User contributions and activities
- `notifications` - System alerts and notifications

### Spatial Features
- All location data stored as PostGIS POINT geometry
- Spatial indexes for efficient location-based queries
- Support for radius-based searches and distance calculations

## Usage Examples

### Environmental Data Repository

```typescript
import { EnvironmentalDataRepository } from './models';

const envRepo = new EnvironmentalDataRepository();

// Create environmental data point
const dataPoint = await envRepo.create({
  source: 'openaq',
  pollutant: 'pm25',
  value: 15.5,
  unit: 'µg/m³',
  location: { latitude: 37.7749, longitude: -122.4194 },
  timestamp: new Date(),
  quality_grade: 'A'
});

// Query data with location filter
const results = await envRepo.findMany({
  pollutant: 'pm25',
  location: {
    latitude: 37.7749,
    longitude: -122.4194,
    radius_km: 5
  },
  limit: 10
});
```

### User Repository

```typescript
import { UserRepository } from './models';

const userRepo = new UserRepository();

// Create user
const user = await userRepo.create({
  email: 'user@example.com',
  password_hash: 'hashed_password',
  location: { latitude: 37.7749, longitude: -122.4194 },
  preferences: {
    notifications: true,
    activity_types: ['outdoor_sports']
  }
});

// Add points and level up
await userRepo.addPoints(user.id, 100);
```

### Data Validation

```typescript
import { validateEnvironmentalData } from './utils/validation';

const validation = validateEnvironmentalData({
  source: 'openaq',
  pollutant: 'pm25',
  value: 15.5,
  unit: 'µg/m³',
  location: { latitude: 37.7749, longitude: -122.4194 },
  timestamp: new Date(),
  quality_grade: 'A'
});

if (!validation.isValid) {
  console.log('Validation errors:', validation.errors);
}
```

## Database Migrations

Use the migration CLI to manage database schema:

```bash
# Check migration status
npm run migrate:status

# Run pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:rollback
```

## Testing

Run the implementation test:

```bash
npm run test:implementation
```

Run unit tests:

```bash
npm test
```

## Requirements Compliance

This implementation satisfies the following requirements:

- **Requirement 1.4**: Environmental data validation and storage with timestamp and location metadata
- **Requirement 8.1**: Data quality validation and anomaly flagging
- **Requirement 8.2**: Weighted averaging based on source reliability and data quality scoring

## Performance Considerations

- Connection pooling for database connections
- Spatial indexes for efficient location-based queries
- Bulk insert operations for high-volume data ingestion
- Prepared statements to prevent SQL injection
- Transaction support for data consistency

## Security Features

- Input validation for all data types
- SQL injection prevention through parameterized queries
- Password hash storage (never plain text)
- Data type enforcement through TypeScript interfaces