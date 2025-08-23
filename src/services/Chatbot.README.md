# Chatbot API and Conversational Interface

This document describes the implementation of the chatbot API and conversational interface for EcoSense.ai, which provides natural language access to environmental data and recommendations.

## Overview

The chatbot system consists of several interconnected components that work together to provide intelligent, context-aware responses to user queries about environmental conditions:

- **Natural Language Processor**: Analyzes user messages to extract intent and entities
- **Conversation Manager**: Handles multi-turn conversations and context management
- **Environmental Query Service**: Processes environmental data queries with location awareness
- **Chatbot Service**: Orchestrates all components to generate responses
- **API Routes**: Provides REST endpoints for frontend integration

## Architecture

```
User Message → NLP → Intent/Entities → Environmental Query → Response Generation
     ↓                                        ↓
Conversation Context ←→ Context Management ←→ Data Sources
```

## Components

### 1. Natural Language Processor (`NaturalLanguageProcessor.ts`)

**Purpose**: Analyzes user messages to understand intent and extract relevant entities.

**Key Features**:
- Intent classification (greeting, current_conditions, safety_check, trends, recommendations, help)
- Entity extraction (location, pollutant, time, activity, health_condition)
- Confidence scoring
- Query type determination

**Example Usage**:
```typescript
const result = await naturalLanguageProcessor.processMessage(
  "Is it safe to run outside?",
  conversationContext
);
// Result: { intent: 'safety_check', query_type: 'safety', requires_location: true, ... }
```

### 2. Conversation Manager (`ConversationManager.ts`)

**Purpose**: Manages conversation state, context, and message history across multiple interactions.

**Key Features**:
- Conversation creation and retrieval
- Message history management
- Context updates and persistence
- Suggestion generation
- Automatic conversation cleanup

**Example Usage**:
```typescript
const conversation = await conversationManager.getOrCreateConversation(
  sessionId,
  userId,
  { location: userLocation }
);

await conversationManager.addMessage(sessionId, 'user', 'What is the air quality?');
```

### 3. Environmental Query Service (`EnvironmentalQueryService.ts`)

**Purpose**: Processes environmental queries and generates location-aware responses using current data.

**Key Features**:
- Current conditions retrieval
- Safety assessments for activities
- Trend analysis
- Community recommendations
- Health impact evaluation

**Example Usage**:
```typescript
const query = {
  location: { latitude: 40.7128, longitude: -74.0060 },
  query_type: 'current_conditions',
  pollutants: ['pm2.5']
};

const response = await environmentalQueryService.processQuery(query);
```

### 4. Chatbot Service (`ChatbotService.ts`)

**Purpose**: Main orchestrator that coordinates all components to process chat requests and generate responses.

**Key Features**:
- Request processing and validation
- Component orchestration
- Response formatting
- Error handling and fallbacks
- Template-based responses

**Example Usage**:
```typescript
const chatRequest = {
  message: "What's the air quality like?",
  session_id: "user-session-123",
  location: { latitude: 40.7128, longitude: -74.0060 }
};

const response = await chatbotService.processChat(chatRequest);
```

## API Endpoints

### Chat Processing

#### `POST /api/chatbot/chat`
Process a chat message and return a response.

**Request Body**:
```json
{
  "message": "What is the current air quality?",
  "session_id": "optional-session-id",
  "user_id": "optional-user-id",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "New York, NY"
  },
  "context": {
    "user_preferences": {
      "units": "metric"
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "The current air quality in your area is moderate with PM2.5 levels at 25 μg/m³.",
    "conversation_id": "conv-123",
    "message_id": "msg-456",
    "intent": "current_conditions",
    "confidence": 0.92,
    "suggestions": [
      "Is it safe for outdoor activities?",
      "Show me air quality trends"
    ],
    "data_sources": ["openaq", "local_sensors"],
    "location_used": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "response_metadata": {
      "processing_time_ms": 150,
      "data_freshness": "fresh",
      "fallback_used": false
    }
  }
}
```

### Conversation Management

#### `GET /api/chatbot/conversation/:sessionId`
Retrieve conversation history.

#### `PUT /api/chatbot/conversation/:sessionId/context`
Update conversation context.

#### `DELETE /api/chatbot/conversation/:sessionId`
Clear conversation history.

#### `GET /api/chatbot/conversation/:sessionId/stats`
Get conversation statistics.

### Quick Queries

#### `POST /api/chatbot/quick-query`
Process a one-off query without conversation context.

**Request Body**:
```json
{
  "query": "Is the air quality safe for running?",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  }
}
```

### Health Check

#### `GET /api/chatbot/health`
Check chatbot service health and functionality.

## Supported Intents

### 1. Greeting
- **Triggers**: "hello", "hi", "good morning"
- **Response**: Welcome message with available features
- **Location Required**: No

### 2. Current Conditions
- **Triggers**: "current air quality", "pollution levels", "what's the air like"
- **Response**: Real-time environmental data for user's location
- **Location Required**: Yes

### 3. Safety Check
- **Triggers**: "safe to run", "safe outside", "outdoor activities"
- **Response**: Safety assessment based on current conditions and activity
- **Location Required**: Yes

