"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestMonitor = exports.MemoryMonitor = exports.PerformanceMetrics = exports.getOptimizationRecommendations = exports.performanceMetrics = exports.healthCheck = exports.performanceMiddleware = void 0;
const perf_hooks_1 = require("perf_hooks");
const databaseOptimizer_1 = require("./databaseOptimizer");
const graphqlOptimizer_1 = require("./graphqlOptimizer");
// Performance metrics collection
class PerformanceMetrics {
    constructor() {
        this.metrics = new Map();
        this.startTime = Date.now();
    }
    static getInstance() {
        if (!PerformanceMetrics.instance) {
            PerformanceMetrics.instance = new PerformanceMetrics();
        }
        return PerformanceMetrics.instance;
    }
    recordMetric(name, value) {
        this.metrics.set(name, {
            value,
            timestamp: Date.now(),
        });
    }
    getMetrics() {
        const result = {};
        for (const [key, data] of this.metrics.entries()) {
            result[key] = data;
        }
        return result;
    }
    getUptime() {
        return Date.now() - this.startTime;
    }
}
exports.PerformanceMetrics = PerformanceMetrics;
// Memory usage monitoring
class MemoryMonitor {
    static getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            rss: Math.round(usage.rss / 1024 / 1024), // MB
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
            external: Math.round(usage.external / 1024 / 1024), // MB
            arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024), // MB
        };
    }
    static getMemoryStats() {
        const usage = this.getMemoryUsage();
        const percentage = (usage.heapUsed / usage.heapTotal) * 100;
        return {
            usage,
            percentage: Math.round(percentage * 100) / 100,
            warning: percentage > 80,
        };
    }
}
exports.MemoryMonitor = MemoryMonitor;
// Request rate limiting and monitoring
class RequestMonitor {
    static recordRequest(endpoint, duration) {
        const now = Date.now();
        // Reset counters if needed
        if (!this.requestCounts.has(endpoint) ||
            now - this.requestCounts.get(endpoint).lastReset > this.resetInterval) {
            this.requestCounts.set(endpoint, { count: 0, lastReset: now });
            this.requestTimes.set(endpoint, []);
        }
        // Update counters
        const countData = this.requestCounts.get(endpoint);
        countData.count++;
        // Record response time
        const times = this.requestTimes.get(endpoint);
        times.push(duration);
        // Keep only last 100 times for average calculation
        if (times.length > 100) {
            times.shift();
        }
    }
    static getRequestStats() {
        const stats = {};
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
exports.RequestMonitor = RequestMonitor;
RequestMonitor.requestCounts = new Map();
RequestMonitor.requestTimes = new Map();
RequestMonitor.resetInterval = 60000; // 1 minute
// Performance monitoring middleware
const performanceMiddleware = (req, res, next) => {
    const startTime = perf_hooks_1.performance.now();
    const endpoint = `${req.method} ${req.path}`;
    // Add performance headers
    res.setHeader('X-Response-Time', '0ms');
    res.setHeader('X-Request-ID', Math.random().toString(36).substring(7));
    // Override end method to capture response time
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
        const duration = perf_hooks_1.performance.now() - startTime;
        res.setHeader('X-Response-Time', `${Math.round(duration)}ms`);
        // Record request metrics
        RequestMonitor.recordRequest(endpoint, duration);
        return originalEnd.call(this, chunk, encoding);
    };
    next();
};
exports.performanceMiddleware = performanceMiddleware;
// Health check endpoint
const healthCheck = async (req, res) => {
    const startTime = perf_hooks_1.performance.now();
    try {
        const [dbHealth, memoryStats] = await Promise.all([
            databaseOptimizer_1.DatabaseHealthCheck.checkConnection(),
            Promise.resolve(MemoryMonitor.getMemoryStats()),
        ]);
        const responseTime = perf_hooks_1.performance.now() - startTime;
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
    }
    catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.healthCheck = healthCheck;
// Performance metrics endpoint
const performanceMetrics = (req, res) => {
    const metrics = {
        timestamp: new Date().toISOString(),
        uptime: PerformanceMetrics.getInstance().getUptime(),
        memory: MemoryMonitor.getMemoryStats(),
        requests: RequestMonitor.getRequestStats(),
        database: {
            queryStats: databaseOptimizer_1.QueryPerformanceMonitor.getInstance().getQueryStats(),
            health: databaseOptimizer_1.DatabaseHealthCheck.checkConnection(),
        },
        graphql: {
            operationStats: graphqlOptimizer_1.GraphQLPerformanceMonitor.getOperationStats(),
            cacheStats: graphqlOptimizer_1.GraphQLCache.getStats(),
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
exports.performanceMetrics = performanceMetrics;
// Performance optimization recommendations
const getOptimizationRecommendations = (req, res) => {
    const recommendations = [];
    const memoryStats = MemoryMonitor.getMemoryStats();
    const requestStats = RequestMonitor.getRequestStats();
    const queryStats = databaseOptimizer_1.QueryPerformanceMonitor.getInstance().getQueryStats();
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
exports.getOptimizationRecommendations = getOptimizationRecommendations;
