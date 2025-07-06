import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';

// Connection pooling configuration
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool settings
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Query performance monitoring
class QueryPerformanceMonitor {
  private static instance: QueryPerformanceMonitor;
  private queryTimes: Map<string, number[]> = new Map();
  private slowQueryThreshold = 1000; // 1 second

  static getInstance(): QueryPerformanceMonitor {
    if (!QueryPerformanceMonitor.instance) {
      QueryPerformanceMonitor.instance = new QueryPerformanceMonitor();
    }
    return QueryPerformanceMonitor.instance;
  }

  startQuery(queryName: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.recordQueryTime(queryName, duration);
      
      if (duration > this.slowQueryThreshold) {
        console.warn(`🚨 Slow query detected: ${queryName} took ${duration.toFixed(2)}ms`);
      }
    };
  }

  private recordQueryTime(queryName: string, duration: number): void {
    if (!this.queryTimes.has(queryName)) {
      this.queryTimes.set(queryName, []);
    }
    this.queryTimes.get(queryName)!.push(duration);
  }

  getQueryStats(): Record<string, { avg: number; count: number; max: number }> {
    const stats: Record<string, { avg: number; count: number; max: number }> = {};
    
    for (const [queryName, times] of this.queryTimes.entries()) {
      const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
      const max = Math.max(...times);
      stats[queryName] = { avg, count: times.length, max };
    }
    
    return stats;
  }
}

// Optimized query builder with caching
class OptimizedQueryBuilder {
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private static cacheTTL = 5 * 60 * 1000; // 5 minutes

  static async getEmployeesWithOptimization(
    prisma: PrismaClient,
    options: {
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      filter?: string;
      includeCount?: boolean;
    }
  ) {
    const cacheKey = JSON.stringify(options);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    const monitor = QueryPerformanceMonitor.getInstance();
    const endQuery = monitor.startQuery('getEmployees');

    try {
      const { page = 1, pageSize = 10, sortBy = 'id', sortOrder = 'asc', filter = '', includeCount = true } = options;
      const skip = (page - 1) * pageSize;
      
      // Optimized where clause with proper indexing considerations
      const where = filter ? {
        OR: [
          { name: { contains: filter, mode: 'insensitive' } },
          { department: { contains: filter, mode: 'insensitive' } },
          { position: { contains: filter, mode: 'insensitive' } },
        ],
      } : {};

      // Execute queries in parallel
      const [employees, totalCount] = await Promise.all([
        prisma.employee.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          // Select only needed fields
          select: {
            id: true,
            name: true,
            email: true,
            age: true,
            department: true,
            position: true,
            salary: true,
            class: true,
            subjects: true,
            attendance: true,
            avatar: true,
            phone: true,
            address: true,
            startDate: true,
            status: true,
            role: true,
          },
        }),
        includeCount ? prisma.employee.count({ where }) : Promise.resolve(0),
      ]);

      const result = {
        employees: employees.map((e: any) => ({
          ...e,
          subjects: this.parseSubjects(e.subjects),
          startDate: e.startDate ? Math.floor(e.startDate.getTime() / 1000) : null,
        })),
        totalCount,
      };

      // Cache the result
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      
      return result;
    } finally {
      endQuery();
    }
  }

  static async getEmployeeWithOptimization(prisma: PrismaClient, id: number) {
    const cacheKey = `employee_${id}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    const monitor = QueryPerformanceMonitor.getInstance();
    const endQuery = monitor.startQuery('getEmployee');

    try {
      const employee = await prisma.employee.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          age: true,
          department: true,
          position: true,
          salary: true,
          class: true,
          subjects: true,
          attendance: true,
          avatar: true,
          phone: true,
          address: true,
          startDate: true,
          status: true,
          role: true,
        },
      });

      if (!employee) return null;

      const result = {
        ...employee,
        subjects: this.parseSubjects(employee.subjects),
        startDate: employee.startDate ? Math.floor(employee.startDate.getTime() / 1000) : null,
      };

      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      endQuery();
    }
  }

  private static parseSubjects(subjects: string): string[] {
    try {
      return JSON.parse(subjects);
    } catch {
      return [];
    }
  }

  // Clear cache for specific patterns
  static clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // Get cache statistics
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Database connection health check
class DatabaseHealthCheck {
  static async checkConnection(): Promise<{ status: 'healthy' | 'unhealthy'; latency: number }> {
    const startTime = performance.now();
    
    try {
      await prisma.$queryRaw`SELECT 1`;
      const latency = performance.now() - startTime;
      
      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: performance.now() - startTime,
      };
    }
  }

  static async getDatabaseStats(): Promise<any> {
    try {
      const [employeeCount, avgSalary, departmentStats] = await Promise.all([
        prisma.employee.count(),
        prisma.employee.aggregate({
          _avg: { salary: true },
        }),
        prisma.employee.groupBy({
          by: ['department'],
          _count: { id: true },
        }),
      ]);

      return {
        employeeCount,
        avgSalary: avgSalary._avg.salary,
        departmentStats,
        queryStats: QueryPerformanceMonitor.getInstance().getQueryStats(),
        cacheStats: OptimizedQueryBuilder.getCacheStats(),
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return null;
    }
  }
}

export {
  prisma,
  QueryPerformanceMonitor,
  OptimizedQueryBuilder,
  DatabaseHealthCheck,
}; 