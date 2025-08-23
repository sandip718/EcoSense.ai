// Tests for Chatbot API Routes
import request from 'supertest';
import express from 'express';
import chatbotRoutes from '../chatbot';
import { chatbotService } from '../../services/ChatbotService';
import { conversationManager } from '../../services/ConversationManager';

// Mock services
jest.mock('../../services/ChatbotService');
jest.mock('../../services/ConversationManager');
jest.mock('../../utils/logger');

const app = express();
app.use(express.json());
app.use('/api/chatbot', chatbotRoutes);

const mockChatbotService = chatbotService as jest.Mocked<typeof chatbotService>;
const mockConversationManager = conversationManager as jest.Mocked<typeof conversationManager>;

describe('Chatbot API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/chatbot/chat', () => {
    it('should process chat message successfully', async () => {
      const mockResponse = {
        message: 'The current air quality is moderate.',
        conversation_id: 'conv-123',
        message_id: 'msg-456',
        intent: 'current_conditions',
        confidence: 0.9,
        suggestions: ['Is it safe to go outside?'],
        data_sources: ['openaq'],
        location_used: { latitude: 40.7128, longitude: -74.0060 },
        response_metadata: {
          processing_time_ms: 150,
          data_freshness: 'fresh',
          fallback_used: false
        }
      };

      mockChatbotService.processChat.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/chatbot/chat')
        .send({
          message: 'What is the air quality?',
          session_id: 'test-session',
          location: { latitude: 40.7128, longitude: -74.0060 }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResponse);
      expect(mockChatbotService.processChat).toHaveBeenCalledWith({
        message: 'What is the air quality?',
        session_id: 'test-session',
        location: { latitude: 40.7128, longitude: -74.0060 },
        conversation_id: undefined,
        user_id: undefined,
        context: undefined
      });
    });

    it('should return 400 for missing message', async () => {
      const response = await request(app)
        .post('/api/chatbot/chat')
        .send({
          session_id: 'test-session'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_MESSAGE');
    });

    it('should return 400 for empty message', async () => {
      const response = await request(app)
        .post('/api/chatbot/chat')
        .send({
          message: '   ',
          session_id: 'test-session'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_MESSAGE');
    });

    it('should return 400 for message too long', async () => {
      const longMessage = 'a'.repeat(1001);
      
      const response = await request(app)
        .post('/api/chatbot/chat')
        .send({
          message: longMessage,
          session_id: 'test-session'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MESSAGE_TOO_LONG');
    });

    it('should return 400 for invalid location', async () => {
      const response = await request(app)
        .post('/api/chatbot/chat')
        .send({
          message: 'What is the air quality?',
          session_id: 'test-session',
          location: { latitude: 'invalid', longitude: -74.0060 }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_LOCATION');
    });

    it('should handle service errors gracefully', async () => {
      mockChatbotService.processChat.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .post('/api/chatbot/chat')
        .send({
          message: 'What is the air quality?',
          session_id: 'test-session'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CHAT_PROCESSING_ERROR');
    });
  });

  describe('GET /api/chatbot/conversation/:sessionId', () => {
    it('should return conversation history', async () => {
      const mockConversation = {
        id: 'conv-123',
        session_id: 'test-session',
        user_id: 'user-123',
        context: { location: { latitude: 40.7128, longitude: -74.0060 } },
        messages: [
          {
            id: 'msg-1',
            conversation_id: 'conv-123',
            role: 'user',
            content: 'Hello',
            timestamp: new Date(),
            metadata: {}
          }
        ],
        created_at: new Date(),
        updated_at: new Date(),
        expires_at: new Date()
      };

      mockConversationManager.getConversation.mockResolvedValue(mockConversation);

      const response = await request(app)
        .get('/api/chatbot/conversation/test-session');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('conv-123');
      expect(response.body.data.messages).toHaveLength(1);
    });

    it('should return 404 for non-existent conversation', async () => {
      mockConversationManager.getConversation.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/chatbot/conversation/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONVERSATION_NOT_FOUND');
    });

    it('should limit messages when requested', async () => {
      const messages = Array.from({ length: 30 }, (_, i) => ({
        id: `msg-${i}`,
        conversation_id: 'conv-123',
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: new Date(),
        metadata: {}
      }));

      const mockConversation = {
        id: 'conv-123',
        session_id: 'test-session',
        user_id: 'user-123',
        context: {},
        messages,
        created_at: new Date(),
        updated_at: new Date(),
        expires_at: new Date()
      };

      mockConversationManager.getConversation.mockResolvedValue(mockConversation);

      const response = await request(app)
        .get('/api/chatbot/conversation/test-session?limit=10');

      expect(response.status).toBe(200);
      expect(response.body.data.messages).toHaveLength(10);
    });
  });

  describe('PUT /api/chatbot/conversation/:sessionId/context', () => {
    it('should update conversation context', async () => {
      mockConversationManager.updateContext.mockResolvedValue();

      const contextUpdate = {
        location: { latitude: 40.7128, longitude: -74.0060 },
        user_preferences: { units: 'metric' }
      };

      const response = await request(app)
        .put('/api/chatbot/conversation/test-session/context')
        .send(contextUpdate);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockConversationManager.updateContext).toHaveBeenCalledWith('test-session', contextUpdate);
    });

    it('should return 400 for invalid location in context', async () => {
      const contextUpdate = {
        location: { latitude: 'invalid', longitude: -74.0060 }
      };

      const response = await request(app)
        .put('/api/chatbot/conversation/test-session/context')
        .send(contextUpdate);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_LOCATION');
    });
  });

  describe('DELETE /api/chatbot/conversation/:sessionId', () => {
    it('should clear conversation', async () => {
      mockChatbotService.clearConversation.mockResolvedValue();

      const response = await request(app)
        .delete('/api/chatbot/conversation/test-session');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockChatbotService.clearConversation).toHaveBeenCalledWith('test-session');
    });
  });

  describe('GET /api/chatbot/conversation/:sessionId/stats', () => {
    it('should return conversation statistics', async () => {
      const mockStats = {
        messageCount: 10,
        duration: 300000,
        lastActivity: new Date(),
        userQueries: 5,
        assistantResponses: 5
      };

      mockChatbotService.getConversationStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/chatbot/conversation/test-session/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
    });

    it('should return 404 for non-existent conversation stats', async () => {
      mockChatbotService.getConversationStats.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/chatbot/conversation/non-existent/stats');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONVERSATION_NOT_FOUND');
    });
  });

  describe('POST /api/chatbot/quick-query', () => {
    it('should process quick query successfully', async () => {
      const mockResponse = {
        message: 'The air quality is good.',
        conversation_id: 'quick_123',
        message_id: 'msg-456',
        intent: 'current_conditions',
        confidence: 0.9,
        suggestions: [],
        data_sources: ['openaq'],
        location_used: { latitude: 40.7128, longitude: -74.0060 },
        response_metadata: {
          processing_time_ms: 100,
          data_freshness: 'fresh',
          fallback_used: false
        }
      };

      mockChatbotService.processChat.mockResolvedValue(mockResponse);
      mockChatbotService.clearConversation.mockResolvedValue();

      const response = await request(app)
        .post('/api/chatbot/quick-query')
        .send({
          query: 'What is the air quality?',
          location: { latitude: 40.7128, longitude: -74.0060 }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('The air quality is good.');
      expect(mockChatbotService.clearConversation).toHaveBeenCalled();
    });

    it('should return 400 for missing query', async () => {
      const response = await request(app)
        .post('/api/chatbot/quick-query')
        .send({
          location: { latitude: 40.7128, longitude: -74.0060 }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_QUERY');
    });

    it('should return 400 for missing location', async () => {
      const response = await request(app)
        .post('/api/chatbot/quick-query')
        .send({
          query: 'What is the air quality?'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_LOCATION');
    });
  });

  describe('GET /api/chatbot/health', () => {
    it('should return healthy status', async () => {
      const mockResponse = {
        message: 'Hello! I can help with environmental information.',
        conversation_id: 'health_123',
        message_id: 'msg-456',
        intent: 'greeting',
        confidence: 0.9,
        suggestions: [],
        data_sources: ['template'],
        response_metadata: {
          processing_time_ms: 50,
          fallback_used: false
        }
      };

      mockChatbotService.processChat.mockResolvedValue(mockResponse);
      mockChatbotService.clearConversation.mockResolvedValue();

      const response = await request(app)
        .get('/api/chatbot/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.services).toBeDefined();
    });

    it('should return unhealthy status on service error', async () => {
      mockChatbotService.processChat.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/chatbot/health');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SERVICE_UNHEALTHY');
    });
  });
});