import React from 'react'
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  TextField,
  Grid,
  Typography,
  Slider,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { FilterOptions } from '../../types'

interface FilterPanelProps {
  filters: FilterOptions
  onFilterChange: (filters: FilterOptions) => void
}

const POLLUTANTS = [
  { value: 'pm2.5', label: 'PM2.5' },
  { value: 'pm10', label: 'PM10' },
  { value: 'no2', label: 'NO₂' },
  { value: 'o3', label: 'O₃' },
  { value: 'co', label: 'CO' },
  { value: 'so2', label: 'SO₂' },
]

const DATA_SOURCES = [
  { value: 'openaq', label: 'OpenAQ' },
  { value: 'water_quality_portal', label: 'Water Quality Portal' },
  { value: 'local_sensor', label: 'Local Sensors' },
]

const FilterPanel: React.FC<FilterPanelProps> = ({ filters, onFilterChange }) => {
  const handlePollutantChange = (event: any) => {
    const value = event.target.value
    onFilterChange({
      ...filters,
      pollutants: typeof value === 'string' ? value.split(',') : value,
    })
  }

  const handleSourceChange = (event: any) => {
    const value = event.target.value
    onFilterChange({
      ...filters,
      sources: typeof value === 'string' ? value.split(',') : value,
    })
  }

  const handleDateChange = (field: 'start' | 'end') => (date: Date | null) => {
    if (date) {
      onFilterChange({
        ...filters,
        dateRange: {
          ...filters.dateRange,
          [field]: date,
        },
      })
    }
  }

  const handleLocationChange = (field: 'latitude' | 'longitude') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value)
    if (!isNaN(value)) {
      onFilterChange({
        ...filters,
        location: {
          ...filters.location,
          [field]: value,
        },
      })
    }
  }

  const handleRadiusChange = (_: Event, value: number | number[]) => {
    onFilterChange({
      ...filters,
      location: {
        ...filters.location,
        radius: Array.isArray(value) ? value[0] : value,
      },
    })
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Typography variant="h6" gutterBottom>
          Filter Options
        </Typography>
        
        <Grid container spacing={3}>
          {/* Date Range */}
          <Grid item xs={12} sm={6} md={3}>
            <DatePicker
              label="Start Date"
              value={filters.dateRange.start}
              onChange={handleDateChange('start')}
              slotProps={{ textField: { fullWidth: true, size: 'small' } }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <DatePicker
              label="End Date"
              value={filters.dateRange.end}
              onChange={handleDateChange('end')}
              slotProps={{ textField: { fullWidth: true, size: 'small' } }}
            />
          </Grid>

          {/* Pollutants */}
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Pollutants</InputLabel>
              <Select
                multiple
                value={filters.pollutants}
                onChange={handlePollutantChange}
                input={<OutlinedInput label="Pollutants" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip
                        key={value}
                        label={POLLUTANTS.find(p => p.value === value)?.label || value}
                        size="small"
                      />
                    ))}
                  </Box>
                )}
              >
                {POLLUTANTS.map((pollutant) => (
                  <MenuItem key={pollutant.value} value={pollutant.value}>
                    {pollutant.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Data Sources */}
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Data Sources</InputLabel>
              <Select
                multiple
                value={filters.sources}
                onChange={handleSourceChange}
                input={<OutlinedInput label="Data Sources" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip
                        key={value}
                        label={DATA_SOURCES.find(s => s.value === value)?.label || value}
                        size="small"
                      />
                    ))}
                  </Box>
                )}
              >
                {DATA_SOURCES.map((source) => (
                  <MenuItem key={source.value} value={source.value}>
                    {source.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Location */}
          <Grid item xs={12} sm={4} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Latitude"
              type="number"
              value={filters.location.latitude}
              onChange={handleLocationChange('latitude')}
              inputProps={{ step: 0.0001 }}
            />
          </Grid>

          <Grid item xs={12} sm={4} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Longitude"
              type="number"
              value={filters.location.longitude}
              onChange={handleLocationChange('longitude')}
              inputProps={{ step: 0.0001 }}
            />
          </Grid>

          {/* Radius */}
          <Grid item xs={12} sm={4} md={2}>
            <Typography gutterBottom>
              Radius: {filters.location.radius} km
            </Typography>
            <Slider
              value={filters.location.radius}
              onChange={handleRadiusChange}
              min={1}
              max={50}
              step={1}
              marks={[
                { value: 1, label: '1km' },
                { value: 25, label: '25km' },
                { value: 50, label: '50km' },
              ]}
            />
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  )
}

export default FilterPanel