export interface EnvironmentalDataPoint {
  id: string
  source: 'openaq' | 'water_quality_portal' | 'local_sensor'
  pollutant: string
  value: number
  unit: string
  location: {
    latitude: number
    longitude: number
    address?: string
  }
  timestamp: Date
  quality_grade: 'A' | 'B' | 'C' | 'D'
}

export interface PollutionLevel {
  pollutant: string
  value: number
  unit: string
  level: 'good' | 'moderate' | 'unhealthy_sensitive' | 'unhealthy' | 'very_unhealthy' | 'hazardous'
  color: string
}

export interface LocationData {
  latitude: number
  longitude: number
  address?: string
  currentConditions: PollutionLevel[]
  lastUpdated: Date
}

export interface TrendData {
  pollutant: string
  timeframe: string
  data: Array<{
    timestamp: Date
    value: number
  }>
  trend: 'improving' | 'worsening' | 'stable'
}

export interface FilterOptions {
  dateRange: {
    start: Date
    end: Date
  }
  pollutants: string[]
  location: {
    latitude: number
    longitude: number
    radius: number
  }
  sources: string[]
}