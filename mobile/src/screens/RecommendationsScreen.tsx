// Recommendations Screen Placeholder
import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

const RecommendationsScreen: React.FC = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Recommendations</Text>
    <Text>Community recommendations will be displayed here</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  title: {fontSize: 24, fontWeight: 'bold', marginBottom: 16},
});

export default RecommendationsScreen;