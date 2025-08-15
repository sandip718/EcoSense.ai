// Core TypeScript interfaces for EcoSense.ai environmental data types
// Based on requirements 1.4, 8.1, 8.2

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

export interface CreateEnvironmentalDataPoint {
  source: 'openaq' | 'water_quality_portal' | 'local_sensor';
  pollutant: string;
  value: number;
  unit: string;
  location: Location;
  timestamp: Date;
  quality_grade: 'A' | 'B' | 'C' | 'D';
}

export interface UserProfile {
  id: string;
  email: string;
  password_hash: string;
  location?: Location;
  preferences: UserPreferences;
  points: number;
  level: number;
  badges: string[];
  contribution_streak: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserProfile {
  email: string;
  password_hash: string;
  location?: Location;
  preferences?: UserPreferences;
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

export interface CreateImageAnalysis {
  user_id: string;
  image_url: string;
  location?: Location;
  upload_timestamp: Date;
  analysis_results: ImageAnalysisResults;
  overall_score?: number;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
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

export interface CommunityAction {
  id: string;
  user_id: string;
  action_type: string;
  location?: Location;
  timestamp: Date;
  points_earned: number;
  impact_description?: string;
  metadata: Record<string, any>;
  created_at: Date;
}

export interface CreateCommunityAction {
  user_id: string;
  action_type: string;
  location?: Location;
  timestamp: Date;
  points_earned?: number;
  impact_description?: string;
  metadata?: Record<string, any>;
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

export interface CreateNotification {
  user_id: string;
  type: string;
  title: string;
  message: string;
  severity?: 'info' | 'warning' | 'critical';
  location?: Location;
  expires_at?: Date;
}

// Query interfaces for database operations
export interface EnvironmentalDataQuery {
  pollutant?: string;
  source?: string;
  location?: {
    latitude: number;
    longitude: number;
    radius_km: number;
  };
  time_range?: {
    start: Date;
    end: Date;
  };
  quality_grade?: ('A' | 'B' | 'C' | 'D')[];
  limit?: number;
  offset?: number;
}

export interface ImageAnalysisQuery {
  user_id?: string;
  status?: ('pending' | 'processing' | 'completed' | 'failed')[];
  location?: {
    latitude: number;
    longitude: number;
    radius_km: number;
  };
  time_range?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  offset?: number;
}

// Database result interfaces (for raw database responses)
export interface DatabaseEnvironmentalData {
  id: string;
  source: string;
  pollutant: string;
  value: string; // DECIMAL comes as string from pg
  unit: string;
  location: string; // PostGIS geometry as string
  address: string | null;
  timestamp: Date;
  quality_grade: string;
  created_at: Date;
}

export interface DatabaseUser {
  id: string;
  email: string;
  password_hash: string;
  location: string | null; // PostGIS geometry as string
  preferences: any; // JSONB
  points: number;
  level: number;
  badges: string[];
  contribution_streak: number;
  created_at: Date;
  updated_at: Date;
}

export interface DatabaseImageAnalysis {
  id: string;
  user_id: string;
  image_url: string;
  location: string | null; // PostGIS geometry as string
  upload_timestamp: Date;
  analysis_results: any; // JSONB
  overall_score: string | null; // DECIMAL comes as string from pg
  status: string;
  created_at: Date;
}

// Community Recommendation System types
export interface CommunityRecommendation {
  id: string;
  location: Location & { radius: number };
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'immediate_action' | 'long_term_strategy' | 'monitoring';
  title: string;
  description: string;
  steps: string[];
  estimated_impact: number; // 0-100 scale
  feasibility_score: number; // 0-100 scale
  target_pollutants: string[];
  estimated_cost?: string | undefined;
  time_to_implement?: string | undefined;
  success_metrics: string[];
  created_at: Date;
  updated_at: Date;
  expires_at?: Date | undefined;
}

export interface CreateCommunityRecommendation {
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
  expires_at?: Date;
}

export interface RecommendationQuery {
  location?: {
    latitude: number;
    longitude: number;
    radius_km: number;
  };
  priority?: ('low' | 'medium' | 'high' | 'urgent')[];
  category?: ('immediate_action' | 'long_term_strategy' | 'monitoring')[];
  target_pollutants?: string[];
  active_only?: boolean;
  limit?: number;
  offset?: number;
}

export interface RecommendationAnalysisInput {
  location: Location;
  radius_km: number;
  current_conditions: EnvironmentalDataPoint[];
  trend_analysis?: any;
  community_profile?: {
    population_density: number;
    economic_level: 'low' | 'medium' | 'high';
    infrastructure_quality: 'poor' | 'fair' | 'good' | 'excellent';
    environmental_awareness: number; // 0-100 scale
  };
}

export interface DatabaseCommunityRecommendation {
  id: string;
  location: string; // PostGIS geometry as string
  radius: number;
  priority: string;
  category: string;
  title: string;
  description: string;
  steps: string[];
  estimated_impact: number;
  feasibility_score: number;
  target_pollutants: string[];
  estimated_cost: string | null;
  time_to_implement: string | null;
  success_metrics: string[];
  created_at: Date;
  updated_at: Date;
  expires_at: Date | null;
}

// Utility types for API responses
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