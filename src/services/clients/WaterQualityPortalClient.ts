import { CreateEnvironmentalDataPoint } from '../../models/types';
import { Logger } from 'winston';

export interface WaterQualityConfig {
  endpoint: string;
  rateLimit: number; // requests per minute
}

export interface WaterQualityResult {
  OrganizationIdentifier: string;
  OrganizationFormalName: string;
  MonitoringLocationIdentifier: string;
  MonitoringLocationName: string;
  MonitoringLocationTypeName: string;
  ActivityIdentifier: string;
  ActivityTypeCode: string;
  ActivityMediaName: string;
  ActivityStartDate: string;
  ActivityStartTime?: {
    Time: string;
    TimeZoneCode: string;
  };
  CharacteristicName: string;
  ResultMeasureValue: string;
  ResultMeasure?: {
    MeasureUnitCode: string;
  };
  MonitoringLocationLatitude: string;
  MonitoringLocationLongitude: string;
  StateCode: string;
  CountyCode: string;
  HUCEightDigitCode: string;
}

export interface WaterQualityResponse {
  WQXWeb: {
    Result: WaterQualityResult[];
  };
}

/**
 * Client for Water Quality Portal API with data validation
 * Implements requirement 1.2: Fetch water quality data from Water Quality Portal API
 * Implements requirement 1.3: Exponential backoff retry logic for API failures
 */
export class WaterQualityPortalClient {
  private config: WaterQualityConfig;
  private logger: Logger;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private requestWindow: number = 60000; // 1 minute in milliseconds

  constructor(config: WaterQualityConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Fetch latest water quality measurements
   * Requirement 1.2: Fetch water quality data from Water Quality Portal API every hour
   */
  async fetchLatestMeasurements(
    location?: { latitude: number; longitude: number; radius: number }
  ): Promise<CreateEnvironmentalDataPoint[]> {
    await this.enforceRateLimit();

    const params = {
      mimeType: 'json',
      zip: 'no',
      dataProfile: 'resultPhysChem',
      startDateLo: this.formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000)), // Last 24 hours
      startDateHi: this.formatDate(new Date()),
      characteristicType: 'Physical,Chemical',
      sampleMedia: 'Water'
    };

    // Add location-based filtering if provided
    if (location) {
      Object.assign(params, {
        lat: location.latitude.toString(),
        long: location.longitude.toString(),
        within: (location.radius / 1000).toString() // Convert meters to kilometers
      });
    }

    const url = this.buildApiUrl('/data/Result/search', params);
    const response = await this.makeRequest(url);
    
