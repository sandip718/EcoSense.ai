# Community Recommendation System

The Community Recommendation System is a core component of EcoSense.ai that analyzes local environmental conditions and generates actionable recommendations for community-level environmental improvements. This system implements requirements 4.1, 4.2, 4.3, and 4.4 from the EcoSense.ai specification.

## Overview

The system consists of several key components:

- **CommunityRecommendationService**: Main service class that implements the recommendation engine
- **CommunityRecommendationRepository**: Database operations for storing and retrieving recommendations
- **Recommendation Templates**: Pre-defined action templates for different pollution scenarios
- **Prioritization Algorithm**: Intelligent ranking based on impact, feasibility, and urgency
- **Community Profile Integration**: Adjusts recommendations based on local community characteristics

## Features

### 1. Environmental Condition Analysis (Requirement 4.1)

The system analyzes current environmental conditions and generates location-specific recommendations:

```typescript
const input: RecommendationAnalysisInput = {
  location: { latitude: 40.7128, longitude: -74.0060 },
  radius_km: 10,
  current_conditions: [
    {
      pollutant: 'pm2.5',
      value: 55.8, // High PM2.5 level
      unit: 'μg/m³',
      timestamp: new Date(),
      // ... other fields
    }
  ],
  community_profile: {
    population_density: 10000,
    economic_level: 'high',
    infrastructure_quality: 'good',
    environmental_awareness: 75
  }
};

const recommendations = await service.generateRecommendations(input);
```

### 2. Action Prioritization Algorithm (Requirement 4.2)

Recommendations are prioritized based on multiple factors:

- **Impact Score** (0-100): Expected environmental improvement
- **Feasibility Score** (0-100): Likelihood of successful implementation
- **Priority Level**: urgent, high, medium, low
- **Category**: immediate_action, long_term_strategy, monitoring

```typescript
// Priority calculation considers:
// - Pollution severity (very_high → urgent priority)
// - Community economic level (affects feasibility)
// - Infrastructure quality (affects implementation)
// - Environmental awareness (affects community engagement)
```

### 3. Location-Specific Remediation Strategies (Requirement 4.3)

The system generates targeted strategies based on:

- **Pollutant Type**: Air quality, water quality, noise pollution
- **Pollution Severity**: Low, moderate, high, very high
- **Geographic Context**: Urban vs. rural, population density
- **Community Resources**: Economic level, infrastructure quality

#### Air Quality Recommendations

For high PM2.5 levels:
- **Immediate Actions**: Stay indoors, use air purifiers, wear masks
- **Long-term Strategies**: Advocate for emission controls, plant trees, promote clean transportation

For high NO2 levels:
- **Immediate Actions**: Avoid traffic areas, use alternative routes
- **Long-term Strategies**: Support electric vehicle infrastructure, improve public transit

#### Water Quality Recommendations

For high turbidity:
- **Immediate Actions**: Use bottled water, install filters, avoid swimming
- **Long-term Strategies**: Watershed cleanup, erosion control, discharge regulations

For low dissolved oxygen:
- **Immediate Actions**: Report to authorities, document impacts
- **Long-term Strategies**: Reduce nutrient pollution, install aeration, restore vegetation

### 4. Database Operations (Requirement 4.4)

Comprehensive database operations for recommendation management:

```typescript
// Create recommendation
const recommendation = await repository.create(newRecommendation);

// Query by location and filters
const results = await repository.findMany({
  location: { latitude: 40.7128, longitude: -74.0060, radius_km: 10 },
  priority: ['high', 'urgent'],
  category: ['immediate_action'],
  active_only: true
});

// Update recommendation
const updated = await repository.update(id, { priority: 'urgent' });

// Delete recommendation
const deleted = await repository.delete(id);
```

## API Endpoints

### GET /api/recommendations

Retrieve recommendations with optional filtering:

```bash
# Get recommendations for a location
GET /api/recommendations?lat=40.7128&lng=-74.0060&radius=10&priority=high&active_only=true

# Get recommendations by category
GET /api/recommendations?category=immediate_action&limit=5
```

### POST /api/recommendations/generate

Generate new recommendations for current conditions:

