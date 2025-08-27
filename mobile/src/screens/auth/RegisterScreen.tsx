// Register Screen Placeholder
import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

const RegisterScreen: React.FC = () => (
  <View style={styles.container}>
    <Text style={styles.title}>Register Screen</Text>
    <Text>Registration form will be implemented here</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  title: {fontSize: 24, fontWeight: 'bold', marginBottom: 16},
});

export default RegisterScreen;