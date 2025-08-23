import { EnvironmentalDataPoint, LocationData } from '../types'

// Mock environmental data for testing
export const mockEnvironmentalData: EnvironmentalDataPoint[] = [
  {
    id: '1',
    source: 'openaq',
    pollutant: 'pm2.5',
    value: 25.4,
    unit: 'μg/m³',
    location: {
      latitude: 40.7128,
      longitude: -74.0060,
      address: 'New York, NY',
    },
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    quality_grade: 'B',
  },
  {
    id: '2',
    source: 'openaq',
    pollutant: 'pm10',
    value: 45.2,
    unit: 'μg/m³',
    location: {
      latitude: 40.7589,
      longitude: -73.9851,
      address: 'Times Square, NY',
    },
    timestamp: new Date(Date.now() - 1000 * 60 * 45), // 45 minutes ago
    quality_grade: 'B',
  },
  {
    id: '3',
    source: 'local_sensor',
    pollutant: 'no2',
    value: 32.1,
    unit: 'μg/m³',
    location: {
      latitude: 40.6892,
      longitude: -74.0445,
      address: 'Brooklyn, NY',
    },
    timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    quality_grade: 'A',
  },
  {
    id: '4',
    source: 'openaq',
    pollutant: 'o3',
    value: 78.5,
    unit: 'μg/m³',
    location: {
      latitude: 40.7831,
      longitude: -73.9712,
      address: 'Central Park, NY',
    },
    timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
    quality_grade: 'C',
  },
  {
    id: '5',
    source: 'water_quality_portal',
    pollutant: 'pm2.5',
    value: 18.7,
    unit: 'μg/m³',
    location: {
      latitude: 40.6782,
      longitude: -73.9442,
      address: 'Brooklyn Heights, NY',
    },
    timestamp: new Date(Date.now() - 1000 * 60 * 20), // 20 minutes ago
    quality_grade: 'A',
  },
]

export const mockLocationData: LocationData = {
  latitude: 40.7128,
  longitude: -74.0060,
  address: 'New York, NY',
  currentConditions: [
    {
      pollutant: 'pm2.5',
      value: 22.1,
      unit: 'μg/m³',
      level: 'good',
      color: '#4caf50',
    },
    {
      pollutant: 'pm10',
      value: 41.3,
      unit: 'μg/m³',
      level: 'moderate',
      color: '#ff9800',
    },
    {
      pollutant: 'no2',
      value: 28.7,
      unit: 'μg/m³',
      level: 'good',
      color: '#4caf50',
    },
    {
      pollutant: 'o3',
      value: 85.2,
      unit: 'μg/m³',
      level: 'moderate',
      color: '#ff9800',
    },
  ],
  lastUpdated: new Date(),
}

// Generate historical data for trends
export const generateMockTrendData = (pollutant: string, hours: number = 24) => {
  const data = []
  const now = new Date()
  
  for (let i = hours; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)
    let baseValue = 30
    
    // Different base values for different pollutants
    switch (pollutant.toLowerCase()) {
      case 'pm2.5':
        baseValue = 20
        break
      case 'pm10':
        baseValue = 35
        break
      case 'no2':
        baseValue = 25
        break
      case 'o3':
        baseValue = 70
        break
      case 'co':
        baseValue = 1.2
        break
      case 'so2':
        baseValue = 15
        break
    }
    
    // Add some realistic variation
    const variation = (Math.random() - 0.5) * baseValue * 0.4
    const dailyPattern = Math.sin((timestamp.getHours() / 24) * Math.PI * 2) * baseValue * 0.2
    const value = Math.max(0, baseValue + variation + dailyPattern)
    
    data.push({
      timestamp: timestamp.toISOString(),
      value: Math.round(value * 10) / 10,
    })
  }
  
  return data
}