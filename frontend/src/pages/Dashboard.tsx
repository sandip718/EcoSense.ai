import React, { useState, useEffect } from 'react'
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material'
import FilterPanel from '../components/dashboard/FilterPanel'
import PollutionHeatmap from '../components/dashboard/PollutionHeatmap'
import EnvironmentalMetrics from '../components/dashboard/EnvironmentalMetrics'
import TrendCharts from '../components/dashboard/TrendCharts'
import { environmentalDataApi } from '../services/api'
import { EnvironmentalDataPoint, FilterOptions, LocationData } from '../types'
import { mockEnvironmentalData, mockLocationData } from '../data/mockData'
import { logger } from '../config/environment'

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [environmentalData, setEnvironmentalData] = useState<EnvironmentalDataPoint[]>([])
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null)
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      end: new Date(),
    },
    pollutants: ['pm2.5', 'pm10', 'no2', 'o3'],
    location: {
      latitude: 40.7128, // Default to NYC
      longitude: -74.0060,
      radius: 10,
    },
    sources: ['openaq', 'water_quality_portal', 'local_sensor'],
  })

  useEffect(() => {
    // Get user's location if available
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFilters(prev => ({
            ...prev,
            location: {
              ...prev.location,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }
          }))
        },
        (error) => {
          logger.warn('Geolocation error:', error)
          // Continue with default location
        }
      )
    }
  }, [])

  useEffect(() => {
    loadDashboardData()
  }, [filters])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      try {
        // Try to load real data from API
        const currentConditions = await environmentalDataApi.getCurrentConditions(
          filters.location.latitude,
          filters.location.longitude,
          filters.location.radius
        )
        setCurrentLocation(currentConditions)

        const data = await environmentalDataApi.getEnvironmentalData({
          lat: filters.location.latitude,
          lng: filters.location.longitude,
          radius: filters.location.radius,
          startDate: filters.dateRange.start.toISOString(),
          endDate: filters.dateRange.end.toISOString(),
          limit: 1000,
        })
        setEnvironmentalData(data)
      } catch (apiError) {
        // If API fails, use mock data for demonstration
        logger.info('API not available, using mock data for demonstration')
        setCurrentLocation(mockLocationData)
        setEnvironmentalData(mockEnvironmentalData)
      }

    } catch (err) {
      setError('Failed to load dashboard data. Please try again.')
      logger.error('Dashboard data loading error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters)
  }

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={60} />
        </Box>
      </Container>
    )
  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Environmental Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Real-time pollution monitoring and insights for your community
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Filter Panel */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <FilterPanel
              filters={filters}
              onFilterChange={handleFilterChange}
            />
          </Paper>
        </Grid>

        {/* Environmental Metrics */}
        <Grid item xs={12} md={4}>
          <EnvironmentalMetrics
            currentLocation={currentLocation}
            loading={loading}
          />
        </Grid>

        {/* Pollution Heatmap */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: '500px' }}>
            <Typography variant="h6" gutterBottom>
              Pollution Heatmap
            </Typography>
            <PollutionHeatmap
              center={[filters.location.latitude, filters.location.longitude]}
              data={environmentalData}
              selectedPollutant="pm2.5"
            />
          </Paper>
        </Grid>

        {/* Trend Charts */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Pollution Trends
            </Typography>
            <TrendCharts
              data={environmentalData}
              filters={filters}
            />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  )
}

export default Dashboard