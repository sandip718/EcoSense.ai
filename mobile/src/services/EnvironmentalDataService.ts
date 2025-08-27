// Environmental Data Service for Mobile App
import {ApiService} from './ApiService';
import {EnvironmentalDataPoint, Location} from '@/types/api';

export class EnvironmentalDataService {
  static async getEnvironmentalData(location: Location, radius?: number): Promise<EnvironmentalDataPoint[]> {
    return await ApiService.getEnvironmentalData(location, radius);
  }

  static async getNearbyData(location: Location, radius: number): Promise<EnvironmentalDataPoint[]> {
    return await ApiService.getEnvironmentalData(location, radius);
  }

  static async getEnvironmentalSummary(location: Location, radius?: number): Promise<any> {
    return await ApiService.getEnvironmentalDataSummary(location, radius);
  }
}