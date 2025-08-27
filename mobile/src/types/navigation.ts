// Navigation Types for EcoSense.ai Mobile App

import {EnvironmentalDataPoint, Location} from './api';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  EnvironmentalDetail: {
    data: EnvironmentalDataPoint;
    location: Location;
  };
  Recommendations: {
    location?: Location;
  };
  Notifications: undefined;
  Settings: undefined;
};

export type TabParamList = {
  Home: undefined;
  Camera: undefined;
  Map: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  Permissions: undefined;
  LocationSetup: undefined;
  Complete: undefined;
};