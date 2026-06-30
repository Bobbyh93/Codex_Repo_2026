import crypto from 'crypto';
import { db } from './db';
import { users, passwordResetTokens } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import { AuthService } from './auth';
import type { User } from '@shared/schema';

export class PasswordRecoveryService {
  // Generate a secure reset token
  static generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Create password reset token for user
  static async createPasswordResetToken(email: string): Promise<{ token: string; user: User }> {
    // Find user by email
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase())
    });

    if (!user) {
      // Don't reveal whether email exists in system for security
      throw new Error('If an account exists with this email, a password reset link will be sent');
    }

    // Generate token
    const token = this.generateResetToken();
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    // Store token in database
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token: hashedToken,
      expiresAt
    });

    return { token, user };
  }

  // Verify reset token and get user
  static async verifyResetToken(token: string): Promise<User> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Find valid token
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.token, hashedToken),
        eq(passwordResetTokens.used, false),
        gt(passwordResetTokens.expiresAt, new Date())
      ),
      with: {
        user: true
      }
    });

    if (!resetToken || !resetToken.user) {
      throw new Error('Invalid or expired reset token');
    }

    return resetToken.user;
  }

  // Reset password using token
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Find valid token
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.token, hashedToken),
        eq(passwordResetTokens.used, false),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    });

    if (!resetToken) {
      throw new Error('Invalid or expired reset token');
    }

    // Update user password
    const hashedPassword = await AuthService.hashPassword(newPassword);
    await db.update(users)
      .set({ 
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, resetToken.userId));

    // Mark token as used
    await db.update(passwordResetTokens)
      .set({ 
        used: true,
        usedAt: new Date()
      })
      .where(eq(passwordResetTokens.id, resetToken.id));
  }

  // Clean up expired tokens (maintenance task)
  static async cleanupExpiredTokens(): Promise<void> {
    // Delete tokens that are either used OR expired
    const now = new Date();
    await db.delete(passwordResetTokens)
      .where(
        sql`${passwordResetTokens.used} = true OR ${passwordResetTokens.expiresAt} < ${now}`
      );
  }
}