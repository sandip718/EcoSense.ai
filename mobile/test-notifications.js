#!/usr/bin/env node

// Test script for push notifications functionality
// Run this to test the notification system

const { execSync } = require('child_process');
const path = require('path');

console.log('🔔 EcoSense.ai Push Notifications Test Setup');
console.log('===========================================\n');

console.log('📱 Available testing options:');
console.log('1. Start React Native Metro bundler: npm run start');
console.log('2. Run on Android device/emulator: npm run android');
console.log('3. Run on iOS device/simulator: npm run ios');
console.log('4. Run tests: npm test\n');

console.log('🧪 To test push notifications:');
console.log('1. Start the app with one of the commands above');
console.log('2. Navigate to Profile > Notification Settings');
console.log('3. Use the NotificationTestPanel component for testing');
console.log('4. Check the notification history screen\n');

console.log('📋 Testing checklist:');
console.log('✅ FCM token generation');
console.log('✅ Local notification display');
console.log('✅ Notification preferences');
console.log('✅ Location-based alerts');
console.log('✅ Notification history');
console.log('✅ Permission handling\n');

console.log('🔧 Setup requirements:');
console.log('- Android: Ensure you have an Android device/emulator running');
console.log('- iOS: Ensure you have Xcode and iOS simulator/device');
console.log('- Firebase: Configure Firebase project for push notifications');
console.log('- Permissions: Grant location and notification permissions\n');

console.log('Run this script with an argument to execute:');
console.log('node test-notifications.js start    # Start Metro bundler');
console.log('node test-notifications.js android  # Run on Android');
console.log('node test-notifications.js ios      # Run on iOS');

const command = process.argv[2];

if (command) {
  try {
    switch (command) {
      case 'start':
        console.log('\n🚀 Starting Metro bundler...');
        execSync('npm run start', { stdio: 'inherit', cwd: __dirname });
        break;
      case 'android':
        console.log('\n🤖 Running on Android...');
        execSync('npm run android', { stdio: 'inherit', cwd: __dirname });
        break;
      case 'ios':
        console.log('\n🍎 Running on iOS...');
        execSync('npm run ios', { stdio: 'inherit', cwd: __dirname });
        break;
      default:
        console.log(`\n❌ Unknown command: ${command}`);
        console.log('Available commands: start, android, ios');
    }
  } catch (error) {
    console.error('\n❌ Error running command:', error.message);
  }
}