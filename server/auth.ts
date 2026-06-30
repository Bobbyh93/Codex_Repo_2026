import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { User, InsertUser } from '@shared/schema';

// Require JWT_SECRET environment variable - no fallback for security
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static generateToken(payload: AuthPayload, stayLoggedIn: boolean = false): string {
    // Extended expiration for "stay logged in" (30 days) vs normal (7 days)
    const expiresIn = stayLoggedIn ? '30d' : '7d';
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
  }

  static verifyToken(token: string): AuthPayload {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  }

  static async register(userData: InsertUser): Promise<{ user: User; token: string }> {
    // Check if user already exists
    const [existingUser] = await db.select().from(users).where(eq(users.email, userData.email));
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(userData.password);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        ...userData,
        password: hashedPassword,
      })
      .returning();

    // Generate token
    const token = this.generateToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role || 'student',
    });

    // Remove password from response
    const { password, ...userWithoutPassword } = newUser;

    return { user: userWithoutPassword as User, token };
  }

  static async login(email: string, password: string): Promise<{ user: User; token: string }> {
    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    // Generate token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role || 'student',
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword as User, token };
  }

  static async getUserById(userId: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return null;

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  static async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    // Don't allow password updates through this method
    const { password, ...safeUpdates } = updates as any;

    const [updatedUser] = await db
      .update(users)
      .set({
        ...safeUpdates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    const { password: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword as User;
  }

  static async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      throw new Error('User not found');
    }

    // Verify old password
    const isValidPassword = await this.verifyPassword(oldPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await this.hashPassword(newPassword);

    // Update password
    await db
      .update(users)
      .set({ 
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }
}