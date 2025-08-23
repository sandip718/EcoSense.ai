import { EnvironmentalDataPoint, LocationData, TrendData } from '../types'
import { API_BASE_URL, logger } from '../config/environment'
import { createSilentAxios } from '../utils/silentAxios'

const api = createSilentAxios(API_BASE_URL, 10000)

export const environmentalDataApi = {
  // Get current environmental conditions for a location
  getCurrentConditions: async (lat: number, lng: number, radius: number = 5): Promise<LocationData> => {
    const response = await api.get('/environmental-data/current', {
      params: { lat, lng, radius }
    })
    return response.data
  },

  // Get environmental data points with filters
  getEnvironmentalData: async (params: {
    lat?: number
    lng?: number
    radius?: number
    pollutant?: string
    startDate?: string
    endDate?: string
    limit?: number
  }): Promise<EnvironmentalDataPoint[]> => {
    const response = await api.get('/environmental-data', { params })
    return response.data.map((item: any) => ({
      ...item,
      timestamp: new Date(item.timestamp)
    }))
  },

  // Get trend analysis for a location
  getTrendAnalysis: async (lat: number, lng: number, pollutant: string, timeframe: string): Promise<TrendData> => {
    const response = await api.get('/insights/trends', {
      params: { lat, lng, pollutant, timeframe }
    })
    return {
      ...response.data,
      data: response.data.data.map((point: any) => ({
        ...point,
        timestamp: new Date(point.timestamp)
      }))
    }
  },

  // Get heatmap data for visualization
  getHeatmapData: async (bounds: {
    north: number
    south: number
    east: number
    west: number
  }, pollutant: string): Promise<Array<{
    lat: number
    lng: number
    value: number
    intensity: number
  }>> => {
    const response = await api.get('/environmental-data/heatmap', {
      params: { ...bounds, pollutant }
    })
    return response.data
  }
}

export default api