// Natural Language Processing Service for Environmental Queries
// Implements requirement 6.1: Create natural language processing service for environmental queries

import { logger } from '../utils/logger';
import { 
  Intent, 
  Entity, 
  IntentClassificationResult, 
  ConversationContext,
  EnvironmentalQuery,
  Location
} from '../models/ChatbotTypes';

export class NaturalLanguageProcessor {
  private readonly POLLUTANT_KEYWORDS = {
    'air_quality': ['air', 'smog', 'pollution', 'pm2.5', 'pm10', 'ozone', 'no2', 'so2', 'co'],
    'water_quality': ['water', 'turbidity', 'contamination', 'ph', 'dissolved oxygen', 'bacteria'],
    'noise': ['noise', 'sound', 'decibel', 'loud', 'quiet']
  };

  private readonly INTENT_PATTERNS = {
    'current_conditions': [
      /what.*current.*air.*quality/i,
      /how.*air.*today/i,
      /current.*pollution/i,
      /air.*quality.*now/i,
      /what.*pollution.*level/i,
      /is.*air.*safe/i,
      /current.*environmental.*conditions/i
    ],
    'safety_check': [
      /safe.*outside/i,
      /safe.*run/i,
      /safe.*walk/i,
      /safe.*exercise/i,
      /should.*go.*outside/i,
      /is.*it.*safe/i,
      /can.*i.*jog/i,
      /outdoor.*activities/i
    ],
    'trends': [
      /trend/i,
      /getting.*better/i,
      /getting.*worse/i,
      /improving/i,
      /deteriorating/i,
      /compared.*yesterday/i,
      /compared.*last.*week/i,
      /historical/i
    ],
    'recommendations': [
      /what.*should.*do/i,
      /recommend/i,
      /advice/i,
      /suggest/i,
      /help.*improve/i,
      /action/i,
      /reduce.*pollution/i
    ],
    'location_query': [
      /where.*am.*i/i,
      /my.*location/i,
      /change.*location/i,
      /different.*location/i,
      /near.*me/i
    ],
    'greeting': [
      /hello/i,
      /hi/i,
      /hey/i,
      /good.*morning/i,
      /good.*afternoon/i,
      /good.*evening/i
    ],
    'help': [
      /help/i,
      /what.*can.*you.*do/i,
      /how.*does.*this.*work/i,
      /commands/i,
      /features/i
    ]
  };

  private readonly LOCATION_PATTERNS = [
    /in\s+([a-zA-Z\s,]+)/i,
    /at\s+([a-zA-Z\s,]+)/i,
    /near\s+([a-zA-Z\s,]+)/i,
    /around\s+([a-zA-Z\s,]+)/i
  ];

  private readonly TIME_PATTERNS = {
    'now': /now|current|currently|right now/i,
    'today': /today|this morning|this afternoon|this evening/i,
    'yesterday': /yesterday/i,
    'this_week': /this week|past week/i,
    'this_month': /this month|past month/i
  };

  private readonly ACTIVITY_KEYWORDS = [
    'running', 'jogging', 'walking', 'cycling', 'hiking', 'exercise', 'workout',
    'outdoor', 'picnic', 'sports', 'children', 'kids', 'elderly', 'asthma'
  ];

  /**
   * Process user message and extract intent, entities, and context
   */
  async processMessage(
    message: string, 
    context?: ConversationContext
  ): Promise<IntentClassificationResult> {
    try {
      const normalizedMessage = message.toLowerCase().trim();
      
      // Classify intent
      const intent = this.classifyIntent(normalizedMessage);
      
      // Extract entities
      const entities = this.extractEntities(normalizedMessage, context);
      
      // Determine if location is required
      const requiresLocation = this.requiresLocation(intent, entities);
      
      // Determine query type
      const queryType = this.determineQueryType(intent, entities);

      logger.debug('NLP processing result', {
        message: message.substring(0, 100),
        intent,
        entities: entities.length,
        requiresLocation,
        queryType
      });

      return {
        intent,
        confidence: this.calculateConfidence(intent, entities, normalizedMessage),
        entities,
        requires_location: requiresLocation,
        query_type: queryType
      };

    } catch (error) {
      logger.error('Error processing message:', error);
      
      return {
        intent: 'unknown',
        confidence: 0,
        entities: [],
        requires_location: false
      };
    }
  }

