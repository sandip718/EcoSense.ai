# EcoSense.ai Real-Time Notification System

The notification system provides comprehensive real-time alerting capabilities for environmental conditions, allowing users to receive timely notifications about pollution levels, health warnings, and environmental trends.

## Overview

The notification system consists of several key components:

- **NotificationService**: Core service for managing notification rules and generating alerts
- **PushNotificationService**: Handles push notification delivery to mobile devices
- **AlertTriggerService**: Monitors environmental data and automatically triggers alerts
- **NotificationWorker**: Background worker that processes notification queues
- **Redis Queue Management**: Handles notification queuing, retry logic, and rate limiting

## Key Features

### 1. Notification Rule Management
Users can create personalized notification rules with:
- **Location-based targeting**: Set notification radius around specific coordinates
- **Pollutant thresholds**: Custom thresholds for different pollutants (PM2.5, PM10, NO2, O3, SO2, CO)
- **Alert types**: Choose which types of alerts to receive (threshold breaches, trends, health warnings, community updates)
- **Delivery methods**: Support for push notifications, email, and SMS
- **Active/inactive status**: Enable or disable rules as needed

### 2. Alert Generation
The system automatically generates different types of alerts:

#### Threshold Breach Alerts
- Triggered when pollutant levels exceed user-defined thresholds
- Severity levels: info, warning, critical (based on exceedance ratio)
- Includes current value, threshold value, and health recommendations

#### Health Warnings
- Generated when multiple pollutants create health risks
- Risk levels: moderate, high, very_high
- Provides specific health recommendations based on risk level

#### Trend Alerts
- Analyzes environmental data trends over time
- Detects improving or worsening conditions
- Uses statistical analysis to determine trend significance

#### Community Updates
- Notifications about community actions and environmental improvements
- Celebrates positive environmental changes
- Encourages community participation

### 3. Push Notification Support
- Multi-platform support: iOS, Android, Web
- Device token management with automatic cleanup of invalid tokens
- Delivery status tracking and retry logic
- Mock implementation with hooks for real push services (FCM, APNS, Web Push)

### 4. Queue Management with Redis
- **Main Queue**: Processes new notifications
- **Processing Set**: Tracks notifications currently being processed
- **Retry Queue**: Handles failed notifications with exponential backoff
- **User Preferences Cache**: Fast access to user notification settings

### 5. Background Processing
- Continuous queue processing every 5 seconds
- Retry queue processing every minute
- Automatic cleanup of expired alerts every hour
- Graceful error handling and logging

## API Endpoints

### Notification Rules
```
POST   /api/notifications/rules           # Create notification rule
GET    /api/notifications/rules           # Get user's notification rules
PUT    /api/notifications/rules/:id       # Update notification rule
DELETE /api/notifications/rules/:id       # Delete notification rule
```

### Device Tokens
```
POST   /api/notifications/device-tokens   # Register device token
DELETE /api/notifications/device-tokens/:token # Deactivate device token
```

### Alerts
```
GET    /api/notifications/alerts          # Get alerts (by location or severity)
GET    /api/notifications/alerts/:id      # Get specific alert
POST   /api/notifications/alerts/generate # Generate test alert (admin)
```

### Statistics
```
GET    /api/notifications/stats/alerts    # Alert statistics
GET    /api/notifications/stats/deliveries # Delivery statistics
GET    /api/notifications/stats/queue     # Queue status
```

## Usage Examples

### Creating a Notification Rule
```typescript
const notificationRule = await notificationService.createNotificationRule({
  user_id: 'user-123',
  location: {
    latitude: 40.7128,
    longitude: -74.0060,
    radius: 5 // 5km radius
  },
  triggers: {
    pollutant_thresholds: {
      'PM2.5': 25,    // Alert when PM2.5 > 25 µg/m³
      'PM10': 50,     // Alert when PM10 > 50 µg/m³
      'NO2': 40       // Alert when NO2 > 40 µg/m³
    },
    trend_alerts: true,
    community_updates: false,
    health_warnings: true
  },
  delivery_methods: ['push'],
  active: true
});
```

### Registering a Device Token
```typescript
await pushService.registerDeviceToken(
  'user-123',
  'device-token-abc123',
  'ios'
);
```

### Generating an Alert
```typescript
const alert = await notificationService.generatePollutantAlert(
  { latitude: 40.7128, longitude: -74.0060 },
  'PM2.5',
  45,      // Current value
  'µg/m³',
  25       // Threshold value
);
```

