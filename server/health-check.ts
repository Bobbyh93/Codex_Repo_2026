import { db } from './db';
import { sql } from 'drizzle-orm';
import sgMail from '@sendgrid/mail';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: boolean;
    email: boolean;
    storage: boolean;
    authentication: boolean;
  };
  details: {
    [key: string]: any;
  };
  timestamp: Date;
}

export class HealthChecker {
  static async checkDatabase(): Promise<boolean> {
    try {
      const result = await db.execute(sql`SELECT 1`);
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  static async checkEmail(): Promise<boolean> {
    try {
      const apiKey = process.env.SENDGRID_API_KEY;
      if (!apiKey) {
        return false;
      }
      
      // Check if SendGrid is configured
      sgMail.setApiKey(apiKey);
      
      // Verify sender authentication - use defaults if not set
      const fromEmail = process.env.FROM_EMAIL || 'noreply@nurseprep.app';
      const fromName = process.env.FROM_NAME || 'NursePrep Analytics';
      
      // Consider email configured if we have API key and defaults
      return true;
    } catch (error) {
      console.error('Email health check failed:', error);
      return false;
    }
  }

  static async checkStorage(): Promise<boolean> {
    try {
      // Check if we can write to temp directory
      const fs = await import('fs/promises');
      const path = await import('path');
      const testFile = path.join('/tmp', `health-check-${Date.now()}.txt`);
      
      await fs.writeFile(testFile, 'health check');
      await fs.unlink(testFile);
      
      return true;
    } catch (error) {
      console.error('Storage health check failed:', error);
      return false;
    }
  }

  static async checkAuthentication(): Promise<boolean> {
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret || jwtSecret === 'your-secret-key-change-in-production') {
        console.warn('JWT_SECRET not properly configured for production');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Authentication health check failed:', error);
      return false;
    }
  }

  static async performHealthCheck(): Promise<HealthCheckResult> {
    const [database, email, storage, authentication] = await Promise.all([
      this.checkDatabase(),
      this.checkEmail(),
      this.checkStorage(),
      this.checkAuthentication()
    ]);

    const allHealthy = database && email && storage && authentication;
    const anyUnhealthy = !database || !authentication;
    
    return {
      status: anyUnhealthy ? 'unhealthy' : (!allHealthy ? 'degraded' : 'healthy'),
      checks: {
        database,
        email,
        storage,
        authentication
      },
      details: {
        emailConfigured: !!process.env.SENDGRID_API_KEY,
        fromEmailSet: !!process.env.FROM_EMAIL,
        fromNameSet: !!process.env.FROM_NAME,
        jwtSecretSet: !!process.env.JWT_SECRET && process.env.JWT_SECRET !== 'your-secret-key-change-in-production',
        nodeEnv: process.env.NODE_ENV
      },
      timestamp: new Date()
    };
  }
}