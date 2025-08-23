# EcoSense.ai Frontend Dashboard

A React-based web dashboard for the EcoSense.ai environmental intelligence platform.

## Features

- **Real-time Environmental Data Visualization**: Interactive pollution heatmaps and metrics
- **Advanced Filtering**: Filter by date range, pollutants, location, and data sources
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Interactive Maps**: Leaflet-based maps with pollution data overlays
- **Trend Analysis**: Historical pollution trend charts with health guidelines
- **Material-UI Components**: Modern, accessible UI components

## Technology Stack

- **React 18** with TypeScript
- **Material-UI (MUI)** for UI components
- **React Leaflet** for interactive maps
- **Recharts** for data visualization
- **Vite** for fast development and building
- **Axios** for API communication

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Building for Production

```bash
npm run build
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── FilterPanel.tsx
│   │   │   ├── PollutionHeatmap.tsx
│   │   │   ├── EnvironmentalMetrics.tsx
│   │   │   └── TrendCharts.tsx
│   │   └── layout/
│   │       └── Navbar.tsx
│   ├── pages/
│   │   └── Dashboard.tsx
│   ├── services/
│   │   └── api.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── public/
├── package.json
└── vite.config.ts
```

## API Integration

The frontend communicates with the backend API running on `http://localhost:8000`. The proxy configuration in `vite.config.ts` handles API requests during development.

### Key API Endpoints Used

- `GET /api/environmental-data/current` - Current conditions for a location
- `GET /api/environmental-data` - Historical environmental data with filters
- `GET /api/insights/trends` - Trend analysis data
- `GET /api/environmental-data/heatmap` - Heatmap data for visualization

## Components

### Dashboard
Main dashboard page that orchestrates all components and manages global state.

### FilterPanel
Provides filtering controls for:
- Date range selection
- Pollutant type selection
- Geographic location and radius
- Data source selection

### PollutionHeatmap
Interactive Leaflet map showing:
- Real-time pollution data points
- Color-coded pollution levels
- Detailed popups with measurement information

### EnvironmentalMetrics
Current conditions display with:
- Real-time pollution readings
- Health impact indicators
- Visual pollution level indicators

### TrendCharts
Historical trend visualization with:
- Time series charts for pollution data
- Health guideline overlays
- Interactive pollutant selection

## Customization

### Adding New Pollutants

1. Update the `POLLUTANTS` array in `FilterPanel.tsx`
2. Add color mappings in `CHART_COLORS` in `TrendCharts.tsx`
3. Update threshold functions in `PollutionHeatmap.tsx`

### Styling

The application uses Material-UI's theming system. Customize the theme in `main.tsx`:

```typescript
const theme = createTheme({
  palette: {
    primary: {
      main: '#2e7d32', // Your primary color
    },
    // ... other theme options
  },
})
```

## Performance Considerations

- Data is cached and filtered client-side to reduce API calls
- Maps use efficient clustering for large datasets
- Charts are optimized for smooth interactions
- Responsive design ensures good performance on mobile devices

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Follow the existing code style and TypeScript patterns
2. Add proper error handling for new components
3. Include loading states for async operations
4. Test responsive behavior on different screen sizes
5. Ensure accessibility compliance with WCAG guidelines