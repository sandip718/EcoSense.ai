// Redux Store Configuration for EcoSense.ai Mobile App

import {configureStore, combineReducers} from '@reduxjs/toolkit';
import {persistStore, persistReducer} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Reducers
import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';
import environmentalDataReducer from './slices/environmentalDataSlice';
import locationReducer from './slices/locationSlice';
import offlineReducer from './slices/offlineSlice';
import notificationReducer from './slices/notificationSlice';
import cameraReducer from './slices/cameraSlice';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'user', 'offline'], // Only persist these reducers
  blacklist: ['environmentalData', 'location'], // Don't persist real-time data
};

const rootReducer = combineReducers({
  auth: authReducer,
  user: userReducer,
  environmentalData: environmentalDataReducer,
  location: locationReducer,
  offline: offlineReducer,
  notifications: notificationReducer,
  camera: cameraReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: __DEV__,
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;