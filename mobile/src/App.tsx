// Main App Component for EcoSense.ai Mobile
// Implements requirement 10.2: Mobile app core functionality

import React, {useEffect} from 'react';
import {StatusBar, Platform} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';

import {store, persistor} from '@/store';
import AppNavigator from '@/navigation/AppNavigator';
import {LocationService} from '@/services/LocationService';
import {OfflineService} from '@/services/OfflineService';
import LoadingScreen from '@/components/LoadingScreen';
import {requestPermissions} from '@/utils/permissions';
import {logger} from '@/utils/logger';

const App: React.FC = () => {
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      logger.info('Initializing EcoSense.ai Mobile App');

      // Request necessary permissions
      await requestPermissions();

      // Initialize location service
      await LocationService.initialize();

      // Initialize offline service
      await OfflineService.initialize();

      // Initialize notification service
      const {NotificationService} = await import('@/services/NotificationService');
      await NotificationService.initialize();

      // Initialize location-based alert service
      const LocationBasedAlertService = (await import('@/services/LocationBasedAlertService')).default;
      await LocationBasedAlertService.initialize();

      logger.info('App initialization completed');
    } catch (error) {
      logger.error('App initialization failed:', error);
    }
  };

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <Provider store={store}>
        <PersistGate loading={<LoadingScreen />} persistor={persistor}>
          <NavigationContainer>
            <StatusBar
              barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
              backgroundColor="#2E7D32"
            />
            <AppNavigator />
          </NavigationContainer>
        </PersistGate>
      </Provider>
    </GestureHandlerRootView>
  );
};

export default App;