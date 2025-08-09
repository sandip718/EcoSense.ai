# Data Ingestion Service

The Data Ingestion Service is responsible for fetching environmental data from external APIs and publishing it to the message queue for downstream processing. This service implements requirements 1.1, 1.2, 1.3, and 7.1 from the EcoSense.ai specification.

## Architecture

The service consists of four main components:

1. **DataIngestionService** - Main orchestrator service
2. **OpenAQClient** - Client for OpenAQ air quality API
3. **WaterQualityPortalClient** - Client for Water Quality Portal API
4. **MessageQueuePublisher** - Publisher for processed environmental data

## Features

### Data Sources
- **OpenAQ API**: Real-time air quality measurements from government and research stations worldwide
- **Water Quality Portal**: Water quality data from USGS, EPA, and other monitoring organizations
- **Local Sensors**: Integration endpoints for local sensor data (future enhancement)

### Rate Limiting
- Configurable rate limits for each API to prevent exceeding quotas
- Automatic request throttling with intelligent queuing
- Exponential backoff retry logic for failed requests

### Data Validation
- Comprehensive validation of incoming data points
- Quality grade assignment based on data source reliability
- Geospatial coordinate validation
- Temporal data filtering (excludes stale data)

### Error Handling
- Exponential backoff retry logic for API failures
- Graceful degradation when external services are unavailable
- Detailed error logging and monitoring
- Circuit breaker pattern for external API calls

### Message Queue Integration
- Publishes processed data to RabbitMQ for downstream consumption
- Configurable exchange and routing key patterns
- Batch publishing support for high-volume scenarios
- Connection resilience with automatic reconnection

## Configuration

### Environment Variables

```bash
# OpenAQ API Configuration
OPENAQ_API_ENDPOINT=https://api.openaq.org
OPENAQ_API_KEY=your_api_key_here  # Optional
OPENAQ_RATE_LIMIT=60  # requests per minute

# Water Quality Portal Configuration
WQP_API_ENDPOINT=https://www.waterqualitydata.us
WQP_RATE_LIMIT=30  # requests per minute

# Message Queue Configuration
RABBITMQ_URL=amqp://localhost:5672
MQ_EXCHANGE_NAME=environmental_data
MQ_EXCHANGE_TYPE=topic
MQ_DURABLE=true
MQ_RECONNECT_DELAY=5000

# Scheduled Jobs
AIR_QUALITY_INTERVAL=0 * * * *  # Every hour
AIR_QUALITY_ENABLED=true
WATER_QUALITY_INTERVAL=0 * * * *  # Every hour
WATER_QUALITY_ENABLED=true
```

## Usage

### Basic Setup

```typescript
import { DataIngestionService } from './DataIngestionService';
import { MessageQueuePublisher } from './messaging/MessageQueuePublisher';
import { getDataIngestionConfig, getMessageQueueConfig } from '../config/dataIngestion';
import winston from 'winston';

// Create logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Load configurations
const dataIngestionConfig = getDataIngestionConfig();
const messageQueueConfig = getMessageQueueConfig();

// Create message publisher
const messagePublisher = new MessageQueuePublisher(messageQueueConfig, logger);
await messagePublisher.initialize();

// Create data ingestion service
const dataIngestionService = new DataIngestionService(
  dataIngestionConfig,
  logger,
  messagePublisher
);
```

### Ingesting Air Quality Data

```typescript
// Ingest air quality data for a specific location
const location = {
  latitude: 34.0522,
  longitude: -118.2437,
  radius: 25000 // 25km radius
};

const result = await dataIngestionService.ingestAirQualityData(location);

console.log(`Processed ${result.dataPointsProcessed} air quality measurements`);
```

### Ingesting Water Quality Data

```typescript
// Ingest water quality data
const result = await dataIngestionService.ingestWaterQualityData();

console.log(`Processed ${result.dataPointsProcessed} water quality measurements`);
```

### Ingesting All Sources

```typescript
// Ingest from all configured sources
const results = await dataIngestionService.ingestAllSources();

results.forEach(result => {
  console.log(`${result.source}: ${result.dataPointsProcessed} data points, ${result.errors.length} errors`);
});
```

