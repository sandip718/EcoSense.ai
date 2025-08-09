// Utility functions for handling PostGIS geometry data
// Supports conversion between Location interface and PostGIS POINT geometry

import { Location } from '../models/types';

/**
 * Convert Location object to PostGIS POINT geometry string
 * @param location Location object with latitude and longitude
 * @returns PostGIS POINT geometry string
 */
export function locationToPostGIS(location: Location): string {
  return `POINT(${location.longitude} ${location.latitude})`;
}

/**
 * Convert PostGIS POINT geometry to Location object
 * @param geometryString PostGIS geometry string (e.g., "POINT(-122.4194 37.7749)")
 * @returns Location object
 */
export function postGISToLocation(geometryString: string): Location {
  // Handle different PostGIS output formats
  // Format 1: "POINT(-122.4194 37.7749)"
  // Format 2: "0101000020E6100000..." (binary format)
  
  if (geometryString.startsWith('POINT(')) {
    const coords = geometryString
      .replace('POINT(', '')
      .replace(')', '')
      .split(' ')
      .map(coord => parseFloat(coord));
    
    return {
      longitude: coords[0],
      latitude: coords[1]
    };
  }
  
  // If it's a binary format, we'll need to handle it differently
  // For now, throw an error to indicate unsupported format
  throw new Error(`Unsupported geometry format: ${geometryString}`);
}

/**
 * Create a PostGIS query for finding points within a radius
 * @param location Center location
 * @param radiusKm Radius in kilometers
 * @returns SQL WHERE clause for spatial query
 */
export function createRadiusQuery(location: Location, radiusKm: number): string {
  const point = locationToPostGIS(location);
  return `ST_DWithin(location::geography, ST_SetSRID(ST_GeomFromText('${point}'), 4326)::geography, ${radiusKm * 1000})`;
}

/**
 * Create a PostGIS query for distance calculation
 * @param location Reference location
 * @returns SQL expression for calculating distance in meters
 */
export function createDistanceQuery(location: Location): string {
  const point = locationToPostGIS(location);
  return `ST_Distance(location::geography, ST_SetSRID(ST_GeomFromText('${point}'), 4326)::geography)`;
}

/**
 * Validate location coordinates
 * @param location Location object to validate
 * @returns true if valid, false otherwise
 */
export function isValidLocation(location: Location): boolean {
  return (
    typeof location.latitude === 'number' &&
    typeof location.longitude === 'number' &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

/**
 * Calculate distance between two locations using Haversine formula
 * @param loc1 First location
 * @param loc2 Second location
 * @returns Distance in kilometers
 */
export function calculateDistance(loc1: Location, loc2: Location): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(loc2.latitude - loc1.latitude);
  const dLon = toRadians(loc2.longitude - loc1.longitude);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(loc1.latitude)) * Math.cos(toRadians(loc2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}