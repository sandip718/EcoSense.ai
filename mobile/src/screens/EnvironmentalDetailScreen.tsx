// Environmental Detail Screen Placeholder
import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

const EnvironmentalDetailScreen: React.FC = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Environmental Details</Text>
    <Text>Detailed environmental data view will be implemented here</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  title: {fontSize: 24, fontWeight: 'bold', marginBottom: 16},
});

export default EnvironmentalDetailScreen;