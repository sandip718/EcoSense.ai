import { CreateEnvironmentalDataPoint } from '../../models/types';
import { Logger } from 'winston';

export interface OpenAQConfig {
  endpoint: string;
  apiKey?: string;
  rateLimit: number; // requests per minute
}

export interface OpenAQMeasurement {
  parameter: string;
  value: number;
  unit: string;
  date: {
    utc: string;
    local: string;
  };
  coordinates: {
    latitude: number;
    longitude: number;
  };
  country: string;
  city: string;
  location: string;
  sourceName: string;
  sourceType: string;
  mobile: boolean;
}

export interface OpenAQResponse {
  meta: {
    name: string;
    license: string;
    website: string;
    page: number;
    limit: number;
    found: number;
  };
  results: OpenAQMeasurement[];
}

/**
 * Client for OpenAQ API with rate limiting and error handling
 * Implements requirement 1.1: Fetch air quality data from OpenAQ API
 * Implements requirement 1.3: Exponential backoff retry logic for API failures
 */
export class OpenAQClient {
  private config: OpenAQConfig;
  private logger: Logger;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private requestWindow: number = 60000; // 1 minute in milliseconds

  constructor(config: OpenAQConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Fetch latest air quality measurements
   * Requirement 1.1: Fetch air quality data from OpenAQ API every hour
   */
  async fetchLatestMeasurements(
    location?: { latitude: number; longitude: number; radius: number }
  ): Promise<CreateEnvironmentalDataPoint[]> {
    await this.enforceRateLimit();

    const url = this.buildApiUrl('/v2/measurements', {
      limit: 1000,
      page: 1,
      offset: 0,
      sort: 'desc',
      radius: location?.radius || 25000, // 25km default radius
      coordinates: location ? `${location.latitude},${location.longitude}` : undefined,
      date_from: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // Last 2 hours
      date_to: new Date().toISOString()
    });

    const response = await this.makeRequest(url);
    return this.transformToEnvironmentalData(response.results);
  }

  /**
   * Make HTTP request with retry logic
   * Requirement 1.3: Exponential backoff retry logic for API failures
   */
  private async makeRequest(url: string, retryCount: number = 0): Promise<OpenAQResponse> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    try {
      this.logger.debug('Making OpenAQ API request', { url, retryCount });

      const headers: Record<string, string> = {
        'User-Agent': 'EcoSense.ai/1.0',
        'Accept': 'application/json'
      };

      if (this.config.apiKey) {
        headers['X-API-Key'] = this.config.apiKey;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        timeout: 30000 // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`OpenAQ API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as OpenAQResponse;
      
      this.logger.debug('OpenAQ API request successful', {
        found: data.meta.found,
        results: data.results.length
      });

      return data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn('OpenAQ API request failed', {
        url,
        retryCount,
        error: errorMessage
      });

      if (retryCount < maxRetries) {
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, retryCount) + Math.random() * 1000;
        
        this.logger.info('Retrying OpenAQ API request', {
          retryCount: retryCount + 1,
          delayMs: Math.round(delay)
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(url, retryCount + 1);
      }

      throw new Error(`OpenAQ API request failed after ${maxRetries} retries: ${errorMessage}`);
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
   * Transform OpenAQ measurements to environmental data points
   */
  private transformToEnvironmentalData(measurements: OpenAQMeasurement[]): CreateEnvironmentalDataPoint[] {
    return measurements.map(measurement => {
      // Determine quality grade based on source type and mobile status
      let qualityGrade: 'A' | 'B' | 'C' | 'D' = 'B'; // Default for reference grade monitors
      
      if (measurement.mobile) {
        qualityGrade = 'C'; // Mobile sensors typically less accurate
      } else if (measurement.sourceType === 'government') {
        qualityGrade = 'A'; // Government stations highest quality
      } else if (measurement.sourceType === 'research') {
        qualityGrade = 'B'; // Research stations good quality
      } else {
        qualityGrade = 'C'; // Other sources moderate quality
      }

      return {
        source: 'openaq' as const,
        pollutant: this.normalizePollutantName(measurement.parameter),
        value: measurement.value,
        unit: measurement.unit,
        location: {
          latitude: measurement.coordinates.latitude,
          longitude: measurement.coordinates.longitude,
          address: `${measurement.location}, ${measurement.city}, ${measurement.country}`
        },
        timestamp: new Date(measurement.date.utc),
        quality_grade: qualityGrade
      };
    });
  }

  /**
   * Normalize pollutant names to standard format
   */
  private normalizePollutantName(parameter: string): string {
    const pollutantMap: Record<string, string> = {
      'pm25': 'PM2.5',
      'pm10': 'PM10',
      'o3': 'O3',
      'no2': 'NO2',
      'so2': 'SO2',
      'co': 'CO',
      'bc': 'BC'
    };

    return pollutantMap[parameter.toLowerCase()] || parameter.toUpperCase();
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
   * Health check for OpenAQ API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const url = this.buildApiUrl('/v2/countries', { limit: 1 });
      await this.makeRequest(url);
      return true;
    } catch (error) {
      this.logger.error('OpenAQ health check failed', { error });
      return false;
    }
  }
}