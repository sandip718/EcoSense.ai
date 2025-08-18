# EcoSense.ai API Endpoints Documentation

This document describes the REST API endpoints implemented for frontend integration as part of Task 10.

## Overview

The API provides comprehensive endpoints for:
- Environmental data queries with geospatial filtering
- Image upload and analysis status tracking
- User dashboard data aggregation
- Community action tracking and leaderboards

## Base URL

All API endpoints are prefixed with `/api/`

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Environmental Data Endpoints

### GET /api/environmental-data

Get environmental data with optional filtering.

**Query Parameters:**
- `lat` (optional): Latitude for location-based filtering
- `lng` (optional): Longitude for location-based filtering  
- `radius` (optional): Radius in km (default: 10, max: 1000)
- `pollutant` (optional): Pollutant type to filter by
- `source` (optional): Data source (`openaq`, `water_quality_portal`, `local_sensor`)
- `start` (optional): Start date (ISO string)
- `end` (optional): End date (ISO string)
- `quality_grade` (optional): Quality grades (comma-separated: A,B,C,D)
- `limit` (optional): Number of results (default: 50, max: 1000)
- `offset` (optional): Pagination offset (default: 0)

**Example:**
```
GET /api/environmental-data?lat=40.7128&lng=-74.0060&radius=5&pollutant=pm25&limit=100
```

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "uuid",
        "source": "openaq",
        "pollutant": "pm25",
        "value": 25.5,
        "unit": "µg/m³",
        "location": {
          "latitude": 40.7128,
          "longitude": -74.0060
        },
        "timestamp": "2024-01-01T12:00:00Z",
        "quality_grade": "B",
        "created_at": "2024-01-01T12:00:00Z"
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 100,
      "has_next": true,
      "has_previous": false
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### GET /api/environmental-data/latest

Get the latest environmental data for a specific location and pollutant.

**Query Parameters:**
- `lat` (required): Latitude
- `lng` (required): Longitude
- `radius` (optional): Radius in km (default: 5, max: 100)
- `pollutant` (required): Pollutant type

**Example:**
```
GET /api/environmental-data/latest?lat=40.7128&lng=-74.0060&pollutant=pm25
```

### GET /api/environmental-data/summary

Get summary statistics for environmental data in a location.

**Query Parameters:**
- `lat` (required): Latitude
- `lng` (required): Longitude
- `radius` (optional): Radius in km (default: 10, max: 100)
- `start` (optional): Start date (default: 24 hours ago)
- `end` (optional): End date (default: now)

