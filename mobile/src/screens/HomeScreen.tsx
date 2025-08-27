// Home Screen for EcoSense.ai Mobile App
// Main dashboard showing environmental data and quick actions

import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useAppDispatch, useAppSelector} from '@/store/hooks';
import {getCurrentLocation} from '@/store/slices/locationSlice';
import {fetchEnvironmentalData} from '@/store/slices/environmentalDataSlice';
import {fetchNotifications} from '@/store/slices/notificationSlice';
import {EnvironmentalDataPoint} from '@/types/api';
import {logger} from '@/utils/logger';

const HomeScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const [refreshing, setRefreshing] = useState(false);

  const {
    currentLocation,
    locationPermission,
    loading: locationLoading,
  } = useAppSelector(state => state.location);

  const {
    currentData,
    loading: dataLoading,
    lastUpdated,
  } = useAppSelector(state => state.environmentalData);

  const {
    unreadCount,
  } = useAppSelector(state => state.notifications);

  const {
    isOnline,
    cachedEnvironmentalData,
  } = useAppSelector(state => state.offline);

  useEffect(() => {
    initializeHomeScreen();
  }, []);

  useEffect(() => {
    if (currentLocation) {
      loadEnvironmentalData();
    }
  }, [currentLocation]);

  const initializeHomeScreen = async () => {
    try {
      logger.info('Initializing home screen');

      // Get current location if permission granted
      if (locationPermission === 'granted') {
        dispatch(getCurrentLocation());
      }

      // Fetch notifications
      dispatch(fetchNotifications());
    } catch (error) {
      logger.error('Failed to initialize home screen:', error);
    }
  };

  const loadEnvironmentalData = async () => {
    if (!currentLocation) return;

    try {
      await dispatch(fetchEnvironmentalData({
        location: currentLocation,
        radius: 10,
      })).unwrap();
    } catch (error) {
      logger.error('Failed to load environmental data:', error);
      
      if (!isOnline) {
        Alert.alert(
          'Offline Mode',
          'You are currently offline. Showing cached data if available.',
          [{text: 'OK'}]
        );
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    
    try {
      if (locationPermission === 'granted') {
        await dispatch(getCurrentLocation()).unwrap();
      }
      
      if (currentLocation) {
        await loadEnvironmentalData();
      }
    } catch (error) {
      logger.error('Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const requestLocationPermission = () => {
    Alert.alert(
      'Location Required',
      'EcoSense needs your location to show environmental data for your area.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Enable Location',
          onPress: () => {
            dispatch(getCurrentLocation());
          },
        },
      ]
    );
  };

  const getAirQualityStatus = (data: EnvironmentalDataPoint[]): {
    status: string;
    color: string;
    description: string;
  } => {
    if (!data || data.length === 0) {
      return {
        status: 'Unknown',
        color: '#757575',
        description: 'No data available',
      };
    }

    // Simple air quality assessment based on PM2.5 levels
    const pm25Data = data.find(d => d.pollutant.toLowerCase().includes('pm2.5'));
    
    if (pm25Data) {
      const value = pm25Data.value;
      if (value <= 12) {
        return {status: 'Good', color: '#4CAF50', description: 'Air quality is satisfactory'};
      } else if (value <= 35) {
        return {status: 'Moderate', color: '#FF9800', description: 'Acceptable for most people'};
      } else if (value <= 55) {
        return {status: 'Unhealthy for Sensitive Groups', color: '#FF5722', description: 'Sensitive individuals may experience issues'};
      } else {
        return {status: 'Unhealthy', color: '#F44336', description: 'Everyone may experience health effects'};
      }
    }

    return {
      status: 'Good',
      color: '#4CAF50',
      description: 'Based on available data',
    };
  };

  const displayData = isOnline ? currentData : cachedEnvironmentalData;
  const airQuality = getAirQualityStatus(displayData);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>EcoSense</Text>
        <View style={styles.headerActions}>
          {!isOnline && (
            <Icon name="cloud-off" size={24} color="#FF9800" style={styles.offlineIcon} />
          )}
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Location Status */}
      {locationPermission !== 'granted' ? (
        <TouchableOpacity style={styles.locationPrompt} onPress={requestLocationPermission}>
          <Icon name="location-off" size={24} color="#FF5722" />
          <Text style={styles.locationPromptText}>
            Enable location to get environmental data for your area
          </Text>
          <Icon name="chevron-right" size={24} color="#FF5722" />
        </TouchableOpacity>
      ) : (
        <View style={styles.locationInfo}>
          <Icon name="location-on" size={20} color="#4CAF50" />
          <Text style={styles.locationText}>
            {currentLocation?.address || 
             `${currentLocation?.latitude.toFixed(3)}, ${currentLocation?.longitude.toFixed(3)}`}
          </Text>
        </View>
      )}

      {/* Air Quality Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Air Quality</Text>
          {lastUpdated && (
            <Text style={styles.lastUpdated}>
              Updated {new Date(lastUpdated).toLocaleTimeString()}
            </Text>
          )}
        </View>
        
        <View style={styles.airQualityStatus}>
          <View style={[styles.statusIndicator, {backgroundColor: airQuality.color}]} />
          <View style={styles.statusInfo}>
            <Text style={styles.statusText}>{airQuality.status}</Text>
            <Text style={styles.statusDescription}>{airQuality.description}</Text>
          </View>
        </View>

        {displayData.length > 0 && (
          <View style={styles.pollutantList}>
            {displayData.slice(0, 3).map((point, index) => (
              <View key={index} style={styles.pollutantItem}>
                <Text style={styles.pollutantName}>{point.pollutant.toUpperCase()}</Text>
                <Text style={styles.pollutantValue}>
                  {point.value} {point.unit}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="camera-alt" size={32} color="#2E7D32" />
            <Text style={styles.actionText}>Capture Photo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="map" size={32} color="#2E7D32" />
            <Text style={styles.actionText}>View Map</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="trending-up" size={32} color="#2E7D32" />
            <Text style={styles.actionText}>View Trends</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Icon name="lightbulb-outline" size={32} color="#2E7D32" />
            <Text style={styles.actionText}>Recommendations</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Offline Notice */}
      {!isOnline && (
        <View style={styles.offlineNotice}>
          <Icon name="info" size={20} color="#FF9800" />
          <Text style={styles.offlineText}>
            You're offline. Data may not be current.
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineIcon: {
    marginRight: 8,
  },
  notificationBadge: {
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  locationPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF3E0',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  locationPromptText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#E65100',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#E8F5E8',
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#2E7D32',
  },
  card: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 8,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#666666',
  },
  airQualityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  statusDescription: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  pollutantList: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
  },
  pollutantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  pollutantName: {
    fontSize: 14,
    color: '#666666',
  },
  pollutantValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  quickActions: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionText: {
    marginTop: 8,
    fontSize: 12,
    color: '#333333',
    textAlign: 'center',
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    margin: 16,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  offlineText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#F57C00',
  },
});

export default HomeScreen;