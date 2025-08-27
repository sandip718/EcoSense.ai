// Authentication Service for Mobile App
import {ApiService} from './ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {logger} from '@/utils/logger';

export class AuthService {
  private static readonly TOKEN_KEY = 'auth_token';

  static async login(credentials: {email: string; password: string}) {
    const response = await ApiService.login(credentials);
    
    if (response.token) {
      await AsyncStorage.setItem(this.TOKEN_KEY, response.token);
    }
    
    return response;
  }

  static async register(userData: {email: string; password: string; location?: any}) {
    const response = await ApiService.register(userData);
    
    if (response.token) {
      await AsyncStorage.setItem(this.TOKEN_KEY, response.token);
    }
    
    return response;
  }

  static async logout() {
    try {
      await ApiService.logout();
    } catch (error) {
      logger.error('Logout API call failed:', error);
    } finally {
      await AsyncStorage.removeItem(this.TOKEN_KEY);
      ApiService.clearAuthToken();
    }
  }

  static async getStoredToken(): Promise<string | null> {
    return await AsyncStorage.getItem(this.TOKEN_KEY);
  }

  static async initializeAuth(): Promise<boolean> {
    const token = await this.getStoredToken();
    if (token) {
      ApiService.setAuthToken(token);
      return true;
    }
    return false;
  }
}