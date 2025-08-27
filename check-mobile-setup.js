#!/usr/bin/env node

// Quick Mobile App Setup Check
// Run this from the project root to verify mobile app setup

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 EcoSense.ai Mobile App Setup Check\n');

// Check if we're in the right directory
const mobileDir = path.join(process.cwd(), 'mobile');
const hasMobileDir = fs.existsSync(mobileDir);

if (!hasMobileDir) {
  console.log('❌ Mobile directory not found');
  console.log('   Expected: ./mobile/');
  console.log('   Current directory:', process.cwd());
  process.exit(1);
}

console.log('✅ Mobile directory found');

// Change to mobile directory
process.chdir(mobileDir);

// Check essential files
const essentialFiles = [
  'package.json',
  'tsconfig.json',
  'metro.config.js',
  'babel.config.js',
  'src/App.tsx',
  'src/navigation/AppNavigator.tsx',
  'src/store/index.ts'
];

console.log('\n📁 Checking essential files:');
let missingFiles = 0;

essentialFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    missingFiles++;
  }
});

if (missingFiles > 0) {
  console.log(`\n⚠️  ${missingFiles} essential files are missing`);
  console.log('Please ensure all mobile app files are created properly');
  process.exit(1);
}

// Check if node_modules exists
console.log('\n📦 Checking dependencies:');
if (fs.existsSync('node_modules')) {
  console.log('✅ node_modules directory exists');
} else {
  console.log('❌ node_modules not found');
  console.log('   Run: cd mobile && npm install');
  process.exit(1);
}

// Check package.json for key dependencies
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const keyDeps = ['react', 'react-native', '@react-navigation/native', '@reduxjs/toolkit'];
  
  keyDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`✅ ${dep}`);
    } else {
      console.log(`❌ ${dep} - MISSING`);
      missingFiles++;
    }
  });
} catch (error) {
  console.log('❌ Could not read package.json');
  process.exit(1);
}

// Try to run TypeScript check
console.log('\n🔧 Running TypeScript check:');
try {
  execSync('npx tsc --noEmit --skipLibCheck', { stdio: 'pipe' });
  console.log('✅ TypeScript compilation check passed');
} catch (error) {
  console.log('❌ TypeScript compilation issues found');
  console.log('   Run: cd mobile && npx tsc --noEmit to see details');
}

// Check React Native CLI
console.log('\n📱 Checking React Native setup:');
try {
  const rnVersion = execSync('npx react-native --version', { encoding: 'utf8' });
  console.log(`✅ React Native CLI: ${rnVersion.trim()}`);
} catch (error) {
  console.log('❌ React Native CLI not available');
  console.log('   Install: npm install -g @react-native-community/cli');
}

// Final recommendations
console.log('\n🚀 Next Steps:');
console.log('==============');

if (missingFiles === 0) {
  console.log('✅ Setup looks good! To test the mobile app:');
  console.log('');
  console.log('1. Start Metro bundler:');
  console.log('   cd mobile && npm start');
  console.log('');
  console.log('2. Run on Android:');
  console.log('   cd mobile && npm run android');
  console.log('');
  console.log('3. Run on iOS (macOS only):');
  console.log('   cd mobile && npm run ios');
  console.log('');
  console.log('4. Test functionality:');
  console.log('   - Add DevTestScreen to your navigation');
  console.log('   - Run the validation script: node mobile/validate-setup.js');
  console.log('   - Check permissions and services');
} else {
  console.log('⚠️  Please fix the missing files and dependencies first');
  console.log('');
  console.log('Common fixes:');
  console.log('1. Install dependencies: cd mobile && npm install');
  console.log('2. Ensure all source files are created');
  console.log('3. Check TypeScript configuration');
}

console.log('\n📚 Additional Resources:');
console.log('- React Native docs: https://reactnative.dev/docs/getting-started');
console.log('- Troubleshooting: Check mobile/README.md');
console.log('- Development testing: Use mobile/src/components/DevTestScreen.tsx');

process.exit(missingFiles > 0 ? 1 : 0);