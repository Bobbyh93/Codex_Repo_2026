import { db } from './db';
import { getHeapStatistics } from 'v8';
import { sql } from 'drizzle-orm';
import { AppLogger } from './logger';
import type { Express } from 'express';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    memory: HealthCheck;
    disk?: HealthCheck;
    email?: HealthCheck;
  };
  version: string;
  environment: string;
}

interface HealthCheck {
  status: 'ok' | 'warning' | 'error';
  message?: string;
  responseTime?: number;
  details?: any;
}

// Bound a health probe so /health cannot hang. The pool has no statement
// timeout, so a database that accepts the connection but never answers would
// otherwise leave the request open until the platform health check gives up,
// which reports nothing and looks identical to a slow deploy.
async function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    // Promise.race subscribes to `work`, so a later rejection stays handled.
    return await Promise.race([work, expiry]);
  } finally {
    clearTimeout(timer);
  }
}

export class HealthCheckService {
  private static startTime = Date.now();

  // A SELECT 1 that has not answered in this long means the database is not
  // serving, which is exactly what this endpoint should report.
  private static readonly DB_TIMEOUT_MS = 5000;

  // Check database connectivity
  static async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      // Run a simple query to test connectivity
      await withTimeout(db.execute(sql`SELECT 1`), this.DB_TIMEOUT_MS, 'Database health check');
      const responseTime = Date.now() - start;
      
      return {
        status: responseTime < 100 ? 'ok' : 'warning',
        responseTime,
        message: responseTime < 100 ? 'Database responding normally' : 'Database response slow',
      };
    } catch (error) {
      AppLogger.error('Database health check failed', error as Error);
      return {
        status: 'error',
        message: 'Database connection failed',
        details: (error as Error).message,
      };
    }
  }

  // Check memory usage
  static checkMemory(): HealthCheck {
    const usage = process.memoryUsage();
    // Measure against V8's hard heap ceiling, not heapTotal. heapTotal is only
    // the currently committed heap, which V8 grows on demand, so a healthy
    // process routinely sits above 90% of it right before a GC or a heap
    // expansion. Using it here would report 'error' -> 'unhealthy' -> 503 on a
    // process that is fine, and /health is the Render healthCheckPath.
    const heapLimit = getHeapStatistics().heap_size_limit;
    const heapUsedPercent = (usage.heapUsed / heapLimit) * 100;

    let status: 'ok' | 'warning' | 'error' = 'ok';
    let message = 'Memory usage normal';
    
    if (heapUsedPercent > 90) {
      status = 'error';
      message = 'Critical memory usage';
    } else if (heapUsedPercent > 75) {
      status = 'warning';
      message = 'High memory usage';
    }

    return {
      status,
      message,
      details: {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        heapLimit: Math.round(heapLimit / 1024 / 1024),
        rss: Math.round(usage.rss / 1024 / 1024),
        heapUsedPercent: heapUsedPercent.toFixed(2),
      },
    };
  }

  // Check email service
  static async checkEmailService(): Promise<HealthCheck> {
    try {
      // Email delivery is opt-in. When it is switched off this is a deliberate
      // configuration, not a fault, so do not report it as a warning - /health
      // is polled continuously and a permanent 'degraded' would log on every
      // poll and bury real problems.
      if (process.env.ENABLE_EMAIL_DELIVERY !== 'true') {
        return {
          status: 'ok',
          message: 'Email delivery disabled',
        };
      }

      const { EmailService } = await import('./email-service');
      // testConnection resolves to { success, error? }; the object is always
      // truthy, so this must read .success rather than the result itself.
      const result = await EmailService.testConnection();

      return {
        status: result.success ? 'ok' : 'warning',
        message: result.success
          ? 'Email service configured'
          : result.error ?? 'Email service not configured',
      };
    } catch (error) {
      return {
        status: 'warning',
        message: 'Email service check failed',
        details: (error as Error).message,
      };
    }
  }

  // Comprehensive health check
  static async performHealthCheck(): Promise<HealthCheckResult> {
    const [database, email] = await Promise.all([
      this.checkDatabase(),
      this.checkEmailService(),
    ]);

    const memory = this.checkMemory();
    
    // Determine overall status
    const checks = { database, memory, email };
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (database.status === 'error' || memory.status === 'error') {
      overallStatus = 'unhealthy';
    } else if (database.status === 'warning' || memory.status === 'warning' || email?.status === 'warning') {
      overallStatus = 'degraded';
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks,
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    // Log health status changes
    if (overallStatus !== 'healthy') {
      AppLogger.warn('Health check detected issues', result);
    }

    return result;
  }

  // Simple liveness check (for k8s liveness probe)
  static liveness(): { status: 'ok'; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  // Readiness check (for k8s readiness probe)
  static async readiness(): Promise<{ ready: boolean; checks: any }> {
    const database = await this.checkDatabase();
    const memory = this.checkMemory();
    
    const ready = database.status !== 'error' && memory.status !== 'error';
    
    return {
      ready,
      checks: {
        database: database.status,
        memory: memory.status,
      },
    };
  }
}

// Register health check endpoints
export function registerHealthEndpoints(app: Express) {
  // Comprehensive health check
  app.get('/health', async (req, res) => {
    try {
      const health = await HealthCheckService.performHealthCheck();
      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      AppLogger.error('Health check endpoint error', error as Error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
      });
    }
  });

  // Simple liveness probe
  app.get('/health/live', (req, res) => {
    res.json(HealthCheckService.liveness());
  });

  // Readiness probe
  app.get('/health/ready', async (req, res) => {
    try {
      const readiness = await HealthCheckService.readiness();
      res.status(readiness.ready ? 200 : 503).json(readiness);
    } catch (error) {
      res.status(503).json({ ready: false, error: 'Readiness check failed' });
    }
  });

  // Metrics endpoint
  app.get('/metrics', (req, res) => {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    res.json({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        rss: usage.rss,
        external: usage.external,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      pid: process.pid,
      version: process.version,
      platform: process.platform,
      arch: process.arch,
    });
  });

  AppLogger.info('Health check endpoints registered', {
    endpoints: ['/health', '/health/live', '/health/ready', '/metrics'],
  });
}