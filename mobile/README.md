# EcoSense.ai Mobile App

React Native mobile application for the EcoSense.ai environmental intelligence platform.

## Features

### Core Functionality
- **Real-time Environmental Data**: Access current air quality, water quality, and pollution data
- **Location Services**: Automatic location detection and location-based environmental data
- **Camera Integration**: Capture and analyze environmental photos using AI
- **Offline Support**: Basic functionality available without internet connection
- **Push Notifications**: Real-time alerts for environmental conditions

### User Experience
- **Intuitive Navigation**: Bottom tab navigation with key features
- **Onboarding**: Guided setup process with permission requests
- **Responsive Design**: Optimized for various screen sizes
- **Offline Indicators**: Clear feedback when offline

### Data & Analytics
- **Environmental Monitoring**: Track pollution levels and trends
- **Community Recommendations**: Location-specific improvement suggestions
- **User Gamification**: Points, levels, and badges for engagement
- **Data Caching**: Smart caching for offline access

## Architecture

### Technology Stack
- **React Native 0.72.4**: Cross-platform mobile development
- **TypeScript**: Type-safe development
- **Redux Toolkit**: State management
- **React Navigation**: Navigation system
- **AsyncStorage**: Local data persistence
- **React Native Permissions**: Permission management

### Project Structure
```
mobile/
├── src/
│   ├── components/          # Reusable UI components
│   ├── screens/            # Screen components
│   ├── navigation/         # Navigation configuration
│   ├── services/           # API and business logic services
│   ├── store/              # Redux store and slices
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   └── App.tsx             # Main app component
├── android/                # Android-specific code
├── ios/                    # iOS-specific code
└── package.json            # Dependencies and scripts
```

### State Management
- **Auth Slice**: User authentication and session management
- **Location Slice**: GPS location and permission handling
- **Environmental Data Slice**: Pollution and environmental data
- **Offline Slice**: Offline caching and sync management
- **Camera Slice**: Photo capture and analysis
- **Notifications Slice**: Push notifications and alerts
- **User Slice**: User profile and preferences

## Getting Started

### Prerequisites
- Node.js 16+
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mobile
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **iOS Setup** (macOS only)
   ```bash
   cd ios && pod install && cd ..
   ```

### Running the App

#### Development
```bash
# Start Metro bundler
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

#### Production Build
```bash
# Android
npm run build:android

# iOS
npm run build:ios
```

## Services

### LocationService
- GPS location access and tracking
- Permission management
- Distance calculations
- Geocoding support

### CameraService
- Photo capture from camera
- Gallery image selection
- Image upload and analysis
- Metadata extraction

### OfflineService
- Data caching for offline access
- Pending upload queue management
- Network state monitoring
- Automatic sync when online

### ApiService
- RESTful API communication
- Authentication token management
- Request/response handling
- Error management

## Permissions

The app requires the following permissions:

### Android
- `ACCESS_FINE_LOCATION`: For location-based environmental data
- `CAMERA`: For environmental photo capture
- `WRITE_EXTERNAL_STORAGE`: For image storage

### iOS
- `NSLocationWhenInUseUsageDescription`: Location access
- `NSCameraUsageDescription`: Camera access
- `NSPhotoLibraryUsageDescription`: Photo library access

## Configuration

### Environment Variables
```bash
API_BASE_URL=http://localhost:3000/api
APP_NAME=EcoSense
ENABLE_OFFLINE_MODE=true
ENABLE_PUSH_NOTIFICATIONS=true
```

### Build Configuration
- **Android**: Configure in `android/app/build.gradle`
- **iOS**: Configure in Xcode project settings

## Testing

### Automated Testing
```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint

# Validate setup
node validate-setup.js
```

### Development Testing
```bash
# Quick setup check (run from project root)
node check-mobile-setup.js

# In-app testing (add DevTestScreen to navigation)
import DevTestScreen from './src/components/DevTestScreen';
```

### Manual Testing Checklist
- [ ] App launches without crashes
- [ ] Navigation between tabs works
- [ ] Location permission request appears
- [ ] Camera permission request appears
- [ ] Offline indicators show when disconnected
- [ ] Pull-to-refresh works on Home screen
- [ ] Redux state updates correctly
- [ ] Error handling works gracefully

### Testing Services
```typescript
// Import and run comprehensive tests
import { testMobileApp } from './src/test-mobile-app';

// Run in a React Native component
const runTests = async () => {
  await testMobileApp();
};
```

## Deployment

### Android
1. Generate signed APK or AAB
2. Upload to Google Play Console
3. Configure app signing and release

### iOS
1. Archive in Xcode
2. Upload to App Store Connect
3. Submit for review

## Features Implementation Status

### ✅ Completed
- Project setup and configuration
- Navigation structure
- Redux state management
- Location services integration
- Camera integration
- Offline data caching
- Basic UI screens
- Permission management

### 🚧 In Progress
- Complete API integration
- Push notification setup
- Advanced offline sync
- Image analysis UI
- Map integration

### 📋 Planned
- Advanced analytics
- Social features
- Widget support
- Background sync
- Advanced caching strategies

## Contributing

1. Follow TypeScript and React Native best practices
2. Use conventional commit messages
3. Add tests for new features
4. Update documentation as needed

## Troubleshooting

### Common Issues

**Metro bundler issues**
```bash
npx react-native start --reset-cache
```

**Android build issues**
```bash
cd android && ./gradlew clean && cd ..
```

**iOS build issues**
```bash
cd ios && pod install && cd ..
```

**Permission issues**
- Ensure all required permissions are declared
- Test permission flows on physical devices
- Handle permission denial gracefully

## Performance Optimization

- Use FlatList for large data sets
- Implement image caching
- Optimize Redux selectors
- Use React.memo for expensive components
- Implement lazy loading where appropriate

## Security Considerations

- Store sensitive data securely (Keychain/Keystore)
- Validate all user inputs
- Use HTTPS for API communication
- Implement certificate pinning for production
- Regular security audits

## Support

For technical support or questions:
- Check the troubleshooting section
- Review React Native documentation
- Contact the development team

## License

This project is licensed under the MIT License.