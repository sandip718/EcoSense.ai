// API Types for EcoSense.ai Mobile App
// Mirrors backend types for consistency

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface EnvironmentalDataPoint {
  id: string;
  source: 'openaq' | 'water_quality_portal' | 'local_sensor';
  pollutant: string;
  value: number;
  unit: string;
  location: Location;
  timestamp: Date;
  quality_grade: 'A' | 'B' | 'C' | 'D';
  created_at?: Date;
}

export interface UserProfile {
  id: string;
  email: string;
  location?: Location;
  preferences: UserPreferences;
  points: number;
  level: number;
  badges: string[];
  contribution_streak: number;
  created_at: Date;
  updated_at: Date;
}

export interface UserPreferences {
  notifications?: boolean;
  activity_types?: string[];
  health_conditions?: string[];
  notification_radius?: number;
  preferred_units?: {
    temperature?: 'celsius' | 'fahrenheit';
    distance?: 'metric' | 'imperial';
  };
}

export interface ImageAnalysis {
  id: string;
  user_id: string;
  image_url: string;
  location?: Location;
  upload_timestamp: Date;
  analysis_results: ImageAnalysisResults;
  overall_score?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: Date;
}

export interface ImageAnalysisResults {
  pollution_indicators: {
    air_quality?: {
      smog_density: number;
      visibility: number;
      confidence: number;
    };
    water_quality?: {
      turbidity: number;
      color_index: number;
      confidence: number;
    };
    visual_contamination?: {
      detected: boolean;
      type: string;
      confidence: number;
    };
  };
  overall_score: number;
  recommendations: string[];
  processing_metadata?: {
    model_version: string;
    processing_time_ms: number;
    image_quality_score: number;
  };
}

export interface CommunityRecommendation {
  id: string;
  location: Location & { radius: number };
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'immediate_action' | 'long_term_strategy' | 'monitoring';
  title: string;
  description: string;
  steps: string[];
  estimated_impact: number;
  feasibility_score: number;
  target_pollutants: string[];
  estimated_cost?: string;
  time_to_implement?: string;
  success_metrics: string[];
  created_at: Date;
  updated_at: Date;
  expires_at?: Date;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  location?: Location;
  read_at?: Date;
  expires_at?: Date;
  created_at: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

// Chat types for mobile chatbot integration
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    location?: Location;
    intent?: string;
    confidence?: number;
  };
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  session_id?: string;
  user_id?: string;
  location?: Location;
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