import v8 from 'v8';
import { db } from './db';
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

export class HealthCheckService {
  private static startTime = Date.now();

  // Check database connectivity
  static async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      // Run a simple query to test connectivity
      await db.execute(sql`SELECT 1`);
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
    // Measured against the heap ceiling, not heapTotal. heapTotal is only what
    // V8 has committed so far and grows on demand, so heapUsed/heapTotal sits
    // near 100% routinely just before a GC -- it says nothing about pressure.
    const heapLimit = v8.getHeapStatistics().heap_size_limit;
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
      const { EmailService } = await import('./email-service');
      // testConnection returns { success, error? }. The object is always
      // truthy, so testing it directly reported 'ok' even when unconfigured.
      const { success } = await EmailService.testConnection();
      
      return {
        status: success ? 'ok' : 'warning',
        message: success ? 'Email service configured' : 'Email service not configured',
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
  // includeEmail is opt-in to keep the probe path minimal: /health is the
  // platform health probe and runs continuously, and email reachability is not
  // part of whether this instance can serve requests. (checkEmailService is
  // local-only -- it validates the SendGrid API key string and makes no network
  // call -- so this is about scope, not latency.)
  static async performHealthCheck(
    options: { includeEmail?: boolean } = {},
  ): Promise<HealthCheckResult> {
    const [database, email] = await Promise.all([
      this.checkDatabase(),
      options.includeEmail ? this.checkEmailService() : Promise.resolve(undefined),
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
      const health = await HealthCheckService.performHealthCheck({
        includeEmail: req.query.email === '1',
      });
      // The HTTP status answers one question only: can this instance serve
      // requests? That is the database being reachable. Memory pressure is
      // reported in the body but does not fail the probe -- an instance under
      // memory pressure still serves, and failing here would have the platform
      // restart it in a loop. health.status still carries the fuller verdict.
      const statusCode = health.checks.database.status === 'error' ? 503 : 200;
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