// Main App Navigator
// Implements navigation structure for mobile app

import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Screens
import HomeScreen from '@/screens/HomeScreen';
import CameraScreen from '@/screens/CameraScreen';
import MapScreen from '@/screens/MapScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import OnboardingScreen from '@/screens/OnboardingScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import RegisterScreen from '@/screens/auth/RegisterScreen';
import EnvironmentalDetailScreen from '@/screens/EnvironmentalDetailScreen';
import RecommendationsScreen from '@/screens/RecommendationsScreen';
import NotificationsScreen from '@/screens/NotificationsScreen';
import NotificationSettingsScreen from '@/screens/NotificationSettingsScreen';
import NotificationHistoryScreen from '@/screens/NotificationHistoryScreen';

// Types
import {RootStackParamList, TabParamList} from '@/types/navigation';

// Store
import {useAppSelector} from '@/store/hooks';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused, color, size}) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = 'home';
              break;
            case 'Camera':
              iconName = 'camera-alt';
              break;
            case 'Map':
              iconName = 'map';
              break;
            case 'Profile':
              iconName = 'person';
              break;
            default:
              iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2E7D32',
        tabBarInactiveTintColor: '#757575',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E0E0E0',
          borderTopWidth: 1,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        headerStyle: {
          backgroundColor: '#2E7D32',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}>
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          title: 'EcoSense',
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen 
        name="Camera" 
        component={CameraScreen}
        options={{
          title: 'Capture',
          tabBarLabel: 'Camera',
        }}
      />
      <Tab.Screen 
        name="Map" 
        component={MapScreen}
        options={{
          title: 'Environmental Map',
          tabBarLabel: 'Map',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator: React.FC = () => {
  const {isAuthenticated, hasCompletedOnboarding} = useAppSelector(state => ({
    isAuthenticated: state.auth.isAuthenticated,
    hasCompletedOnboarding: state.user.hasCompletedOnboarding,
  }));

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2E7D32',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}>
      
      {!hasCompletedOnboarding ? (
        <Stack.Screen 
          name="Onboarding" 
          component={OnboardingScreen}
          options={{headerShown: false}}
        />
      ) : !isAuthenticated ? (
        <Stack.Group>
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{
              title: 'Sign In',
              headerShown: false,
            }}
          />
          <Stack.Screen 
            name="Register" 
            component={RegisterScreen}
            options={{
              title: 'Create Account',
            }}
          />
        </Stack.Group>
      ) : (
        <Stack.Group>
          <Stack.Screen 
            name="MainTabs" 
            component={TabNavigator}
            options={{headerShown: false}}
          />
          <Stack.Screen 
            name="EnvironmentalDetail" 
            component={EnvironmentalDetailScreen}
            options={{
              title: 'Environmental Details',
              presentation: 'modal',
            }}
          />
          <Stack.Screen 
            name="Recommendations" 
            component={RecommendationsScreen}
            options={{
              title: 'Recommendations',
            }}
          />
          <Stack.Screen 
            name="Notifications" 
            component={NotificationsScreen}
            options={{
              title: 'Notifications',
            }}
          />
          <Stack.Screen 
            name="Settings" 
            component={SettingsScreen}
            options={{
              title: 'Settings',
            }}
          />
          <Stack.Screen 
            name="NotificationSettings" 
            component={NotificationSettingsScreen}
            options={{
              title: 'Notification Settings',
            }}
          />
          <Stack.Screen 
            name="NotificationHistory" 
            component={NotificationHistoryScreen}
            options={{
              title: 'Notification History',
            }}
          />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;