// Map Screen for EcoSense.ai Mobile App

import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

const MapScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Environmental Map</Text>
      <Text style={styles.subtitle}>
        Interactive map showing environmental data will be implemented here.
      </Text>
      <Text style={styles.description}>
        This screen will display:
        {'\n'}• Real-time pollution heatmaps
        {'\n'}• Sensor locations
        {'\n'}• Community reports
        {'\n'}• Environmental alerts
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'left',
    lineHeight: 20,
  },
});

export default MapScreen;