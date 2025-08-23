// Main Chatbot Service
// Orchestrates NLP, conversation management, and environmental queries
// Implements requirements 6.1, 6.2, 6.3, 6.4, 6.5

import { logger } from '../utils/logger';
import { naturalLanguageProcessor } from './NaturalLanguageProcessor';
import { conversationManager } from './ConversationManager';
import { environmentalQueryService } from './EnvironmentalQueryService';
import { 
  ChatRequest, 
  ChatResponse, 
  ConversationContext,
  ResponseTemplate,
  Location
} from '../models/ChatbotTypes';
import { v4 as uuidv4 } from 'uuid';

export class ChatbotService {
  private readonly RESPONSE_TEMPLATES: Record<string, ResponseTemplate> = {
    greeting: {
      intent: 'greeting',
      templates: {
        success: [
          "Hello! I'm here to help you with environmental information. What would you like to know about air quality, water quality, or environmental conditions in your area?",
          "Hi there! I can provide real-time environmental data and safety recommendations. How can I help you today?",
          "Welcome! Ask me about pollution levels, air quality, or if it's safe for outdoor activities in your area."
        ],
        no_data: [],
        error: []
      },
      requires_data: false,
      follow_up_questions: [
        "What's the current air quality?",
        "Is it safe to go outside?",
        "Show me environmental trends"
      ]
    },
    help: {
      intent: 'help',
      templates: {
        success: [
          "I can help you with:\n• Current air and water quality\n• Safety for outdoor activities\n• Environmental trends and forecasts\n• Recommendations for improving local conditions\n\nJust ask me questions like 'What's the air quality?' or 'Is it safe to run outside?'",
          "Here's what I can do:\n• Check current pollution levels\n• Assess safety for activities like running, cycling, or walking\n• Show environmental trends over time\n• Provide community recommendations\n\nTry asking about air quality or outdoor activity safety!"
        ],
        no_data: [],
        error: []
      },
      requires_data: false
    },
    location_request: {
      intent: 'location_request',
      templates: {
        success: [
          "I need your location to provide accurate environmental data. You can share your current location or tell me a city/address.",
          "To give you personalized environmental information, please share your location or tell me which area you're interested in.",
          "I can provide better recommendations if you share your location. Where are you located?"
        ],
        no_data: [],
        error: []
      },
      requires_data: false
    },
    no_data: {
      intent: 'no_data',
      templates: {
        success: [],
        no_data: [
          "I don't have environmental data for your location right now. This could be due to limited sensor coverage in your area.",
          "Sorry, I couldn't find recent environmental data for your location. You might want to try a nearby city or check back later.",
          "Environmental data isn't available for your specific location at the moment. Try asking about a nearby urban area."
        ],
        error: []
      },
      requires_data: false
    },
    error: {
      intent: 'error',
      templates: {
        success: [],
        no_data: [],
        error: [
          "I'm having trouble accessing environmental data right now. Please try again in a few minutes.",
          "Something went wrong while getting environmental information. Please try your request again.",
          "I encountered an error processing your request. Please try rephrasing your question or try again later."
        ]
      },
      requires_data: false
    }
  };

  /**
   * Process chat request and generate response
   */
  async processChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      logger.info('Processing chat request', {
        messageLength: request.message.length,
        hasLocation: !!request.location,
        conversationId: request.conversation_id,
        sessionId: request.session_id
      });

      // Get or create conversation
      const sessionId = request.session_id || uuidv4();
      const conversation = await conversationManager.getOrCreateConversation(
        sessionId,
        request.user_id,
        {
          location: request.location,
          user_preferences: request.context?.user_preferences
        }
      );

      // Add user message to conversation
      const userMessage = await conversationManager.addMessage(
        sessionId,
        'user',
        request.message,
        {
          location: request.location
        }
      );

      // Process message with NLP
      const nlpResult = await naturalLanguageProcessor.processMessage(
        request.message,
        conversation.context
      );

      // Update conversation context with intent
      await conversationManager.updateContext(sessionId, {
        conversation_state: {
          last_intent: nlpResult.intent
        }
      });

      // Generate response based on intent and context
      const response = await this.generateResponse(
        nlpResult,
        conversation.context,
        request.location
      );

      // Add assistant message to conversation
      await conversationManager.addMessage(
        sessionId,
        'assistant',
        response.message,
        {
          intent: nlpResult.intent,
          confidence: nlpResult.confidence,
          data_sources: response.data_sources,
          response_time_ms: Date.now() - startTime
        }
      );

      // Generate suggestions for follow-up
      const suggestions = conversationManager.generateSuggestions(conversation.context);

