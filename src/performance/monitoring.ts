import { Request, Response } from 'express';
import { performance } from 'perf_hooks';
import { QueryPerformanceMonitor, DatabaseHealthCheck } from './databaseOptimizer';
import { GraphQLPerformanceMonitor, GraphQLCache } from './graphqlOptimizer';

// Performance metrics collection
class PerformanceMetrics {
  private static instance: PerformanceMetrics;
  private metrics: Map<string, any> = new Map();
  private startTime = Date.now();

  static getInstance(): PerformanceMetrics {
    if (!PerformanceMetrics.instance) {
      PerformanceMetrics.instance = new PerformanceMetrics();
    }
    return PerformanceMetrics.instance;
  }

  recordMetric(name: string, value: any): void {
    this.metrics.set(name, {
      value,
      timestamp: Date.now(),
    });
  }

  getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, data] of this.metrics.entries()) {
      result[key] = data;
    }
    return result;
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }
}

// Memory usage monitoring
class MemoryMonitor {
  static getMemoryUsage(): {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  } {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024), // MB
    };
  }

  static getMemoryStats(): {
    usage: any;
    percentage: number;
    warning: boolean;
  } {
    const usage = this.getMemoryUsage();
    const percentage = (usage.heapUsed / usage.heapTotal) * 100;
    
    return {
      usage,
      percentage: Math.round(percentage * 100) / 100,
      warning: percentage > 80,
    };
  }
}

// Request rate limiting and monitoring
class RequestMonitor {
  private static requestCounts: Map<string, { count: number; lastReset: number }> = new Map();
  private static requestTimes: Map<string, number[]> = new Map();
  private static resetInterval = 60000; // 1 minute

  static recordRequest(endpoint: string, duration: number): void {
    const now = Date.now();
    
    // Reset counters if needed
    if (!this.requestCounts.has(endpoint) || 
        now - this.requestCounts.get(endpoint)!.lastReset > this.resetInterval) {
      this.requestCounts.set(endpoint, { count: 0, lastReset: now });
      this.requestTimes.set(endpoint, []);
    }

    // Update counters
    const countData = this.requestCounts.get(endpoint)!;
    countData.count++;
    
    // Record response time
    const times = this.requestTimes.get(endpoint)!;
    times.push(duration);
    
    // Keep only last 100 times for average calculation
    if (times.length > 100) {
      times.shift();
    }
  }

  static getRequestStats(): Record<string, { 
    count: number; 
    avgResponseTime: number; 
    maxResponseTime: number;
    requestsPerMinute: number;
  }> {
    const stats: Record<string, any> = {};
    const now = Date.now();

    for (const [endpoint, countData] of this.requestCounts.entries()) {
      const times = this.requestTimes.get(endpoint) || [];
      const avgTime = times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0;
      const maxTime = times.length > 0 ? Math.max(...times) : 0;
      
      // Calculate requests per minute
      const timeElapsed = (now - countData.lastReset) / 1000 / 60; // minutes
      const requestsPerMinute = timeElapsed > 0 ? countData.count / timeElapsed : 0;

      stats[endpoint] = {
        count: countData.count,
        avgResponseTime: Math.round(avgTime * 100) / 100,
        maxResponseTime: Math.round(maxTime * 100) / 100,
        requestsPerMinute: Math.round(requestsPerMinute * 100) / 100,
      };
    }

    return stats;
  }
}

// Performance monitoring middleware
export const performanceMiddleware = (req: Request, res: Response, next: Function) => {
  const startTime = performance.now();
  const endpoint = `${req.method} ${req.path}`;

  // Add performance headers
  res.setHeader('X-Response-Time', '0ms');
  res.setHeader('X-Request-ID', Math.random().toString(36).substring(7));

  // Override end method to capture response time
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = performance.now() - startTime;
    res.setHeader('X-Response-Time', `${Math.round(duration)}ms`);
    
    // Record request metrics
    RequestMonitor.recordRequest(endpoint, duration);
    
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Health check endpoint
export const healthCheck = async (req: Request, res: Response) => {
  const startTime = performance.now();
  
  try {
    const [dbHealth, memoryStats] = await Promise.all([
      DatabaseHealthCheck.checkConnection(),
      Promise.resolve(MemoryMonitor.getMemoryStats()),
    ]);

    const responseTime = performance.now() - startTime;
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: PerformanceMetrics.getInstance().getUptime(),
      responseTime: Math.round(responseTime * 100) / 100,
      database: dbHealth,
      memory: memoryStats,
      version: process.env.npm_package_version || '1.0.0',
    };

    const statusCode = dbHealth.status === 'healthy' && !memoryStats.warning ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Performance metrics endpoint
export const performanceMetrics = (req: Request, res: Response) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: PerformanceMetrics.getInstance().getUptime(),
    memory: MemoryMonitor.getMemoryStats(),
    requests: RequestMonitor.getRequestStats(),
    database: {
      queryStats: QueryPerformanceMonitor.getInstance().getQueryStats(),
      health: DatabaseHealthCheck.checkConnection(),
    },
    graphql: {
      operationStats: GraphQLPerformanceMonitor.getOperationStats(),
      cacheStats: GraphQLCache.getStats(),
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
    },
  };

  res.json(metrics);
};

// Performance optimization recommendations
export const getOptimizationRecommendations = (req: Request, res: Response) => {
  const recommendations: string[] = [];
  const memoryStats = MemoryMonitor.getMemoryStats();
  const requestStats = RequestMonitor.getRequestStats();
  const queryStats = QueryPerformanceMonitor.getInstance().getQueryStats();

  // Memory recommendations
  if (memoryStats.percentage > 80) {
    recommendations.push('High memory usage detected. Consider implementing garbage collection optimization or increasing memory limits.');
  }

  // Database recommendations
  for (const [queryName, stats] of Object.entries(queryStats)) {
    if (stats.avg > 100) {
      recommendations.push(`Slow query detected: ${queryName} (avg: ${stats.avg}ms). Consider adding database indexes or optimizing the query.`);
    }
  }

  // Request recommendations
  for (const [endpoint, stats] of Object.entries(requestStats)) {
    if (stats.avgResponseTime > 500) {
      recommendations.push(`Slow endpoint detected: ${endpoint} (avg: ${stats.avgResponseTime}ms). Consider implementing caching or optimizing the endpoint.`);
    }
  }

  res.json({
    recommendations,
    count: recommendations.length,
    timestamp: new Date().toISOString(),
  });
};

export {
  PerformanceMetrics,
  MemoryMonitor,
  RequestMonitor,
}; 