```bash
POST /api/recommendations/generate
Content-Type: application/json

{
  "location": { "latitude": 40.7128, "longitude": -74.0060 },
  "radius_km": 10,
  "current_conditions": [
    {
      "pollutant": "pm2.5",
      "value": 55.8,
      "unit": "μg/m³",
      "timestamp": "2024-01-01T12:00:00Z",
      "location": { "latitude": 40.7128, "longitude": -74.0060 },
      "source": "openaq",
      "quality_grade": "A"
    }
  ],
  "community_profile": {
    "population_density": 10000,
    "economic_level": "high",
    "infrastructure_quality": "good",
    "environmental_awareness": 75
  }
}
```

### GET /api/recommendations/:id

Get a specific recommendation by ID:

```bash
GET /api/recommendations/rec-123
```

### PUT /api/recommendations/:id

Update a recommendation:

```bash
PUT /api/recommendations/rec-123
Content-Type: application/json

{
  "priority": "urgent",
  "title": "Updated Title"
}
```

### DELETE /api/recommendations/:id

Delete a recommendation:

```bash
DELETE /api/recommendations/rec-123
```

## Database Schema

The system uses a PostgreSQL table with PostGIS for geospatial operations:

```sql
CREATE TABLE community_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location GEOMETRY(POINT, 4326) NOT NULL,
    radius DECIMAL(8,2) NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    category VARCHAR(30) NOT NULL CHECK (category IN ('immediate_action', 'long_term_strategy', 'monitoring')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    steps TEXT[] NOT NULL,
    estimated_impact INTEGER NOT NULL CHECK (estimated_impact >= 0 AND estimated_impact <= 100),
    feasibility_score INTEGER NOT NULL CHECK (feasibility_score >= 0 AND feasibility_score <= 100),
    target_pollutants TEXT[] NOT NULL,
    estimated_cost TEXT,
    time_to_implement TEXT,
    success_metrics TEXT[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);
```

## Configuration

The service can be configured with custom parameters:

```typescript
const service = new CommunityRecommendationService({
  max_recommendations_per_location: 10,
  recommendation_expiry_days: 30,
  min_impact_threshold: 50,
  min_feasibility_threshold: 30
});
```

## Testing

Comprehensive test suites are provided:

```bash
# Run service tests
npm test src/services/__tests__/CommunityRecommendationService.test.ts

# Run API route tests
npm test src/routes/__tests__/recommendations.test.ts

# Run all recommendation system tests
npm test -- --testPathPattern="recommendation"
```

## Examples

See `src/services/examples/community-recommendation-example.ts` for detailed usage examples including:

- Generating recommendations for air pollution scenarios
- Handling water quality issues
- Querying existing recommendations
- Demonstrating prioritization algorithms
- Community profile impact analysis

## Error Handling

The system includes comprehensive error handling:

- **Validation Errors**: Invalid input parameters
- **Database Errors**: Connection issues, constraint violations
- **Service Errors**: External API failures, processing errors
- **Not Found Errors**: Missing recommendations or resources

All errors are logged and return structured error responses:

```typescript
{
  "success": false,
  "error": {
    "code": "INVALID_LOCATION",
    "message": "Invalid location coordinates",
    "details": { "latitude": 91 }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Performance Considerations

- **Spatial Indexing**: PostGIS GIST indexes for efficient location queries
- **Caching**: Redis caching for frequently accessed recommendations
- **Pagination**: Limit result sets to prevent memory issues
- **Batch Processing**: Efficient bulk operations for multiple recommendations

## Integration Points

The Community Recommendation System integrates with:

- **InsightsEngine**: For health impact assessments and trend analysis
- **EnvironmentalDataRepository**: For current pollution data
- **NotificationService**: For alerting users about new recommendations
- **UserRepository**: For personalized recommendations based on user preferences

## Future Enhancements

Potential improvements include:

- **Machine Learning**: Adaptive recommendation templates based on success rates
- **Community Feedback**: User ratings and effectiveness tracking
- **Seasonal Adjustments**: Time-based recommendation variations
- **Multi-language Support**: Localized recommendation content
- **Mobile Optimization**: Location-based push notifications for urgent recommendations