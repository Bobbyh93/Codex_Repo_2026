import type { Request, Response, NextFunction } from 'express';
import { AppLogger } from '../logger';

// Request tracking
interface RequestMetrics {
  method: string;
  path: string;
  startTime: number;
  ip?: string;
  userAgent?: string;
  userId?: string;
}

const activeRequests = new Map<string, RequestMetrics>();
let requestCounter = 0;

// Performance monitoring middleware
export function performanceMonitor(req: Request, res: Response, next: NextFunction) {
  const requestId = `${Date.now()}-${++requestCounter}`;
  const startTime = Date.now();
  
  // Track request
  activeRequests.set(requestId, {
    method: req.method,
    path: req.path,
    startTime,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req as any).user?.userId,
  });

  // Monitor response
  const originalSend = res.send;
  res.send = function(data) {
    res.send = originalSend;
    const duration = Date.now() - startTime;
    
    // Log API performance
    AppLogger.api(req.method, req.path, res.statusCode, duration, {
      requestId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: (req as any).user?.userId,
      responseSize: JSON.stringify(data).length,
    });

    // Log slow requests
    if (duration > 1000) {
      AppLogger.performance('slow_request', duration, 'ms', {
        method: req.method,
        path: req.path,
        threshold: 1000,
      });
    }

    // Clean up tracking
    activeRequests.delete(requestId);

    return originalSend.call(this, data);
  };

  next();
}

// Memory usage monitoring
export function memoryMonitor() {
  setInterval(() => {
    const usage = process.memoryUsage();
    AppLogger.performance('memory_heap_used', Math.round(usage.heapUsed / 1024 / 1024), 'MB', {
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
    });

    // Alert on high memory usage
    const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
    if (heapUsedPercent > 90) {
      AppLogger.warn('High memory usage detected', {
        heapUsedPercent: heapUsedPercent.toFixed(2),
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      });
    }
  }, 60000); // Check every minute
}

// Active connections monitoring
export function connectionMonitor() {
  setInterval(() => {
    AppLogger.performance('active_requests', activeRequests.size, 'connections', {
      requests: Array.from(activeRequests.values()).map(r => ({
        method: r.method,
        path: r.path,
        duration: Date.now() - r.startTime,
      })),
    });
  }, 30000); // Check every 30 seconds
}

// Database query monitoring
export function databaseQueryMonitor(query: string, duration: number, table?: string) {
  AppLogger.database('query', table || 'unknown', {
    query: query.substring(0, 200), // Truncate long queries
    duration,
    slow: duration > 100,
  });

  if (duration > 100) {
    AppLogger.performance('slow_query', duration, 'ms', {
      query: query.substring(0, 100),
      table,
    });
  }
}

// CPU usage monitoring
export function cpuMonitor() {
  let previousCpuUsage = process.cpuUsage();
  
  setInterval(() => {
    const currentCpuUsage = process.cpuUsage(previousCpuUsage);
    const totalCpuTime = (currentCpuUsage.user + currentCpuUsage.system) / 1000; // Convert to ms
    const cpuPercent = (totalCpuTime / 30000) * 100; // 30 second interval
    
    AppLogger.performance('cpu_usage', cpuPercent, '%', {
      user: currentCpuUsage.user / 1000,
      system: currentCpuUsage.system / 1000,
    });

    if (cpuPercent > 80) {
      AppLogger.warn('High CPU usage detected', {
        cpuPercent: cpuPercent.toFixed(2),
      });
    }

    previousCpuUsage = process.cpuUsage();
  }, 30000); // Check every 30 seconds
}

// Error rate monitoring
let errorCount = 0;
let requestCount = 0;
let windowStart = Date.now();

export function errorRateMonitor(isError: boolean) {
  requestCount++;
  if (isError) errorCount++;

  // Calculate error rate every minute
  const now = Date.now();
  if (now - windowStart > 60000) {
    const errorRate = (errorCount / requestCount) * 100;
    
    AppLogger.performance('error_rate', errorRate, '%', {
      errors: errorCount,
      requests: requestCount,
      window: '1min',
    });

    if (errorRate > 5) {
      AppLogger.security('high_error_rate', 'medium', {
        errorRate: errorRate.toFixed(2),
        errors: errorCount,
        requests: requestCount,
      });
    }

    // Reset counters
    errorCount = 0;
    requestCount = 0;
    windowStart = now;
  }
}

// Initialize all monitors
export function initializeMonitoring() {
  memoryMonitor();
  connectionMonitor();
  cpuMonitor();
  
  AppLogger.info('Monitoring system initialized', {
    monitors: ['memory', 'connections', 'cpu', 'errors', 'performance'],
  });
}