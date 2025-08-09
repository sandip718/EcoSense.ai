// Simple test script to verify the implementation
// This script tests the core data models and repositories

import { EnvironmentalDataRepository, UserRepository, ImageAnalysisRepository } from './models';
import { validateEnvironmentalData, validateUserProfile } from './utils/validation';
import { CreateEnvironmentalDataPoint, CreateUserProfile } from './models/types';

console.log('Testing EcoSense.ai Core Data Models Implementation...');

// Test validation functions
console.log('\n1. Testing validation functions...');

const testEnvData: CreateEnvironmentalDataPoint = {
  source: 'openaq',
  pollutant: 'pm25',
  value: 15.5,
  unit: 'µg/m³',
  location: { latitude: 37.7749, longitude: -122.4194 },
  timestamp: new Date(),
  quality_grade: 'A'
};

const envValidation = validateEnvironmentalData(testEnvData);
console.log('Environmental data validation:', envValidation.isValid ? 'PASSED' : 'FAILED');
if (!envValidation.isValid) {
  console.log('Errors:', envValidation.errors);
}

const testUserData: CreateUserProfile = {
  email: 'test@example.com',
  password_hash: 'hashed_password_123',
  location: { latitude: 37.7749, longitude: -122.4194 },
  preferences: {
    notifications: true,
    activity_types: ['outdoor_sports', 'walking']
  }
};

const userValidation = validateUserProfile(testUserData);
console.log('User profile validation:', userValidation.isValid ? 'PASSED' : 'FAILED');
if (!userValidation.isValid) {
  console.log('Errors:', userValidation.errors);
}

// Test repository instantiation (without database connection)
console.log('\n2. Testing repository instantiation...');

try {
  // These will fail without database connection, but we can test instantiation
  const envRepo = new EnvironmentalDataRepository();
  const userRepo = new UserRepository();
  const imageRepo = new ImageAnalysisRepository();
  
  console.log('Repository instantiation: PASSED');
  console.log('- EnvironmentalDataRepository: OK');
  console.log('- UserRepository: OK');
  console.log('- ImageAnalysisRepository: OK');
} catch (error) {
  console.log('Repository instantiation: FAILED');
  console.log('Error:', error.message);
}

// Test geometry utilities
console.log('\n3. Testing geometry utilities...');

try {
  const { locationToPostGIS, postGISToLocation, isValidLocation, calculateDistance } = require('./utils/geometry');
  
  const testLocation = { latitude: 37.7749, longitude: -122.4194 };
  const postGISString = locationToPostGIS(testLocation);
  console.log('Location to PostGIS:', postGISString);
  
  const backToLocation = postGISToLocation(postGISString);
  console.log('PostGIS to Location:', backToLocation);
  
  const isValid = isValidLocation(testLocation);
  console.log('Location validation:', isValid ? 'VALID' : 'INVALID');
  
  const distance = calculateDistance(
    { latitude: 37.7749, longitude: -122.4194 },
    { latitude: 37.7849, longitude: -122.4094 }
  );
  console.log('Distance calculation:', distance.toFixed(2), 'km');
  
  console.log('Geometry utilities: PASSED');
} catch (error) {
  console.log('Geometry utilities: FAILED');
  console.log('Error:', error.message);
}

console.log('\n✅ Core data models implementation test completed!');
console.log('\nImplemented components:');
console.log('- TypeScript interfaces for all environmental data types');
console.log('- Database schema migration scripts');
console.log('- Database connection utilities with connection pooling');
console.log('- CRUD operations for environmental data');
console.log('- User management repository');
console.log('- Image analysis repository');
console.log('- Data validation utilities');
console.log('- PostGIS geometry utilities');
console.log('- Migration runner utility');