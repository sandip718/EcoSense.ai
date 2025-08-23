// Chatbot API Routes
// Implements requirement 6.4: Create integration endpoints for chatbot widget in web dashboard

import { Router, Request, Response } from 'express';
import { chatbotService } from '../services/ChatbotService';
import { conversationManager } from '../services/ConversationManager';
import { logger } from '../utils/logger';
import { validateLocation } from '../utils/validation';
import { ApiResponse } from '../models/types';
import { ChatRequest, ChatResponse, ConversationContext } from '../models/ChatbotTypes';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * POST /api/chatbot/chat
 * Main chat endpoint for processing user messages
 */
router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      message,
      conversation_id,
      session_id,
      user_id,
      location,
      context
    } = req.body;

    // Validate required fields
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MESSAGE',
          message: 'Message is required and must be a non-empty string'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    // Validate message length
    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MESSAGE_TOO_LONG',
          message: 'Message must be less than 1000 characters'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    // Validate location if provided
    if (location && !validateLocation(location)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: 'Invalid location format. Latitude and longitude must be valid numbers'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    // Build chat request
    const chatRequest: ChatRequest = {
      message: message.trim(),
      conversation_id,
      session_id: session_id || uuidv4(),
      user_id,
      location,
      context
    };

    logger.info('Processing chat request', {
      messageLength: chatRequest.message.length,
      hasLocation: !!chatRequest.location,
      sessionId: chatRequest.session_id,
      userId: chatRequest.user_id
    });

    // Process chat request
    const chatResponse = await chatbotService.processChat(chatRequest);

    res.json({
      success: true,
      data: chatResponse,
      timestamp: new Date()
    } as ApiResponse<ChatResponse>);

  } catch (error) {
    logger.error('Error processing chat request:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    res.status(500).json({
      success: false,
      error: {
        code: 'CHAT_PROCESSING_ERROR',
        message: errorMessage
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * GET /api/chatbot/conversation/:sessionId
 * Get conversation history
 */
router.get('/conversation/:sessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { limit = 20 } = req.query;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SESSION_ID',
          message: 'Valid session ID is required'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    const conversation = await conversationManager.getConversation(sessionId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: 'Conversation not found'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    // Limit messages if requested
    const limitNum = parseInt(limit as string) || 20;
    const messages = conversation.messages.slice(-limitNum);

    const conversationData = {
      id: conversation.id,
      session_id: conversation.session_id,
      user_id: conversation.user_id,
      messages,
      context: conversation.context,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at
    };

    res.json({
      success: true,
      data: conversationData,
      timestamp: new Date()
    } as ApiResponse<typeof conversationData>);

  } catch (error) {
    logger.error('Error getting conversation:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'CONVERSATION_FETCH_ERROR',
        message: 'Failed to retrieve conversation'
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * PUT /api/chatbot/conversation/:sessionId/context
 * Update conversation context
 */
router.put('/conversation/:sessionId/context', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const contextUpdate = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SESSION_ID',
          message: 'Valid session ID is required'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    // Validate location in context if provided
    if (contextUpdate.location && !validateLocation(contextUpdate.location)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: 'Invalid location format in context'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    await conversationManager.updateContext(sessionId, contextUpdate);

    res.json({
      success: true,
      data: { message: 'Context updated successfully' },
      timestamp: new Date()
    } as ApiResponse<{ message: string }>);

  } catch (error) {
    logger.error('Error updating conversation context:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'CONTEXT_UPDATE_ERROR',
        message: 'Failed to update conversation context'
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * DELETE /api/chatbot/conversation/:sessionId
 * Clear conversation history
 */
router.delete('/conversation/:sessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SESSION_ID',
          message: 'Valid session ID is required'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    await chatbotService.clearConversation(sessionId);

    res.json({
      success: true,
      data: { message: 'Conversation cleared successfully' },
      timestamp: new Date()
    } as ApiResponse<{ message: string }>);

  } catch (error) {
    logger.error('Error clearing conversation:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'CONVERSATION_CLEAR_ERROR',
        message: 'Failed to clear conversation'
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * GET /api/chatbot/conversation/:sessionId/stats
 * Get conversation statistics
 */
router.get('/conversation/:sessionId/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SESSION_ID',
          message: 'Valid session ID is required'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    const stats = await chatbotService.getConversationStats(sessionId);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: 'Conversation not found'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    res.json({
      success: true,
      data: stats,
      timestamp: new Date()
    } as ApiResponse<typeof stats>);

  } catch (error) {
    logger.error('Error getting conversation stats:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'STATS_FETCH_ERROR',
        message: 'Failed to retrieve conversation statistics'
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * POST /api/chatbot/quick-query
 * Quick environmental query without conversation context
 * Useful for simple one-off questions
 */
router.post('/quick-query', async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, location } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Query is required and must be a non-empty string'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    if (!location || !validateLocation(location)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: 'Valid location is required for quick queries'
        },
        timestamp: new Date()
      } as ApiResponse<null>);
    }

    // Create a temporary session for the quick query
    const tempSessionId = `quick_${uuidv4()}`;
    
    const chatRequest: ChatRequest = {
      message: query.trim(),
      session_id: tempSessionId,
      location,
      context: {
        location
      }
    };

    const chatResponse = await chatbotService.processChat(chatRequest);

    // Clean up the temporary conversation
    await chatbotService.clearConversation(tempSessionId);

    res.json({
      success: true,
      data: {
        message: chatResponse.message,
        intent: chatResponse.intent,
        confidence: chatResponse.confidence,
        data_sources: chatResponse.data_sources,
        location_used: chatResponse.location_used,
        response_metadata: chatResponse.response_metadata
      },
      timestamp: new Date()
    } as ApiResponse<Partial<ChatResponse>>);

  } catch (error) {
    logger.error('Error processing quick query:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'QUICK_QUERY_ERROR',
        message: 'Failed to process quick query'
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

/**
 * GET /api/chatbot/health
 * Health check endpoint for chatbot service
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    // Test basic functionality
    const testSessionId = `health_check_${Date.now()}`;
    const testRequest: ChatRequest = {
      message: 'hello',
      session_id: testSessionId
    };

    const testResponse = await chatbotService.processChat(testRequest);
    
    // Clean up test conversation
    await chatbotService.clearConversation(testSessionId);

    const health = {
      status: 'healthy',
      timestamp: new Date(),
      services: {
        nlp: 'operational',
        conversation_manager: 'operational',
        environmental_query: 'operational'
      },
      test_response_time_ms: testResponse.response_metadata?.processing_time_ms || 0
    };

    res.json({
      success: true,
      data: health,
      timestamp: new Date()
    } as ApiResponse<typeof health>);

  } catch (error) {
    logger.error('Chatbot health check failed:', error);
    
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNHEALTHY',
        message: 'Chatbot service is not functioning properly'
      },
      timestamp: new Date()
    } as ApiResponse<null>);
  }
});

export default router;