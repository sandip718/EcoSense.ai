// User Service for Mobile App
import {ApiService} from './ApiService';
import {UserProfile, UserPreferences} from '@/types/api';

export class UserService {
  static async getProfile(): Promise<UserProfile> {
    return await ApiService.getUserProfile();
  }

  static async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    return await ApiService.updateUserProfile(updates);
  }

  static async updatePreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    const profile = await this.getProfile();
    const updatedProfile = await this.updateProfile({
      preferences: {...profile.preferences, ...preferences}
    });
    return updatedProfile.preferences;
  }
}