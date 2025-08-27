// Settings Screen Placeholder
import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

const SettingsScreen: React.FC = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Settings</Text>
    <Text>App settings will be implemented here</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  title: {fontSize: 24, fontWeight: 'bold', marginBottom: 16},
});

export default SettingsScreen;