import { db } from './db';
import { users, adminUsers } from '@shared/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import type { User } from '@shared/schema';

export interface AdminConfig {
  email: string;
  permissions: string[];
  addedBy?: string;
  notes?: string;
}

export class AdminManagementService {
  // Get all admins
  static async getAllAdmins(): Promise<any[]> {
    const admins = await db.query.adminUsers.findMany({
      with: {
        user: {
          columns: {
            password: false // Don't return password
          }
        }
      },
      orderBy: (adminUsers, { desc }) => [desc(adminUsers.createdAt)]
    });
    
    return admins;
  }

  // Add admin by email
  static async addAdmin(adminConfig: AdminConfig): Promise<any> {
    const normalizedEmail = adminConfig.email.toLowerCase();
    
    // Check if user exists
    let user = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail)
    });

    // If user doesn't exist, create a placeholder
    if (!user) {
      const [newUser] = await db.insert(users).values({
        email: normalizedEmail,
        username: normalizedEmail.split('@')[0] + '_admin',
        password: 'pending_email_verification', // They'll login via email
        role: 'admin',
        isEmailVerified: false
      }).returning();
      user = newUser;
    } else {
      // Update existing user role to admin
      await db.update(users)
        .set({ role: 'admin' })
        .where(eq(users.id, user.id));
    }

    // Check if already an admin
    const existingAdmin = await db.query.adminUsers.findFirst({
      where: eq(adminUsers.userId, user.id)
    });

    if (existingAdmin) {
      // Update permissions
      await db.update(adminUsers)
        .set({
          permissions: adminConfig.permissions,
          notes: adminConfig.notes,
          updatedAt: new Date()
        })
        .where(eq(adminUsers.id, existingAdmin.id));
      
      return { ...existingAdmin, user };
    }

    // Add new admin
    const [newAdmin] = await db.insert(adminUsers).values({
      userId: user.id,
      email: normalizedEmail,
      permissions: adminConfig.permissions,
      addedBy: adminConfig.addedBy,
      notes: adminConfig.notes,
      isActive: true
    }).returning();

    return { ...newAdmin, user };
  }

  // Remove admin (keeps user but removes admin privileges)
  static async removeAdmin(email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase();
    
    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail)
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Update user role
    await db.update(users)
      .set({ role: 'student' })
      .where(eq(users.id, user.id));

    // Deactivate admin record
    await db.update(adminUsers)
      .set({ 
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(adminUsers.userId, user.id));

    return true;
  }

  // Check if email is admin
  static async isAdmin(email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase();
    
    const admin = await db.query.adminUsers.findFirst({
      where: and(
        eq(adminUsers.email, normalizedEmail),
        eq(adminUsers.isActive, true)
      )
    });

    return !!admin;
  }

  // Update admin permissions
  static async updateAdminPermissions(email: string, permissions: string[]): Promise<any> {
    const normalizedEmail = email.toLowerCase();
    
    const admin = await db.query.adminUsers.findFirst({
      where: eq(adminUsers.email, normalizedEmail)
    });

    if (!admin) {
      throw new Error('Admin not found');
    }

    await db.update(adminUsers)
      .set({
        permissions,
        updatedAt: new Date()
      })
      .where(eq(adminUsers.id, admin.id));

    return { ...admin, permissions };
  }

  // Bulk add admins
  static async bulkAddAdmins(emails: string[], addedBy: string): Promise<any[]> {
    const results = [];
    
    for (const email of emails) {
      try {
        const admin = await this.addAdmin({
          email,
          permissions: ['full_access'],
          addedBy,
          notes: 'Bulk added'
        });
        results.push({ email, success: true, admin });
      } catch (error: any) {
        results.push({ email, success: false, error: error?.message || 'Unknown error' });
      }
    }
    
    return results;
  }

  // Get admin by email
  static async getAdminByEmail(email: string): Promise<any> {
    const normalizedEmail = email.toLowerCase();
    
    const admin = await db.query.adminUsers.findFirst({
      where: eq(adminUsers.email, normalizedEmail),
      with: {
        user: {
          columns: {
            password: false
          }
        }
      }
    });

    return admin;
  }

  // Toggle admin status
  static async toggleAdminStatus(email: string): Promise<any> {
    const normalizedEmail = email.toLowerCase();
    
    const admin = await db.query.adminUsers.findFirst({
      where: eq(adminUsers.email, normalizedEmail)
    });

    if (!admin) {
      throw new Error('Admin not found');
    }

    const newStatus = !admin.isActive;
    
    await db.update(adminUsers)
      .set({
        isActive: newStatus,
        updatedAt: new Date()
      })
      .where(eq(adminUsers.id, admin.id));

    // Update user role
    const user = await db.query.users.findFirst({
      where: eq(users.id, admin.userId)
    });

    if (user) {
      await db.update(users)
        .set({ role: newStatus ? 'admin' : 'student' })
        .where(eq(users.id, user.id));
    }

    return { ...admin, isActive: newStatus };
  }
}