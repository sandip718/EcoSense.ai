// API Service for EcoSense.ai Mobile App
// Handles all API communication with the backend

import Config from 'react-native-config';
import {
  EnvironmentalDataPoint,
  UserProfile,
  ImageAnalysis,
  CommunityRecommendation,
  Notification,
  Location,
  ApiResponse,
  ChatRequest,
  ChatResponse,
} from '@/types/api';
import {logger} from '@/utils/logger';

export class ApiService {
  private static baseURL = Config.API_BASE_URL || 'http://localhost:3000/api';
  private static authToken: string | null = null;

  /**
   * Set authentication token
   */
  static setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Clear authentication token
   */
  static clearAuthToken(): void {
    this.authToken = null;
  }

  /**
   * Make authenticated API request
   */
  private static async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    logger.debug('API Request:', {method: config.method || 'GET', url});

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      logger.debug('API Response:', {url, success: data.success});
      
      return data;
    } catch (error) {
      logger.error('API Request failed:', {url, error});
      throw error;
    }
  }

  // Authentication
  static async login(credentials: {email: string; password: string}): Promise<any> {
    const response = await this.makeRequest<ApiResponse<any>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    if (response.data?.token) {
      this.setAuthToken(response.data.token);
    }
    
    return response.data;
  }

  static async register(userData: {email: string; password: string; location?: Location}): Promise<any> {
    const response = await this.makeRequest<ApiResponse<any>>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    
    if (response.data?.token) {
      this.setAuthToken(response.data.token);
    }
    
    return response.data;
  }

  static async logout(): Promise<void> {
    await this.makeRequest('/auth/logout', {method: 'POST'});
    this.clearAuthToken();
  }

  // Environmental Data
  static async getEnvironmentalData(
    location: Location,
    radius: number = 10
  ): Promise<EnvironmentalDataPoint[]> {
    const params = new URLSearchParams({
      lat: location.latitude.toString(),
      lng: location.longitude.toString(),
      radius: radius.toString(),
    });

    const response = await this.makeRequest<ApiResponse<{data: EnvironmentalDataPoint[]}>>
      (`/environmental-data?${params}`);
    
    return response.data?.data || [];
  }

  static async getEnvironmentalDataSummary(
    location: Location,
    radius: number = 10
  ): Promise<any> {
    const params = new URLSearchParams({
      lat: location.latitude.toString(),
      lng: location.longitude.toString(),
      radius: radius.toString(),
    });

    const response = await this.makeRequest<ApiResponse<any>>(`/environmental-data/summary?${params}`);
    return response.data;
  }

  // User Profile
  static async getUserProfile(): Promise<UserProfile> {
    const response = await this.makeRequest<ApiResponse<UserProfile>>('/auth/profile');
    return response.data!;
  }

  static async updateUserProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const response = await this.makeRequest<ApiResponse<UserProfile>>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data!;
  }

  // Image Analysis
  static async uploadImage(formData: FormData): Promise<{imageUrl: string; analysisId: string}> {
    const response = await this.makeRequest<ApiResponse<any>>('/images/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });
    return response.data;
  }

  static async getImageAnalysis(analysisId: string): Promise<ImageAnalysis> {
    const response = await this.makeRequest<ApiResponse<ImageAnalysis>>(`/images/${analysisId}`);
    return response.data!;
  }

  // Community Recommendations
  static async getRecommendations(location: Location, radius: number = 10): Promise<CommunityRecommendation[]> {
    const params = new URLSearchParams({
      lat: location.latitude.toString(),
      lng: location.longitude.toString(),
      radius: radius.toString(),
    });

    const response = await this.makeRequest<ApiResponse<{data: CommunityRecommendation[]}>>
      (`/recommendations?${params}`);
    
    return response.data?.data || [];
  }

  // Notifications
  static async getNotifications(): Promise<Notification[]> {
    const response = await this.makeRequest<ApiResponse<{data: Notification[]}>>('/notifications');
    return response.data?.data || [];
  }

  static async markNotificationAsRead(notificationId: string): Promise<void> {
    await this.makeRequest(`/notifications/${notificationId}/read`, {method: 'PUT'});
  }

  static async markAllNotificationsAsRead(): Promise<void> {
    await this.makeRequest('/notifications/read-all', {method: 'PUT'});
  }

  // Push Notifications
  static async registerPushToken(tokenData: {
    token: string;
    platform: string;
    deviceId: string;
  }): Promise<void> {
    await this.makeRequest('/notifications/register-token', {
      method: 'POST',
      body: JSON.stringify(tokenData),
    });
  }

  static async updateNotificationPreferences(preferences: any): Promise<void> {
    await this.makeRequest('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

  static async getNotificationPreferences(): Promise<any> {
    const response = await this.makeRequest<ApiResponse<any>>('/notifications/preferences');
    return response.data;
  }

  static async unregisterPushToken(deviceId: string): Promise<void> {
    await this.makeRequest(`/notifications/unregister-token/${deviceId}`, {
      method: 'DELETE',
    });
  }

  // Chatbot
  static async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.makeRequest<ApiResponse<ChatResponse>>('/chatbot/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response.data!;
  }

  static async getChatHistory(sessionId: string): Promise<any> {
    const response = await this.makeRequest<ApiResponse<any>>(`/chatbot/conversation/${sessionId}`);
    return response.data;
  }

  // Dashboard Data
  static async getDashboardData(location: Location): Promise<any> {
    const params = new URLSearchParams({
      lat: location.latitude.toString(),
      lng: location.longitude.toString(),
    });

    const response = await this.makeRequest<ApiResponse<any>>(`/dashboard?${params}`);
    return response.data;
  }

  // Gamification
  static async getUserStats(): Promise<any> {
    const response = await this.makeRequest<ApiResponse<any>>('/gamification/stats');
    return response.data;
  }

  static async getLeaderboard(): Promise<any> {
    const response = await this.makeRequest<ApiResponse<any>>('/gamification/leaderboard');
    return response.data;
  }

  // Health Check
  static async healthCheck(): Promise<{status: string; timestamp: string}> {
    const response = await this.makeRequest<{status: string; timestamp: string}>('/health');
    return response;
  }
}

export default ApiService;