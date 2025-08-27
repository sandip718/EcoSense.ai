# EcoSense.ai - Project Structure Guide

## 📁 Complete Directory Structure

```
EcoSense.ai/
│
├── 📄 IMPLEMENTATION_OVERVIEW.md     # Complete implementation summary
├── 📄 PROJECT_STRUCTURE.md          # This file
├── 📄 API_ENDPOINTS.md              # API documentation
├── 📄 check-mobile-setup.js         # Mobile setup validator
│
├── 🗄️ database/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_community_recommendations.sql
│       └── 003_notification_system.sql
│
├── 🖥️ src/ (Backend API)
│   ├── 📁 config/
│   │   ├── database.ts              # PostgreSQL configuration
│   │   └── redis.ts                 # Redis configuration
│   │
│   ├── 📁 middleware/
│   │   ├── auth.ts                  # Authentication middleware
│   │   └── cache.ts                 # Caching middleware
│   │
│   ├── 📁 models/
│   │   ├── types.ts                 # Core TypeScript interfaces
│   │   ├── UserRepository.ts        # User data operations
│   │   ├── AlertRepository.ts       # Alert management
│   │   ├── NotificationRuleRepository.ts
│   │   ├── CommunityActionRepository.ts
│   │   └── CommunityRecommendationRepository.ts
│   │
│   ├── 📁 routes/ (API Endpoints)
│   │   ├── auth.ts                  # Authentication API
│   │   ├── dashboard.ts             # Dashboard data API
│   │   ├── environmentalData.ts     # Environmental data API
│   │   ├── gamification.ts          # User engagement API
│   │   ├── insights.ts              # Analytics API
│   │   ├── notifications.ts         # Notification API
│   │   ├── recommendations.ts       # Community recommendations API
│   │   ├── cache.ts                 # Cache management API
│   │   └── chatbot.ts              # Chatbot API
│   │
│   ├── 📁 services/ (Business Logic)
│   │   ├── 🤖 Chatbot System/
│   │   │   ├── ChatbotService.ts           # Main orchestrator
│   │   │   ├── NaturalLanguageProcessor.ts # NLP engine
│   │   │   ├── ConversationManager.ts      # Context management
│   │   │   └── EnvironmentalQueryService.ts # Location-aware responses
│   │   │
│   │   ├── 🔔 Notification System/
│   │   │   ├── NotificationService.ts      # Core notifications
│   │   │   ├── AlertTriggerService.ts      # Alert generation
│   │   │   ├── PushNotificationService.ts  # Mobile push
│   │   │   └── NotificationWorker.ts       # Background processing
│   │   │
│   │   ├── 💾 Caching Layer/
│   │   │   ├── EnvironmentalDataCache.ts   # Main caching
│   │   │   ├── CacheWarmingService.ts      # Proactive caching
│   │   │   ├── CacheInvalidationService.ts # Cache management
│   │   │   └── CacheIntegrationService.ts  # Integration
│   │   │
│   │   ├── 🎯 Community System/
│   │   │   ├── CommunityRecommendationService.ts # Recommendations
│   │   │   ├── GamificationService.ts            # Points & badges
│   │   │   └── AuthService.ts                    # Authentication
│   │   │
│   │   └── 📊 Analytics/
│   │       └── InsightsEngine.ts           # Data analytics
│   │
│   ├── 📁 utils/
│   │   ├── logger.ts                # Logging utilities
│   │   └── validation.ts            # Input validation
│   │
│   ├── 📁 __tests__/ (Backend Tests)
│   │   └── [service-name].test.ts   # Unit tests for each service
│   │
│   ├── 📁 test files/
│   │   ├── test-api-endpoints.ts
│   │   ├── test-caching-implementation.ts
│   │   ├── test-chatbot-implementation.ts
│   │   ├── test-community-recommendations.ts
│   │   ├── test-notification-simple.ts
│   │   └── test-user-management.ts
│   │
│   └── 📄 index.ts                  # Main server entry point
│
├── 🌐 frontend/ (React Dashboard)
│   ├── 📁 src/
│   │   ├── 📁 components/
│   │   │   ├── layout/
│   │   │   │   └── Navbar.tsx       # Navigation component
│   │   │   └── dashboard/
│   │   │       ├── EnvironmentalMetrics.tsx  # Metrics display
│   │   │       ├── PollutionHeatmap.tsx     # Interactive maps
│   │   │       ├── TrendCharts.tsx          # Data visualization
│   │   │       └── FilterPanel.tsx          # Data filtering
│   │   │
│   │   ├── 📁 pages/
│   │   │   └── Dashboard.tsx        # Main dashboard page
│   │   │
│   │   ├── 📁 services/
│   │   │   └── api.ts              # Backend API integration
│   │   │
│   │   ├── 📁 utils/
│   │   │   ├── console.ts          # Console management
│   │   │   ├── errorSuppression.ts # Error handling
│   │   │   └── silentAxios.ts      # HTTP client
│   │   │
│   │   └── 📁 data/
│   │       └── mockData.ts         # Development data
│   │
│   ├── 📁 __tests__/
│   │   └── Dashboard.test.tsx      # Component tests
│   │
│   ├── 📄 README.md                # Frontend documentation
│   └── 📄 IMPLEMENTATION_SUMMARY.md # Frontend summary
│
├── 📱 mobile/ (React Native App)
│   ├── 📁 src/
│   │   ├── 📄 App.tsx              # Main app component
│   │   │
│   │   ├── 📁 navigation/
│   │   │   └── AppNavigator.tsx    # Navigation structure
│   │   │
│   │   ├── 📁 screens/
│   │   │   ├── HomeScreen.tsx      # Main dashboard
│   │   │   ├── CameraScreen.tsx    # Photo capture
│   │   │   ├── MapScreen.tsx       # Environmental map
│   │   │   ├── ProfileScreen.tsx   # User profile
│   │   │   ├── OnboardingScreen.tsx # App introduction
│   │   │   ├── auth/
│   │   │   │   ├── LoginScreen.tsx
│   │   │   │   └── RegisterScreen.tsx
│   │   │   ├── EnvironmentalDetailScreen.tsx
│   │   │   ├── RecommendationsScreen.tsx
│   │   │   ├── NotificationsScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   │
│   │   ├── 📁 services/
│   │   │   ├── LocationService.ts   # GPS & location
│   │   │   ├── CameraService.ts     # Photo capture
│   │   │   ├── OfflineService.ts    # Offline caching
│   │   │   ├── ApiService.ts        # Backend communication
│   │   │   ├── AuthService.ts       # Authentication
│   │   │   ├── UserService.ts       # User management
│   │   │   ├── EnvironmentalDataService.ts
│   │   │   └── NotificationService.ts
│   │   │
│   │   ├── 📁 store/ (Redux State)
│   │   │   ├── index.ts             # Store configuration
│   │   │   ├── hooks.ts             # Redux hooks
│   │   │   └── slices/
│   │   │       ├── authSlice.ts     # Authentication state
│   │   │       ├── locationSlice.ts # Location state
│   │   │       ├── environmentalDataSlice.ts
│   │   │       ├── offlineSlice.ts  # Offline state
│   │   │       ├── cameraSlice.ts   # Camera state
│   │   │       ├── notificationSlice.ts
│   │   │       └── userSlice.ts     # User state
│   │   │
│   │   ├── 📁 types/
│   │   │   ├── api.ts              # API type definitions
│   │   │   └── navigation.ts       # Navigation types
│   │   │
│   │   ├── 📁 utils/
│   │   │   ├── permissions.ts      # Permission management
│   │   │   └── logger.ts           # Mobile logging
│   │   │
│   │   ├── 📁 components/
│   │   │   ├── LoadingScreen.tsx   # Loading component
│   │   │   └── DevTestScreen.tsx   # Development testing
│   │   │
│   │   └── 📄 test-mobile-app.ts   # Comprehensive mobile tests
│   │
│   ├── 📄 package.json             # Mobile dependencies
│   ├── 📄 tsconfig.json           # TypeScript config
│   ├── 📄 metro.config.js         # Metro bundler config
│   ├── 📄 babel.config.js         # Babel config
│   ├── 📄 validate-setup.js       # Setup validation
│   ├── 📄 .env.example            # Environment template
│   └── 📄 README.md               # Mobile documentation
│
└── 📄 Root Files
    ├── package.json               # Backend dependencies
    ├── tsconfig.json             # Backend TypeScript config
    ├── .env.example              # Environment template
    └── README.md                 # Project documentation
```

