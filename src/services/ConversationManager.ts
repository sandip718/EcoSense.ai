// Conversation Manager for Multi-turn Interactions
// Implements requirement 6.3: Build conversation context management for multi-turn interactions

import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { 
  ChatConversation, 
  ChatMessage, 
  ConversationContext,
  ChatbotConfig
} from '../models/ChatbotTypes';
import { v4 as uuidv4 } from 'uuid';

export class ConversationManager {
  private redis = getRedisClient();
  
  private readonly config: ChatbotConfig = {
    max_conversation_length: 50,
    conversation_ttl_hours: 24,
    default_location_radius_km: 10,
    max_response_length: 500,
    enable_suggestions: true,
    fallback_responses: [
      "I'm not sure I understand. Could you ask about air quality, water quality, or environmental conditions?",
      "I can help you with environmental data and safety recommendations. What would you like to know?",
      "Try asking about current air quality, pollution levels, or if it's safe for outdoor activities."
    ],
    supported_languages: ['en']
  };

  /**
   * Get or create a conversation
   */
  async getOrCreateConversation(
    sessionId: string,
    userId?: string,
    initialContext?: Partial<ConversationContext>
  ): Promise<ChatConversation> {
    try {
      // Try to get existing conversation
      const existingConversation = await this.getConversation(sessionId);
      
      if (existingConversation) {
        // Update expiration time
        await this.extendConversationTTL(sessionId);
        return existingConversation;
      }

      // Create new conversation
      const conversationId = uuidv4();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.config.conversation_ttl_hours * 60 * 60 * 1000);

      const conversation: ChatConversation = {
        id: conversationId,
        user_id: userId,
        session_id: sessionId,
        context: {
          location: initialContext?.location,
          user_preferences: initialContext?.user_preferences || {},
          recent_queries: [],
          environmental_focus: [],
          conversation_state: {}
        },
        messages: [],
        created_at: now,
        updated_at: now,
        expires_at: expiresAt
      };

      await this.saveConversation(conversation);
      
      logger.info('Created new conversation', { 
        conversationId, 
        sessionId, 
        userId 
      });

      return conversation;

    } catch (error) {
      logger.error('Error getting or creating conversation:', error);
      throw error;
    }
  }

  /**
   * Get existing conversation by session ID
   */
  async getConversation(sessionId: string): Promise<ChatConversation | null> {
    try {
      const key = this.getConversationKey(sessionId);
      const data = await this.redis.get(key);
      
      if (!data) {
        return null;
      }

      const conversation = JSON.parse(data) as ChatConversation;
      
      // Convert date strings back to Date objects
      conversation.created_at = new Date(conversation.created_at);
      conversation.updated_at = new Date(conversation.updated_at);
      conversation.expires_at = new Date(conversation.expires_at);
      
      conversation.messages = conversation.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));

      return conversation;

    } catch (error) {
      logger.error('Error getting conversation:', error);
      return null;
    }
  }

  /**
   * Add message to conversation
   */
  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: ChatMessage['metadata']
  ): Promise<ChatMessage> {
    try {
      const conversation = await this.getOrCreateConversation(sessionId);
      
      const message: ChatMessage = {
        id: uuidv4(),
        conversation_id: conversation.id,
        role,
        content,
        timestamp: new Date(),
        metadata
      };

      // Add message to conversation
      conversation.messages.push(message);
      
      // Trim conversation if it's too long
      if (conversation.messages.length > this.config.max_conversation_length) {
        const messagesToKeep = this.config.max_conversation_length - 10; // Keep some buffer
        conversation.messages = conversation.messages.slice(-messagesToKeep);
      }

      // Update conversation metadata
      conversation.updated_at = new Date();
      
      // Update context based on message
      if (role === 'user') {
        this.updateContextFromUserMessage(conversation, content, metadata);
      }

      await this.saveConversation(conversation);
      
      logger.debug('Added message to conversation', {
        sessionId,
        role,
        messageLength: content.length,
        totalMessages: conversation.messages.length
      });

      return message;

    } catch (error) {
      logger.error('Error adding message to conversation:', error);
      throw error;
    }
  }

  /**
   * Update conversation context
   */
  async updateContext(
    sessionId: string,
    contextUpdate: Partial<ConversationContext>
  ): Promise<void> {
    try {
      const conversation = await this.getOrCreateConversation(sessionId);
      
      // Merge context updates
      conversation.context = {
        ...conversation.context,
        ...contextUpdate,
        user_preferences: {
          ...conversation.context.user_preferences,
          ...contextUpdate.user_preferences
        },
        conversation_state: {
          ...conversation.context.conversation_state,
          ...contextUpdate.conversation_state
        }
      };

      conversation.updated_at = new Date();
      await this.saveConversation(conversation);

      logger.debug('Updated conversation context', { sessionId, contextUpdate });

    } catch (error) {
      logger.error('Error updating conversation context:', error);
      throw error;
    }
  }

  /**
   * Get conversation context
   */
  async getContext(sessionId: string): Promise<ConversationContext | null> {
    try {
      const conversation = await this.getConversation(sessionId);
      return conversation?.context || null;
    } catch (error) {
      logger.error('Error getting conversation context:', error);
      return null;
    }
  }

  /**
   * Get recent messages for context
   */
  async getRecentMessages(sessionId: string, count: number = 5): Promise<ChatMessage[]> {
    try {
      const conversation = await this.getConversation(sessionId);
      
      if (!conversation) {
        return [];
      }

      return conversation.messages.slice(-count);

    } catch (error) {
      logger.error('Error getting recent messages:', error);
      return [];
    }
  }

  /**
   * Clear conversation
   */
  async clearConversation(sessionId: string): Promise<void> {
    try {
      const key = this.getConversationKey(sessionId);
      await this.redis.del(key);
      
      logger.info('Cleared conversation', { sessionId });

    } catch (error) {
      logger.error('Error clearing conversation:', error);
      throw error;
    }
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(sessionId: string): Promise<{
    messageCount: number;
    duration: number;
    lastActivity: Date;
    userQueries: number;
    assistantResponses: number;
  } | null> {
    try {
      const conversation = await this.getConversation(sessionId);
      
      if (!conversation) {
        return null;
      }

      const userMessages = conversation.messages.filter(m => m.role === 'user');
      const assistantMessages = conversation.messages.filter(m => m.role === 'assistant');
      
      const duration = conversation.updated_at.getTime() - conversation.created_at.getTime();

      return {
        messageCount: conversation.messages.length,
        duration,
        lastActivity: conversation.updated_at,
        userQueries: userMessages.length,
        assistantResponses: assistantMessages.length
      };

    } catch (error) {
      logger.error('Error getting conversation stats:', error);
      return null;
    }
  }

  /**
   * Private helper methods
   */

  private getConversationKey(sessionId: string): string {
    return `conversation:${sessionId}`;
  }

  private async saveConversation(conversation: ChatConversation): Promise<void> {
    const key = this.getConversationKey(conversation.session_id);
    const ttlSeconds = this.config.conversation_ttl_hours * 60 * 60;
    
    await this.redis.setEx(key, ttlSeconds, JSON.stringify(conversation));
  }

  private async extendConversationTTL(sessionId: string): Promise<void> {
    const key = this.getConversationKey(sessionId);
    const ttlSeconds = this.config.conversation_ttl_hours * 60 * 60;
    
    await this.redis.expire(key, ttlSeconds);
  }

  private updateContextFromUserMessage(
    conversation: ChatConversation,
    content: string,
    metadata?: ChatMessage['metadata']
  ): void {
    // Update recent queries
    if (!conversation.context.recent_queries) {
      conversation.context.recent_queries = [];
    }
    
    conversation.context.recent_queries.push(content);
    
    // Keep only last 10 queries
    if (conversation.context.recent_queries.length > 10) {
      conversation.context.recent_queries = conversation.context.recent_queries.slice(-10);
    }

    // Update location if provided in metadata
    if (metadata?.location) {
      conversation.context.location = metadata.location;
    }

    // Update environmental focus based on intent
    if (metadata?.intent) {
      if (!conversation.context.environmental_focus) {
        conversation.context.environmental_focus = [];
      }
      
      // Track what types of environmental data the user asks about
      const environmentalIntents = ['current_conditions', 'safety_check', 'trends', 'recommendations'];
      if (environmentalIntents.includes(metadata.intent)) {
        conversation.context.environmental_focus.push(metadata.intent);
        
        // Keep only last 5 focus areas
        if (conversation.context.environmental_focus.length > 5) {
          conversation.context.environmental_focus = conversation.context.environmental_focus.slice(-5);
        }
      }
    }

    // Reset conversation state flags
    if (conversation.context.conversation_state) {
      conversation.context.conversation_state.awaiting_location = false;
      conversation.context.conversation_state.awaiting_clarification = false;
    }
  }

  /**
   * Check if conversation needs location
   */
  needsLocation(context: ConversationContext): boolean {
    return !context.location || 
           !context.location.latitude || 
           !context.location.longitude;
  }

  /**
   * Generate follow-up suggestions based on conversation context
   */
  generateSuggestions(context: ConversationContext): string[] {
    const suggestions: string[] = [];

    if (!this.config.enable_suggestions) {
      return suggestions;
    }

    // Location-based suggestions
    if (!context.location) {
      suggestions.push("Share your location for personalized environmental data");
    }

    // Based on recent queries
    const recentQueries = context.recent_queries || [];
    const hasAskedAboutAir = recentQueries.some(q => 
      q.toLowerCase().includes('air') || q.toLowerCase().includes('pollution')
    );
    
    if (!hasAskedAboutAir) {
      suggestions.push("Check current air quality");
    }

    // Based on environmental focus
    const focus = context.environmental_focus || [];
    if (!focus.includes('safety_check')) {
      suggestions.push("Is it safe for outdoor activities?");
    }

    if (!focus.includes('trends')) {
      suggestions.push("Show environmental trends");
    }

    if (!focus.includes('recommendations')) {
      suggestions.push("Get environmental improvement recommendations");
    }

    // Limit suggestions
    return suggestions.slice(0, 3);
  }

  /**
   * Get fallback response when intent is unclear
   */
  getFallbackResponse(): string {
    const responses = this.config.fallback_responses;
    return responses[Math.floor(Math.random() * responses.length)];
  }
}

export const conversationManager = new ConversationManager();