### 4. Trends
- **Triggers**: "trends", "getting better", "compared to yesterday"
- **Response**: Historical analysis and trend information
- **Location Required**: Yes

### 5. Recommendations
- **Triggers**: "what should I do", "recommendations", "improve air quality"
- **Response**: Community-specific action recommendations
- **Location Required**: Yes

### 6. Help
- **Triggers**: "help", "what can you do", "commands"
- **Response**: Feature overview and usage instructions
- **Location Required**: No

## Entity Types

### Location
- **Examples**: "in New York", "near me", "around downtown"
- **Processing**: Extracted for geocoding (future enhancement)

### Pollutant
- **Examples**: "PM2.5", "ozone", "air quality", "water quality"
- **Processing**: Mapped to specific pollutant types

### Time
- **Examples**: "now", "today", "yesterday", "this week"
- **Processing**: Converted to date ranges

### Activity
- **Examples**: "running", "cycling", "walking", "exercise"
- **Processing**: Used for safety risk assessment

### Health Condition
- **Examples**: "asthma", "allergies", "respiratory", "pregnant"
- **Processing**: Adjusts risk calculations and recommendations

## Context Management

The conversation manager maintains context across interactions:

### User Context
- **Location**: Current or preferred location
- **Preferences**: Units, language, activity types
- **Health Conditions**: Conditions affecting environmental sensitivity

### Conversation State
- **Recent Queries**: Last 10 user messages
- **Environmental Focus**: Types of data user is interested in
- **Awaiting Information**: Flags for missing required data

### Session Management
- **TTL**: 24 hours by default
- **Message Limit**: 50 messages per conversation
- **Auto-cleanup**: Expired conversations are automatically removed

## Error Handling

### Input Validation
- Message length limits (1000 characters)
- Location coordinate validation
- Required field checking

### Service Errors
- Graceful degradation when data sources are unavailable
- Fallback responses for processing failures
- Retry logic for transient errors

### User Experience
- Clear error messages
- Suggested alternatives
- Help guidance for unclear requests

## Performance Considerations

### Caching
- Environmental data cached for 5 minutes
- Conversation context cached in Redis
- Response templates cached in memory

### Rate Limiting
- Per-session rate limiting (future enhancement)
- API endpoint throttling
- Resource usage monitoring

### Scalability
- Stateless service design
- Redis-based session storage
- Horizontal scaling support

## Testing

### Unit Tests
- Natural language processing accuracy
- Conversation management functionality
- Environmental query processing
- API endpoint validation

### Integration Tests
- End-to-end conversation flows
- Data source integration
- Error handling scenarios

### Performance Tests
- Response time benchmarks
- Concurrent user handling
- Memory usage monitoring

## Usage Examples

### Basic Air Quality Query
```
User: "What's the air quality like?"
Bot: "The current air quality in your area is moderate with PM2.5 levels at 25 μg/m³. This is acceptable for most people, but sensitive individuals may experience minor issues."
```

### Safety Assessment
```
User: "Is it safe to go running?"
Bot: "For running, conditions are currently moderate risk. PM2.5 levels are at 25 μg/m³. Consider reducing intensity and taking frequent breaks. Monitor how you feel during exercise."
```

### Trend Analysis
```
User: "How has air quality been trending?"
Bot: "PM2.5 levels are improving by 15% over the past week. This is good news for air quality in your area. Conditions have been generally stable with occasional moderate periods."
```

### Recommendations
```
User: "What can I do to help improve air quality?"
Bot: "I found 3 recommendations for your area. 2 are high priority: 1) Support local clean transportation initiatives 2) Reduce vehicle idling in your neighborhood. These actions have high feasibility and estimated impact."
```

## Future Enhancements

### Planned Features
- Multi-language support
- Voice input/output integration
- Personalized learning from user interactions
- Integration with calendar for activity planning
- Weather correlation analysis

### Technical Improvements
- Advanced NLP models (transformer-based)
- Geocoding service integration
- Real-time data streaming
- Machine learning for response optimization
- Advanced analytics and insights

## Configuration

### Environment Variables
```bash
CHATBOT_MAX_CONVERSATION_LENGTH=50
CHATBOT_CONVERSATION_TTL_HOURS=24
CHATBOT_DEFAULT_RADIUS_KM=10
CHATBOT_MAX_RESPONSE_LENGTH=500
CHATBOT_ENABLE_SUGGESTIONS=true
```

### Redis Configuration
- Conversation storage: `conversation:{sessionId}`
- TTL management: Automatic expiration
- Memory optimization: Compressed JSON storage

## Monitoring and Analytics

### Metrics Tracked
- Response times
- Intent classification accuracy
- User satisfaction (implicit)
- Data source availability
- Error rates

### Logging
- All user interactions (anonymized)
- System performance metrics
- Error details and stack traces
- Data source response times

This chatbot implementation provides a comprehensive, scalable solution for natural language interaction with environmental data, supporting the EcoSense.ai platform's goal of making environmental information accessible to everyone.