## 🎯 Key Implementation Areas

### 1. **Backend Services** (`src/services/`)
- **25+ services** implementing core business logic
- **Modular architecture** with clear separation of concerns
- **Comprehensive testing** with unit and integration tests

### 2. **API Layer** (`src/routes/`)
- **50+ endpoints** covering all platform functionality
- **RESTful design** with proper HTTP methods and status codes
- **Input validation** and error handling

### 3. **Frontend Dashboard** (`frontend/src/`)
- **React components** for environmental data visualization
- **Interactive charts** and pollution heatmaps
- **Responsive design** with Material-UI

### 4. **Mobile Application** (`mobile/src/`)
- **Cross-platform** React Native app
- **Native integrations** for camera and location
- **Offline-first** architecture with Redux state management

### 5. **Database Layer** (`database/` & `src/models/`)
- **PostgreSQL** with PostGIS for geospatial data
- **Version-controlled migrations** for schema management
- **Repository pattern** for data access

## 🔍 How to Navigate the Codebase

### Finding Specific Functionality

**Environmental Data:**
- API: `src/routes/environmentalData.ts`
- Service: `src/services/EnvironmentalDataCache.ts`
- Frontend: `frontend/src/components/dashboard/EnvironmentalMetrics.tsx`
- Mobile: `mobile/src/services/EnvironmentalDataService.ts`