  /**
   * Classify the intent of the user message
   */
  private classifyIntent(message: string): string {
    let bestIntent = 'unknown';
    let maxMatches = 0;

    for (const [intent, patterns] of Object.entries(this.INTENT_PATTERNS)) {
      const matches = patterns.filter(pattern => pattern.test(message)).length;
      
      if (matches > maxMatches) {
        maxMatches = matches;
        bestIntent = intent;
      }
    }

    // If no pattern matches, try keyword-based classification
    if (bestIntent === 'unknown') {
      bestIntent = this.classifyByKeywords(message);
    }

    return bestIntent;
  }

  /**
   * Classify intent based on keywords when patterns don't match
   */
  private classifyByKeywords(message: string): string {
    const words = message.split(/\s+/);
    
    // Check for pollutant mentions
    const hasPollutantKeywords = Object.values(this.POLLUTANT_KEYWORDS)
      .flat()
      .some(keyword => message.includes(keyword));
    
    // Check for activity keywords
    const hasActivityKeywords = this.ACTIVITY_KEYWORDS
      .some(keyword => message.includes(keyword));
    
    // Check for question words
    const hasQuestionWords = /what|how|is|can|should|when|where/.test(message);
    
    if (hasPollutantKeywords && hasQuestionWords) {
      if (hasActivityKeywords) {
        return 'safety_check';
      }
      return 'current_conditions';
    }
    
    if (hasActivityKeywords && hasQuestionWords) {
      return 'safety_check';
    }
    
    return 'general_inquiry';
  }

  /**
   * Extract entities from the message
   */
  private extractEntities(message: string, context?: ConversationContext): Entity[] {
    const entities: Entity[] = [];

    // Extract location entities
    const locationEntities = this.extractLocationEntities(message);
    entities.push(...locationEntities);

    // Extract pollutant entities
    const pollutantEntities = this.extractPollutantEntities(message);
    entities.push(...pollutantEntities);

    // Extract time entities
    const timeEntities = this.extractTimeEntities(message);
    entities.push(...timeEntities);

    // Extract activity entities
    const activityEntities = this.extractActivityEntities(message);
    entities.push(...activityEntities);

    // Extract health condition entities
    const healthEntities = this.extractHealthEntities(message);
    entities.push(...healthEntities);

    return entities;
  }

  /**
   * Extract location entities from message
   */
  private extractLocationEntities(message: string): Entity[] {
    const entities: Entity[] = [];

    for (const pattern of this.LOCATION_PATTERNS) {
      const match = message.match(pattern);
      if (match && match[1]) {
        entities.push({
          type: 'location',
          value: match[1].trim(),
          confidence: 0.8
        });
      }
    }

    return entities;
  }

  /**
   * Extract pollutant entities from message
   */
  private extractPollutantEntities(message: string): Entity[] {
    const entities: Entity[] = [];

    for (const [pollutantType, keywords] of Object.entries(this.POLLUTANT_KEYWORDS)) {
      for (const keyword of keywords) {
        if (message.includes(keyword)) {
          entities.push({
            type: 'pollutant',
            value: keyword,
            confidence: 0.9,
            resolved_value: pollutantType
          });
        }
      }
    }

    return entities;
  }

  /**
   * Extract time entities from message
   */
  private extractTimeEntities(message: string): Entity[] {
    const entities: Entity[] = [];

    for (const [timeType, pattern] of Object.entries(this.TIME_PATTERNS)) {
      if (pattern.test(message)) {
        entities.push({
          type: 'time',
          value: timeType,
          confidence: 0.9,
          resolved_value: this.resolveTimeValue(timeType)
        });
      }
    }

    return entities;
  }

  /**
   * Extract activity entities from message
   */
  private extractActivityEntities(message: string): Entity[] {
    const entities: Entity[] = [];

    for (const activity of this.ACTIVITY_KEYWORDS) {
      if (message.includes(activity)) {
        entities.push({
          type: 'activity',
          value: activity,
          confidence: 0.8
        });
      }
    }

    return entities;
  }

