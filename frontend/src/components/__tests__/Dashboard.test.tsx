import React from 'react'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import Dashboard from '../../pages/Dashboard'

// Mock the API service
jest.mock('../../services/api', () => ({
  environmentalDataApi: {
    getCurrentConditions: jest.fn().mockResolvedValue({
      latitude: 40.7128,
      longitude: -74.0060,
      currentConditions: [],
      lastUpdated: new Date(),
    }),
    getEnvironmentalData: jest.fn().mockResolvedValue([]),
  },
}))

// Mock Leaflet components
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  CircleMarker: () => <div data-testid="circle-marker" />,
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
  useMap: () => ({
    setView: jest.fn(),
    getZoom: jest.fn().mockReturnValue(11),
  }),
}))

const theme = createTheme()

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </BrowserRouter>
  )
}

describe('Dashboard', () => {
  test('renders dashboard title', async () => {
    renderWithProviders(<Dashboard />)
    
    expect(screen.getByText('Environmental Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Real-time pollution monitoring and insights for your community')).toBeInTheDocument()
  })

  test('renders main dashboard sections', async () => {
    renderWithProviders(<Dashboard />)
    
    // Wait for loading to complete and check for main sections
    await screen.findByText('Pollution Heatmap')
    expect(screen.getByText('Pollution Trends')).toBeInTheDocument()
  })
})