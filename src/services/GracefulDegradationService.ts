import { StructuredLogger } from '../utils/logger';
import { getRedisClient } from '../config/redis';
import { createApiUnavailableError } from '../middleware/errorHandler';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

export interface FallbackData {
  data: any;
  source: 'cache' | 'static' | 'alternative_api';
  lastUpdated: Date;
  expiresAt?: Date;
}

export interface ApiCallResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  fallback?: FallbackData;
  source: 'primary' | 'fallback';
}

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig
  ) {}

  public async execute<T>(
    operation: () => Promise<T>,
    fallbackFn?: () => Promise<FallbackData>
  ): Promise<ApiCallResult<T>> {
    const startTime = Date.now();

    try {
      if (this.state === CircuitState.OPEN) {
        if (this.shouldAttemptReset()) {
          this.state = CircuitState.HALF_OPEN;
          StructuredLogger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN`);
        } else {
          return await this.handleFallback(fallbackFn, 'Circuit breaker is OPEN');
        }
      }

      const result = await operation();
      this.onSuccess();
      
      const duration = Date.now() - startTime;
      StructuredLogger.externalService(this.name, 'api_call', true, duration);

      return {
        success: true,
        data: result,
        source: 'primary',
      };

    } catch (error) {
      this.onFailure();
      const duration = Date.now() - startTime;
      
      StructuredLogger.externalService(
        this.name, 
        'api_call', 
        false, 
        duration, 
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );

      return await this.handleFallback(fallbackFn, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      StructuredLogger.info(`Circuit breaker ${this.name} reset to CLOSED`);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
      
      StructuredLogger.warn(`Circuit breaker ${this.name} opened`, {
        failureCount: this.failureCount,
        nextAttemptTime: this.nextAttemptTime,
      });
    }
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime ? new Date() >= this.nextAttemptTime : false;
  }

  private async handleFallback<T>(
    fallbackFn?: () => Promise<FallbackData>,
    error?: string
  ): Promise<ApiCallResult<T>> {
    if (fallbackFn) {
      try {
        const fallbackData = await fallbackFn();
        
        StructuredLogger.info(`Using fallback data for ${this.name}`, {
          source: fallbackData.source,
          lastUpdated: fallbackData.lastUpdated,
        });

        return {
          success: false,
          error: new Error(error || 'Primary service unavailable'),
          fallback: fallbackData,
          source: 'fallback',
        };
      } catch (fallbackError) {
        StructuredLogger.error(`Fallback failed for ${this.name}`, fallbackError);
      }
    }

    return {
      success: false,
      error: new Error(error || 'Service unavailable and no fallback available'),
      source: 'primary',
    };
  }

  public getState(): CircuitState {
    return this.state;
  }

  public getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }
}

export class GracefulDegradationService {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private redis = getRedisClient();

  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    monitoringPeriod: 300000, // 5 minutes
  };

  public getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const finalConfig = { ...this.defaultConfig, ...config };
      this.circuitBreakers.set(name, new CircuitBreaker(name, finalConfig));
    }
    return this.circuitBreakers.get(name)!;
  }

  // OpenAQ API with fallback
  public async callOpenAQApi<T>(
    operation: () => Promise<T>,
    cacheKey?: string
  ): Promise<ApiCallResult<T>> {
    const circuitBreaker = this.getCircuitBreaker('openaq_api');
    
    const fallbackFn = cacheKey ? async (): Promise<FallbackData> => {
      const cachedData = await this.getCachedData(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      
      // Return static fallback data if no cache available
      return {
        data: this.getStaticOpenAQFallback(),
        source: 'static',
        lastUpdated: new Date(Date.now() - 3600000), // 1 hour ago
      };
    } : undefined;

    return circuitBreaker.execute(operation, fallbackFn);
  }

  // Water Quality Portal API with fallback
  public async callWaterQualityApi<T>(
    operation: () => Promise<T>,
    cacheKey?: string
  ): Promise<ApiCallResult<T>> {
    const circuitBreaker = this.getCircuitBreaker('water_quality_api');
    
    const fallbackFn = cacheKey ? async (): Promise<FallbackData> => {
      const cachedData = await this.getCachedData(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      
      return {
        data: this.getStaticWaterQualityFallback(),
        source: 'static',
        lastUpdated: new Date(Date.now() - 3600000),
      };
    } : undefined;

    return circuitBreaker.execute(operation, fallbackFn);
  }

  // Image Analysis API with fallback
  public async callImageAnalysisApi<T>(
    operation: () => Promise<T>,
    imageId?: string
  ): Promise<ApiCallResult<T>> {
    const circuitBreaker = this.getCircuitBreaker('image_analysis_api');
    
    const fallbackFn = async (): Promise<FallbackData> => {
      return {
        data: this.getStaticImageAnalysisFallback(),
        source: 'static',
        lastUpdated: new Date(),
      };
    };

    return circuitBreaker.execute(operation, fallbackFn);
  }

  // Generic external API call with fallback
  public async callExternalApi<T>(
    apiName: string,
    operation: () => Promise<T>,
    fallbackFn?: () => Promise<FallbackData>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<ApiCallResult<T>> {
    const circuitBreaker = this.getCircuitBreaker(apiName, config);
    return circuitBreaker.execute(operation, fallbackFn);
  }

  // Cache management
  public async setCachedData(key: string, data: any, ttl = 3600): Promise<void> {
    try {
      const fallbackData: FallbackData = {
        data,
        source: 'cache',
        lastUpdated: new Date(),
        expiresAt: new Date(Date.now() + ttl * 1000),
      };
      
      await this.redis.setEx(`fallback:${key}`, ttl, JSON.stringify(fallbackData));
    } catch (error) {
      StructuredLogger.error('Failed to cache fallback data', error, { key });
    }
  }

  public async getCachedData(key: string): Promise<FallbackData | null> {
    try {
      const cached = await this.redis.get(`fallback:${key}`);
      if (cached) {
        const fallbackData: FallbackData = JSON.parse(cached);
        fallbackData.lastUpdated = new Date(fallbackData.lastUpdated);
        if (fallbackData.expiresAt) {
          fallbackData.expiresAt = new Date(fallbackData.expiresAt);
        }
        return fallbackData;
      }
    } catch (error) {
      StructuredLogger.error('Failed to retrieve cached fallback data', error, { key });
    }
    return null;
  }

  // Static fallback data
  private getStaticOpenAQFallback(): any {
    return {
      message: 'OpenAQ API is currently unavailable. Showing cached data.',
      data: [],
      timestamp: new Date().toISOString(),
      source: 'static_fallback',
    };
  }

  private getStaticWaterQualityFallback(): any {
    return {
      message: 'Water Quality Portal API is currently unavailable. Showing cached data.',
      data: [],
      timestamp: new Date().toISOString(),
      source: 'static_fallback',
    };
  }

  private getStaticImageAnalysisFallback(): any {
    return {
      message: 'Image analysis service is currently unavailable.',
      analysisResult: {
        pollutionIndicators: {
          airQuality: { smogDensity: 0, visibility: 0, confidence: 0 },
          waterQuality: { turbidity: 0, colorIndex: 0, confidence: 0 },
          visualContamination: { detected: false, type: 'unknown', confidence: 0 },
        },
        overallScore: 0,
        recommendations: ['Image analysis temporarily unavailable. Please try again later.'],
      },
      timestamp: new Date().toISOString(),
      source: 'static_fallback',
    };
  }

  // Health monitoring
  public getCircuitBreakerStats(): { [name: string]: any } {
    const stats: { [name: string]: any } = {};
    
    for (const [name, breaker] of this.circuitBreakers) {
      stats[name] = breaker.getStats();
    }
    
    return stats;
  }

  // Utility method to handle API results and throw appropriate errors
  public handleApiResult<T>(result: ApiCallResult<T>, apiName: string): T {
    if (result.success && result.data) {
      return result.data;
    }

    if (result.fallback) {
      const error = createApiUnavailableError(
        apiName,
        result.fallback.data,
        result.fallback.lastUpdated
      );
      throw error;
    }

    throw createApiUnavailableError(apiName);
  }
}

export const gracefulDegradationService = new GracefulDegradationService();