  /**
   * Extract health condition entities from message
   */
  private extractHealthEntities(message: string): Entity[] {
    const entities: Entity[] = [];
    const healthKeywords = ['asthma', 'copd', 'allergies', 'respiratory', 'heart', 'pregnant', 'elderly', 'children'];

    for (const condition of healthKeywords) {
      if (message.includes(condition)) {
        entities.push({
          type: 'health_condition',
          value: condition,
          confidence: 0.8
        });
      }
    }

    return entities;
  }

  /**
   * Determine if the intent requires location information
   */
  private requiresLocation(intent: string, entities: Entity[]): boolean {
    const locationRequiredIntents = [
      'current_conditions',
      'safety_check',
      'trends',
      'recommendations'
    ];

    // Always require location for these intents
    if (locationRequiredIntents.includes(intent)) {
      return true;
    }

    // Check if location entity is present
    const hasLocationEntity = entities.some(entity => entity.type === 'location');
    
    return hasLocationEntity;
  }

  /**
   * Determine the query type based on intent and entities
   */
  private determineQueryType(intent: string, entities: Entity[]): 'current_conditions' | 'forecast' | 'trends' | 'safety' | 'recommendations' | undefined {
    switch (intent) {
      case 'current_conditions':
        return 'current_conditions';
      case 'safety_check':
        return 'safety';
      case 'trends':
        return 'trends';
      case 'recommendations':
        return 'recommendations';
      default:
        // Try to infer from entities
        const hasTimeEntity = entities.some(e => e.type === 'time');
        const hasActivityEntity = entities.some(e => e.type === 'activity');
        
        if (hasActivityEntity) {
          return 'safety';
        }
        
        if (hasTimeEntity) {
          const timeEntity = entities.find(e => e.type === 'time');
          if (timeEntity?.value === 'now') {
            return 'current_conditions';
          }
          return 'trends';
        }
        
        return 'current_conditions';
    }
  }

  /**
   * Calculate confidence score for the classification
   */
  private calculateConfidence(intent: string, entities: Entity[], message: string): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence if intent was matched by patterns
    if (intent !== 'unknown' && intent !== 'general_inquiry') {
      confidence += 0.3;
    }

    // Increase confidence based on number of entities
    confidence += Math.min(entities.length * 0.1, 0.3);

    // Increase confidence if message is clear and specific
    if (message.length > 10 && message.includes('?')) {
      confidence += 0.1;
    }

    // Decrease confidence for very short or unclear messages
    if (message.length < 5) {
      confidence -= 0.2;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Resolve time value to actual date range
   */
  private resolveTimeValue(timeType: string): { start?: Date; end?: Date } {
    const now = new Date();
    
    switch (timeType) {
      case 'now':
        return { start: now, end: now };
      
      case 'today':
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        return { start: todayStart, end: todayEnd };
      
      case 'yesterday':
        const yesterdayStart = new Date(now);
        yesterdayStart.setDate(now.getDate() - 1);
        yesterdayStart.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(now);
        yesterdayEnd.setDate(now.getDate() - 1);
        yesterdayEnd.setHours(23, 59, 59, 999);
        return { start: yesterdayStart, end: yesterdayEnd };
      
      case 'this_week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        return { start: weekStart, end: now };
      
      case 'this_month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: monthStart, end: now };
      
      default:
        return {};
    }
  }

  /**
   * Build environmental query from processed intent and entities
   */
  buildEnvironmentalQuery(
    result: IntentClassificationResult,
    location: Location,
    context?: ConversationContext
  ): EnvironmentalQuery {
    const query: EnvironmentalQuery = {
      location,
      query_type: result.query_type || 'current_conditions'
    };

    // Add pollutants from entities
    const pollutantEntities = result.entities.filter(e => e.type === 'pollutant');
    if (pollutantEntities.length > 0) {
      query.pollutants = pollutantEntities.map(e => e.resolved_value || e.value);
    }

    // Add time range from entities
    const timeEntities = result.entities.filter(e => e.type === 'time');
    if (timeEntities.length > 0) {
      const timeEntity = timeEntities[0];
      if (timeEntity.resolved_value) {
        query.time_range = timeEntity.resolved_value;
      }
    }

    // Add activity context
    const activityEntities = result.entities.filter(e => e.type === 'activity');
    if (activityEntities.length > 0) {
      query.activity_context = activityEntities[0].value;
    }

    return query;
  }
}

export const naturalLanguageProcessor = new NaturalLanguageProcessor();