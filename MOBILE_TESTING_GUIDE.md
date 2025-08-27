# Mobile Push Notifications Testing Guide

This guide will help you test the push notification functionality in the EcoSense.ai mobile app.

## Quick Start

### 1. Install Dependencies
```bash
node test-mobile-notifications.js install
```

### 2. Start the App
```bash
# Terminal 1: Start Metro bundler
node test-mobile-notifications.js start

# Terminal 2: Run on Android
node test-mobile-notifications.js android

# OR run on iOS
node test-mobile-notifications.js ios
```

### 3. Test Notifications
Once the app is running, you can test notifications in several ways:

## Testing Methods

### Method 1: Using the DevTestScreen
1. Navigate to any screen in the app
2. Look for a "Dev Test" option or add the DevTestScreen to your navigation
3. Tap "Show Notification Tests"
4. Use the comprehensive test panel

### Method 2: Using Notification Settings
1. Go to **Profile** tab
2. Tap **Notification Settings**
3. Configure your preferences
4. Tap **Send Test Notification**
5. Check **Notification History**

### Method 3: Using the Test Panel Directly
The `NotificationTestPanel` component provides these test functions:
- Send test local notification
- Add test warning alert to history
- Add test critical alert to history
- Force alert rule check
- Clear notification history
- View FCM token and preferences

## What to Test

### ✅ Core Functionality
- [ ] **FCM Token Generation**: Check that a token is generated
- [ ] **Local Notifications**: Test notifications appear in system tray
- [ ] **Permission Handling**: Test permission requests work properly
- [ ] **Notification Preferences**: Test all preference options
- [ ] **Notification History**: Verify history is saved and displayed

### ✅ User Preferences
- [ ] **Enable/Disable**: Toggle notifications on/off
- [ ] **Alert Types**: Test pollution, trend, and community alerts
- [ ] **Severity Threshold**: Test info, warning, critical levels
- [ ] **Location Radius**: Test 5km, 10km, 25km, 50km options
- [ ] **Quiet Hours**: Test time-based notification filtering

### ✅ Location-Based Alerts
- [ ] **Alert Rules**: Verify default pollution thresholds
- [ ] **Location Filtering**: Test radius-based filtering
- [ ] **Cooldown Periods**: Verify alerts don't spam (30min critical, 1hr warning)
- [ ] **Background Monitoring**: Check 5-minute monitoring interval

### ✅ UI/UX Testing
- [ ] **Settings Screen**: Test all controls work
- [ ] **History Screen**: Test list, filtering, clearing
- [ ] **Badge Counts**: Verify unread notification badges
- [ ] **Navigation**: Test deep linking from notifications

## Expected Behavior

### Notification Flow
1. **App Start**: Services initialize, FCM token generated
2. **Permission Request**: User grants notification permission
3. **Background Monitoring**: Service checks environmental data every 5 minutes
4. **Alert Trigger**: When pollution exceeds thresholds, alert is created
5. **User Filtering**: Alert is filtered based on user preferences
6. **Notification Display**: Local notification shown to user
7. **History Update**: Notification added to history

### Test Scenarios

#### Scenario 1: First Time User
1. Install and open app
2. Grant location and notification permissions
3. Default alert rules should be created
4. FCM token should be registered
5. Background monitoring should start

#### Scenario 2: Notification Preferences
1. Go to notification settings
2. Disable pollution alerts
3. Send test pollution alert
4. Verify it's not shown (respects preferences)
5. Re-enable and test again

#### Scenario 3: Quiet Hours
1. Set quiet hours (e.g., 10 PM - 8 AM)
2. Send test warning during quiet hours
3. Verify it's not shown
4. Send test critical alert during quiet hours
5. Verify critical alert is still shown

#### Scenario 4: Location Radius
1. Set location radius to 5km
2. Force alert check with mock data outside radius
3. Verify alert is not shown
4. Test with data inside radius
5. Verify alert is shown

## Debugging

### Check Logs
The app logs detailed information about notifications:
```javascript
// In React Native debugger or console
console.log('Notification logs');
```

### Common Issues

1. **No FCM Token**
   - Check Firebase configuration
   - Verify network connectivity
   - Check console for errors

2. **Notifications Not Showing**
   - Check notification permissions
   - Verify preferences are enabled
   - Check quiet hours settings
   - Ensure location is within radius

3. **Background Monitoring Not Working**
   - Check location permissions
   - Verify app is not being killed by battery optimization
   - Check monitoring stats in test panel

4. **High Battery Usage**
   - Monitoring runs every 5 minutes (configurable)
   - Uses cached location when possible
   - Implements intelligent cooldown periods

### Debug Commands

```bash
# Check setup
node test-mobile-notifications.js setup

# Run tests
node test-mobile-notifications.js test

# View logs (Android)
adb logcat | grep -i ecosense

# View logs (iOS)
# Use Xcode console or iOS simulator logs
```

## Firebase Setup (Required for Full Testing)

### Android
1. Create Firebase project
2. Add Android app to project
3. Download `google-services.json`
4. Place in `mobile/android/app/`
5. Configure FCM in Firebase Console

### iOS
1. Add iOS app to Firebase project
2. Download `GoogleService-Info.plist`
3. Add to iOS project in Xcode
4. Configure APNS certificates

## Performance Testing

### Memory Usage
- Monitor memory usage during background monitoring
- Check for memory leaks in notification handling

### Battery Usage
- Test background monitoring impact
- Verify efficient location usage
- Check notification frequency

### Network Usage
- Monitor API calls for environmental data
- Check token registration frequency
- Verify offline behavior

## Production Considerations

### Security
- FCM tokens are securely stored
- User preferences encrypted locally
- No sensitive data in notification payloads

### Scalability
- Efficient background monitoring
- Intelligent cooldown periods
- Optimized database queries

### User Experience
- Clear permission requests
- Intuitive settings interface
- Helpful notification content
- Proper error handling

## Troubleshooting

### App Won't Start
```bash
# Clean and rebuild
cd mobile
npx react-native clean
npm run android
```

### Metro Bundler Issues
```bash
# Reset Metro cache
npx react-native start --reset-cache
```

### Android Build Issues
```bash
# Clean Gradle
cd mobile/android
./gradlew clean
cd ..
npm run android
```

### iOS Build Issues
```bash
# Clean iOS build
cd mobile/ios
xcodebuild clean
cd ..
npm run ios
```

## Success Criteria

The notification system is working correctly when:

✅ FCM token is generated and registered  
✅ Local notifications appear in system tray  
✅ User preferences are respected  
✅ Location-based filtering works  
✅ Background monitoring is active  
✅ Notification history is maintained  
✅ Performance is acceptable  
✅ Battery usage is reasonable  
✅ All permissions work properly  
✅ UI is responsive and intuitive  

## Next Steps

After successful testing:
1. Configure Firebase for production
2. Test on multiple devices
3. Implement analytics tracking
4. Add crash reporting
5. Optimize performance
6. Prepare for app store submission