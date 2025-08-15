# Insights Engine

The Insights Engine is a core component of EcoSense.ai that provides environmental trend analysis, correlation analysis between pollution sources, and health impact assessments. It implements requirements 3.1, 3.2, 3.3, and 3.4 from the project specifications.

## Features

### 1. Trend Analysis (Requirement 3.1)
- Analyzes environmental data trends over time using linear regression
- Identifies trend direction: improving, worsening, or stable
- Calculates trend magnitude and confidence levels
- Supports daily, weekly, and monthly trend analysis

### 2. Correlation Analysis (Requirement 3.3)
- Calculates Pearson correlation coefficients between different pollutants
- Provides statistical significance testing
- Interprets correlation strength (weak, moderate, strong, very strong)
- Supports multiple pollutant comparisons

### 3. Health Impact Assessment (Requirement 3.4)
- Assesses health risks based on WHO guidelines and standards
- Categorizes risk levels: low, moderate, high, very high
- Provides specific health effects and recommendations
- Estimates affected population based on location and risk level

### 4. Comprehensive Insights
- Combines trend analysis, correlations, and health impacts
- Provides holistic environmental intelligence
- Supports multiple pollutants and locations

## Supported Pollutants

### Air Quality
- **PM2.5**: Fine particulate matter (μg/m³)
- **PM10**: Coarse particulate matter (μg/m³)
- **NO2**: Nitrogen dioxide (μg/m³)
- **O3**: Ozone (μg/m³)
- **SO2**: Sulfur dioxide (μg/m³)
- **CO**: Carbon monoxide (mg/m³)

### Water Quality
- **Turbidity**: Water clarity (NTU)
- **pH**: Acidity/alkalinity (pH units)
- **Dissolved Oxygen**: Oxygen content (mg/L)

### Noise
- **Noise**: Sound levels (dB)

## Health Thresholds

The engine uses WHO guidelines and international standards for health risk assessment:

| Pollutant | Moderate | High | Very High | Unit |
|-----------|----------|------|-----------|------|
| PM2.5 | 15 | 35 | 75 | μg/m³ |
| PM10 | 45 | 100 | 200 | μg/m³ |
| NO2 | 40 | 100 | 200 | μg/m³ |
| O3 | 100 | 180 | 240 | μg/m³ |
| SO2 | 40 | 125 | 350 | μg/m³ |
| CO | 10 | 30 | 60 | mg/m³ |
| Turbidity | 1 | 4 | 10 | NTU |
| pH | 6.5 | 6.0 | 5.5 | pH |
| Dissolved Oxygen | 6 | 4 | 2 | mg/L |
| Noise | 55 | 70 | 85 | dB |

## API Usage

### Trend Analysis
```typescript
const trendAnalysis = await insightsEngine.analyzeTrend(
  { latitude: 40.7128, longitude: -74.0060 },
  5, // radius in km
  'pm2.5',
  { start: new Date('2024-01-01'), end: new Date('2024-01-07') }
);

console.log(trendAnalysis.trend.direction); // 'improving', 'worsening', or 'stable'
console.log(trendAnalysis.trend.confidence); // 0.0 to 1.0
console.log(trendAnalysis.healthImpact.riskLevel); // 'low', 'moderate', 'high', 'very_high'
```

### Correlation Analysis
```typescript
const correlationAnalysis = await insightsEngine.analyzeCorrelations(
  { latitude: 40.7128, longitude: -74.0060 },
  5,
  ['pm2.5', 'no2', 'o3'],
  { start: new Date('2024-01-01'), end: new Date('2024-01-07') }
);

correlationAnalysis.correlations.forEach(corr => {
  console.log(`${corr.pollutant1} vs ${corr.pollutant2}: ${corr.correlation}`);
  console.log(`Interpretation: ${corr.interpretation}`);
});
```

### Health Impact Assessment
```typescript
const healthImpact = await insightsEngine.assessHealthImpact(
  { latitude: 40.7128, longitude: -74.0060 },
  5,
  'pm2.5'
);

console.log(healthImpact.riskLevel); // Current risk level
console.log(healthImpact.recommendations); // Array of health recommendations
console.log(healthImpact.affectedPopulation); // Estimated affected population
```

## REST API Endpoints

### GET /api/insights/trends
Analyze environmental trends for a specific location and pollutant.

**Query Parameters:**
- `lat`: Latitude (required)
- `lng`: Longitude (required)
- `radius`: Radius in km (default: 5)
- `pollutant`: Pollutant type (required)
- `start`: Start date (ISO string, required)
- `end`: End date (ISO string, required)

**Example:**
```
GET /api/insights/trends?lat=40.7128&lng=-74.0060&pollutant=pm2.5&start=2024-01-01T00:00:00Z&end=2024-01-07T00:00:00Z
```

### GET /api/insights/correlations
Analyze correlations between different pollution sources.

**Query Parameters:**
- `lat`: Latitude (required)
- `lng`: Longitude (required)
- `radius`: Radius in km (default: 5)
- `pollutants`: Comma-separated list of pollutants (required, min 2)
- `start`: Start date (ISO string, required)
- `end`: End date (ISO string, required)

**Example:**
```
GET /api/insights/correlations?lat=40.7128&lng=-74.0060&pollutants=pm2.5,no2,o3&start=2024-01-01T00:00:00Z&end=2024-01-07T00:00:00Z
```

### GET /api/insights/health-impact
Assess health impact based on current pollution levels.

**Query Parameters:**
- `lat`: Latitude (required)
- `lng`: Longitude (required)
- `radius`: Radius in km (default: 5)
- `pollutant`: Pollutant type (required)

**Example:**
```
GET /api/insights/health-impact?lat=40.7128&lng=-74.0060&pollutant=pm2.5
```

### GET /api/insights/comprehensive
Get comprehensive insights including trends, correlations, and health impact.

**Query Parameters:**
- `lat`: Latitude (required)
- `lng`: Longitude (required)
- `radius`: Radius in km (default: 5)
- `pollutants`: Comma-separated list of pollutants (required)
- `start`: Start date (ISO string, required)
- `end`: End date (ISO string, required)

**Example:**
```
GET /api/insights/comprehensive?lat=40.7128&lng=-74.0060&pollutants=pm2.5,no2&start=2024-01-01T00:00:00Z&end=2024-01-07T00:00:00Z
```

## Error Handling

The Insights Engine provides comprehensive error handling:

- **Insufficient Data**: Throws error when less than 3 data points available for trend analysis
- **Invalid Pollutant**: Throws error for unsupported pollutant types
- **No Current Data**: Throws error when no recent data available for health assessment
- **Invalid Parameters**: Validates location coordinates, time ranges, and other parameters

## Testing

The engine includes comprehensive unit tests covering:
- Trend detection algorithms
- Correlation calculations
- Health impact assessments
- Error handling scenarios
- Edge cases and boundary conditions

Run tests with:
```bash
npm test -- --testPathPattern="InsightsEngine"
```

## Performance Considerations

- **Caching**: Results can be cached using Redis for frequently requested analyses
- **Batch Processing**: Supports bulk analysis for multiple locations/pollutants
- **Database Optimization**: Uses spatial indexes for efficient location-based queries
- **Async Processing**: All operations are asynchronous and non-blocking

## Future Enhancements

- Machine learning models for more sophisticated trend prediction
- Integration with weather data for enhanced correlation analysis
- Real-time streaming analysis for immediate insights
- Advanced statistical methods for uncertainty quantification
- Support for additional pollutant types and health standards