**Response:**
```json
{
  "success": true,
  "data": {
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "radius": 10
    },
    "timeframe": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-01T23:59:59Z"
    },
    "total_measurements": 150,
    "pollutants": {
      "pm25": {
        "count": 50,
        "latest_value": 25.5,
        "latest_timestamp": "2024-01-01T23:00:00Z",
        "avg_value": 22.3,
        "min_value": 15.2,
        "max_value": 35.8,
        "quality_distribution": {
          "A": 10,
          "B": 25,
          "C": 12,
          "D": 3
        },
        "sources": ["openaq", "local_sensor"]
      }
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### GET /api/environmental-data/:id

Get a specific environmental data point by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "source": "openaq",
    "pollutant": "pm25",
    "value": 25.5,
    "unit": "µg/m³",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "timestamp": "2024-01-01T12:00:00Z",
    "quality_grade": "B",
    "created_at": "2024-01-01T12:00:00Z"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Dashboard Endpoints

### GET /api/dashboard/overview

Get comprehensive dashboard overview for authenticated user.

**Authentication:** Required

**Query Parameters:**
- `radius` (optional): Radius in km for location-based data (default: 10, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "points": 150,
      "level": 2,
      "contribution_streak": 5,
      "badges_count": 3,
      "location": {
        "latitude": 40.7128,
        "longitude": -74.0060
      }
    },
    "environmental_conditions": {
      "current": [
        {
          "pollutant": "pm25",
          "value": 25.5,
          "quality_grade": "B",
          "timestamp": "2024-01-01T12:00:00Z"
        }
      ],
      "summary": {
        "total_measurements": 50,
        "quality_distribution": {
          "A": 10,
          "B": 25,
          "C": 12,
          "D": 3
        },
        "unique_pollutants": 3,
        "data_freshness": 1704110400000
      },
      "alerts": []
    },
    "user_contributions": {
      "total_images": 15,
      "recent_images": [],
      "points_this_week": 50
    },
    "recommendations": {
      "active": [],
      "priority_count": {
        "low": 2,
        "medium": 3,
        "high": 1,
        "urgent": 0
      }
    },
    "community_stats": {
      "local_rank": {
        "rank": 5,
        "total_users": 25
      },
      "nearby_contributors": 12
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### GET /api/dashboard/environmental-summary

Get environmental data summary for user's location or specified location.

**Authentication:** Required

**Query Parameters:**
- `lat` (optional): Latitude (uses user location if not provided)
- `lng` (optional): Longitude (uses user location if not provided)
- `radius` (optional): Radius in km (default: 10, max: 100)
- `hours` (optional): Time range in hours (default: 24, max: 168)

**Response:**
```json
{
  "success": true,
  "data": {
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "radius": 10
    },
    "timeframe": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-01T23:59:59Z",
      "hours": 24
    },
    "total_measurements": 150,
    "data_sources": ["openaq", "water_quality_portal"],
    "pollutants": {
      "pm25": {
        "count": 50,
        "latest": {
          "value": 25.5,
          "timestamp": "2024-01-01T23:00:00Z",
          "quality_grade": "B"
        },
        "statistics": {
          "min": 15.2,
          "max": 35.8,
          "avg": 22.3,
          "median": 21.5
        },
        "quality_distribution": {
          "A": 10,
          "B": 25,
          "C": 12,
          "D": 3
        },
        "trend": "improving"
      }
    },
    "overall_quality": {
      "current_grade": "B",
      "grade_distribution": {
        "A": 25,
        "B": 75,
        "C": 35,
        "D": 15
      },
      "quality_score": 72
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### GET /api/dashboard/user-activity

Get user's recent activity and contributions.

**Authentication:** Required

**Query Parameters:**
- `days` (optional): Number of days to look back (default: 30, max: 365)
- `limit` (optional): Number of activities to return (default: 50, max: 200)

**Response:**
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "activity-uuid",
        "type": "image_analysis",
        "timestamp": "2024-01-01T12:00:00Z",
        "data": {
          "image_url": "https://example.com/image.jpg",
          "status": "completed",
          "location": {
            "latitude": 40.7128,
            "longitude": -74.0060
          },
          "overall_score": 0.75
        },
        "points_earned": 10
      }
    ],
    "summary": {
      "total_activities": 15,
      "points_earned": 150,
      "activity_types": {
        "image_analysis": 15
      },
      "recent_streak": 5,
      "timeframe": {
        "start": "2023-12-02T00:00:00Z",
        "end": "2024-01-01T23:59:59Z",
        "days": 30
      }
    },
    "pagination": {
      "total": 15,
      "limit": 50,
      "has_more": false
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Image Analysis Endpoints (Existing)

### POST /api/images/upload

Upload an environmental image for analysis.

**Authentication:** Required

**Request:** Multipart form data with image file

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "image-uuid",
    "imageUrl": "https://example.com/uploads/image.jpg",
    "status": "pending",
    "uploadTimestamp": "2024-01-01T12:00:00Z",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### GET /api/images/:id

Get image analysis by ID.

### GET /api/images/:id/status

Get analysis status for an image.

### GET /api/images/user/:userId

Get all image analyses for a user.

## Community & Gamification Endpoints (Existing)

### GET /api/recommendations

Get community recommendations with filtering options.

### POST /api/recommendations/generate

Generate new recommendations based on current conditions.

### GET /api/gamification/leaderboard

Get community leaderboard.

### GET /api/gamification/my-rank

Get current user's rank.

### GET /api/gamification/badges

Get available badges and user progress.

## Authentication Endpoints (Existing)

### POST /api/auth/register

Register a new user.

### POST /api/auth/login

Login user.

### GET /api/auth/profile

Get current user profile.

### PUT /api/auth/profile

Update user profile.

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details (optional)"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Common Error Codes

- `VALIDATION_ERROR`: Request validation failed
- `INVALID_LOCATION`: Invalid latitude/longitude values
- `INVALID_RADIUS`: Radius out of acceptable range
- `INVALID_TIME_RANGE`: Invalid date range
- `MISSING_PARAMETERS`: Required parameters missing
- `NOT_FOUND`: Resource not found
- `UNAUTHORIZED`: Authentication required
- `INTERNAL_ERROR`: Server error

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- 1000 requests per hour for authenticated users
- 100 requests per hour for unauthenticated endpoints

## Data Formats

### Dates
All dates are in ISO 8601 format: `2024-01-01T12:00:00Z`

### Coordinates
- Latitude: -90 to 90 degrees
- Longitude: -180 to 180 degrees

### Quality Grades
Environmental data quality grades:
- `A`: Excellent quality
- `B`: Good quality  
- `C`: Fair quality
- `D`: Poor quality

### Pollutant Types
Common pollutant identifiers:
- `pm25`: PM2.5 particulate matter
- `pm10`: PM10 particulate matter
- `no2`: Nitrogen dioxide
- `o3`: Ozone
- `so2`: Sulfur dioxide
- `co`: Carbon monoxide
- `turbidity`: Water turbidity
- `ph`: Water pH level

## Implementation Status

✅ **Completed:**
- Environmental data API endpoints with geospatial filtering
- User dashboard data aggregation endpoints
- Image upload and analysis status endpoints (existing)
- Community action tracking and leaderboard APIs (existing)

This completes Task 10: "Develop REST API endpoints for frontend integration" according to requirements 5.1, 5.3, 9.3, and 10.2.
#
# Notification System Endpoints

### Notification Rules Management

#### POST /api/notifications/rules
Create a new notification rule for the authenticated user.

**Authentication:** Required

**Request Body:**
```json
{
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "radius": 5
  },
  "triggers": {
    "pollutant_thresholds": {
      "PM2.5": 25,
      "PM10": 50,
      "NO2": 40
    },
    "trend_alerts": true,
    "community_updates": false,
    "health_warnings": true
  },
  "delivery_methods": ["push"],
  "active": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "rule-123",
    "user_id": "user-456",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "radius": 5
    },
    "triggers": {
      "pollutant_thresholds": {
        "PM2.5": 25,
        "PM10": 50,
        "NO2": 40
      },
      "trend_alerts": true,
      "community_updates": false,
      "health_warnings": true
    },
    "delivery_methods": ["push"],
    "active": true,
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### GET /api/notifications/rules
Get all notification rules for the authenticated user.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "rule-123",
      "user_id": "user-456",
      "location": {
        "latitude": 40.7128,
        "longitude": -74.0060,
        "radius": 5
      },
      "triggers": {
        "pollutant_thresholds": {
          "PM2.5": 25
        },
        "trend_alerts": true,
        "community_updates": false,
        "health_warnings": true
      },
      "delivery_methods": ["push"],
      "active": true,
      "created_at": "2024-01-01T12:00:00Z",
      "updated_at": "2024-01-01T12:00:00Z"
    }
  ],
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### PUT /api/notifications/rules/:id
Update an existing notification rule.

**Authentication:** Required

**Request Body:** (partial updates allowed)
```json
{
  "triggers": {
    "pollutant_thresholds": {
      "PM2.5": 30
    },
    "community_updates": true
  },
  "active": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "rule-123",
    "user_id": "user-456",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "radius": 5
    },
    "triggers": {
      "pollutant_thresholds": {
        "PM2.5": 30
      },
      "trend_alerts": true,
      "community_updates": true,
      "health_warnings": true
    },
    "delivery_methods": ["push"],
    "active": false,
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:05:00Z"
  },
  "timestamp": "2024-01-01T12:05:00Z"
}
```

#### DELETE /api/notifications/rules/:id
Delete a notification rule.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "deleted": true
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Device Token Management

#### POST /api/notifications/device-tokens
Register a device token for push notifications.

**Authentication:** Required

**Request Body:**
```json
{
  "device_token": "device-token-abc123",
  "platform": "ios"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "registered": true
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### DELETE /api/notifications/device-tokens/:token
Deactivate a device token.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "deactivated": true
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Alerts

#### GET /api/notifications/alerts
Get alerts with optional filtering.

**Authentication:** Required

**Query Parameters:**
- `latitude` (optional): Latitude for location-based filtering
- `longitude` (optional): Longitude for location-based filtering
- `radius` (optional): Radius in km (default: 10)
- `severity` (optional): Filter by severity (`info`, `warning`, `critical`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "alert-123",
      "type": "threshold_breach",
      "severity": "warning",
      "title": "PM2.5 Level Alert",
      "message": "PM2.5 levels have reached 35 µg/m³, exceeding the safe threshold of 25 µg/m³. Consider limiting outdoor activities.",
      "location": {
        "latitude": 40.7128,
        "longitude": -74.0060
      },
      "affected_radius": 5,
      "pollutant": "PM2.5",
      "current_value": 35,
      "threshold_value": 25,
      "expires_at": "2024-01-01T18:00:00Z",
      "created_at": "2024-01-01T12:00:00Z"
    }
  ],
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### GET /api/notifications/alerts/:id
Get a specific alert by ID.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "alert-123",
    "type": "health_warning",
    "severity": "critical",
    "title": "Health Advisory",
    "message": "Health advisory issued for your area due to elevated PM2.5, NO2 levels. Avoid all outdoor activities. Keep windows closed and use air purifiers if available.",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "affected_radius": 10,
    "expires_at": "2024-01-02T00:00:00Z",
    "created_at": "2024-01-01T12:00:00Z"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### POST /api/notifications/alerts/generate
