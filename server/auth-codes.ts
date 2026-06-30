import crypto from 'crypto';
import { db } from './db';
import { users, emailVerificationCodes } from '@shared/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import { AuthService } from './auth';
import type { User } from '@shared/schema';

export class EmailAuthService {
  // Generate a 6-digit verification code
  static generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Create verification code for email
  static async createVerificationCode(email: string): Promise<{ code: string; isNewUser: boolean }> {
    const normalizedEmail = email.toLowerCase();
    
    // Check if user exists
    let user = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail)
    });

    const isNewUser = !user;
    
    // If user doesn't exist, create a placeholder user
    if (!user) {
      const [newUser] = await db.insert(users).values({
        email: normalizedEmail,
        username: normalizedEmail.split('@')[0] + '_' + Date.now(),
        password: crypto.randomBytes(32).toString('hex'), // Random password since we're using email auth
        isEmailVerified: false
      }).returning();
      user = newUser;
    }

    // Generate verification code
    const code = this.generateVerificationCode();
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Delete any existing codes for this email
    await db.delete(emailVerificationCodes)
      .where(eq(emailVerificationCodes.email, normalizedEmail));

    // Store new code
    await db.insert(emailVerificationCodes).values({
      email: normalizedEmail,
      userId: user.id,
      code: hashedCode,
      expiresAt
    });

    return { code, isNewUser };
  }

  // Verify code and login
  static async verifyCodeAndLogin(email: string, code: string, stayLoggedIn: boolean = false): Promise<{ user: User; token: string }> {
    const normalizedEmail = email.toLowerCase();
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    
    // Find valid code
    const verificationCode = await db.query.emailVerificationCodes.findFirst({
      where: and(
        eq(emailVerificationCodes.email, normalizedEmail),
        eq(emailVerificationCodes.code, hashedCode),
        eq(emailVerificationCodes.used, false),
        gt(emailVerificationCodes.expiresAt, new Date())
      ),
      with: {
        user: true
      }
    });

    if (!verificationCode || !verificationCode.user) {
      throw new Error('Invalid or expired verification code');
    }

    // Mark code as used
    await db.update(emailVerificationCodes)
      .set({ 
        used: true,
        usedAt: new Date()
      })
      .where(eq(emailVerificationCodes.id, verificationCode.id));

    // Update user's email verification status and last login
    await db.update(users)
      .set({ 
        isEmailVerified: true,
        lastLogin: new Date()
      })
      .where(eq(users.id, verificationCode.userId));

    // Generate JWT token with stayLoggedIn option
    const token = AuthService.generateToken({
      userId: verificationCode.user.id,
      email: verificationCode.user.email,
      role: verificationCode.user.role || 'student'
    }, stayLoggedIn);

    return { user: verificationCode.user, token };
  }

  // Clean up expired codes (maintenance task)
  static async cleanupExpiredCodes(): Promise<void> {
    // CRITICAL BUG FIX: Delete codes that are either used OR expired
    // Previous logic was inverted - it deleted non-expired codes!
    const now = new Date();
    await db.delete(emailVerificationCodes)
      .where(
        sql`${emailVerificationCodes.used} = true OR ${emailVerificationCodes.expiresAt} < ${now}`
      );
  }
}