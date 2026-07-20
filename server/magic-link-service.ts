import crypto from 'crypto';
import { db } from './db';
import { verificationTokens, users, rateLimitEntries } from '@shared/schema';
import { eq, and, gte, sql, lte } from 'drizzle-orm';
import type { VerificationToken, User, RateLimitEntry } from '@shared/schema';
import { AuthService } from './auth';

export class MagicLinkService {
  private static readonly TOKEN_EXPIRY_MINUTES = 15;
  private static readonly RATE_LIMIT_MINUTES = 15;
  private static readonly MAX_REQUESTS_PER_PERIOD = 3;
  
  static generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  
  static async checkRateLimit(email: string): Promise<{ allowed: boolean; remainingRequests?: number }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.RATE_LIMIT_MINUTES * 60 * 1000);
    
    // Query existing rate limit entry for this email within the current window
    const [rateLimitEntry] = await db
      .select()
      .from(rateLimitEntries)
      .where(
        and(
          eq(rateLimitEntries.email, email),
          gte(rateLimitEntries.windowStart, windowStart)
        )
      );
    
    if (!rateLimitEntry) {
      // No entry exists in the current window, this is allowed
      return { allowed: true, remainingRequests: this.MAX_REQUESTS_PER_PERIOD - 1 };
    }
    
    // Check if we've exceeded the limit
    if (rateLimitEntry.requestCount >= this.MAX_REQUESTS_PER_PERIOD) {
      return { allowed: false, remainingRequests: 0 };
    }
    
    // Still within limits
    return { 
      allowed: true, 
      remainingRequests: this.MAX_REQUESTS_PER_PERIOD - rateLimitEntry.requestCount - 1 
    };
  }
  
  static async updateRateLimit(email: string): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.RATE_LIMIT_MINUTES * 60 * 1000);
    const expiresAt = new Date(now.getTime() + this.RATE_LIMIT_MINUTES * 60 * 1000);
    
    // Find existing entry within the current window
    const [existingEntry] = await db
      .select()
      .from(rateLimitEntries)
      .where(
        and(
          eq(rateLimitEntries.email, email),
          gte(rateLimitEntries.windowStart, windowStart)
        )
      );
    
    if (existingEntry) {
      // Update existing entry
      await db
        .update(rateLimitEntries)
        .set({
          requestCount: existingEntry.requestCount + 1,
          updatedAt: now,
          expiresAt
        })
        .where(eq(rateLimitEntries.id, existingEntry.id));
    } else {
      // Create new entry
      await db
        .insert(rateLimitEntries)
        .values({
          email,
          requestCount: 1,
          windowStart: now,
          expiresAt
        });
    }
  }
  
  static async createMagicLink(email: string): Promise<{ token: string; isNewUser: boolean; user?: User } | null> {
    // Check rate limit
    const rateCheck = await this.checkRateLimit(email);
    if (!rateCheck.allowed) {
      console.log(`Rate limit exceeded for email: ${email}`);
      return null;
    }
    
    // Update rate limit counter
    await this.updateRateLimit(email);
    
    // Check if user exists
    const [existingUser] = await db.select().from(users).where(eq(users.email, email));
    
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_MINUTES * 60 * 1000);
    
    // Create verification token
    await db.insert(verificationTokens).values({
      email,
      userId: existingUser?.id || null,
      token,
      type: 'magic-link',
      expiresAt,
    });
    
    return {
      token,
      isNewUser: !existingUser,
      user: existingUser || undefined
    };
  }
  
  static async verifyMagicLink(token: string): Promise<{ user: User; isNewUser: boolean } | null> {
    if (!token) {
      return null;
    }
    
    // Find valid token
    const [verificationToken] = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.token, token),
          eq(verificationTokens.type, 'magic-link'),
          gte(verificationTokens.expiresAt, new Date())
        )
      );
    
    if (!verificationToken) {
      console.log('Invalid or expired magic link token');
      return null;
    }
    
    // Check if token has already been used
    if (verificationToken.usedAt) {
      console.log('Magic link token has already been used');
      return null;
    }
    
    // Mark token as used
    await db
      .update(verificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(verificationTokens.id, verificationToken.id));
    
    let user: User;
    let isNewUser = false;
    
    if (verificationToken.userId) {
      // Existing user
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, verificationToken.userId));
      
      if (!existingUser) {
        console.error('User not found for token');
        return null;
      }
      
      // Update last login and mark email as verified
      await db
        .update(users)
        .set({ 
          lastLogin: new Date(),
          isEmailVerified: true
        })
        .where(eq(users.id, existingUser.id));
      
      const { password, ...userWithoutPassword } = existingUser;
      user = userWithoutPassword as User;
    } else {
      // New user - create account
      isNewUser = true;
      
      // Generate username from email
      const emailParts = verificationToken.email.split('@');
      const baseUsername = emailParts[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Check for username conflicts and add number if needed
      let username = baseUsername;
      let counter = 1;
      while (true) {
        const [existingUsername] = await db
          .select()
          .from(users)
          .where(eq(users.username, username));
        
        if (!existingUsername) break;
        username = `${baseUsername}${counter}`;
        counter++;
      }
      
      // Create new user with random password (won't be used for magic link auth)
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await AuthService.hashPassword(randomPassword);
      
      const [newUser] = await db
        .insert(users)
        .values({
          email: verificationToken.email,
          username,
          password: hashedPassword,
          isEmailVerified: true,
          lastLogin: new Date(),
          role: 'student'
        })
        .returning();
      
      const { password, ...userWithoutPassword } = newUser;
      user = userWithoutPassword as User;
    }
    
    return { user, isNewUser };
  }
  
  static async cleanupExpiredTokens(): Promise<void> {
    // Delete expired tokens older than 24 hours
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    await db
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.type, 'magic-link'),
          sql`${verificationTokens.expiresAt} < ${cutoffDate}`
        )
      );
  }
  
  static async cleanupExpiredRateLimits(): Promise<void> {
    // Delete expired rate limit entries
    const now = new Date();
    
    await db
      .delete(rateLimitEntries)
      .where(lte(rateLimitEntries.expiresAt, now));
  }
}