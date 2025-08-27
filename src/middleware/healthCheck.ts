import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../config/database';
import { getRedisClient } from '../config/redis';
import { StructuredLogger } from '../utils/logger';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    [serviceName: string]: ServiceHealth;
  };
  system: SystemHealth;
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastChecked: string;
  error?: string;
  details?: any;
}

export interface SystemHealth {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
}

class HealthCheckService {
  private readonly checks: Map<string, () => Promise<ServiceHealth>> = new Map();
  private lastResults: Map<string, ServiceHealth> = new Map();
  private readonly checkInterval = 30000; // 30 seconds
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.registerDefaultChecks();
  }

  private registerDefaultChecks(): void {
    this.registerCheck('database', this.checkDatabase.bind(this));
    this.registerCheck('redis', this.checkRedis.bind(this));
    this.registerCheck('memory', this.checkMemory.bind(this));
    this.registerCheck('disk', this.checkDisk.bind(this));
  }

  public registerCheck(name: string, checkFn: () => Promise<ServiceHealth>): void {
    this.checks.set(name, checkFn);
  }

  public async runHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const results: { [serviceName: string]: ServiceHealth } = {};

    // Run all health checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
      try {
        const result = await Promise.race([
          checkFn(),
          this.timeoutPromise(5000) // 5 second timeout
        ]);
        results[name] = result;
        this.lastResults.set(name, result);
      } catch (error) {
        const errorResult: ServiceHealth = {
          status: 'unhealthy',
          lastChecked: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        results[name] = errorResult;
        this.lastResults.set(name, errorResult);
      }
    });

    await Promise.all(checkPromises);

    // Determine overall status
    const overallStatus = this.determineOverallStatus(results);
    
    const healthResult: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: results,
      system: await this.getSystemHealth(),
    };

    const duration = Date.now() - startTime;
    StructuredLogger.performance('health_check', duration, { status: overallStatus });

    return healthResult;
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const db = getDatabase();
      const result = await db.query('SELECT NOW() as current_time');
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        details: {
          currentTime: result.rows[0].current_time,
          poolSize: db.totalCount,
          idleCount: db.idleCount,
          waitingCount: db.waitingCount,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const redis = getRedisClient();
      await redis.ping();
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        details: {
          connected: redis.isReady,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }

  private async checkMemory(): Promise<ServiceHealth> {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal + memUsage.external;
    const usedMemory = memUsage.heapUsed;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    const status = memoryPercentage > 90 ? 'unhealthy' : 
                   memoryPercentage > 75 ? 'degraded' : 'healthy';

    return {
      status,
      lastChecked: new Date().toISOString(),
      details: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        percentage: Math.round(memoryPercentage * 100) / 100,
      },
    };
  }

  private async checkDisk(): Promise<ServiceHealth> {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.statfs('./');
      const total = stats.blocks * stats.bsize;
      const free = stats.bavail * stats.bsize;
      const used = total - free;
      const percentage = (used / total) * 100;

      const status = percentage > 90 ? 'unhealthy' : 
                     percentage > 80 ? 'degraded' : 'healthy';

      return {
        status,
        lastChecked: new Date().toISOString(),
        details: {
          total,
          used,
          free,
          percentage: Math.round(percentage * 100) / 100,
        },
      };
    } catch (error) {
      return {
        status: 'degraded',
        lastChecked: new Date().toISOString(),
        error: 'Could not check disk usage',
      };
    }
  }

  private determineOverallStatus(results: { [serviceName: string]: ServiceHealth }): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(results).map(r => r.status);
    
    if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    }
    
    if (statuses.includes('degraded')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  private async getSystemHealth(): Promise<SystemHealth> {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal + memUsage.external;
    const usedMemory = memUsage.heapUsed;

    return {
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: Math.round((usedMemory / totalMemory) * 10000) / 100,
      },
      cpu: {
        usage: process.cpuUsage().user / 1000000, // Convert to seconds
      },
      disk: {
        used: 0, // Will be populated by disk check
        total: 0,
        percentage: 0,
      },
    };
  }

  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Health check timeout after ${ms}ms`)), ms);
    });
  }

  public startPeriodicChecks(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(async () => {
      try {
        await this.runHealthCheck();
      } catch (error) {
        StructuredLogger.error('Periodic health check failed', error);
      }
    }, this.checkInterval);

    StructuredLogger.info('Started periodic health checks', { interval: this.checkInterval });
  }

  public stopPeriodicChecks(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      StructuredLogger.info('Stopped periodic health checks');
    }
  }

  public getLastResults(): Map<string, ServiceHealth> {
    return new Map(this.lastResults);
  }
}

export const healthCheckService = new HealthCheckService();

// Health check middleware
export function healthCheckMiddleware(req: Request, res: Response, next: NextFunction): void {
  healthCheckService.runHealthCheck()
    .then((result) => {
      const statusCode = result.status === 'healthy' ? 200 : 
                        result.status === 'degraded' ? 200 : 503;
      res.status(statusCode).json(result);
    })
    .catch((error) => {
      StructuredLogger.error('Health check failed', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      });
    });
}

// Readiness check (for Kubernetes)
export function readinessCheckMiddleware(req: Request, res: Response, next: NextFunction): void {
  const lastResults = healthCheckService.getLastResults();
  const criticalServices = ['database', 'redis'];
  
  const criticalServicesHealthy = criticalServices.every(service => {
    const result = lastResults.get(service);
    return result && result.status !== 'unhealthy';
  });

  if (criticalServicesHealthy) {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready' });
  }
}

// Liveness check (for Kubernetes)
export function livenessCheckMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.status(200).json({ 
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}