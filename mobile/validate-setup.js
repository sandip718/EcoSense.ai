#!/usr/bin/env node

// Mobile App Setup Validation Script
// Checks if the React Native project is properly configured

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating EcoSense.ai Mobile App Setup...\n');

const checks = [
  {
    name: 'Package.json exists',
    check: () => fs.existsSync('package.json'),
    fix: 'Run: npm init or ensure you\'re in the mobile directory'
  },
  {
    name: 'TypeScript config exists',
    check: () => fs.existsSync('tsconfig.json'),
    fix: 'Create tsconfig.json with proper React Native TypeScript configuration'
  },
  {
    name: 'Metro config exists',
    check: () => fs.existsSync('metro.config.js'),
    fix: 'Create metro.config.js for React Native bundler configuration'
  },
  {
    name: 'Babel config exists',
    check: () => fs.existsSync('babel.config.js'),
    fix: 'Create babel.config.js with React Native preset'
  },
  {
    name: 'Source directory exists',
    check: () => fs.existsSync('src'),
    fix: 'Create src directory and move source files there'
  },
  {
    name: 'App.tsx exists',
    check: () => fs.existsSync('src/App.tsx'),
    fix: 'Create src/App.tsx as the main app component'
  },
  {
    name: 'Navigation setup exists',
    check: () => fs.existsSync('src/navigation'),
    fix: 'Create navigation directory with AppNavigator.tsx'
  },
  {
    name: 'Services directory exists',
    check: () => fs.existsSync('src/services'),
    fix: 'Create services directory with core services'
  },
  {
    name: 'Store directory exists',
    check: () => fs.existsSync('src/store'),
    fix: 'Create store directory with Redux configuration'
  },
  {
    name: 'Types directory exists',
    check: () => fs.existsSync('src/types'),
    fix: 'Create types directory with TypeScript definitions'
  },
  {
    name: 'Utils directory exists',
    check: () => fs.existsSync('src/utils'),
    fix: 'Create utils directory with helper functions'
  },
  {
    name: 'Screens directory exists',
    check: () => fs.existsSync('src/screens'),
    fix: 'Create screens directory with screen components'
  }
];

let passed = 0;
let failed = 0;

console.log('📋 File Structure Checks:');
console.log('========================');

checks.forEach(check => {
  try {
    if (check.check()) {
      console.log(`✅ ${check.name}`);
      passed++;
    } else {
      console.log(`❌ ${check.name}`);
      console.log(`   Fix: ${check.fix}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${check.name} - Error: ${error.message}`);
    failed++;
  }
});

// Check package.json dependencies
console.log('\n📦 Dependency Checks:');
console.log('====================');

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = [
    'react',
    'react-native',
    '@react-navigation/native',
    '@react-navigation/bottom-tabs',
    '@react-navigation/native-stack',
    '@reduxjs/toolkit',
    'react-redux',
    'redux-persist',
    '@react-native-async-storage/async-storage'
  ];

  const requiredDevDeps = [
    'typescript',
    '@types/react',
    '@types/react-test-renderer'
  ];

  requiredDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
      passed++;
    } else {
      console.log(`❌ Missing dependency: ${dep}`);
      console.log(`   Fix: npm install ${dep}`);
      failed++;
    }
  });

  requiredDevDeps.forEach(dep => {
    if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
      console.log(`✅ ${dep}: ${packageJson.devDependencies[dep]}`);
      passed++;
    } else {
      console.log(`❌ Missing dev dependency: ${dep}`);
      console.log(`   Fix: npm install --save-dev ${dep}`);
      failed++;
    }
  });

} catch (error) {
  console.log('❌ Could not read package.json');
  failed++;
}

// Check key source files
console.log('\n🔧 Core Files Check:');
console.log('===================');

const coreFiles = [
  'src/App.tsx',
  'src/navigation/AppNavigator.tsx',
  'src/store/index.ts',
  'src/services/LocationService.ts',
  'src/services/CameraService.ts',
  'src/services/OfflineService.ts',
  'src/services/ApiService.ts',
  'src/utils/permissions.ts',
  'src/utils/logger.ts',
  'src/types/api.ts',
  'src/types/navigation.ts'
];

coreFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
    passed++;
  } else {
    console.log(`❌ Missing: ${file}`);
    failed++;
  }
});

// Summary
console.log('\n📊 Validation Summary:');
console.log('=====================');
console.log(`Total Checks: ${passed + failed}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

const successRate = ((passed / (passed + failed)) * 100).toFixed(1);
console.log(`Success Rate: ${successRate}%`);

if (failed === 0) {
  console.log('\n🎉 All checks passed! Your mobile app setup looks good.');
  console.log('\nNext steps:');
  console.log('1. Install dependencies: npm install');
  console.log('2. Start Metro bundler: npm start');
  console.log('3. Run on device: npm run android or npm run ios');
} else {
  console.log('\n⚠️  Some checks failed. Please fix the issues above before proceeding.');
  console.log('\nCommon fixes:');
  console.log('1. Ensure you\'re in the mobile directory');
  console.log('2. Run: npm install to install dependencies');
  console.log('3. Create missing files and directories as indicated');
}

process.exit(failed > 0 ? 1 : 0);