Generate a test alert (admin endpoint).

**Authentication:** Required

**Request Body:**
```json
{
  "type": "threshold_breach",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "pollutant": "PM2.5",
  "current_value": 50,
  "threshold_value": 25,
  "unit": "µg/m³"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "alert-124",
    "type": "threshold_breach",
    "severity": "critical",
    "title": "PM2.5 Level Alert",
    "message": "PM2.5 levels have reached 50 µg/m³, exceeding the safe threshold of 25 µg/m³. Consider limiting outdoor activities.",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "affected_radius": 10,
    "pollutant": "PM2.5",
    "current_value": 50,
    "threshold_value": 25,
    "expires_at": "2024-01-01T18:00:00Z",
    "created_at": "2024-01-01T12:00:00Z"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Statistics

#### GET /api/notifications/stats/alerts
Get alert statistics.

**Authentication:** Required

**Query Parameters:**
- `timeframe` (optional): Time period (`hour`, `day`, `week`) - default: `day`

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 25,
    "by_severity": {
      "info": 10,
      "warning": 12,
      "critical": 3
    },
    "by_type": {
      "health_warning": 5,
      "trend_alert": 8,
      "community_update": 2,
      "threshold_breach": 10
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### GET /api/notifications/stats/deliveries
Get notification delivery statistics.

**Authentication:** Required

**Query Parameters:**
- `timeframe` (optional): Time period (`hour`, `day`, `week`) - default: `day`

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "by_status": {
      "pending": 5,
      "sent": 120,
      "delivered": 115,
      "failed": 10
    },
    "by_method": {
      "push": 140,
      "email": 8,
      "sms": 2
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### GET /api/notifications/stats/queue
Get notification queue status.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "pending": 5,
    "processing": 2,
    "retry": 1
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Notification System Features

### Supported Alert Types
- **threshold_breach**: Triggered when pollutant levels exceed user-defined thresholds
- **health_warning**: Generated when multiple pollutants create health risks
- **trend_alert**: Analyzes environmental data trends over time
- **community_update**: Notifications about community actions and improvements

### Supported Pollutants
- PM2.5 (Fine Particulate Matter)
- PM10 (Coarse Particulate Matter)
- NO2 (Nitrogen Dioxide)
- O3 (Ozone)
- SO2 (Sulfur Dioxide)
- CO (Carbon Monoxide)

### Delivery Methods
- **push**: Push notifications to mobile devices
- **email**: Email notifications (implementation pending)
- **sms**: SMS notifications (implementation pending)

### Supported Platforms
- **ios**: iOS devices via APNS
- **android**: Android devices via FCM
- **web**: Web browsers via Web Push

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Common Error Codes
- `NOTIFICATION_RULE_CREATE_ERROR`: Failed to create notification rule
- `NOTIFICATION_RULE_NOT_FOUND`: Notification rule not found
- `DEVICE_TOKEN_REGISTER_ERROR`: Failed to register device token
- `ALERT_NOT_FOUND`: Alert not found
- `VALIDATION_ERROR`: Request validation failed
- `AUTHENTICATION_ERROR`: Authentication required or failed
- `AUTHORIZATION_ERROR`: Insufficient permissions

## Rate Limiting

API endpoints are rate limited to prevent abuse:
- General endpoints: 100 requests per minute per user
- Alert generation: 10 requests per minute per user
- Device token registration: 20 requests per minute per user

## WebSocket Support (Future Enhancement)

Real-time notifications will be supported via WebSocket connections:
- Connect to `/ws/notifications` with authentication
- Receive real-time alerts and updates
- Subscribe to specific alert types or locations