      const chatResponse: ChatResponse = {
        message: response.message,
        conversation_id: conversation.id,
        message_id: uuidv4(),
        intent: nlpResult.intent,
        confidence: nlpResult.confidence,
        suggestions: response.suggestions || suggestions,
        data_sources: response.data_sources,
        location_used: response.location_used,
        response_metadata: {
          processing_time_ms: Date.now() - startTime,
          data_freshness: response.data_freshness,
          fallback_used: response.fallback_used
        }
      };

      logger.info('Chat response generated', {
        intent: nlpResult.intent,
        confidence: nlpResult.confidence,
        processingTime: chatResponse.response_metadata.processing_time_ms,
        dataSources: response.data_sources.length
      });

      return chatResponse;

    } catch (error) {
      logger.error('Error processing chat request:', error);
      
      const errorResponse = this.generateErrorResponse(request.session_id || uuidv4());
      
      return {
        ...errorResponse,
        response_metadata: {
          processing_time_ms: Date.now() - startTime,
          fallback_used: true
        }
      };
    }
  }

  /**
   * Generate response based on NLP result and context
   */
  private async generateResponse(
    nlpResult: any,
    context: ConversationContext,
    requestLocation?: Location
  ): Promise<{
    message: string;
    suggestions?: string[];
    data_sources: string[];
    location_used?: Location;
    data_freshness?: string;
    fallback_used?: boolean;
  }> {
    
    // Handle greeting
    if (nlpResult.intent === 'greeting') {
      return this.generateTemplateResponse('greeting');
    }

    // Handle help requests
    if (nlpResult.intent === 'help') {
      return this.generateTemplateResponse('help');
    }

    // Check if location is required but not available
    const location = this.resolveLocation(nlpResult, context, requestLocation);
    if (nlpResult.requires_location && !location) {
      return this.generateTemplateResponse('location_request');
    }

    // Handle environmental queries
    if (nlpResult.query_type && location) {
      return await this.handleEnvironmentalQuery(nlpResult, location, context);
    }

    // Handle location queries
    if (nlpResult.intent === 'location_query') {
      return this.handleLocationQuery(context);
    }

    // Fallback for unknown intents
    return this.generateFallbackResponse();
  }

  /**
   * Handle environmental data queries
   */
  private async handleEnvironmentalQuery(
    nlpResult: any,
    location: Location,
    context: ConversationContext
  ): Promise<{
    message: string;
    suggestions?: string[];
    data_sources: string[];
    location_used: Location;
    data_freshness?: string;
    fallback_used?: boolean;
  }> {
    
    try {
      // Build environmental query
      const environmentalQuery = naturalLanguageProcessor.buildEnvironmentalQuery(
        nlpResult,
        location,
        context
      );

      // Process the query
      const queryResponse = await environmentalQueryService.processQuery(environmentalQuery);

      if (!queryResponse.data || (Array.isArray(queryResponse.data) && queryResponse.data.length === 0)) {
        return {
          message: this.getRandomTemplate('no_data', 'no_data'),
          data_sources: [],
          location_used: location,
          fallback_used: true
        };
      }

      // Format response message
      let message = queryResponse.summary;

      // Add recommendations if available
      if (queryResponse.recommendations && queryResponse.recommendations.length > 0) {
        message += '\n\nRecommendations:\n• ' + queryResponse.recommendations.slice(0, 3).join('\n• ');
      }

      // Add health impact if available
      if (queryResponse.health_impact) {
        message += `\n\nHealth Impact: ${queryResponse.health_impact.description}`;
        
        if (queryResponse.health_impact.precautions && queryResponse.health_impact.precautions.length > 0) {
          message += '\n\nPrecautions:\n• ' + queryResponse.health_impact.precautions.slice(0, 2).join('\n• ');
        }
      }

      // Generate follow-up suggestions
      const suggestions = this.generateFollowUpSuggestions(nlpResult.query_type, context);

      // Calculate data freshness
      const dataFreshness = this.calculateDataFreshness(queryResponse.last_updated);

      return {
        message,
        suggestions,
        data_sources: queryResponse.data_sources,
        location_used: location,
        data_freshness: dataFreshness,
        fallback_used: false
      };

    } catch (error) {
      logger.error('Error handling environmental query:', error);
      
      return {
        message: this.getRandomTemplate('error', 'error'),
        data_sources: [],
        location_used: location,
        fallback_used: true
      };
    }
  }

  /**
   * Handle location-related queries
   */
  private handleLocationQuery(context: ConversationContext): {
    message: string;
    data_sources: string[];
    fallback_used?: boolean;
  } {
    
    if (context.location) {
      const message = `I'm currently using your location at approximately ${context.location.latitude.toFixed(3)}, ${context.location.longitude.toFixed(3)}${context.location.address ? ` (${context.location.address})` : ''}. You can ask me about environmental conditions for this area or provide a different location.`;
      
      return {
        message,
        data_sources: ['user_context'],
        fallback_used: false
      };
    } else {
      return {
        message: "I don't have your location yet. Please share your current location or tell me which city or area you'd like environmental information for.",
        data_sources: [],
        fallback_used: false
      };
    }
  }

  /**
   * Resolve location from various sources
   */
  private resolveLocation(
    nlpResult: any,
    context: ConversationContext,
    requestLocation?: Location
  ): Location | null {
    
    // Priority order: request location, location entities, context location
    if (requestLocation) {
      return requestLocation;
    }

    // Check for location entities in the message
    const locationEntities = nlpResult.entities?.filter((e: any) => e.type === 'location');
    if (locationEntities && locationEntities.length > 0) {
      // For now, we'll need geocoding service to convert location names to coordinates
      // This is a simplified implementation
      logger.debug('Location entity found but geocoding not implemented:', locationEntities[0].value);
    }

    // Use context location
    if (context.location) {
      return context.location;
    }

    return null;
  }

  /**
   * Generate template-based response
   */
  private generateTemplateResponse(templateKey: string): {
    message: string;
    suggestions?: string[];
    data_sources: string[];
    fallback_used?: boolean;
  } {
    
    const template = this.RESPONSE_TEMPLATES[templateKey];
    if (!template) {
      return this.generateFallbackResponse();
    }

    const message = this.getRandomTemplate(templateKey, 'success');
    
    return {
      message,
      suggestions: template.follow_up_questions,
      data_sources: ['template'],
      fallback_used: false
    };
  }

  /**
   * Generate fallback response
   */
  private generateFallbackResponse(): {
    message: string;
    suggestions?: string[];
    data_sources: string[];
    fallback_used: boolean;
  } {
    
    const message = conversationManager.getFallbackResponse();
    
    return {
      message,
      suggestions: [
        "What's the current air quality?",
        "Is it safe to go outside?",
        "Show me environmental trends"
      ],
      data_sources: ['fallback'],
      fallback_used: true
    };
  }

  /**
   * Generate error response
   */
  private generateErrorResponse(sessionId: string): ChatResponse {
    return {
      message: this.getRandomTemplate('error', 'error'),
      conversation_id: sessionId,
      message_id: uuidv4(),
      intent: 'error',
      confidence: 0,
      suggestions: [
        "Try asking about air quality",
        "Check if it's safe for outdoor activities",
        "Get environmental recommendations"
      ],
      data_sources: ['error_handler']
    };
  }

  /**
   * Generate follow-up suggestions based on query type
   */
  private generateFollowUpSuggestions(queryType: string, context: ConversationContext): string[] {
    const suggestions: string[] = [];

    switch (queryType) {
      case 'current_conditions':
        suggestions.push("Is it safe for outdoor activities?");
        suggestions.push("Show me environmental trends");
        suggestions.push("Get improvement recommendations");
        break;
      
      case 'safety':
        suggestions.push("What are the current pollution levels?");
        suggestions.push("Show me air quality trends");
        suggestions.push("When will conditions improve?");
        break;
      
      case 'trends':
        suggestions.push("What's the current air quality?");
        suggestions.push("Get safety recommendations");
        suggestions.push("How can we improve conditions?");
        break;
      
      case 'recommendations':
        suggestions.push("What's the current air quality?");
        suggestions.push("Is it safe to go outside?");
        suggestions.push("Show me recent trends");
        break;
      
      default:
        suggestions.push("Check current air quality");
        suggestions.push("Is it safe for activities?");
        suggestions.push("Show environmental trends");
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Get random template message
   */
  private getRandomTemplate(templateKey: string, type: 'success' | 'no_data' | 'error'): string {
    const template = this.RESPONSE_TEMPLATES[templateKey];
    if (!template || !template.templates[type] || template.templates[type].length === 0) {
      return conversationManager.getFallbackResponse();
    }

    const templates = template.templates[type];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Calculate data freshness description
   */
  private calculateDataFreshness(lastUpdated: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - lastUpdated.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 5) return 'very fresh';
    if (diffMins < 30) return 'fresh';
    if (diffMins < 120) return 'recent';
    return 'older data';
  }

  /**
   * Clear conversation history
   */
  async clearConversation(sessionId: string): Promise<void> {
    await conversationManager.clearConversation(sessionId);
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(sessionId: string) {
    return await conversationManager.getConversationStats(sessionId);
  }
}

export const chatbotService = new ChatbotService();