### Health Monitoring

```typescript
// Check service health
const healthStatus = await dataIngestionService.getHealthStatus();

console.log(`Service status: ${healthStatus.status}`);
console.log(`OpenAQ healthy: ${healthStatus.services.openaq}`);
console.log(`Water Quality Portal healthy: ${healthStatus.services.waterQuality}`);
console.log(`Message Queue healthy: ${healthStatus.services.messageQueue}`);
```

## Data Flow

1. **Scheduled Trigger**: Cron jobs trigger data ingestion at configured intervals
2. **API Requests**: Service makes rate-limited requests to external APIs
3. **Data Validation**: Incoming data is validated and quality-graded
4. **Message Publishing**: Valid data points are published to message queue
5. **Error Handling**: Failed requests are retried with exponential backoff
6. **Health Monitoring**: Service health is continuously monitored

## Data Quality Grades

The service assigns quality grades to data based on source reliability:

- **Grade A**: Government agencies (USGS, EPA, state agencies)
- **Grade B**: Research institutions and reference-grade monitors
- **Grade C**: Community sensors and mobile monitors
- **Grade D**: Volunteer monitoring and unverified sources

## Message Queue Schema

Published messages follow this schema:

```typescript
{
  type: 'environmental_data',
  data: {
    source: 'openaq' | 'water_quality_portal' | 'local_sensor',
    pollutant: string,
    value: number,
    unit: string,
    location: {
      latitude: number,
      longitude: number,
      address?: string
    },
    timestamp: Date,
    quality_grade: 'A' | 'B' | 'C' | 'D'
  },
  metadata: {
    publishedAt: Date,
    messageId: string,
    source: string
  }
}
```

## Error Handling

The service implements comprehensive error handling:

### API Errors
- Network timeouts and connection failures
- Rate limit exceeded responses
- Invalid API responses
- Authentication failures

### Data Validation Errors
- Invalid coordinates or timestamps
- Missing required fields
- Out-of-range values
- Malformed data structures

### Message Queue Errors
- Connection failures
- Exchange/queue configuration issues
- Publishing failures
- Buffer overflow conditions

## Testing

### Unit Tests
```bash
npm test -- --testPathPattern="services.*test"
```

### Integration Tests
```bash
npm run test:integration
```

### Manual Testing
```bash
# Run integration test
ts-node src/services/integration-test.ts

# Test specific functionality
ts-node src/services/example-usage.ts
```

## Monitoring and Observability

### Metrics
- Data points processed per source
- API response times and error rates
- Message queue publish success rates
- Service health status

### Logging
- Structured JSON logging with correlation IDs
- Configurable log levels (debug, info, warn, error)
- Request/response logging for external APIs
- Performance metrics and timing data

### Alerts
- API health check failures
- High error rates or processing delays
- Message queue connection issues
- Data quality degradation

## Performance Considerations

### Rate Limiting
- OpenAQ: 60 requests/minute (configurable)
- Water Quality Portal: 30 requests/minute (configurable)
- Automatic throttling prevents quota exhaustion

### Batch Processing
- Support for batch publishing to message queue
- Configurable batch sizes for high-volume scenarios
- Memory-efficient streaming for large datasets

### Caching
- Response caching for frequently accessed data
- Location-based cache keys for geospatial queries
- TTL-based cache invalidation

## Future Enhancements

1. **Local Sensor Integration**: Direct integration with IoT sensors
2. **Real-time Streaming**: WebSocket connections for real-time data
3. **Data Fusion**: Combining multiple sources for improved accuracy
4. **Machine Learning**: Anomaly detection and data quality scoring
5. **Geographic Expansion**: Support for additional regional APIs

## Dependencies

- **amqplib**: RabbitMQ client for message publishing
- **winston**: Structured logging
- **joi**: Data validation
- **node-cron**: Scheduled job execution
- **pg**: PostgreSQL database client (for future persistence)

## Contributing

When contributing to the Data Ingestion Service:

1. Follow the existing code structure and patterns
2. Add comprehensive unit tests for new functionality
3. Update configuration documentation
4. Test with real API endpoints when possible
5. Monitor performance impact of changes