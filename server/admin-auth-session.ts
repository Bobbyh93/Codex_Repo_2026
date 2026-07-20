import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { users, adminUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Extend Express session to include admin user
declare module 'express-session' {
  interface SessionData {
    adminUser?: {
      userId: string;
      email: string;
      role: string;
      permissions: string[];
      loginTime: Date;
      lastActivity: Date;
    };
  }
}

export interface AdminAuthRequest extends Request {
  adminUser?: {
    userId: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

// Session configuration
const SESSION_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours
const ACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity

// Sensitive fields that should never be logged
const SENSITIVE_FIELDS = ['password', 'passwordHash', 'token', 'secret', 'apiKey', 'apiSecret', 'refreshToken', 'accessToken', 'authToken', 'sessionId', 'csrfToken'];

// CSRF token storage for validation
const csrfTokens = new Map<string, { token: string; expires: number }>();

export class AdminAuthSession {
  /**
   * Authenticate admin user and create session
   */
  static async login(req: Request, email: string, password: string): Promise<any> {
    try {
      const normalizedEmail = email.toLowerCase();
      
      // Find user
      const user = await db.query.users.findFirst({
        where: eq(users.email, normalizedEmail)
      });

      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Check if user is an admin
      const adminRecord = await db.query.adminUsers.findFirst({
        where: eq(adminUsers.userId, user.id)
      });

      if (!adminRecord || !adminRecord.isActive) {
        throw new Error('Access denied. Admin privileges required.');
      }

      // Regenerate session ID to prevent session fixation
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Create session with CSRF token
      const csrfToken = this.generateCSRFToken();
      req.session.adminUser = {
        userId: user.id,
        email: user.email,
        role: 'admin',
        permissions: adminRecord.permissions || ['full_access'],
        loginTime: new Date(),
        lastActivity: new Date()
      };
      
      // Store CSRF token with expiry
      csrfTokens.set(req.sessionID, {
        token: csrfToken,
        expires: Date.now() + SESSION_TIMEOUT
      });

      // Update last login
      await db.update(users)
        .set({ lastLogin: new Date() })
        .where(eq(users.id, user.id));

      await db.update(adminUsers)
        .set({ updatedAt: new Date() })
        .where(eq(adminUsers.id, adminRecord.id));

      // Log successful login
      console.log(`Admin login successful: ${email} at ${new Date().toISOString()}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: 'admin',
          permissions: adminRecord.permissions
        },
        csrfToken: csrfTokens.get(req.sessionID)?.token
      };
    } catch (error) {
      // Log failed login attempt
      console.error(`Admin login failed for ${email}: ${error}`);
      throw error;
    }
  }

  /**
   * Logout admin user and destroy session
   */
  static async logout(req: Request): Promise<void> {
    const adminEmail = req.session.adminUser?.email;
    const sessionId = req.sessionID;
    
    // Remove CSRF token
    if (sessionId) {
      csrfTokens.delete(sessionId);
    }
    
    return new Promise((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          console.error(`Admin logout failed for ${adminEmail}:`, err);
          reject(err);
        } else {
          console.log(`Admin logout successful: ${adminEmail} at ${new Date().toISOString()}`);
          resolve();
        }
      });
    });
  }

  /**
   * Check if current session is valid
   */
  static isSessionValid(req: Request): boolean {
    if (!req.session.adminUser) {
      return false;
    }

    const now = Date.now();
    const loginTime = new Date(req.session.adminUser.loginTime).getTime();
    const lastActivity = new Date(req.session.adminUser.lastActivity).getTime();

    // Check session timeout
    if (now - loginTime > SESSION_TIMEOUT) {
      return false;
    }

    // Check inactivity timeout
    if (now - lastActivity > ACTIVITY_TIMEOUT) {
      return false;
    }

    return true;
  }

  /**
   * Update last activity time
   */
  static updateActivity(req: Request): void {
    if (req.session.adminUser) {
      req.session.adminUser.lastActivity = new Date();
    }
  }

  /**
   * Check if user has specific permission
   */
  static hasPermission(req: Request, permission: string): boolean {
    const permissions = req.session.adminUser?.permissions || [];
    return permissions.includes('full_access') || permissions.includes(permission);
  }

  /**
   * Generate CSRF token for admin forms
   */
  static generateCSRFToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate CSRF token
   */
  static validateCSRFToken(token: string, sessionId: string): boolean {
    const stored = csrfTokens.get(sessionId);
    if (!stored) return false;
    
    // Check expiry
    if (stored.expires < Date.now()) {
      csrfTokens.delete(sessionId);
      return false;
    }
    
    return token === stored.token && token.length === 64;
  }

  /**
   * Get CSRF token for session
   */
  static getCSRFToken(sessionId: string): string | undefined {
    const stored = csrfTokens.get(sessionId);
    if (!stored || stored.expires < Date.now()) {
      return undefined;
    }
    return stored.token;
  }

  /**
   * Clean expired CSRF tokens
   */
  static cleanExpiredTokens(): void {
    const now = Date.now();
    for (const [sessionId, data] of Array.from(csrfTokens.entries())) {
      if (data.expires < now) {
        csrfTokens.delete(sessionId);
      }
    }
  }
}

/**
 * Middleware to require admin authentication
 */
export function requireAdminSession(req: AdminAuthRequest, res: Response, next: NextFunction) {
  // Check if session exists and is valid
  if (!AdminAuthSession.isSessionValid(req)) {
    // Clear invalid session
    if (req.session.adminUser) {
      req.session.destroy(() => {});
    }
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'SESSION_EXPIRED'
    });
  }

  // Update activity timestamp
  AdminAuthSession.updateActivity(req);

  // Attach admin user to request
  req.adminUser = {
    userId: req.session.adminUser!.userId,
    email: req.session.adminUser!.email,
    role: req.session.adminUser!.role,
    permissions: req.session.adminUser!.permissions
  };

  next();
}

/**
 * Middleware to require specific permission
 */
export function requirePermission(permission: string) {
  return (req: AdminAuthRequest, res: Response, next: NextFunction) => {
    if (!req.adminUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!AdminAuthSession.hasPermission(req, permission)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permission
      });
    }

    next();
  };
}

/**
 * Sanitize data to remove sensitive fields
 */
function sanitizeData(data: any): any {
  if (!data) return data;
  
  if (typeof data === 'string') {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  
  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
      // Check if key contains sensitive field name
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_FIELDS.some(field => 
        lowerKey.includes(field.toLowerCase())
      );
      
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeData(data[key]);
      }
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Audit logging middleware for admin actions
 */
export function auditLog(action: string) {
  return (req: AdminAuthRequest, res: Response, next: NextFunction) => {
    const timestamp = new Date().toISOString();
    const user = req.adminUser?.email || req.session?.adminUser?.email || 'unknown';
    const ip = req.ip || req.socket.remoteAddress;
    const method = req.method;
    const path = req.path;
    
    // Sanitize body to remove sensitive data
    const sanitizedBody = req.body ? sanitizeData(req.body) : null;
    const bodyStr = sanitizedBody ? JSON.stringify(sanitizedBody).substring(0, 200) : '';

    console.log(`[ADMIN AUDIT] ${timestamp} | ${user} | ${ip} | ${action} | ${method} ${path} | ${bodyStr}`);

    // Store original end function
    const originalEnd = res.end;
    
    // Override end function to log response
    res.end = function(this: Response, ...args: any[]): Response {
      const statusCode = res.statusCode;
      console.log(`[ADMIN AUDIT RESULT] ${timestamp} | ${user} | ${action} | Status: ${statusCode}`);
      
      // Call original end function with proper arguments
      return originalEnd.apply(this, args as any);
    } as any;

    next();
  };
}

/**
 * Middleware to validate CSRF token
 */
export function validateCSRFToken(req: AdminAuthRequest, res: Response, next: NextFunction) {
  // Skip CSRF check for GET requests
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const token = req.headers['x-csrf-token'] as string || req.body?.csrfToken;
  const sessionId = req.sessionID;

  if (!token || !sessionId) {
    return res.status(403).json({ 
      error: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING'
    });
  }

  if (!AdminAuthSession.validateCSRFToken(token, sessionId)) {
    return res.status(403).json({ 
      error: 'Invalid CSRF token',
      code: 'CSRF_TOKEN_INVALID'
    });
  }

  next();
}

// Clean up expired tokens periodically
setInterval(() => {
  AdminAuthSession.cleanExpiredTokens();
}, 60 * 60 * 1000); // Every hour