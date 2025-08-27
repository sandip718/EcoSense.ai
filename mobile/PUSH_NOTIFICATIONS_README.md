# Push Notifications Implementation

This document describes the push notification implementation for the EcoSense.ai mobile app.

## Overview

The push notification system provides real-time environmental alerts to users based on their location and preferences. It includes:

- FCM/APNS integration for cross-platform push notifications
- Location-based alert triggering for pollution threshold breaches
- User preference management for notification types and timing
- Notification history and management interface

## Architecture

### Core Components

1. **PushNotificationService** - Handles FCM/APNS integration and local notifications
2. **NotificationService** - Manages notification history and preferences
3. **LocationBasedAlertService** - Monitors environmental conditions and triggers alerts
4. **NotificationSettingsScreen** - User interface for managing preferences
5. **NotificationHistoryScreen** - Displays notification history

### Key Features

- **Real-time Monitoring**: Continuously monitors environmental conditions every 5 minutes
- **Smart Filtering**: Respects user preferences for notification types, severity, and quiet hours
- **Location Awareness**: Only shows alerts within user-defined radius
- **Cooldown Periods**: Prevents notification spam with intelligent cooldown logic
- **Offline Support**: Caches preferences and history locally

## Setup Requirements

### Dependencies

```json
{
  "@react-native-firebase/app": "^18.3.0",
  "@react-native-firebase/messaging": "^18.3.0",
  "react-native-push-notification": "^8.1.1"
}
```

### Platform Configuration

#### Android
- Add `google-services.json` to `android/app/`
- Configure Firebase project with FCM
- Add notification channels for different alert types

#### iOS
- Add `GoogleService-Info.plist` to iOS project
- Configure APNS certificates in Firebase Console
- Request notification permissions

## Usage

### Initialization

The notification system is automatically initialized when the app starts:

```typescript
// In App.tsx
await NotificationService.initialize();
await LocationBasedAlertService.initialize();
```

### User Preferences

Users can configure notifications through the settings screen:

- Enable/disable notifications
- Choose alert types (pollution, trends, community)
- Set severity threshold (info, warning, critical)
- Configure location radius (5-50km)
- Set quiet hours

### Alert Rules

The system creates default alert rules based on WHO pollution guidelines:

- PM2.5: Warning at 35 μg/m³, Critical at 55 μg/m³
- PM10: Warning at 50 μg/m³, Critical at 100 μg/m³
- NO2: Warning at 40 μg/m³, Critical at 80 μg/m³
- O3: Warning at 100 μg/m³, Critical at 180 μg/m³
- SO2: Warning at 20 μg/m³, Critical at 50 μg/m³
- CO: Warning at 10 mg/m³, Critical at 30 mg/m³

## API Integration

### Backend Endpoints

The mobile app communicates with these backend endpoints:

- `POST /api/notifications/register-token` - Register FCM token
- `PUT /api/notifications/preferences` - Update user preferences
- `GET /api/notifications/preferences` - Get user preferences
- `DELETE /api/notifications/unregister-token/:deviceId` - Unregister token

### Data Flow

1. App registers FCM token with backend
2. Backend sends push notifications based on environmental data
3. App receives notifications and shows local alerts
4. Location-based service monitors conditions independently
5. User preferences are synced between app and backend

## Testing

### Development Testing

Use the `NotificationTestPanel` component for testing:

```typescript
import NotificationTestPanel from '@/components/NotificationTestPanel';

// Add to any screen for testing
<NotificationTestPanel />
```

### Test Functions

- Send test local notification
- Add test pollution alerts to history
- Force alert rule checking
- Clear notification history
- View FCM token and preferences

## Troubleshooting

### Common Issues

1. **No FCM Token**: Check Firebase configuration and network connectivity
2. **Notifications Not Showing**: Verify permissions and notification settings
3. **Location Alerts Not Working**: Check location permissions and GPS
4. **High Battery Usage**: Adjust monitoring interval or disable background monitoring

### Debug Information

The app logs detailed information about:
- FCM token registration
- Notification permission status
- Alert rule execution
- Background monitoring activity

### Performance Considerations

- Monitoring interval: 5 minutes (configurable)
- Cooldown periods: 30 minutes for critical, 1 hour for warnings
- History limit: 100 notifications maximum
- Location accuracy: Uses last known location if GPS unavailable

## Security

- FCM tokens are securely stored and transmitted
- User preferences are encrypted in local storage
- Location data is only used for alert filtering
- No sensitive data is included in push notification payloads

## Future Enhancements

- Machine learning for personalized alert thresholds
- Integration with wearable devices
- Voice notifications for accessibility
- Predictive alerts based on weather patterns
- Community-driven alert verification