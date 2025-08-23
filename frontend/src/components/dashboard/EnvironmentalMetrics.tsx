import React from 'react'
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  Chip,
  Stack,
  Divider,
} from '@mui/material'
import {
  Air as AirIcon,
  Water as WaterIcon,
  VolumeUp as NoiseIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
} from '@mui/icons-material'
import { LocationData } from '../../types'

interface EnvironmentalMetricsProps {
  currentLocation: LocationData | null
  loading: boolean
}

const getPollutionIcon = (pollutant: string) => {
  const lower = pollutant.toLowerCase()
  if (lower.includes('pm') || lower.includes('no2') || lower.includes('o3') || lower.includes('co')) {
    return <AirIcon />
  }
  if (lower.includes('water') || lower.includes('turbidity')) {
    return <WaterIcon />
  }
  if (lower.includes('noise') || lower.includes('sound')) {
    return <NoiseIcon />
  }
  return <AirIcon />
}

const getLevelColor = (level: string): string => {
  switch (level.toLowerCase()) {
    case 'good':
      return '#4caf50'
    case 'moderate':
      return '#ff9800'
    case 'unhealthy_sensitive':
    case 'unhealthy for sensitive groups':
      return '#ff5722'
    case 'unhealthy':
      return '#f44336'
    case 'very_unhealthy':
    case 'very unhealthy':
      return '#9c27b0'
    case 'hazardous':
      return '#424242'
    default:
      return '#757575'
  }
}

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'improving':
      return <TrendingDownIcon color="success" />
    case 'worsening':
      return <TrendingUpIcon color="error" />
    case 'stable':
    default:
      return <TrendingFlatIcon color="info" />
  }
}

const EnvironmentalMetrics: React.FC<EnvironmentalMetricsProps> = ({
  currentLocation,
  loading,
}) => {
  if (loading) {
    return (
      <Paper sx={{ p: 3, height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Paper>
    )
  }

  if (!currentLocation) {
    return (
      <Paper sx={{ p: 3, height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary">
          No environmental data available for this location
        </Typography>
      </Paper>
    )
  }

  return (
    <Paper sx={{ p: 3, height: '500px', overflow: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        Current Conditions
      </Typography>
      
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {currentLocation.address || `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`}
      </Typography>
      
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
        Last updated: {new Date(currentLocation.lastUpdated).toLocaleString()}
      </Typography>

      <Divider sx={{ mb: 2 }} />

      <Stack spacing={2}>
        {currentLocation.currentConditions.map((condition, index) => (
          <Box key={index}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              {getPollutionIcon(condition.pollutant)}
              <Typography variant="subtitle2" sx={{ ml: 1, flexGrow: 1 }}>
                {condition.pollutant.toUpperCase()}
              </Typography>
              {/* {getTrendIcon('stable')} */}
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">
                {condition.value} {condition.unit}
              </Typography>
              
              <Chip
                label={condition.level.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                size="small"
                sx={{
                  backgroundColor: getLevelColor(condition.level),
                  color: 'white',
                  fontWeight: 'bold',
                }}
              />
            </Box>
            
            {/* Progress bar showing relative level */}
            <Box sx={{ width: '100%', height: 8, backgroundColor: '#e0e0e0', borderRadius: 1, overflow: 'hidden' }}>
              <Box
                sx={{
                  height: '100%',
                  backgroundColor: condition.color || getLevelColor(condition.level),
                  width: `${Math.min((condition.value / getMaxValue(condition.pollutant)) * 100, 100)}%`,
                  transition: 'width 0.3s ease',
                }}
              />
            </Box>
            
            {index < currentLocation.currentConditions.length - 1 && (
              <Divider sx={{ mt: 2 }} />
            )}
          </Box>
        ))}
      </Stack>

      {currentLocation.currentConditions.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="text.secondary">
            No current pollution data available
          </Typography>
        </Box>
      )}
    </Paper>
  )
}

// Helper function to get max values for progress bars
const getMaxValue = (pollutant: string): number => {
  const lower = pollutant.toLowerCase()
  if (lower === 'pm2.5') return 250
  if (lower === 'pm10') return 400
  if (lower === 'no2') return 200
  if (lower === 'o3') return 300
  if (lower === 'co') return 50
  if (lower === 'so2') return 300
  return 200 // default
}

export default EnvironmentalMetrics