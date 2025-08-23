// Chatbot API types and interfaces
// Implements requirements 6.1, 6.2, 6.3, 6.4, 6.5

import { Location } from './types';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    location?: Location;
    intent?: string;
    confidence?: number;
    data_sources?: string[];
    response_time_ms?: number;
  };
}

export interface ChatConversation {
  id: string;
  user_id?: string;
  session_id: string;
  context: ConversationContext;
  messages: ChatMessage[];
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
}

export interface ConversationContext {
  location?: Location;
  user_preferences?: {
    units?: 'metric' | 'imperial';
    language?: string;
    activity_types?: string[];
    health_conditions?: string[];
  };
  recent_queries?: string[];
  environmental_focus?: string[]; // pollutants user is most interested in
  conversation_state?: {
    awaiting_location?: boolean;
    awaiting_clarification?: boolean;
    last_intent?: string;
    follow_up_context?: any;
  };
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  session_id?: string;
  user_id?: string;
  location?: Location;
  context?: Partial<ConversationContext>;
}

export interface ChatResponse {
  message: string;
  conversation_id: string;
  message_id: string;
  intent?: string;
  confidence?: number;
  suggestions?: string[];
  data_sources?: string[];
  location_used?: Location;
  response_metadata?: {
    processing_time_ms: number;
    data_freshness?: string;
    fallback_used?: boolean;
  };
}

export interface Intent {
  name: string;
  confidence: number;
  entities?: Entity[];
}

export interface Entity {
  type: 'location' | 'pollutant' | 'time' | 'activity' | 'health_condition';
  value: string;
  confidence: number;
  resolved_value?: any;
}

export interface EnvironmentalQuery {
  location: Location;
  pollutants?: string[];
  time_range?: {
    start?: Date;
    end?: Date;
    relative?: string; // 'now', 'today', 'this_week', etc.
  };
  query_type: 'current_conditions' | 'forecast' | 'trends' | 'safety' | 'recommendations';
  activity_context?: string;
}

export interface QueryResponse {
  data: any;
  summary: string;
  recommendations?: string[];
  health_impact?: {
    risk_level: 'low' | 'moderate' | 'high' | 'very_high';
    description: string;
    precautions?: string[];
  };
  data_sources: string[];
  last_updated: Date;
}

export interface IntentClassificationResult {
  intent: string;
  confidence: number;
  entities: Entity[];
  requires_location: boolean;
  query_type?: 'current_conditions' | 'forecast' | 'trends' | 'safety' | 'recommendations';
}

export interface ResponseTemplate {
  intent: string;
  templates: {
    success: string[];
    no_data: string[];
    error: string[];
    follow_up?: string[];
  };
  requires_data: boolean;
  follow_up_questions?: string[];
}

export interface ChatbotConfig {
  max_conversation_length: number;
  conversation_ttl_hours: number;
  default_location_radius_km: number;
  max_response_length: number;
  enable_suggestions: boolean;
  fallback_responses: string[];
  supported_languages: string[];
}