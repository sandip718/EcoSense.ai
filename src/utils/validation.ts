// Validation utilities for environmental data types
// Implements data validation according to requirements 8.1, 8.2

import { CreateEnvironmentalDataPoint, CreateUserProfile, CreateImageAnalysis, Location } from '../models/types';
import { isValidLocation } from '../utils/geometry';

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validate environmental data point
 * @param data Environmental data to validate
 * @returns Validation result
 */
export function validateEnvironmentalData(data: CreateEnvironmentalDataPoint): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate source
  const validSources = ['openaq', 'water_quality_portal', 'local_sensor'];
  if (!validSources.includes(data.source)) {
    errors.push({
      field: 'source',
      message: `Source must be one of: ${validSources.join(', ')}`,
      value: data.source
    });
  }

  // Validate pollutant
  if (!data.pollutant || typeof data.pollutant !== 'string' || data.pollutant.trim().length === 0) {
    errors.push({
      field: 'pollutant',
      message: 'Pollutant is required and must be a non-empty string',
      value: data.pollutant
    });
  }

  // Validate value
  if (typeof data.value !== 'number' || isNaN(data.value) || data.value < 0) {
    errors.push({
      field: 'value',
      message: 'Value must be a non-negative number',
      value: data.value
    });
  }

  // Validate unit
  if (!data.unit || typeof data.unit !== 'string' || data.unit.trim().length === 0) {
    errors.push({
      field: 'unit',
      message: 'Unit is required and must be a non-empty string',
      value: data.unit
    });
  }

  // Validate location
  if (!data.location || !isValidLocation(data.location)) {
    errors.push({
      field: 'location',
      message: 'Location must have valid latitude (-90 to 90) and longitude (-180 to 180)',
      value: data.location
    });
  }

  // Validate timestamp
  if (!data.timestamp || !(data.timestamp instanceof Date) || isNaN(data.timestamp.getTime())) {
    errors.push({
      field: 'timestamp',
      message: 'Timestamp must be a valid Date object',
      value: data.timestamp
    });
  } else {
    // Check if timestamp is not too far in the future (more than 1 hour)
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    if (data.timestamp > oneHourFromNow) {
      errors.push({
        field: 'timestamp',
        message: 'Timestamp cannot be more than 1 hour in the future',
        value: data.timestamp
      });
    }
  }

  // Validate quality grade
  const validGrades = ['A', 'B', 'C', 'D'];
  if (!validGrades.includes(data.quality_grade)) {
    errors.push({
      field: 'quality_grade',
      message: `Quality grade must be one of: ${validGrades.join(', ')}`,
      value: data.quality_grade
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate user profile data
 * @param data User profile data to validate
 * @returns Validation result
 */
export function validateUserProfile(data: CreateUserProfile): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email)) {
    errors.push({
      field: 'email',
      message: 'Email must be a valid email address',
      value: data.email
    });
  }

  // Validate password hash
  if (!data.password_hash || typeof data.password_hash !== 'string' || data.password_hash.length < 10) {
    errors.push({
      field: 'password_hash',
      message: 'Password hash is required and must be at least 10 characters',
      value: data.password_hash ? '[REDACTED]' : data.password_hash
    });
  }

  // Validate location (optional)
  if (data.location && !isValidLocation(data.location)) {
    errors.push({
      field: 'location',
      message: 'Location must have valid latitude (-90 to 90) and longitude (-180 to 180)',
      value: data.location
    });
  }

  // Validate preferences (optional)
  if (data.preferences) {
    const prefErrors = validateUserPreferences(data.preferences);
    errors.push(...prefErrors.map(error => ({
      field: `preferences.${error.field}`,
      message: error.message,
      value: error.value
    })));
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate image analysis data
 * @param data Image analysis data to validate
 * @returns Validation result
 */
export function validateImageAnalysis(data: CreateImageAnalysis): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate user_id
  if (!data.user_id || typeof data.user_id !== 'string' || data.user_id.trim().length === 0) {
    errors.push({
      field: 'user_id',
      message: 'User ID is required and must be a non-empty string',
      value: data.user_id
    });
  }

  // Validate image_url
  const urlRegex = /^https?:\/\/.+/;
  if (!data.image_url || !urlRegex.test(data.image_url)) {
    errors.push({
      field: 'image_url',
      message: 'Image URL must be a valid HTTP/HTTPS URL',
      value: data.image_url
    });
  }

  // Validate location (optional)
  if (data.location && !isValidLocation(data.location)) {
    errors.push({
      field: 'location',
      message: 'Location must have valid latitude (-90 to 90) and longitude (-180 to 180)',
      value: data.location
    });
  }

  // Validate upload_timestamp
  if (!data.upload_timestamp || !(data.upload_timestamp instanceof Date) || isNaN(data.upload_timestamp.getTime())) {
    errors.push({
      field: 'upload_timestamp',
      message: 'Upload timestamp must be a valid Date object',
      value: data.upload_timestamp
    });
  }

  // Validate analysis_results
  if (!data.analysis_results || typeof data.analysis_results !== 'object') {
    errors.push({
      field: 'analysis_results',
      message: 'Analysis results are required and must be an object',
      value: data.analysis_results
    });
  }

  // Validate overall_score (optional)
  if (data.overall_score !== undefined) {
    if (typeof data.overall_score !== 'number' || data.overall_score < 0 || data.overall_score > 1) {
      errors.push({
        field: 'overall_score',
        message: 'Overall score must be a number between 0 and 1',
        value: data.overall_score
      });
    }
  }

  // Validate status (optional)
  if (data.status) {
    const validStatuses = ['pending', 'processing', 'completed', 'failed'];
    if (!validStatuses.includes(data.status)) {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${validStatuses.join(', ')}`,
        value: data.status
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate user preferences
 * @param preferences User preferences to validate
 * @returns Array of validation errors
 */
function validateUserPreferences(preferences: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof preferences !== 'object' || preferences === null) {
    return [{
      field: 'preferences',
      message: 'Preferences must be an object',
      value: preferences
    }];
  }

  // Validate notifications (optional boolean)
  if (preferences.notifications !== undefined && typeof preferences.notifications !== 'boolean') {
    errors.push({
      field: 'notifications',
      message: 'Notifications preference must be a boolean',
      value: preferences.notifications
    });
  }

  // Validate activity_types (optional string array)
  if (preferences.activity_types !== undefined) {
    if (!Array.isArray(preferences.activity_types)) {
      errors.push({
        field: 'activity_types',
        message: 'Activity types must be an array',
        value: preferences.activity_types
      });
    } else if (!preferences.activity_types.every((type: any) => typeof type === 'string')) {
      errors.push({
        field: 'activity_types',
        message: 'All activity types must be strings',
        value: preferences.activity_types
      });
    }
  }

  // Validate health_conditions (optional string array)
  if (preferences.health_conditions !== undefined) {
    if (!Array.isArray(preferences.health_conditions)) {
      errors.push({
        field: 'health_conditions',
        message: 'Health conditions must be an array',
        value: preferences.health_conditions
      });
    } else if (!preferences.health_conditions.every((condition: any) => typeof condition === 'string')) {
      errors.push({
        field: 'health_conditions',
        message: 'All health conditions must be strings',
        value: preferences.health_conditions
      });
    }
  }

  // Validate notification_radius (optional number)
  if (preferences.notification_radius !== undefined) {
    if (typeof preferences.notification_radius !== 'number' || preferences.notification_radius <= 0) {
      errors.push({
        field: 'notification_radius',
        message: 'Notification radius must be a positive number',
        value: preferences.notification_radius
      });
    }
  }

  return errors;
}

/**
 * Validate pollutant value ranges based on common standards
 * @param pollutant Pollutant type
 * @param value Measured value
 * @param unit Unit of measurement
 * @returns Validation result
 */
export function validatePollutantRange(pollutant: string, value: number, unit: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Define reasonable ranges for common pollutants
  const pollutantRanges: Record<string, { min: number; max: number; units: string[] }> = {
    'pm25': { min: 0, max: 500, units: ['µg/m³', 'ug/m3'] },
    'pm10': { min: 0, max: 1000, units: ['µg/m³', 'ug/m3'] },
    'no2': { min: 0, max: 2000, units: ['µg/m³', 'ug/m3', 'ppb'] },
    'o3': { min: 0, max: 1000, units: ['µg/m³', 'ug/m3', 'ppb'] },
    'so2': { min: 0, max: 2000, units: ['µg/m³', 'ug/m3', 'ppb'] },
    'co': { min: 0, max: 50, units: ['mg/m³', 'mg/m3', 'ppm'] },
    'turbidity': { min: 0, max: 1000, units: ['NTU', 'FTU'] },
    'ph': { min: 0, max: 14, units: ['pH', 'units'] },
    'temperature': { min: -50, max: 60, units: ['°C', 'C', '°F', 'F'] },
    'noise': { min: 0, max: 140, units: ['dB', 'dBA'] }
  };

  const range = pollutantRanges[pollutant.toLowerCase()];
  
  if (range) {
    // Check if unit is valid for this pollutant
    if (!range.units.includes(unit)) {
      errors.push({
        field: 'unit',
        message: `Invalid unit for ${pollutant}. Expected one of: ${range.units.join(', ')}`,
        value: unit
      });
    }

    // Check if value is within reasonable range
    if (value < range.min || value > range.max) {
      errors.push({
        field: 'value',
        message: `Value for ${pollutant} should be between ${range.min} and ${range.max} ${unit}`,
        value: value
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}