### Processing Notifications
```typescript
// Start the background worker
const worker = new NotificationWorker();
worker.start();

// Or process once manually
await worker.processOnce();
```

## Database Schema

### notification_rules
- Stores user notification preferences and triggers
- Includes location (PostGIS POINT), radius, triggers (JSONB), delivery methods

### alerts
- Stores generated alerts with location, severity, and expiration
- Supports different alert types and pollutant-specific data

### user_device_tokens
- Manages device tokens for push notifications
- Tracks platform (iOS/Android/Web) and active status

### notification_deliveries
- Logs notification delivery attempts and status
- Tracks delivery method, success/failure, and error messages

## Configuration

### Environment Variables
```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Push Notification Configuration (for production)
FCM_SERVER_KEY=your_fcm_server_key
APNS_KEY_ID=your_apns_key_id
APNS_TEAM_ID=your_apns_team_id
WEB_PUSH_VAPID_PUBLIC_KEY=your_vapid_public_key
WEB_PUSH_VAPID_PRIVATE_KEY=your_vapid_private_key
```

### Pollutant Thresholds
The system uses WHO Air Quality Guidelines and common health-based thresholds:

| Pollutant | Info | Warning | Critical | Unit |
|-----------|------|---------|----------|------|
| PM2.5     | 15   | 25      | 35       | µg/m³ |
| PM10      | 45   | 75      | 150      | µg/m³ |
| NO2       | 25   | 40      | 200      | µg/m³ |
| O3        | 100  | 160     | 240      | µg/m³ |
| SO2       | 20   | 40      | 500      | µg/m³ |
| CO        | 10   | 20      | 30       | mg/m³ |

## Integration with Environmental Data

The notification system integrates with the environmental data ingestion pipeline:

```typescript
// When new environmental data is received
const alertTriggerService = new AlertTriggerService();

// Check for threshold breaches
await alertTriggerService.checkForThresholdBreaches(newEnvironmentalData);

// Check for health warnings in affected areas
await alertTriggerService.checkForHealthWarnings(location, radiusKm);

// Analyze trends and generate trend alerts
await alertTriggerService.checkForTrendAlerts(location, radiusKm);
```

## Error Handling and Reliability

### Retry Logic
- Failed notifications are automatically retried with exponential backoff
- Maximum of 3 retry attempts per notification
- Retry delays: 2 minutes, 4 minutes, 8 minutes

### Rate Limiting
- Prevents spam by limiting similar alerts within time windows
- Critical alerts: max once per hour per location/pollutant
- Warning alerts: max once per 2 hours
- Info alerts: max once per 4 hours

### Graceful Degradation
- System continues operating even if push services are unavailable
- Fallback to alternative delivery methods when possible
- Comprehensive logging for debugging and monitoring

## Monitoring and Observability

### Queue Metrics
- Pending notifications count
- Processing notifications count
- Retry queue size
- Processing rate and success rate

### Alert Metrics
- Alerts generated by type and severity
- Alert response times
- User engagement with alerts

### Delivery Metrics
- Delivery success rates by platform
- Failed delivery reasons
- Device token health

## Testing

The notification system includes comprehensive tests:

- **Unit Tests**: Test individual service methods and logic
- **Integration Tests**: Test API endpoints and database operations
- **Mock Services**: Simulate push notification services for testing
- **Queue Testing**: Verify queue processing and retry logic

Run tests with:
```bash
npm test src/services/__tests__/NotificationService.test.ts
npm test src/routes/__tests__/notifications.test.ts
```

## Production Considerations

### Scaling
- Redis cluster for high availability
- Multiple worker instances for queue processing
- Database read replicas for alert queries

### Security
- API authentication required for all endpoints
- Device token validation and encryption
- Rate limiting on API endpoints

### Performance
- Efficient geospatial queries using PostGIS indexes
- Redis caching for user preferences
- Batch processing for high-volume notifications

### Compliance
- User consent management for notifications
- Data retention policies for notification logs
- Privacy controls for location-based alerts

## Future Enhancements

- **Machine Learning**: Predictive alerts based on environmental patterns
- **Smart Scheduling**: Optimal notification timing based on user behavior
- **Rich Notifications**: Interactive notifications with action buttons
- **Multi-language Support**: Localized alert messages
- **Advanced Analytics**: User engagement and alert effectiveness metrics