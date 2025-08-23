import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  CircularProgress,
} from '@mui/material'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { EnvironmentalDataPoint, FilterOptions } from '../../types'
import { generateMockTrendData } from '../../data/mockData'
import { logger } from '../../config/environment'

interface TrendChartsProps {
  data: EnvironmentalDataPoint[]
  filters: FilterOptions
}

interface ChartData {
  timestamp: string
  [key: string]: string | number
}

const CHART_COLORS = {
  'pm2.5': '#ff6b6b',
  'pm10': '#4ecdc4',
  'no2': '#45b7d1',
  'o3': '#96ceb4',
  'co': '#ffeaa7',
  'so2': '#dda0dd',
}

const TrendCharts: React.FC<TrendChartsProps> = ({ data, filters }) => {
  const [selectedPollutant, setSelectedPollutant] = useState<string>('pm2.5')
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    processChartData()
  }, [data, selectedPollutant])

  const processChartData = () => {
    setLoading(true)
    
    try {
      // Filter data for selected pollutant
      const filteredData = data.filter(point => 
        point.pollutant.toLowerCase() === selectedPollutant.toLowerCase()
      )

      let processedData: ChartData[] = []

      if (filteredData.length > 0) {
        // Group data by time intervals (hourly)
        const groupedData = new Map<string, EnvironmentalDataPoint[]>()
        
        filteredData.forEach(point => {
          const hour = new Date(point.timestamp)
          hour.setMinutes(0, 0, 0) // Round to hour
          const hourKey = hour.toISOString()
          
          if (!groupedData.has(hourKey)) {
            groupedData.set(hourKey, [])
          }
          groupedData.get(hourKey)!.push(point)
        })

        // Calculate averages for each hour
        processedData = Array.from(groupedData.entries())
          .map(([timestamp, points]) => {
            const avgValue = points.reduce((sum, point) => sum + point.value, 0) / points.length
            return {
              timestamp: new Date(timestamp).toLocaleString(),
              [selectedPollutant]: Math.round(avgValue * 100) / 100,
              count: points.length,
            }
          })
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .slice(-48) // Show last 48 hours
      } else {
        // Generate mock trend data for demonstration
        const mockData = generateMockTrendData(selectedPollutant, 24)
        processedData = mockData.map(point => ({
          timestamp: new Date(point.timestamp).toLocaleString(),
          [selectedPollutant]: point.value,
        }))
      }

      setChartData(processedData)
    } catch (error) {
      logger.error('Error processing chart data:', error)
      setChartData([])
    } finally {
      setLoading(false)
    }
  }

  const handlePollutantChange = (event: any) => {
    setSelectedPollutant(event.target.value)
  }

  const getUnit = (pollutant: string): string => {
    const lower = pollutant.toLowerCase()
    if (lower.includes('pm') || lower.includes('no2') || lower.includes('o3') || lower.includes('so2')) {
      return 'μg/m³'
    }
    if (lower === 'co') {
      return 'mg/m³'
    }
    return 'units'
  }

  const getThresholdLines = (pollutant: string) => {
    const lower = pollutant.toLowerCase()
    if (lower === 'pm2.5') {
      return [
        { value: 12, label: 'Good', color: '#4caf50' },
        { value: 35.4, label: 'Moderate', color: '#ff9800' },
        { value: 55.4, label: 'Unhealthy for Sensitive', color: '#ff5722' },
      ]
    }
    if (lower === 'pm10') {
      return [
        { value: 54, label: 'Good', color: '#4caf50' },
        { value: 154, label: 'Moderate', color: '#ff9800' },
        { value: 254, label: 'Unhealthy for Sensitive', color: '#ff5722' },
      ]
    }
    return []
  }

  return (
    <Box>
      <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Pollutant</InputLabel>
            <Select
              value={selectedPollutant}
              onChange={handlePollutantChange}
              label="Pollutant"
            >
              {filters.pollutants.map((pollutant) => (
                <MenuItem key={pollutant} value={pollutant}>
                  {pollutant.toUpperCase()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} sm={6} md={9}>
          <Typography variant="body2" color="text.secondary">
            Showing trends for the last 48 hours
          </Typography>
        </Grid>
      </Grid>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" height={400}>
          <CircularProgress />
        </Box>
      ) : chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timestamp" 
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              label={{ value: getUnit(selectedPollutant), angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value: number) => [`${value} ${getUnit(selectedPollutant)}`, selectedPollutant.toUpperCase()]}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={selectedPollutant}
              stroke={CHART_COLORS[selectedPollutant as keyof typeof CHART_COLORS] || '#8884d8'}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              name={selectedPollutant.toUpperCase()}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <Box 
          display="flex" 
          justifyContent="center" 
          alignItems="center" 
          height={400}
          sx={{ backgroundColor: '#f5f5f5', borderRadius: 1 }}
        >
          <Typography color="text.secondary">
            No trend data available for {selectedPollutant.toUpperCase()}
          </Typography>
        </Box>
      )}

      {/* Health Guidelines */}
      {chartData.length > 0 && (
        <Paper sx={{ p: 2, mt: 2, backgroundColor: '#f9f9f9' }}>
          <Typography variant="subtitle2" gutterBottom>
            Health Guidelines for {selectedPollutant.toUpperCase()}
          </Typography>
          <Grid container spacing={2}>
            {getThresholdLines(selectedPollutant).map((threshold, index) => (
              <Grid item key={index}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      backgroundColor: threshold.color,
                      borderRadius: '50%',
                      mr: 1,
                    }}
                  />
                  <Typography variant="caption">
                    {threshold.label}: ≤{threshold.value} {getUnit(selectedPollutant)}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}
    </Box>
  )
}

export default TrendCharts