**User Authentication:**
- API: `src/routes/auth.ts`
- Service: `src/services/AuthService.ts`
- Frontend: `frontend/src/services/api.ts`
- Mobile: `mobile/src/services/AuthService.ts`

**Notifications:**
- API: `src/routes/notifications.ts`
- Service: `src/services/NotificationService.ts`
- Worker: `src/services/NotificationWorker.ts`
- Mobile: `mobile/src/store/slices/notificationSlice.ts`

**Chatbot:**
- API: `src/routes/chatbot.ts`
- NLP: `src/services/NaturalLanguageProcessor.ts`
- Context: `src/services/ConversationManager.ts`
- Query: `src/services/EnvironmentalQueryService.ts`

**Caching:**
- Service: `src/services/EnvironmentalDataCache.ts`
- Warming: `src/services/CacheWarmingService.ts`
- Integration: `src/services/CacheIntegrationService.ts`

### Testing Files
- **Backend Tests**: `src/services/__tests__/`
- **Frontend Tests**: `frontend/src/components/__tests__/`
- **Mobile Tests**: `mobile/src/test-mobile-app.ts`
- **Integration Tests**: `src/test-*.ts` files

### Documentation
- **API Docs**: `API_ENDPOINTS.md`
- **Implementation Overview**: `IMPLEMENTATION_OVERVIEW.md`
- **Service READMEs**: `src/services/*.README.md`
- **Frontend Docs**: `frontend/README.md`
- **Mobile Docs**: `mobile/README.md`

## 🚀 Quick Start Guide

### Backend Development
```bash
# Start backend server
npm install && npm run dev

# Run specific tests
npm test -- --testPathPattern="NotificationService"

# Test specific functionality
npm run test:implementation
```

### Frontend Development
```bash
cd frontend
npm install && npm run dev

# Run frontend tests
npm test
```

### Mobile Development
```bash
cd mobile
npm install

# Validate setup
node validate-setup.js

# Start development
npm start
npm run android  # or npm run ios
```

### Full Stack Testing
```bash
# From project root
node check-mobile-setup.js  # Validate mobile setup
npm test                     # Backend tests
cd frontend && npm test      # Frontend tests
```

This structure provides a clear roadmap for navigating and understanding the complete EcoSense.ai implementation!