    return this.transformToEnvironmentalData(response.WQXWeb.Result || []);
  }

  /**
   * Make HTTP request with retry logic
   * Requirement 1.3: Exponential backoff retry logic for API failures
   */
  private async makeRequest(url: string, retryCount: number = 0): Promise<WaterQualityResponse> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    try {
      this.logger.debug('Making Water Quality Portal API request', { url, retryCount });

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'EcoSense.ai/1.0',
          'Accept': 'application/json'
        },
        timeout: 60000 // 60 second timeout (WQP can be slow)
      });

      if (!response.ok) {
        throw new Error(`Water Quality Portal API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as WaterQualityResponse;
      
      this.logger.debug('Water Quality Portal API request successful', {
        results: data.WQXWeb?.Result?.length || 0
      });

      return data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn('Water Quality Portal API request failed', {
        url,
        retryCount,
        error: errorMessage
      });

      if (retryCount < maxRetries) {
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, retryCount) + Math.random() * 1000;
        
        this.logger.info('Retrying Water Quality Portal API request', {
          retryCount: retryCount + 1,
          delayMs: Math.round(delay)
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(url, retryCount + 1);
      }

      throw new Error(`Water Quality Portal API request failed after ${maxRetries} retries: ${errorMessage}`);
    }
  }

  /**
   * Build API URL with query parameters
   */
  private buildApiUrl(endpoint: string, params: Record<string, any>): string {
    const url = new URL(endpoint, this.config.endpoint);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });

    return url.toString();
  }

  /**
   * Transform Water Quality Portal results to environmental data points
   */
  private transformToEnvironmentalData(results: WaterQualityResult[]): CreateEnvironmentalDataPoint[] {
    const validResults = results.filter(result => this.validateWaterQualityResult(result));
    
    return validResults.map(result => {
      // Determine quality grade based on organization type and monitoring location
      let qualityGrade: 'A' | 'B' | 'C' | 'D' = 'B'; // Default
      
      const orgName = result.OrganizationFormalName?.toLowerCase() || '';
      if (orgName.includes('usgs') || orgName.includes('epa') || orgName.includes('state')) {
        qualityGrade = 'A'; // Government agencies highest quality
      } else if (orgName.includes('university') || orgName.includes('research')) {
        qualityGrade = 'B'; // Research institutions good quality
      } else if (result.MonitoringLocationTypeName?.toLowerCase().includes('volunteer')) {
        qualityGrade = 'D'; // Volunteer monitoring lower quality
      } else {
        qualityGrade = 'C'; // Other sources moderate quality
      }

      // Parse timestamp
      let timestamp = new Date(result.ActivityStartDate);
      if (result.ActivityStartTime?.Time) {
        const timeStr = `${result.ActivityStartDate}T${result.ActivityStartTime.Time}`;
        timestamp = new Date(timeStr);
      }

      return {
        source: 'water_quality_portal' as const,
        pollutant: this.normalizePollutantName(result.CharacteristicName),
        value: parseFloat(result.ResultMeasureValue),
        unit: result.ResultMeasure?.MeasureUnitCode || 'unknown',
        location: {
          latitude: parseFloat(result.MonitoringLocationLatitude),
          longitude: parseFloat(result.MonitoringLocationLongitude),
          address: `${result.MonitoringLocationName}, ${result.StateCode}`
        },
        timestamp,
        quality_grade: qualityGrade
      };
    });
  }

  /**
   * Validate water quality result data
   * Requirement 1.2: Data validation for water quality data
   */
  private validateWaterQualityResult(result: WaterQualityResult): boolean {
    try {
      // Check required fields
      if (!result.CharacteristicName || !result.ResultMeasureValue || !result.ActivityStartDate) {
        return false;
      }

      // Validate numeric values
      const measureValue = parseFloat(result.ResultMeasureValue);
      if (isNaN(measureValue) || measureValue < 0) {
        return false;
      }

      // Validate coordinates
      const lat = parseFloat(result.MonitoringLocationLatitude);
      const lng = parseFloat(result.MonitoringLocationLongitude);
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return false;
      }

      // Validate date
      const date = new Date(result.ActivityStartDate);
      if (isNaN(date.getTime())) {
        return false;
      }

      // Check if data is too old (more than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (date < thirtyDaysAgo) {
        return false;
      }

      return true;

    } catch (error) {
      this.logger.debug('Water quality result validation failed', { result, error });
      return false;
    }
  }

  /**
   * Normalize pollutant names to standard format
   */
  private normalizePollutantName(characteristic: string): string {
    const pollutantMap: Record<string, string> = {
      'dissolved oxygen': 'Dissolved Oxygen',
      'ph': 'pH',
      'temperature': 'Temperature',
      'turbidity': 'Turbidity',
      'conductivity': 'Conductivity',
      'total suspended solids': 'TSS',
      'biochemical oxygen demand': 'BOD',
      'chemical oxygen demand': 'COD',
      'nitrate': 'Nitrate',
      'nitrite': 'Nitrite',
      'ammonia': 'Ammonia',
      'phosphorus': 'Phosphorus',
      'phosphate': 'Phosphate',
      'chlorophyll': 'Chlorophyll',
      'fecal coliform': 'Fecal Coliform',
      'e. coli': 'E. coli'
    };

    const normalized = characteristic.toLowerCase().trim();
    return pollutantMap[normalized] || characteristic;
  }

  /**
   * Format date for API query
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  /**
   * Enforce rate limiting
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counter if window has passed
    if (now - this.lastRequestTime > this.requestWindow) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    // Check if we've exceeded rate limit
    if (this.requestCount >= this.config.rateLimit) {
      const waitTime = this.requestWindow - (now - this.lastRequestTime);
      
      this.logger.info('Rate limit reached, waiting', {
        waitTimeMs: waitTime,
        requestCount: this.requestCount,
        rateLimit: this.config.rateLimit
      });

      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Reset after waiting
      this.requestCount = 0;
      this.lastRequestTime = Date.now();
    }

    this.requestCount++;
  }

  /**
   * Health check for Water Quality Portal API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const url = this.buildApiUrl('/data/Organization/search', { 
        mimeType: 'json',
        zip: 'no'
      });
      await this.makeRequest(url);
      return true;
    } catch (error) {
      this.logger.error('Water Quality Portal health check failed', { error });
      return false;
    }
  }
}