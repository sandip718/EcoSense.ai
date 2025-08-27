#!/usr/bin/env node

// Test runner for EcoSense.ai Mobile Push Notifications
// This script helps you test the notification functionality

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔔 EcoSense.ai Mobile Push Notifications Test Runner');
console.log('==================================================\n');

// Check if we're in the right directory
const mobileDir = path.join(__dirname, 'mobile');
if (!fs.existsSync(mobileDir)) {
  console.error('❌ Mobile directory not found. Please run this from the project root.');
  process.exit(1);
}

// Check if package.json exists
const packageJsonPath = path.join(mobileDir, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ Mobile package.json not found. Please ensure the mobile app is set up.');
  process.exit(1);
}

console.log('📱 Available Commands:');
console.log('===================');
console.log('1. start    - Start Metro bundler');
console.log('2. android  - Run on Android device/emulator');
console.log('3. ios      - Run on iOS simulator/device');
console.log('4. test     - Run unit tests');
console.log('5. install  - Install dependencies');
console.log('6. setup    - Setup for notification testing\n');

const command = process.argv[2];

if (!command) {
  console.log('Usage: node test-mobile-notifications.js <command>');
  console.log('Example: node test-mobile-notifications.js android\n');
  
  console.log('🧪 Testing Push Notifications:');
  console.log('==============================');
  console.log('1. First run: node test-mobile-notifications.js install');
  console.log('2. Start Metro: node test-mobile-notifications.js start');
  console.log('3. In another terminal, run: node test-mobile-notifications.js android');
  console.log('4. In the app, go to Profile > Notification Settings');
  console.log('5. Or use the DevTestScreen for comprehensive testing\n');
  
  console.log('📋 What to Test:');
  console.log('================');
  console.log('✅ FCM token generation');
  console.log('✅ Local notification display');
  console.log('✅ Notification permission requests');
  console.log('✅ Notification preferences (enable/disable, types, severity)');
  console.log('✅ Quiet hours functionality');
  console.log('✅ Location-based alert radius');
  console.log('✅ Notification history');
  console.log('✅ Test notifications from settings');
  console.log('✅ Background monitoring (check logs)');
  console.log('✅ Alert cooldown periods\n');
  
  process.exit(0);
}

function runCommand(cmd, cwd = mobileDir) {
  console.log(`\n🚀 Running: ${cmd}`);
  console.log(`📁 Directory: ${cwd}\n`);
  
  try {
    execSync(cmd, { 
      stdio: 'inherit', 
      cwd: cwd,
      env: { ...process.env }
    });
  } catch (error) {
    console.error(`\n❌ Command failed: ${error.message}`);
    process.exit(1);
  }
}

function runCommandAsync(cmd, cwd = mobileDir) {
  console.log(`\n🚀 Starting: ${cmd}`);
  console.log(`📁 Directory: ${cwd}\n`);
  
  const child = spawn(cmd, [], {
    stdio: 'inherit',
    cwd: cwd,
    shell: true,
    env: { ...process.env }
  });
  
  child.on('error', (error) => {
    console.error(`\n❌ Command failed: ${error.message}`);
  });
  
  return child;
}

switch (command) {
  case 'install':
    console.log('📦 Installing mobile app dependencies...');
    runCommand('npm install');
    console.log('\n✅ Dependencies installed successfully!');
    console.log('\n📱 Next steps:');
    console.log('1. node test-mobile-notifications.js start');
    console.log('2. node test-mobile-notifications.js android (or ios)');
    break;
    
  case 'start':
    console.log('🚀 Starting Metro bundler...');
    console.log('Keep this terminal open and use another terminal to run the app.');
    runCommandAsync('npm run start');
    break;
    
  case 'android':
    console.log('🤖 Running on Android...');
    console.log('Make sure you have:');
    console.log('- Android Studio installed');
    console.log('- Android device connected or emulator running');
    console.log('- Metro bundler running (npm run start)');
    runCommand('npm run android');
    break;
    
  case 'ios':
    console.log('🍎 Running on iOS...');
    console.log('Make sure you have:');
    console.log('- Xcode installed');
    console.log('- iOS simulator running or device connected');
    console.log('- Metro bundler running (npm run start)');
    runCommand('npm run ios');
    break;
    
  case 'test':
    console.log('🧪 Running unit tests...');
    runCommand('npm test');
    break;
    
  case 'setup':
    console.log('⚙️  Setting up notification testing environment...');
    
    // Check for required files
    const requiredFiles = [
      'src/services/PushNotificationService.ts',
      'src/services/NotificationService.ts',
      'src/services/LocationBasedAlertService.ts',
      'src/screens/NotificationSettingsScreen.tsx',
      'src/screens/NotificationHistoryScreen.tsx',
      'src/components/NotificationTestPanel.tsx'
    ];
    
    console.log('\n📋 Checking required files...');
    let allFilesExist = true;
    
    requiredFiles.forEach(file => {
      const filePath = path.join(mobileDir, file);
      if (fs.existsSync(filePath)) {
        console.log(`✅ ${file}`);
      } else {
        console.log(`❌ ${file} - MISSING`);
        allFilesExist = false;
      }
    });
    
    if (allFilesExist) {
      console.log('\n✅ All notification files are present!');
      
      console.log('\n🔧 Setup checklist:');
      console.log('1. ✅ Notification services implemented');
      console.log('2. ✅ UI screens created');
      console.log('3. ✅ Test panel available');
      console.log('4. 📋 TODO: Configure Firebase (add google-services.json/GoogleService-Info.plist)');
      console.log('5. 📋 TODO: Test on physical device for full push notification support');
      
      console.log('\n🚀 Ready to test! Run:');
      console.log('node test-mobile-notifications.js start');
      console.log('node test-mobile-notifications.js android');
    } else {
      console.log('\n❌ Some notification files are missing. Please ensure the implementation is complete.');
    }
    break;
    
  default:
    console.log(`❌ Unknown command: ${command}`);
    console.log('Available commands: install, start, android, ios, test, setup');
    process.exit(1);
}