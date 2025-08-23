import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { Box, Typography, Chip } from '@mui/material'
import { EnvironmentalDataPoint } from '../../types'
import 'leaflet/dist/leaflet.css'

interface PollutionHeatmapProps {
  center: [number, number]
  data: EnvironmentalDataPoint[]
  selectedPollutant: string
}

// Helper function to get color based on pollution level
const getPollutionColor = (value: number, pollutant: string): string => {
  // PM2.5 thresholds (μg/m³)
  if (pollutant === 'pm2.5') {
    if (value <= 12) return '#00e400' // Good
    if (value <= 35.4) return '#ffff00' // Moderate
    if (value <= 55.4) return '#ff7e00' // Unhealthy for sensitive
    if (value <= 150.4) return '#ff0000' // Unhealthy
    if (value <= 250.4) return '#8f3f97' // Very unhealthy
    return '#7e0023' // Hazardous
  }
  
  // PM10 thresholds (μg/m³)
  if (pollutant === 'pm10') {
    if (value <= 54) return '#00e400'
    if (value <= 154) return '#ffff00'
    if (value <= 254) return '#ff7e00'
    if (value <= 354) return '#ff0000'
    if (value <= 424) return '#8f3f97'
    return '#7e0023'
  }
  
  // Default color scale
  if (value <= 50) return '#00e400'
  if (value <= 100) return '#ffff00'
  if (value <= 150) return '#ff7e00'
  if (value <= 200) return '#ff0000'
  if (value <= 300) return '#8f3f97'
  return '#7e0023'
}

const getPollutionLevel = (value: number, pollutant: string): string => {
  if (pollutant === 'pm2.5') {
    if (value <= 12) return 'Good'
    if (value <= 35.4) return 'Moderate'
    if (value <= 55.4) return 'Unhealthy for Sensitive Groups'
    if (value <= 150.4) return 'Unhealthy'
    if (value <= 250.4) return 'Very Unhealthy'
    return 'Hazardous'
  }
  
  if (pollutant === 'pm10') {
    if (value <= 54) return 'Good'
    if (value <= 154) return 'Moderate'
    if (value <= 254) return 'Unhealthy for Sensitive Groups'
    if (value <= 354) return 'Unhealthy'
    if (value <= 424) return 'Very Unhealthy'
    return 'Hazardous'
  }
  
  // Default levels
  if (value <= 50) return 'Good'
  if (value <= 100) return 'Moderate'
  if (value <= 150) return 'Unhealthy for Sensitive Groups'
  if (value <= 200) return 'Unhealthy'
  if (value <= 300) return 'Very Unhealthy'
  return 'Hazardous'
}

// Component to update map view when center changes
const MapUpdater: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap()
  
  useEffect(() => {
    map.setView(center, map.getZoom())
  }, [center, map])
  
  return null
}

const PollutionHeatmap: React.FC<PollutionHeatmapProps> = ({
  center,
  data,
  selectedPollutant,
}) => {
  const [filteredData, setFilteredData] = useState<EnvironmentalDataPoint[]>([])

  useEffect(() => {
    // Filter data for the selected pollutant
    const filtered = data.filter(point => 
      point.pollutant.toLowerCase() === selectedPollutant.toLowerCase()
    )
    setFilteredData(filtered)
  }, [data, selectedPollutant])

  if (!center || center.length !== 2) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <Typography>Loading map...</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <MapContainer
        center={center}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        className="pollution-heatmap"
      >
        <MapUpdater center={center} />
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {filteredData.map((point) => {
          const color = getPollutionColor(point.value, point.pollutant)
          const level = getPollutionLevel(point.value, point.pollutant)
          
          return (
            <CircleMarker
              key={point.id}
              center={[point.location.latitude, point.location.longitude]}
              radius={8}
              fillColor={color}
              color={color}
              weight={2}
              opacity={0.8}
              fillOpacity={0.6}
            >
              <Popup>
                <Box sx={{ minWidth: 200 }}>
                  <Typography variant="h6" gutterBottom>
                    {point.pollutant.toUpperCase()} Reading
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Value:</strong> {point.value} {point.unit}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Level:</strong>{' '}
                    <Chip
                      label={level}
                      size="small"
                      sx={{
                        backgroundColor: color,
                        color: 'white',
                        fontWeight: 'bold',
                      }}
                    />
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Source:</strong> {point.source}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Quality:</strong> Grade {point.quality_grade}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Time:</strong> {new Date(point.timestamp).toLocaleString()}
                  </Typography>
                  
                  {point.location.address && (
                    <Typography variant="body2">
                      <strong>Location:</strong> {point.location.address}
                    </Typography>
                  )}
                </Box>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
      
      {filteredData.length === 0 && (
        <Box
          position="absolute"
          top="50%"
          left="50%"
          sx={{
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: 2,
            borderRadius: 1,
            zIndex: 1000,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            No data available for {selectedPollutant.toUpperCase()} in this area
          </Typography>
        </Box>
      )}
    </Box>
  )
}

export default PollutionHeatmap