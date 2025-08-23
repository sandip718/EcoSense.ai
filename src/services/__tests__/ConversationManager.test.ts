// Tests for Conversation Manager
import { conversationManager } from '../ConversationManager';
import { getRedisClient } from '../../config/redis';

// Mock Redis
jest.mock('../../config/redis');
const mockRedis = {
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  scan: jest.fn(),
  info: jest.fn()
};
(getRedisClient as jest.Mock).mockReturnValue(mockRedis);

describe('ConversationManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateConversation', () => {
    it('should create new conversation when none exists', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setEx.mockResolvedValue('OK');

      const conversation = await conversationManager.getOrCreateConversation('test-session');

      expect(conversation).toBeDefined();
      expect(conversation.session_id).toBe('test-session');
      expect(conversation.messages).toEqual([]);
      expect(conversation.context).toBeDefined();
      expect(mockRedis.setEx).toHaveBeenCalled();
    });

    it('should return existing conversation', async () => {
      const existingConversation = {
        id: 'conv-123',
        session_id: 'test-session',
        user_id: 'user-123',
        context: { location: { latitude: 40.7128, longitude: -74.0060 } },
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingConversation));
      mockRedis.expire.mockResolvedValue(1);

      const conversation = await conversationManager.getOrCreateConversation('test-session');

      expect(conversation.id).toBe('conv-123');
      expect(conversation.session_id).toBe('test-session');
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('should include initial context when creating conversation', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setEx.mockResolvedValue('OK');

      const initialContext = {
        location: { latitude: 40.7128, longitude: -74.0060 },
        user_preferences: { units: 'metric' as const }
      };

      const conversation = await conversationManager.getOrCreateConversation(
        'test-session',
        'user-123',
        initialContext
      );

      expect(conversation.context.location).toEqual(initialContext.location);
      expect(conversation.context.user_preferences).toEqual(initialContext.user_preferences);
      expect(conversation.user_id).toBe('user-123');
    });
  });

  describe('addMessage', () => {
    it('should add user message to conversation', async () => {
      const existingConversation = {
        id: 'conv-123',
        session_id: 'test-session',
        context: { recent_queries: [] },
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingConversation));
      mockRedis.setEx.mockResolvedValue('OK');

      const message = await conversationManager.addMessage(
        'test-session',
        'user',
        'What is the air quality?'
      );

      expect(message.role).toBe('user');
      expect(message.content).toBe('What is the air quality?');
      expect(message.conversation_id).toBe('conv-123');
      expect(mockRedis.setEx).toHaveBeenCalled();
    });

    it('should add assistant message to conversation', async () => {
      const existingConversation = {
        id: 'conv-123',
        session_id: 'test-session',
        context: { recent_queries: [] },
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingConversation));
      mockRedis.setEx.mockResolvedValue('OK');

      const message = await conversationManager.addMessage(
        'test-session',
        'assistant',
        'The air quality is moderate.',
        {
          intent: 'current_conditions',
          confidence: 0.9,
          data_sources: ['openaq']
        }
      );

      expect(message.role).toBe('assistant');
      expect(message.content).toBe('The air quality is moderate.');
      expect(message.metadata?.intent).toBe('current_conditions');
      expect(message.metadata?.confidence).toBe(0.9);
    });

    it('should trim conversation when it gets too long', async () => {
      const longMessages = Array.from({ length: 60 }, (_, i) => ({
        id: `msg-${i}`,
        conversation_id: 'conv-123',
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: new Date().toISOString()
      }));

      const existingConversation = {
        id: 'conv-123',
        session_id: 'test-session',
        context: { recent_queries: [] },
        messages: longMessages,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingConversation));
      mockRedis.setEx.mockResolvedValue('OK');

      await conversationManager.addMessage('test-session', 'user', 'New message');

      // Verify that setEx was called with trimmed conversation
      const savedConversation = JSON.parse(mockRedis.setEx.mock.calls[0][2]);
      expect(savedConversation.messages.length).toBeLessThan(60);
    });
  });

  describe('updateContext', () => {
    it('should update conversation context', async () => {
      const existingConversation = {
        id: 'conv-123',
        session_id: 'test-session',
        context: { 
          location: { latitude: 40.7128, longitude: -74.0060 },
          user_preferences: {}
        },
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingConversation));
      mockRedis.setEx.mockResolvedValue('OK');

      const contextUpdate = {
        user_preferences: { units: 'imperial' as const },
        conversation_state: { last_intent: 'current_conditions' }
      };

      await conversationManager.updateContext('test-session', contextUpdate);

      const savedConversation = JSON.parse(mockRedis.setEx.mock.calls[0][2]);
      expect(savedConversation.context.user_preferences.units).toBe('imperial');
      expect(savedConversation.context.conversation_state.last_intent).toBe('current_conditions');
    });
  });

  describe('getRecentMessages', () => {
    it('should return recent messages', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i}`,
        conversation_id: 'conv-123',
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: new Date().toISOString()
      }));

      const existingConversation = {
        id: 'conv-123',
        session_id: 'test-session',
        context: {},
        messages,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingConversation));

      const recentMessages = await conversationManager.getRecentMessages('test-session', 5);

      expect(recentMessages).toHaveLength(5);
      expect(recentMessages[0].content).toBe('Message 5'); // Last 5 messages
    });

    it('should return empty array for non-existent conversation', async () => {
      mockRedis.get.mockResolvedValue(null);

      const recentMessages = await conversationManager.getRecentMessages('non-existent');

      expect(recentMessages).toEqual([]);
    });
  });

  describe('clearConversation', () => {
    it('should delete conversation from Redis', async () => {
      mockRedis.del.mockResolvedValue(1);

      await conversationManager.clearConversation('test-session');

      expect(mockRedis.del).toHaveBeenCalledWith('conversation:test-session');
    });
  });

  describe('generateSuggestions', () => {
    it('should generate location suggestion when no location', () => {
      const context = { recent_queries: [] };
      
      const suggestions = conversationManager.generateSuggestions(context);
      
      expect(suggestions).toContain('Share your location for personalized environmental data');
    });

    it('should generate air quality suggestion when not asked before', () => {
      const context = { 
        location: { latitude: 40.7128, longitude: -74.0060 },
        recent_queries: ['water quality'] 
      };
      
      const suggestions = conversationManager.generateSuggestions(context);
      
      expect(suggestions).toContain('Check current air quality');
    });

    it('should generate suggestions based on environmental focus', () => {
      const context = { 
        location: { latitude: 40.7128, longitude: -74.0060 },
        recent_queries: ['air quality'],
        environmental_focus: ['current_conditions']
      };
      
      const suggestions = conversationManager.generateSuggestions(context);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('needsLocation', () => {
    it('should return true when no location in context', () => {
      const context = {};
      
      const needsLocation = conversationManager.needsLocation(context);
      
      expect(needsLocation).toBe(true);
    });

    it('should return false when valid location in context', () => {
      const context = { 
        location: { latitude: 40.7128, longitude: -74.0060 }
      };
      
      const needsLocation = conversationManager.needsLocation(context);
      
      expect(needsLocation).toBe(false);
    });

    it('should return true when incomplete location in context', () => {
      const context = { 
        location: { latitude: 40.7128 } as any
      };
      
      const needsLocation = conversationManager.needsLocation(context);
      
      expect(needsLocation).toBe(true);
    });
  });
});