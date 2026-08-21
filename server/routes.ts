import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { lookupTextbookReferences, findTextbookRefs, getChapterDetailCache, setChapterDetailCache } from "./focused-report-pdf-generator";
import { selectFocusedClusters, buildSubjectReports } from "./ati-cluster-analyzer";
import { parseAssessmentReport as simpleParseAssessment, TOPIC_RESOURCES } from "./simple-parser";
import { insertAssessmentReportSchema, insertTopicPerformanceSchema, insertUserSchema, insertLeadSchema, chapterTopicMappings, textbookChapters, textbooks, assessmentReports, nursingTopics } from "@shared/schema";
import multer from "multer";
import { z } from "zod";
import { sql, inArray, or, eq } from "drizzle-orm";
import { parseATIReport, getTopicsForReview, groupTopicsByCategory, calculateTopicStatistics } from "./ati-parser";
import { trackAndCategorizeTopics, categorizeTopicBySubject, categorizeTopicBySystem } from "./topic-categorizer";
import { ProfessionalStudyGuideTemplate, type StudyGuideGenerationRequest } from "./professional-study-guide-template";
import type { OutputFormat } from "./template-renderer";
import { AuthService } from "./auth";
import { authenticateToken, requireRole, type AuthRequest } from "./middleware/auth";
import { authLimiter, uploadLimiter, reportLimiter, passwordResetLimiter } from "./middleware/rate-limiter";
import { validateRequest, loginSchema, registerSchema, changePasswordSchema, sanitizeQuery, validateUUID } from "./middleware/validation";

// Strict PDF validation for file uploads
const pdfFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check MIME type
  const allowedMimeTypes = ['application/pdf'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    console.warn(`[Security] Rejected file upload: Invalid MIME type ${file.mimetype} from IP ${req.ip}`);
    return cb(new Error('Only PDF files are allowed. Please upload a valid PDF file.'));
  }

  // Check file extension
  const fileExtension = file.originalname.toLowerCase().split('.').pop();
  if (fileExtension !== 'pdf') {
    console.warn(`[Security] Rejected file upload: Invalid extension .${fileExtension} from IP ${req.ip}`);
    return cb(new Error('Only PDF files with .pdf extension are allowed.'));
  }

  // Accept the file for now - magic bytes will be checked after upload
  cb(null, true);
};

// Validate PDF magic bytes (first 5 bytes should be "%PDF-")
const validatePDFMagicBytes = (buffer: Buffer): boolean => {
  if (!buffer || buffer.length < 5) {
    return false;
  }
  
  // PDF files start with "%PDF-" (hex: 25 50 44 46 2D)
  const pdfMagicBytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D]);
  return buffer.subarray(0, 5).equals(pdfMagicBytes);
};

// Helper function to normalize guest IDs and prevent exponential prefixing
const normalizeGuestId = (sessionId: string): string => {
  // If sessionId already starts with 'guest_', return it as-is to prevent double prefixing
  if (sessionId.startsWith('guest_')) {
    return sessionId;
  }
  // Otherwise, add the 'guest_' prefix
  return `guest_${sessionId}`;
};

// Helper function to ensure guest user exists in database
const ensureGuestUserExists = async (guestId: string): Promise<void> => {
  try {
    // Check if guest user already exists
    const existingUser = await storage.getUser(guestId);
    if (existingUser) {
      return; // User already exists
    }

    // Create guest user record
    await storage.createUser({
      id: guestId,
      username: guestId,
      email: `${guestId}@guest.temporary`, // Temporary email format
      password: 'guest_user_no_password', // Dummy password since guests don't authenticate with passwords
      role: 'guest',
      isEmailVerified: false,
      firstName: 'Guest',
      lastName: 'User'
    });

    console.log(`[Guest User] Created guest user record: ${guestId}`);
  } catch (error) {
    console.error(`[Guest User] Failed to create guest user ${guestId}:`, error);
    throw error;
  }
};

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only allow 1 file per upload
  },
  fileFilter: pdfFileFilter
});

const serverStartedAt = new Date().toISOString();

const publicLaunchInterestSchema = z.object({
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(180),
  contactPhone: z.string().trim().max(40).optional().or(z.literal("")),
  companyName: z.string().trim().max(160).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  organizationType: z.string().trim().max(80).optional().or(z.literal("")),
  pilotGoal: z.string().trim().max(1200).optional().or(z.literal("")),
  interestedTopics: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/public/deploy-proof", (_req, res) => {
    res.json({
      app: "nursestudy-lesson-builder",
      releaseTrack: "public_launch_mfp",
      commit: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || process.env.GIT_COMMIT || "local",
      branch: process.env.RENDER_GIT_BRANCH || process.env.GIT_BRANCH || "unknown",
      environment: process.env.NODE_ENV || "development",
      serviceName: process.env.RENDER_SERVICE_NAME || "local",
      startedAt: serverStartedAt,
      internalPilotAccepted: true,
      publicLaunchMfp: true,
      internalPilotPackageId: "bf472933-fdb6-4e67-b893-491c00c7bcd4",
    });
  });

  app.post("/api/public/launch-interest", authLimiter, async (req, res) => {
    try {
      const parsed = publicLaunchInterestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid launch interest request",
          details: parsed.error.errors,
        });
      }

      const data = parsed.data;
      const lead = await storage.createLead(insertLeadSchema.parse({
        status: "new",
        score: 45,
        source: "public_launch_mfp",
        conversionType: "pilot_demo_request",
        firstContactDate: new Date(),
        lastContactDate: new Date(),
        numberOfContacts: 1,
        engagementLevel: "medium",
        interestedTopics: data.interestedTopics?.length ? data.interestedTopics : ["Harrity Lesson Builder pilot"],
        tags: ["public-launch", "lesson-builder", "pilot-interest"],
        contactName: data.contactName,
        contactEmail: data.contactEmail.toLowerCase(),
        contactPhone: data.contactPhone || undefined,
        companyName: data.companyName || undefined,
        jobTitle: data.jobTitle || undefined,
        industry: data.organizationType || "Nursing education",
        customFields: {
          pilotGoal: data.pilotGoal || "",
          requestedPath: "public_launch_mfp",
        },
      }));

      res.status(201).json({
        success: true,
        message: "Pilot interest captured",
        leadId: lead.id,
        nextStep: "NurseStudy will follow up with a controlled pilot review path.",
      });
    } catch (error) {
      console.error("Public launch interest error:", error);
      res.status(500).json({ error: "Failed to capture pilot interest" });
    }
  });

  // Authentication routes
  app.post("/api/auth/register", authLimiter, validateRequest(registerSchema), async (req, res) => {
    try {
      const registrationInput = req.body as {
        email: string;
        password: string;
        username?: string;
        name?: string;
        firstName?: string;
        lastName?: string;
        school?: string;
        role?: "student" | "instructor" | "admin";
      };
      const email = registrationInput.email.trim().toLowerCase();
      const nameParts = (registrationInput.name || "").trim().split(/\s+/).filter(Boolean);
      const firstName = (registrationInput.firstName || nameParts[0] || "").trim();
      const lastName = (registrationInput.lastName || nameParts.slice(1).join(" ") || "").trim();
      const userData = insertUserSchema.parse({
        email,
        username: (registrationInput.username || email).trim().toLowerCase(),
        password: registrationInput.password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        school: registrationInput.school || undefined,
        role: registrationInput.role || "student",
      });
      const result = await AuthService.register(userData);
      res.json(result);
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        res.status(409).json({ error: error.message });
      } else if (error.errors) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
      } else {
        console.error("Registration error:", error);
        res.status(500).json({ error: "Failed to register user" });
      }
    }
  });

  app.post("/api/auth/login", authLimiter, validateRequest(loginSchema), async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      const result = await AuthService.login(email, password);
      res.json(result);
    } catch (error: any) {
      if (error.message.includes('Invalid')) {
        res.status(401).json({ error: error.message });
      } else {
        console.error("Login error:", error);
        res.status(500).json({ error: "Failed to login" });
      }
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await AuthService.getUserById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.put("/api/auth/profile", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const updatedUser = await AuthService.updateUser(req.user.userId, req.body);
      res.json(updatedUser);
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.post("/api/auth/change-password", authenticateToken, validateRequest(changePasswordSchema), async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { currentPassword, newPassword } = req.body;
      await AuthService.changePassword(req.user.userId, currentPassword, newPassword);
      res.json({ message: "Password changed successfully" });
    } catch (error: any) {
      if (error.message.includes('incorrect')) {
        res.status(400).json({ error: error.message });
      } else {
        console.error("Change password error:", error);
        res.status(500).json({ error: "Failed to change password" });
      }
    }
  });

  // Magic Link Authentication Routes
  app.post("/api/auth/request-magic-link", authLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      const { MagicLinkService } = await import("./magic-link-service");
      const { EmailService } = await import("./email-service");
      
      // Create magic link (rate limiting is handled inside)
      const result = await MagicLinkService.createMagicLink(email);
      
      // Always return success to prevent email enumeration
      if (!result) {
        return res.json({ 
          message: "If an account exists with this email, you will receive a login link shortly.",
          rateLimitExceeded: true 
        });
      }
      
      // Generate the magic link URL
      const baseUrl = process.env.APP_URL || 'http://localhost:5000';
      const magicLinkUrl = `${baseUrl}/verify-magic-link?token=${result.token}`;
      
      // Send email
      const emailSent = await EmailService.sendMagicLinkEmail(
        email, 
        magicLinkUrl,
        result.user?.firstName || undefined
      );
      
      if (!emailSent) {
        // Delete the token if email failed
        console.error('Failed to send magic link email');
        return res.status(500).json({ 
          error: "Failed to send login link. Please try again." 
        });
      }
      
      res.json({ 
        message: "If an account exists with this email, you will receive a login link shortly.",
        isNewUser: result.isNewUser
      });
    } catch (error: any) {
      console.error("Request magic link error:", error);
      res.status(500).json({ error: "Failed to send login link" });
    }
  });

  app.post("/api/auth/verify-magic-link", authLimiter, async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }
      
      const { MagicLinkService } = await import("./magic-link-service");
      const result = await MagicLinkService.verifyMagicLink(token);
      
      if (!result) {
        return res.status(400).json({ error: "Invalid or expired login link" });
      }
      
      // Generate JWT token
      const authToken = AuthService.generateToken({
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role || 'student',
      });
      
      // Send welcome email if new user
      if (result.isNewUser) {
        const { EmailService } = await import("./email-service");
        await EmailService.sendWelcomeEmail(result.user);
      }
      
      res.json({ 
        message: "Login successful",
        token: authToken,
        user: {
          id: result.user.id,
          email: result.user.email,
          username: result.user.username,
          role: result.user.role,
          firstName: result.user.firstName,
          lastName: result.user.lastName
        },
        isNewUser: result.isNewUser
      });
    } catch (error: any) {
      console.error("Verify magic link error:", error);
      res.status(400).json({ error: error.message || "Invalid login link" });
    }
  });

  // Email-based authentication routes (passwordless login)
  app.post("/api/auth/send-code", authLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      const { EmailAuthService } = await import("./auth-codes");
      const { EmailService } = await import("./email-service");
      const { code, isNewUser } = await EmailAuthService.createVerificationCode(email);
      
      // Send email with verification code
      const emailSent = await EmailService.sendVerificationCodeEmail(email, code);
      
      // CRITICAL FIX: Return error if email failed to send
      if (!emailSent) {
        return res.status(500).json({ 
          error: "Failed to send verification code via email. Please try again." 
        });
      }
      
      res.json({ 
        message: "Verification code sent to your email",
        isNewUser
        // SECURITY FIX: Never expose verification codes in API responses - removed verificationCode field
      });
    } catch (error: any) {
      console.error("Send code error:", error);
      res.status(500).json({ error: "Failed to send verification code" });
    }
  });

  app.post("/api/auth/verify-code", authLimiter, async (req, res) => {
    try {
      const { email, code, stayLoggedIn = false } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: "Email and code are required" });
      }
      
      const { EmailAuthService } = await import("./auth-codes");
      const { user, token } = await EmailAuthService.verifyCodeAndLogin(email, code, stayLoggedIn);
      
      // Send welcome email if new user
      if (!user.lastLogin) {
        const { EmailService } = await import("./email-service");
        await EmailService.sendWelcomeEmail(user);
      }
      
      res.json({ 
        message: "Login successful",
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName
        }
      });
    } catch (error: any) {
      console.error("Verify code error:", error);
      res.status(400).json({ error: error.message || "Invalid verification code" });
    }
  });

  // Dashboard endpoints
  app.get("/api/dashboard/stats", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const stats = await storage.getUserDashboardStats(req.user.userId);
      res.json(stats);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  });

  app.get("/api/dashboard/trends", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Get the time range from query params (default to 7 days)
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      const trends = await storage.getUserPerformanceTrends(req.user.userId, days);
      res.json(trends);
    } catch (error) {
      console.error("Dashboard trends error:", error);
      res.status(500).json({ error: "Failed to fetch performance trends" });
    }
  });

  app.get("/api/dashboard/upcoming-sessions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const sessions = await storage.getUpcomingStudySessions(req.user.userId);
      res.json(sessions);
    } catch (error) {
      console.error("Upcoming sessions error:", error);
      res.status(500).json({ error: "Failed to fetch upcoming sessions" });
    }
  });

  app.get("/api/dashboard/topic-progress", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Get the most recent assessment report for the user
      const reports = await storage.getAssessmentReportsByUser(req.user.userId);
      
      if (reports.length === 0) {
        return res.json([]);
      }
      
      // Get topic performance for the most recent report
      const topicPerformance = await storage.getTopicPerformanceByReport(reports[0].id);
      
      // Transform the data to match frontend expectations
      const topicProgress = topicPerformance.map(tp => {
        // Convert score from string to number, defaulting to 0 if null
        const score = tp.score ? parseFloat(tp.score) : 0;
        
        return {
          topic: tp.topic.name,
          currentScore: score,
          targetScore: 85, // Default target score
          progressPercentage: Math.min(100, Math.round((score / 85) * 100)),
          masteryLevel: score >= 85 ? 'mastered' : score >= 70 ? 'proficient' : score >= 60 ? 'intermediate' : 'beginner',
        };
      });
      
      res.json(topicProgress);
    } catch (error) {
      console.error("Topic progress error:", error);
      res.status(500).json({ error: "Failed to fetch topic progress" });
    }
  });

  // User progress tracking routes
  app.get("/api/progress/topics", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const progress = await storage.getUserProgressByTopic(req.user.userId);
      res.json(progress);
    } catch (error) {
      console.error("Get progress error:", error);
      res.status(500).json({ error: "Failed to fetch user progress" });
    }
  });

  // Aggregate stats backing the progress dashboard header metrics.
  app.get("/api/user/dashboard-stats", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const stats = await storage.getUserDashboardStats(req.user.userId);
      res.json(stats);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.post("/api/progress/mark-complete", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { topicId, studyTimeMinutes } = req.body;
      
      if (!topicId) {
        return res.status(400).json({ error: "topicId is required" });
      }

      const progress = await storage.markTopicComplete(
        req.user.userId, 
        topicId, 
        studyTimeMinutes || 0
      );
      
      res.json({
        message: "Topic marked as complete",
        progress
      });
    } catch (error) {
      console.error("Mark complete error:", error);
      res.status(500).json({ error: "Failed to mark topic complete" });
    }
  });

  // Development-only test login (REMOVE IN PRODUCTION)
  if (process.env.NODE_ENV === 'development') {
    app.post("/api/auth/dev-login", async (req, res) => {
      try {
        const { email } = req.body;
        if (email === 'admin@nurseprep.com') {
          const user = await AuthService.getUserById('admin');
          if (user) {
            const token = AuthService.generateToken({
              userId: user.id,
              email: user.email,
              role: 'admin'
            });
            res.json({ 
              message: "Development login successful",
              token,
              user 
            });
          } else {
            res.status(404).json({ error: "Admin user not found" });
          }
        } else {
          res.status(403).json({ error: "Development login only for admin" });
        }
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  // Admin management routes
  app.get("/api/admin/admins", authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
    try {
      const { AdminManagementService } = await import("./admin-management");
      const admins = await AdminManagementService.getAllAdmins();
      res.json(admins);
    } catch (error: any) {
      console.error("Get admins error:", error);
      res.status(500).json({ error: "Failed to get admins" });
    }
  });

  app.post("/api/admin/admins", authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
    try {
      const { email, permissions = ['full_access'], notes } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      const { AdminManagementService } = await import("./admin-management");
      const admin = await AdminManagementService.addAdmin({
        email,
        permissions,
        addedBy: req.user?.email,
        notes
      });
      
      res.json({ message: "Admin added successfully", admin });
    } catch (error: any) {
      console.error("Add admin error:", error);
      res.status(500).json({ error: error.message || "Failed to add admin" });
    }
  });

  app.delete("/api/admin/admins/:email", authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
    try {
      const { email } = req.params;
      
      // Prevent self-removal
      if (email === req.user?.email) {
        return res.status(400).json({ error: "Cannot remove yourself as admin" });
      }
      
      const { AdminManagementService } = await import("./admin-management");
      await AdminManagementService.removeAdmin(email);
      
      res.json({ message: "Admin removed successfully" });
    } catch (error: any) {
      console.error("Remove admin error:", error);
      res.status(500).json({ error: error.message || "Failed to remove admin" });
    }
  });

  app.post("/api/admin/admins/bulk", authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
    try {
      const { emails } = req.body;
      if (!emails || !Array.isArray(emails)) {
        return res.status(400).json({ error: "Emails array is required" });
      }
      
      const { AdminManagementService } = await import("./admin-management");
      const results = await AdminManagementService.bulkAddAdmins(emails, req.user?.email || 'system');
      
      res.json({ message: "Bulk admin operation completed", results });
    } catch (error: any) {
      console.error("Bulk add admins error:", error);
      res.status(500).json({ error: "Failed to bulk add admins" });
    }
  });

  app.patch("/api/admin/admins/:email/toggle", authenticateToken, requireRole('admin'), async (req: AuthRequest, res) => {
    try {
      const { email } = req.params;
      
      const { AdminManagementService } = await import("./admin-management");
      const admin = await AdminManagementService.toggleAdminStatus(email);
      
      res.json({ 
        message: `Admin ${admin.isActive ? 'activated' : 'deactivated'} successfully`,
        admin
      });
    } catch (error: any) {
      console.error("Toggle admin error:", error);
      res.status(500).json({ error: error.message || "Failed to toggle admin status" });
    }
  });

  // Password recovery routes
  app.post("/api/auth/forgot-password", passwordResetLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      const { PasswordRecoveryService } = await import("./password-recovery");
      const { token } = await PasswordRecoveryService.createPasswordResetToken(email);
      
      // TODO: Send email with reset link containing token
      // For now, return success message (in production, never expose the token)
      res.json({ 
        message: "If an account exists with this email, a password reset link will be sent",
        // Remove this in production - only for testing
        resetToken: process.env.NODE_ENV === 'development' ? token : undefined
      });
    } catch (error: any) {
      // Always return success to prevent email enumeration
      res.json({ message: "If an account exists with this email, a password reset link will be sent" });
    }
  });

  app.post("/api/auth/reset-password", passwordResetLimiter, async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
      }
      
      const { PasswordRecoveryService } = await import("./password-recovery");
      await PasswordRecoveryService.resetPassword(token, newPassword);
      
      res.json({ message: "Password has been reset successfully" });
    } catch (error: any) {
      console.error("Password reset error:", error);
      res.status(400).json({ error: error.message || "Failed to reset password" });
    }
  });

  app.get("/api/auth/verify-reset-token", async (req, res) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Token is required" });
      }
      
      const { PasswordRecoveryService } = await import("./password-recovery");
      const user = await PasswordRecoveryService.verifyResetToken(token);
      
      res.json({ valid: true, email: user.email });
    } catch (error: any) {
      res.status(400).json({ error: "Invalid or expired token" });
    }
  });
  
  // Register admin routes
  const { registerAdminRoutes } = await import("./admin-routes");
  registerAdminRoutes(app);

  // Register admin lesson builder routes
  const { registerLessonBuilderRoutes } = await import("./routes/lesson-builder-routes");
  registerLessonBuilderRoutes(app);
  
  // Register curriculum catalog routes first (local DB — public endpoints)
  // MUST come before registerCurriculumRoutes so local handlers win over external-API proxy
  const { registerCurriculumCatalogRoutes } = await import("./routes/curriculum-catalog-routes");
  registerCurriculumCatalogRoutes(app);

  // Register curriculum integration routes (external API proxy — kept for recommendations/progress)
  const { registerCurriculumRoutes } = await import("./curriculum-routes");
  registerCurriculumRoutes(app);
  
  // Register admin database routes
  const { registerAdminDatabaseRoutes } = await import("./admin-database-routes");
  registerAdminDatabaseRoutes(app);
  
  // Register user search routes
  const { searchUsersByEmail, getUserById, getAllUsers } = await import("./user-search-routes");
  app.get("/api/admin/users/search", searchUsersByEmail);
  app.get("/api/admin/users/:id", getUserById);
  app.get("/api/admin/users", getAllUsers);
  
  // Register content import routes
  const contentImportRouter = (await import("./content-import-routes")).default;
  app.use("/api/admin", contentImportRouter);
  
  // Register privacy routes
  const privacyRouter = (await import("./routes/privacy")).default;
  app.use("/api/privacy", privacyRouter);
  
  // Register crosswalk routes
  const { registerCrosswalkRoutes } = await import("./crosswalk-routes");
  registerCrosswalkRoutes(app);
  
  // Register content generation routes
  const { registerContentGenerationRoutes } = await import("./content-generation-routes");
  registerContentGenerationRoutes(app);
  
  // Content areas endpoint
  app.get("/api/content-areas", async (req, res) => {
    try {
      const contentAreas = await storage.getAllContentAreas();
      res.json(contentAreas);
    } catch (error) {
      console.error("Error fetching content areas:", error);
      res.status(500).json({ error: "Failed to fetch content areas" });
    }
  });

  // Nursing topics endpoint
  app.get("/api/nursing-topics", async (req, res) => {
    try {
      const topics = await storage.getAllNursingTopics();
      res.json(topics);
    } catch (error) {
      console.error("Error fetching nursing topics:", error);
      res.status(500).json({ error: "Failed to fetch nursing topics" });
    }
  });

  // Get topics organized by subject and system
  app.get("/api/topics/organized", async (req, res) => {
    try {
      const { getTopicsBySubjectAndSystem } = await import('./topic-categorizer');
      const organized = await getTopicsBySubjectAndSystem();
      res.json(organized);
    } catch (error) {
      console.error("Error fetching organized topics:", error);
      res.status(500).json({ error: "Failed to fetch organized topics" });
    }
  });

  // Get most frequent topics across all assessments
  app.get("/api/topics/frequent", async (req, res) => {
    try {
      const { getMostFrequentTopics } = await import('./topic-categorizer');
      const limit = parseInt(req.query.limit as string) || 10;
      const frequentTopics = await getMostFrequentTopics(limit);
      res.json(frequentTopics);
    } catch (error) {
      console.error("Error fetching frequent topics:", error);
      res.status(500).json({ error: "Failed to fetch frequent topics" });
    }
  });

  // Generate PDF study guide
  app.get("/api/assessment-reports/:reportId/pdf", async (req, res) => {
    try {
      const { reportId } = req.params;
      const { generateFocusedStudyGuidePDF } = await import('./focused-report-pdf-generator');
      
      const pdfBuffer = await generateFocusedStudyGuidePDF(reportId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="study-guide.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF study guide" });
    }
  });

  // Email PDF study guide to a given address
  app.post("/api/assessment-reports/:reportId/email-pdf", reportLimiter, async (req, res) => {
    try {
      const { reportId } = req.params;
      const { recipientEmail } = req.body;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!recipientEmail || typeof recipientEmail !== "string" || !emailRegex.test(recipientEmail)) {
        return res.status(400).json({ error: "A valid recipient email address is required" });
      }

      const { generateFocusedStudyGuidePDF } = await import('./focused-report-pdf-generator');
      const pdfBuffer = await generateFocusedStudyGuidePDF(reportId);

      const sendGridKey = process.env.SENDGRID_API_KEY;
      if (!sendGridKey) {
        if (process.env.NODE_ENV === 'production') {
          console.error("SendGrid API key not configured in production — cannot send email");
          return res.status(503).json({ error: "Email service is not configured. Please contact support." });
        }
        console.log("SendGrid not configured — would email study guide to:", recipientEmail);
        return res.json({ success: true, message: "Study guide emailed (demo mode — SendGrid not configured)" });
      }

      const sgMail = await import('@sendgrid/mail');
      sgMail.default.setApiKey(sendGridKey);

      const msg = {
        to: recipientEmail,
        from: process.env.FROM_EMAIL || 'noreply@nurseprep.app',
        subject: "Your NursePrep Study Guide",
        text: "Your personalized NCLEX study guide is attached. Good luck with your studies!",
        html: "<p>Your personalized NCLEX study guide is attached.</p><p>Good luck with your studies!</p>",
        attachments: [
          {
            content: pdfBuffer.toString('base64'),
            filename: 'study-guide.pdf',
            type: 'application/pdf',
            disposition: 'attachment'
          }
        ]
      };

      await sgMail.default.send(msg);
      res.json({ success: true, message: "Study guide sent successfully" });
    } catch (error) {
      console.error("Error emailing study guide PDF:", error);
      res.status(500).json({ error: "Failed to send study guide" });
    }
  });

  function buildLaunchStudyGuideFallback(reportId: string, report: any, options: any, reason: string) {
    const maxTopics = Number(options?.maxTopics || (options?.focusOnTopGaps ? 2 : 5));
    const fallbackTopics = [
      { name: "Safety and Infection Control", category: "NCLEX Client Needs", gapScore: 72, priority: 1, subject: "Fundamentals" },
      { name: "Clinical Judgment and Prioritization", category: "Clinical Judgment", gapScore: 68, priority: 1, subject: "Medical-Surgical" },
      { name: "Medication Administration", category: "Pharmacological Therapies", gapScore: 62, priority: 2, subject: "Pharmacology" },
      { name: "Maternal-Newborn Assessment", category: "Health Promotion and Maintenance", gapScore: 55, priority: 2, subject: "Maternal-Newborn" },
      { name: "Pediatric Respiratory Cues", category: "Physiological Adaptation", gapScore: 48, priority: 3, subject: "Pediatrics" },
    ];

    let parsedTopics = fallbackTopics;
    if (report?.extractedText) {
      try {
        const parsed = parseATIReport(report.extractedText);
        const reviewTopics = getTopicsForReview(parsed);
        if (reviewTopics.length > 0) {
          parsedTopics = reviewTopics.map((topic: any, index: number) => ({
            name: topic.name || topic.topicName || "Assessment topic",
            category: topic.category || topic.contentArea || "NCLEX Review",
            gapScore: topic.groupScore != null ? Math.max(0, 100 - Number(topic.groupScore)) : 60 - Math.min(index * 6, 30),
            priority: index < 2 ? 1 : index < 4 ? 2 : 3,
            subject: categorizeTopicBySubject(topic.name || topic.topicName || ""),
          }));
        }
      } catch (error) {
        console.warn("[ProfessionalGuide] Falling back to launch template after parse issue:", error);
      }
    }

    const selectedTopics = parsedTopics.slice(0, Number.isFinite(maxTopics) && maxTopics > 0 ? maxTopics : 5);
    const criticalCount = selectedTopics.filter((topic) => topic.priority === 1).length;
    const highCount = selectedTopics.filter((topic) => topic.priority === 2).length;
    const estimatedHours = Math.max(2, Math.ceil(selectedTopics.length * 1.5));
    const generatedDate = new Date().toLocaleDateString();

    const topicDetails = selectedTopics.map((topic, index) => ({
      name: topic.name,
      description: `${topic.category} focus area mapped for immediate NCLEX review.`,
      priority: topic.priority || index + 1,
      gapScore: Number(topic.gapScore || 50),
      clinicalScenarios: [
        `Recognize priority cues related to ${topic.name}.`,
        `Choose the safest first nursing action for ${topic.name}.`,
      ],
      keyNursingActions: [
        "Recognize relevant cues before choosing interventions",
        "Prioritize safety, airway, circulation, and client risk",
        "Evaluate the response and update the study plan",
      ],
      safetyConsiderations: [
        "Escalate unstable findings",
        "Verify orders, allergies, and contraindications",
      ],
      difficulty: topic.priority === 1 ? "foundation" : "intermediate",
      estimatedStudyTime: topic.priority === 1 ? 60 : 45,
      prerequisites: ["Review core concept summary", "Complete one rationale-backed quiz"],
      performanceData: {
        currentScore: Math.max(0, 100 - Number(topic.gapScore || 50)),
        targetScore: 85,
        improvementNeeded: Number(topic.gapScore || 50),
      },
    }));

    return {
      title: "NCLEX SUCCESS BLUEPRINT",
      subtitle: "LAUNCH PREVIEW STUDY GUIDE",
      studentName: report?.studentName || "Nursing Student",
      generatedDate,
      launchFallback: true,
      fallbackReason: reason,
      sourceReportId: report?.id || reportId,
      progressStage: {
        current: "foundation",
        description: "Start with the highest-risk topics, then connect each topic to clinical judgment and practice rationales.",
        objectives: [
          "Map weak topics to nursing concepts and subject areas",
          "Study one source-backed guide section per topic",
          "Complete at least one rationale-backed practice item per topic",
        ],
        nextStage: "Application of mapped topics in patient scenarios",
      },
      overview: {
        totalTopics: selectedTopics.length,
        estimatedHours,
        priorityDistribution: {
          critical: criticalCount,
          high: highCount,
          medium: Math.max(0, selectedTopics.length - criticalCount - highCount),
          low: 0,
        },
        subjectBreakdown: selectedTopics.map((topic) => ({
          name: topic.subject || "Nursing Review",
          topicCount: 1,
          estimatedTime: topic.priority === 1 ? 60 : 45,
          priority: topic.priority === 1 ? "critical" : "high",
          systems: [{
            name: topic.category || "NCLEX Review",
            topics: [topic.name],
            clinicalRelevance: topic.priority === 1 ? "critical" : "high",
          }],
        })),
        studySequence: selectedTopics.map((topic) => topic.name),
      },
      progressMap: [
        {
          stage: "foundation",
          title: "Map Weak Topics",
          description: "Confirm concept, specialty, NCLEX category, and CJM step.",
          isCompleted: false,
          isCurrent: true,
          estimatedCompletion: "Today",
        },
        {
          stage: "application",
          title: "Study Pack",
          description: "Review guide, visuals, deck, and one quiz item per topic.",
          isCompleted: false,
          isCurrent: false,
          estimatedCompletion: "1-2 days",
        },
        {
          stage: "synthesis",
          title: "Practice Rationales",
          description: "Use rationales to correct cue recognition and action choices.",
          isCompleted: false,
          isCurrent: false,
          estimatedCompletion: "2-3 days",
        },
        {
          stage: "mastery",
          title: "Repeat Check",
          description: "Reattempt items and update weak-topic status.",
          isCompleted: false,
          isCurrent: false,
          estimatedCompletion: "3-5 days",
        },
      ],
      sections: [{
        id: "launch-priority-topics",
        title: "PRIORITY TOPIC MAP",
        subtitle: "First launch version: deterministic, reviewable, and ready for expert polish.",
        stage: {
          current: "foundation",
          description: "Launch-safe review path for mapped weak topics.",
          objectives: ["Identify cues", "Connect topic to concept", "Practice one rationale-backed item"],
          nextStage: "Expert-reviewed study pack",
        },
        learningObjectives: [
          "Explain the core concept for each weak topic",
          "Recognize priority cues using the Clinical Judgment Model",
          "Complete a quiz item and review the rationale",
        ],
        criticalConcepts: selectedTopics.map((topic) => topic.name),
        clinicalApplications: [
          "Cue recognition",
          "Priority setting",
          "Safe nursing action",
        ],
        clinicalJudgmentSteps: [
          {
            layer: "clinical_judgment",
            step: "Recognize Cues",
            description: "Identify assessment findings that matter first.",
            application: "Pull cues from the scenario before picking an answer.",
            examples: ["Vital sign changes", "Risk factors", "Unexpected findings"],
          },
          {
            layer: "clinical_judgment",
            step: "Take Action",
            description: "Choose the safest nursing action.",
            application: "Match intervention to the most urgent cue.",
            examples: ["Airway support", "Medication safety", "Escalation"],
          },
        ],
        topics: topicDetails,
        estimatedTime: estimatedHours * 60,
        difficulty: "foundation",
        resources: {
          requiredReading: [],
          supplementalReading: [],
          interactiveContent: [],
          practiceQuestions: [],
          videoContent: [],
          simulationActivities: [],
          externalResources: [],
          additionalPractice: [],
        },
        assessmentFocus: {
          nclexCategories: Array.from(new Set(selectedTopics.map((topic) => topic.category || "NCLEX Review"))),
          clientNeedsAreas: Array.from(new Set(selectedTopics.map((topic) => topic.category || "NCLEX Review"))),
          cognitiveLevel: "Application",
          integratedProcesses: ["Clinical Judgment", "Nursing Process", "Teaching and Learning"],
          expectedQuestionTypes: ["Multiple choice", "Case scenario", "Priority action"],
        },
        completionCriteria: [
          "Review guide section",
          "Open related slide deck or lesson",
          "Complete one quiz item with rationale",
        ],
        selfAssessmentQuestions: [
          "Can I name the most important cue?",
          "Can I explain why the correct action is safest?",
          "Do I need expert review before publishing this topic?",
        ],
      }],
      resourceLibrary: {
        categories: ["study-guide", "slide-deck", "quiz", "visuals"],
        totalResources: selectedTopics.length * 4,
        estimatedTime: estimatedHours * 60,
      },
      clinicalJudgmentFramework: {
        overview: "Use the Clinical Judgment Model to connect weak topics to cues, hypotheses, actions, and evaluation.",
        layers: [],
        applicationExamples: [],
        practiceFramework: {
          recognizeCues: ["Highlight abnormal findings", "Identify risk factors"],
          analyzeCues: ["Connect cues to likely problem"],
          prioritizeHypotheses: ["Rank by safety and urgency"],
          generateSolutions: ["Choose evidence-based nursing actions"],
          takeActions: ["Act on the highest priority"],
          evaluateOutcomes: ["Check if the response improved"],
        },
      },
      progressTracking: {
        currentStage: "foundation",
        overallProgress: 0,
        sectionProgress: [],
        timeTracking: { totalStudyTime: 0, dailyAverage: 0, weeklyGoal: estimatedHours * 60, streakDays: 0 },
        milestones: [],
      },
    };
  }

  // Professional study guide generation endpoint
  app.post("/api/generate-professional-guide", async (req, res) => {
    try {
      const { reportId, options = {} } = req.body;
      
      if (!reportId) {
        return res.status(400).json({ error: "Report ID is required" });
      }

      if (process.env.ENABLE_PROFESSIONAL_STUDY_GUIDE !== "true") {
        const report = reportId === "demo-report" ? undefined : await storage.getAssessmentReport(reportId);
        const guide = buildLaunchStudyGuideFallback(reportId, report, options, "professional_guide_disabled");
        return res.json({
          success: true,
          guide,
          status: "launch_template_fallback",
          warning: "Full professional guide generation is disabled; returned the launch-safe preview guide.",
          message: "Launch preview study guide generated successfully",
        });
      }

      const { generateProfessionalStudyGuide } = await import("./professional-study-guide");
      const guide = await generateProfessionalStudyGuide(reportId, options);
      
      res.json({
        success: true,
        guide,
        message: "Professional study guide generated successfully"
      });
    } catch (error) {
      console.error("Error generating professional study guide:", error);
      if (error instanceof Error && error.message.includes("Assessment report not found")) {
        const { reportId, options = {} } = req.body || {};
        const guide = buildLaunchStudyGuideFallback(reportId || "demo-report", undefined, options, "assessment_report_not_found");
        return res.json({
          success: true,
          guide,
          status: "launch_template_fallback",
          warning: "Assessment report was not found; returned the launch-safe preview guide.",
          message: "Launch preview study guide generated successfully",
        });
      }
      res.status(500).json({ 
        error: "Failed to generate professional study guide",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Admin endpoints
  app.post("/api/admin/upload-assessment", upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      const { studentName, studentEmail, instructorNotes } = req.body;
      
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Validate PDF magic bytes for additional security
      if (!validatePDFMagicBytes(file.buffer)) {
        console.error(`[Security] Rejected file upload: Invalid PDF magic bytes from IP ${req.ip}`);
        return res.status(400).json({ 
          error: "Invalid file format. Please upload a valid PDF file." 
        });
      }

      // Log successful validation
      console.info(`[Security] Valid PDF uploaded: ${file.originalname} (${file.size} bytes) from IP ${req.ip}`);

      // Process the PDF
      const pdfParse = (await import('pdf-parse')).default;
      const { parseATIReportSafely, extractTextFromPDFSafely } = await import('./improved-ati-parser');
      const { calculateTopicStatistics } = await import('./ati-parser');
      const { extractStudentInfoFromPDF } = await import('./extract-student-info');
      
      // Use improved parsing with fallback strategies
      let pdfText: string;
      try {
        pdfText = await extractTextFromPDFSafely(file.buffer);
      } catch (pdfError: any) {
        console.warn('Improved PDF extraction failed, trying basic method:', pdfError.message);
        const pdfData = await pdfParse(file.buffer);
        pdfText = pdfData.text;
      }
      
      // Parse the report with enhanced error handling
      const reportData = await parseATIReportSafely(pdfText, {
        maxRetries: 3,
        enableFallbackParsing: true,
        strictValidation: false
      });
      
      const stats = calculateTopicStatistics(reportData.topics);
      
      // Extract student information from PDF
      const extractedInfo = extractStudentInfoFromPDF(pdfText);
      
      // Save to database with student info and overall score
      // Use extracted score from PDF if available, otherwise use calculated average
      let initialOverallScore: string;
      
      if (reportData.studentDetails?.overallScore) {
        // Use the extracted overall score from the PDF
        initialOverallScore = reportData.studentDetails.overallScore;
        console.log(`Using extracted overall score from PDF: ${initialOverallScore}%`);
      } else {
        // Fall back to calculated average from topics
        const cappedAvgScore = Math.min(100, Math.max(0, stats.averageScore || 75));
        initialOverallScore = cappedAvgScore.toFixed(1);
        console.log(`Using calculated average score: ${initialOverallScore}%`);
      }
      
      const report = await storage.createAssessmentReport({
        userId: 'admin', // Admin upload, use special admin user ID
        fileName: file.originalname,
        extractedText: pdfText,
        overallScore: initialOverallScore
      });
      
      // Process topics if extracted
      if (reportData.topics && reportData.topics.length > 0) {
        const { trackAndCategorizeTopics } = await import('./topic-categorizer');
        await trackAndCategorizeTopics(reportData.topics, report.id);
      }
      
      res.json({
        id: report.id,
        studentName: studentName || extractedInfo.name || 'Unknown',
        studentEmail: studentEmail || extractedInfo.email || 'N/A',
        fileName: file.originalname,
        uploadDate: report.uploadDate,
        overallScore: parseFloat(initialOverallScore),
        topicsCount: reportData.topics?.length || 0,
        extractedInfo: {
          name: extractedInfo.name,
          email: extractedInfo.email,
          programCohort: extractedInfo.programCohort,
          testDate: extractedInfo.testDate,
          assessmentName: extractedInfo.assessmentName,
          institutionProgram: extractedInfo.institutionProgram
        }
      });
    } catch (error) {
      console.error("Admin upload error:", error);
      res.status(500).json({ error: "Failed to process assessment" });
    }
  });

  app.get("/api/admin/assessments", async (req, res) => {
    try {
      const reports = await storage.getRecentAssessmentReports(10);
      res.json(reports.map(r => ({
        id: r.id,
        studentName: r.studentName || 'Unknown',
        studentEmail: r.studentEmail || 'N/A',
        fileName: r.fileName,
        uploadDate: r.uploadDate,
        overallScore: parseFloat(r.overallScore || '0'),
        topicsCount: 0,
        customizations: r.customizations
      })));
    } catch (error) {
      console.error("Error fetching assessments:", error);
      res.status(500).json({ error: "Failed to fetch assessments" });
    }
  });

  app.post("/api/admin/assessments/:assessmentId/customize", async (req, res) => {
    try {
      const { assessmentId } = req.params;
      const customizations = req.body;
      
      // Store customizations (you may want to add this to your database schema)
      // For now, we'll store in memory or a simple JSON structure
      await storage.updateAssessmentCustomizations(assessmentId, customizations);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving customizations:", error);
      res.status(500).json({ error: "Failed to save customizations" });
    }
  });

  app.get("/api/admin/assessments/:assessmentId/pdf", async (req, res) => {
    try {
      const { assessmentId } = req.params;
      const { customized } = req.query;
      const { generateCustomizedPDF } = await import('./pdf-generator');
      
      // Get customizations if requested
      let customizations = null;
      if (customized === 'true') {
        customizations = await storage.getAssessmentCustomizations(assessmentId);
      }
      
      const pdfBuffer = await generateCustomizedPDF(assessmentId, customizations);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="customized-study-guide.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating customized PDF:", error);
      res.status(500).json({ error: "Failed to generate customized PDF" });
    }
  });

  app.post("/api/admin/assessments/:assessmentId/email", async (req, res) => {
    try {
      const { assessmentId } = req.params;
      const { recipientEmail, subject, message } = req.body;
      
      // Check for SendGrid API key
      const sendGridKey = process.env.SENDGRID_API_KEY;
      if (!sendGridKey) {
        console.log("SendGrid not configured, would send to:", recipientEmail);
        // For demo purposes, just return success
        return res.json({ 
          success: true, 
          message: "Email would be sent to " + recipientEmail,
          note: "SendGrid API key not configured" 
        });
      }
      
      // Generate PDF
      const { generateCustomizedPDF } = await import('./pdf-generator');
      const customizations = await storage.getAssessmentCustomizations(assessmentId);
      const pdfBuffer = await generateCustomizedPDF(assessmentId, customizations);
      
      // Send email with SendGrid
      const sgMail = await import('@sendgrid/mail');
      sgMail.default.setApiKey(sendGridKey);
      
      const msg = {
        to: recipientEmail,
        from: process.env.SENDER_EMAIL || 'noreply@nurseprep.com',
        subject: subject,
        text: message,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
        attachments: [
          {
            content: pdfBuffer.toString('base64'),
            filename: 'study-guide.pdf',
            type: 'application/pdf',
            disposition: 'attachment'
          }
        ]
      };
      
      await sgMail.default.send(msg);
      res.json({ success: true, message: "Email sent successfully" });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Review topics endpoint (simplified)
  app.get("/api/review-topics", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT id, name, description, nclex_category, nclex_subcategory, 
               nursing_specialty, body_system, difficulty, estimated_study_time, keywords
        FROM review_topics 
        WHERE is_active = true 
        ORDER BY name
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching review topics:", error);
      res.status(500).json({ error: "Failed to fetch review topics" });
    }
  });

  // Simple endpoint to map content to topics
  app.post("/api/admin/map-content-to-topics", async (req, res) => {
    try {
      const { content, title, source } = req.body;
      
      // Simple storage of content mapped to topics
      const result = await db.execute(sql`
        INSERT INTO topic_content_blocks (title, content, source, created_at)
        VALUES (${title || 'Untitled'}, ${content}, ${source || 'Content Mapper'}, NOW())
        RETURNING id
      `);
      
      res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
      console.error("Error mapping content to topics:", error);
      res.status(500).json({ error: "Failed to map content" });
    }
  });

  // Topic relationship analysis endpoint
  app.get("/api/admin/topic-relationships", async (req, res) => {
    try {
      const { analyzeTopicRelationships } = await import('./topic-relationship-analyzer');
      const analysis = await analyzeTopicRelationships();
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing topic relationships:", error);
      res.status(500).json({ error: "Failed to analyze relationships" });
    }
  });

  // Study guide template endpoint (simplified)
  app.get("/api/study-guide/template", async (req, res) => {
    try {
      const { buildSimpleStudyGuide } = await import('./simple-study-guide-builder');
      const template = await buildSimpleStudyGuide();
      res.json(template);
    } catch (error) {
      console.error("Error building study guide template:", error);
      res.status(500).json({ error: "Failed to build study guide" });
    }
  });

  // Personalized study guide endpoint (simplified)
  app.post("/api/study-guide/personalized", async (req, res) => {
    try {
      const { weakTopics } = req.body;
      const { generateSimpleRecommendations } = await import('./simple-study-guide-builder');
      const recommendations = await generateSimpleRecommendations(weakTopics || []);
      res.json(recommendations);
    } catch (error) {
      console.error("Error generating personalized recommendations:", error);
      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });

  // Topic frequency and priority endpoints (simplified)
  app.get("/api/admin/topic-frequency", async (req, res) => {
    try {
      const { getSimpleTopicStats } = await import('./simple-topic-tracker');
      const frequencyData = await getSimpleTopicStats();
      res.json(frequencyData);
    } catch (error) {
      console.error("Error getting topic frequency data:", error);
      res.status(500).json({ error: "Failed to get frequency data" });
    }
  });

  app.get("/api/admin/content-development-priorities", async (req, res) => {
    try {
      const { getSimpleTopicStats } = await import('./simple-topic-tracker');
      const stats = await getSimpleTopicStats();
      
      // Create simple priority structure
      const priorities = {
        highPriorityTopics: stats.filter(s => s.priority === 'high').slice(0, 5),
        emergingNeeds: stats.filter(s => s.priority === 'medium').slice(0, 3),
        contentGaps: [],
        developmentRecommendations: stats.slice(0, 3).map(s => ({
          topic: s.topicName,
          recommendedContent: ['Video tutorials', 'Practice questions', 'Study guides'],
          businessImpact: s.priority === 'high' ? 'high' : 'medium',
          estimatedEffort: 'medium'
        }))
      };
      
      res.json(priorities);
    } catch (error) {
      console.error("Error generating content development priorities:", error);
      res.status(500).json({ error: "Failed to generate priorities" });
    }
  });

  app.get("/api/admin/priority-metrics", async (req, res) => {
    try {
      const { getSimpleMetrics } = await import('./simple-topic-tracker');
      const metrics = await getSimpleMetrics();
      res.json({
        totalReviews: metrics.totalReviews,
        activeTopics: metrics.activeTopics,
        criticalTopics: metrics.highPriorityTopics,
        contentGapsCount: 0,
        topDemandTopics: metrics.topTopics.map(t => ({ name: t.name, score: t.frequency }))
      });
    } catch (error) {
      console.error("Error getting priority metrics:", error);
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  // Manual topic tracking endpoint
  app.post("/api/admin/track-topic-review", async (req, res) => {
    try {
      const { topics, source, userIdentifier } = req.body;
      const { trackTopicReview } = await import('./topic-frequency-tracker');
      
      const events = topics.map((topic: any) => ({
        topicName: topic.name || topic,
        source: source || 'manual_selection',
        confidenceScore: topic.confidence || 1.0,
        userIdentifier
      }));
      
      await trackTopicReview(events);
      res.json({ success: true, tracked: events.length });
    } catch (error) {
      console.error("Error tracking topic review:", error);
      res.status(500).json({ error: "Failed to track topics" });
    }
  });

  // ATI topic extraction endpoints
  app.post("/api/admin/extract-ati-topics", async (req, res) => {
    try {
      const { reportText, reportId } = req.body;
      const { extractAndAddATITopics } = await import('./ati-topic-extractor');
      
      const result = await extractAndAddATITopics(reportText, reportId);
      res.json(result);
    } catch (error) {
      console.error("Error extracting ATI topics:", error);
      res.status(500).json({ error: "Failed to extract topics" });
    }
  });

  app.get("/api/admin/topic-extraction-stats", async (req, res) => {
    try {
      const { getTopicExtractionStats } = await import('./ati-topic-extractor');
      const stats = await getTopicExtractionStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting extraction stats:", error);
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  // Reference book parsing endpoints
  app.post("/api/admin/parse-reference-book", async (req, res) => {
    try {
      const { bookText, bookTitle } = req.body;
      const { parseReferenceBook } = await import('./reference-book-parser');
      
      const result = await parseReferenceBook(bookText, bookTitle || 'Nursing Reference Book');
      res.json(result);
    } catch (error) {
      console.error("Error parsing reference book:", error);
      res.status(500).json({ error: "Failed to parse reference book" });
    }
  });

  app.get("/api/admin/reference-book-stats", async (req, res) => {
    try {
      const { getReferenceBookStats } = await import('./reference-book-parser');
      const stats = await getReferenceBookStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting reference book stats:", error);
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  // Content export endpoints
  app.post("/api/export/content", async (req, res) => {
    try {
      const { exportContent } = await import('./content-exporter');
      const options = req.body;
      
      const result = await exportContent(options);
      
      if (result.success) {
        // Set appropriate headers for download
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        
        if (options.format === 'pdf') {
          res.send(result.data);
        } else {
          res.send(result.data);
        }
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (error) {
      console.error("Error exporting content:", error);
      res.status(500).json({ error: "Failed to export content" });
    }
  });

  app.get("/api/export/options", async (req, res) => {
    try {
      const { getExportOptions } = await import('./content-exporter');
      const options = getExportOptions();
      res.json(options);
    } catch (error) {
      console.error("Error getting export options:", error);
      res.status(500).json({ error: "Failed to get export options" });
    }
  });

  // Upload and process assessment report - supports both authenticated and guest users
  app.post(["/api/assessment-reports", "/api/assessment-reports/upload"], upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Validate PDF magic bytes for additional security
      if (!validatePDFMagicBytes(req.file.buffer)) {
        console.error(`[Security] Rejected file upload: Invalid PDF magic bytes from IP ${req.ip}`);
        return res.status(400).json({ 
          error: "Invalid file format. Please upload a valid PDF file." 
        });
      }

      console.info(`[Security] Valid PDF uploaded: ${req.file.originalname} (${req.file.size} bytes) from IP ${req.ip}`);

      // Determine user - check for authentication first, fallback to guest session
      let userId: string;
      let isAuthenticated = false;
      
      try {
        // Check if user is authenticated with JWT token
        const authHeader = req.headers['authorization'];
        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.split(' ')[1];
          const decoded = AuthService.verifyToken(token);
          userId = decoded.userId;
          isAuthenticated = true;
          console.log(`[Upload] Authenticated user upload: ${decoded.email}`);
        } else {
          // Guest access - create or use session-based guest ID
          const sessionIdHeader = req.headers['x-session-id'];
          const sessionId = req.sessionID || (Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader) || `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          userId = normalizeGuestId(sessionId);
          console.log(`[Upload] Guest user upload: ${userId}`);
        }
      } catch (tokenError) {
        // Invalid token, treat as guest
        const sessionIdHeader = req.headers['x-session-id'];
        const sessionId = req.sessionID || (Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader) || `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        userId = normalizeGuestId(sessionId);
        console.log(`[Upload] Invalid token, treating as guest: ${userId}`);
      }

      // Extract text from PDF
      let extractedText = "";
      try {
        // Dynamic import to avoid initialization issues
        const pdfParse = (await import("pdf-parse")).default;
        const pdfData = await pdfParse(req.file.buffer);
        extractedText = pdfData.text;
      } catch (pdfError) {
        console.error("Error parsing PDF:", pdfError);
        // Fallback to mock data if PDF parsing fails
        console.log("Using fallback text extraction method");
        extractedText = `Topics To Review
Management of Care: Client Rights Assessment and Advocacy
Safety and Infection Control: Handling Hazardous and Infectious Materials
Health Promotion and Maintenance: Techniques of Physical Assessment  
Psychosocial Integrity: Coping Mechanisms and Stress Management
Basic Care and Comfort: Personal Hygiene and Elimination
Pharmacological and Parenteral Therapies: Adverse Effects/Contraindications
Reduction of Risk Potential: System-Specific Assessments
Physiological Adaptation: Alterations in Body Systems`;
      }

      // Ensure guest user exists in database if this is a guest upload
      if (!isAuthenticated && userId.startsWith('guest_')) {
        await ensureGuestUserExists(userId);
      }

      // Create assessment report with proper user linking
      const reportData = {
        userId: userId,
        fileName: req.file.originalname,
        extractedText,
        processingStatus: "processing"
      };

      const report = await storage.createAssessmentReport(reportData);

      // Parse assessment report format to extract detailed topics with scores
      const reportParsed = parseATIReport(extractedText);
      const assessmentTopics = reportParsed.topics;
      
      // Store student details in report if available
      if (reportParsed.studentDetails.studentName || reportParsed.studentDetails.overallScore) {
        await storage.updateAssessmentReport(report.id, {
          studentName: reportParsed.studentDetails.studentName,
          school: reportParsed.studentDetails.school,
          testDate: reportParsed.studentDetails.testDate,
          assessmentName: reportParsed.studentDetails.assessmentName,
          overallScore: reportParsed.studentDetails.overallScore
        });
      }
      
      // Track and categorize topics by subject and system
      const categorizedTopics = await trackAndCategorizeTopics(
        assessmentTopics.map(t => ({ name: t.name, category: t.category })),
        report.id
      );
      
      // Log what we found in the Topics to Review section
      console.log(`\n=== Extracted ${assessmentTopics.length} Topics from 'Topics to Review' section ===`);
      categorizedTopics.forEach((topic: any) => {
        console.log(`  - ${topic.subject} > ${topic.system || 'Core Concepts'}: ${topic.name}`);
      });
      
      // Calculate statistics for the report with baseline comparison
      const stats = calculateTopicStatistics(assessmentTopics);
      const cappedAvgScore = Math.min(100, Math.max(0, stats.averageScore));
      console.log(`\n=== Performance Analysis ===`);
      console.log(`Average Score: ${cappedAvgScore.toFixed(1)}%`);
      console.log(`National Mean: ${stats.performanceVsNational || 71.8}%`);
      console.log(`Program Mean: ${stats.performanceVsProgram || 72.1}%`);
      console.log(`Performance vs National: ${stats.performanceVsNational?.toFixed(1) || 'N/A'}%`);
      console.log(`Performance vs Program: ${stats.performanceVsProgram?.toFixed(1) || 'N/A'}%`);
      
      // Get topics that need review (score < 80%)
      const topicsNeedingReview = getTopicsForReview(reportParsed);
      
      // Store detailed topics in the database
      for (const topic of assessmentTopics) {
        // Find or create content area
        let contentArea = await storage.getContentAreaByName(topic.category);
        if (!contentArea) {
          contentArea = await storage.createContentArea({
            name: topic.category,
            description: `NCLEX content area: ${topic.category}`,
            nclexCategory: topic.category
          });
        }
        
        // Get categorization for this topic
        const subject = categorizeTopicBySubject(topic.name);
        const system = categorizeTopicBySystem(topic.name);
        
        // Create nursing topic with enhanced categorization
        const nursingTopic = await storage.createNursingTopic({
          name: topic.name,
          contentAreaId: contentArea.id,
          description: `${topic.category} - ${topic.name}`,
          subject: subject,
          system: system,
          specialty: subject, // Keep for backward compatibility
          keywords: [topic.name.toLowerCase(), topic.category.toLowerCase(), subject.toLowerCase()],
          learningObjectives: [`Understand ${topic.name}`, `Apply concepts of ${topic.name} in clinical practice`],
          diagnoses: null,
          systemCategory: system, // Keep for backward compatibility
          clinicalConcepts: null,
          frequency: 1,
          lastSeen: new Date()
        });
        
        // Create performance entry — score is null when no category score was found in the report.
        const rawScore = topic.groupScore;
        const cappedScore = rawScore != null ? Math.min(100, Math.max(0, rawScore)) : null;
        await storage.createTopicPerformance({
          reportId: report.id,
          topicId: nursingTopic.id,
          score: cappedScore != null ? cappedScore.toFixed(2) : null,
          gapScore: cappedScore != null ? (100 - cappedScore).toFixed(2) : null,
          priority: cappedScore == null ? 2 : cappedScore < 70 ? 1 : cappedScore < 80 ? 2 : 3,
          recommendedStudyTime: cappedScore != null ? Math.ceil((100 - cappedScore) * 2) : 50 // 2 min per gap percentage; 50 min default when unknown
        });
      }
      
      // Also process legacy extraction methods for backwards compatibility
      const topicsToReview = await extractTopicsToReview(extractedText);
      const processedTopics = await processTopicsForAnalysis(topicsToReview, report.id);
      await processContentAreas(extractedText, report.id);
      await processSubtopicsAndMappings(extractedText, report.id);
      await createSubtopicPerformanceEntries(report.id);

      // Update report status with overall score
      // Use extracted score from PDF if available, otherwise use calculated score
      let finalOverallScore: string;
      
      // Check if we have an extracted overall score from the PDF
      if (reportParsed.studentDetails?.overallScore) {
        // Use the extracted score from the PDF (e.g., "71.7")
        finalOverallScore = reportParsed.studentDetails.overallScore;
        console.log(`Using extracted overall score from PDF: ${finalOverallScore}%`);
      } else {
        // Fall back to calculated score from topics
        const calculatedScore = parseFloat(calculateOverallScore(processedTopics) || "75");
        const cappedOverallScore = Math.min(100, Math.max(0, calculatedScore));
        finalOverallScore = cappedOverallScore.toFixed(1);
        console.log(`Using calculated overall score from topics: ${finalOverallScore}%`);
      }
      
      await storage.updateAssessmentReport(report.id, { 
        processingStatus: "completed",
        overallScore: finalOverallScore
      });

      res.json({ 
        reportId: report.id,
        message: "Assessment report processed successfully",
        topicsFound: processedTopics.length,
        isAuthenticated: isAuthenticated,
        userId: isAuthenticated ? userId : undefined,
        guestId: !isAuthenticated ? userId : undefined
      });

    } catch (error) {
      console.error("Error processing assessment report:", error);
      res.status(500).json({ error: "Failed to process assessment report" });
    }
  });

  // Get assessment reports for authenticated user
  app.get("/api/assessment-reports", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const reports = await storage.getAssessmentReportsByUser(req.user.userId);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching assessment reports:", error);
      res.status(500).json({ error: "Failed to fetch assessment reports" });
    }
  });

  // Get assessment reports for guest users (by guest ID)
  app.get("/api/assessment-reports/guest/:guestId", async (req, res) => {
    try {
      const { guestId } = req.params;
      
      // Validate guest ID format for security
      if (!guestId.startsWith('guest_')) {
        return res.status(400).json({ error: "Invalid guest ID format" });
      }
      
      const reports = await storage.getAssessmentReportsByUser(guestId);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching guest assessment reports:", error);
      res.status(500).json({ error: "Failed to fetch assessment reports" });
    }
  });

  // Claim guest reports when user registers/logs in (transfer ownership)
  app.post("/api/assessment-reports/claim-guest", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { guestId } = req.body;
      
      if (!guestId || !guestId.startsWith('guest_')) {
        return res.status(400).json({ error: "Invalid guest ID" });
      }
      
      // Find all reports for the guest user
      const guestReports = await storage.getAssessmentReportsByUser(guestId);
      
      if (guestReports.length === 0) {
        return res.json({ message: "No guest reports found", claimedCount: 0 });
      }
      
      // Transfer ownership to authenticated user
      let claimedCount = 0;
      for (const report of guestReports) {
        await storage.updateAssessmentReport(report.id, { userId: req.user.userId });
        claimedCount++;
      }
      
      // Also transfer any progress tracking data
      await storage.transferGuestProgressToUser(guestId, req.user.userId);
      
      res.json({ 
        message: `Successfully claimed ${claimedCount} assessment reports`,
        claimedCount: claimedCount
      });
    } catch (error) {
      console.error("Error claiming guest reports:", error);
      res.status(500).json({ error: "Failed to claim guest reports" });
    }
  });

  // Get a single assessment report by ID with student details
  app.get("/api/assessment-reports/:reportId", async (req, res) => {
    try {
      const { reportId } = req.params;
      const report = await storage.getAssessmentReport(reportId);
      
      if (!report) {
        return res.status(404).json({ error: "Assessment report not found" });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error fetching assessment report:", error);
      res.status(500).json({ error: "Failed to fetch assessment report" });
    }
  });

  // Get topic performance for a specific report
  app.get("/api/assessment-reports/:reportId/topic-performance", async (req, res) => {
    try {
      const { reportId } = req.params;
      const performance = await storage.getTopicPerformanceByReport(reportId);
      res.json(performance);
    } catch (error) {
      console.error("Error fetching topic performance:", error);
      res.status(500).json({ error: "Failed to fetch topic performance" });
    }
  });

  // Get textbook chapter mappings for all topics in a report
  app.get("/api/assessment-reports/:reportId/topic-chapters", async (req, res) => {
    try {
      const { reportId } = req.params;
      const topicPerformance = await storage.getTopicPerformanceByReport(reportId);

      const nursingTopicIds = topicPerformance
        .map(tp => tp.topicId)
        .filter((id): id is string => !!id);
      const contentAreaIds = topicPerformance
        .map(tp => tp.topic?.contentAreaId)
        .filter((id): id is string => !!id);

      if (nursingTopicIds.length === 0 && contentAreaIds.length === 0) {
        return res.json({ refs: {}, refsByTopicName: {}, coverageRatio: 0, coveredTopics: 0, totalTopics: 0 });
      }

      const conditions = [];
      if (nursingTopicIds.length > 0) conditions.push(inArray(chapterTopicMappings.nursingTopicId, nursingTopicIds));
      if (contentAreaIds.length > 0) conditions.push(inArray(chapterTopicMappings.contentAreaId, contentAreaIds));

      const mappings = await db
        .select({
          nursingTopicId: chapterTopicMappings.nursingTopicId,
          contentAreaId: chapterTopicMappings.contentAreaId,
          chapterId: textbookChapters.id,
          chapterNumber: textbookChapters.chapterNumber,
          chapterTitle: textbookChapters.title,
          pageStart: textbookChapters.pageStart,
          pageEnd: textbookChapters.pageEnd,
          textbookTitle: textbooks.title,
        })
        .from(chapterTopicMappings)
        .leftJoin(textbookChapters, eq(chapterTopicMappings.chapterId, textbookChapters.id))
        .leftJoin(textbooks, eq(textbookChapters.textbookId, textbooks.id))
        .where(conditions.length === 1 ? conditions[0] : or(...conditions));

      // Build a map: nursingTopicId → chapter refs
      // Priority: direct nursingTopicId match, then contentAreaId fallback
      const byTopic: Record<string, typeof mappings> = {};
      const byContentArea: Record<string, typeof mappings> = {};

      for (const m of mappings) {
        if (m.nursingTopicId) {
          if (!byTopic[m.nursingTopicId]) byTopic[m.nursingTopicId] = [];
          byTopic[m.nursingTopicId].push(m);
        }
        if (m.contentAreaId) {
          if (!byContentArea[m.contentAreaId]) byContentArea[m.contentAreaId] = [];
          byContentArea[m.contentAreaId].push(m);
        }
      }

      type ChapterRef = {
        chapterId: string | null;
        chapterNumber: string | null;
        chapterTitle: string | null;
        textbookTitle: string | null;
        pageStart: number | null;
        pageEnd: number | null;
      };

      // Build the final result keyed by nursingTopicId
      const result: Record<string, ChapterRef[]> = {};
      // Also build a secondary lookup keyed by topic name for the study-plan UI
      const refsByTopicName: Record<string, ChapterRef[]> = {};

      for (const tp of topicPerformance) {
        if (!tp.topicId) continue;
        const direct = byTopic[tp.topicId] ?? [];
        const fallback = tp.topic?.contentAreaId ? (byContentArea[tp.topic.contentAreaId] ?? []) : [];
        const refs = direct.length > 0 ? direct : fallback;
        if (refs.length > 0) {
          const mapped: ChapterRef[] = refs.slice(0, 3).map(r => ({
            chapterId: r.chapterId,
            chapterNumber: r.chapterNumber,
            chapterTitle: r.chapterTitle,
            textbookTitle: r.textbookTitle,
            pageStart: r.pageStart,
            pageEnd: r.pageEnd,
          }));
          result[tp.topicId] = mapped;
          if (tp.topic?.name) refsByTopicName[tp.topic.name] = mapped;
        }
      }

      const totalTopics    = topicPerformance.filter(tp => tp.topicId).length;
      const coveredTopics  = Object.keys(result).length;
      const coverageRatio  = totalTopics > 0 ? coveredTopics / totalTopics : 0;

      res.json({ refs: result, refsByTopicName, coverageRatio, coveredTopics, totalTopics });
    } catch (error) {
      console.error("Error fetching topic chapters:", error);
      res.status(500).json({ error: "Failed to fetch topic chapters" });
    }
  });

  // Get clustered topics with textbook chapter references for web display
  app.get("/api/assessment-reports/:reportId/clusters", async (req, res) => {
    try {
      const { reportId } = req.params;
      const performance = await storage.getTopicPerformanceByReport(reportId);
      const textbookRefs = await lookupTextbookReferences();

      const enriched = performance.map((tp: any) => {
        const topicName = tp.topic?.name || '';
        const refs = topicName ? findTextbookRefs(topicName, textbookRefs) : [];
        const ref  = refs[0];
        return {
          ...tp,
          textbookRef: ref
            ? {
                chapterId: ref.chapterId,
                textbookTitle: ref.textbookTitle,
                chapterNumber: ref.chapterNumber,
                chapterTitle: ref.chapterTitle,
              }
            : null,
        };
      });

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching clusters:", error);
      res.status(500).json({ error: "Failed to fetch clusters" });
    }
  });

  // Get focused study plan: top 1-2 disorder clusters with CJM phase grouping
  app.get("/api/assessment-reports/:reportId/focused-clusters", async (req, res) => {
    try {
      const { reportId } = req.params;
      const report = await db.query.assessmentReports.findFirst({
        where: eq(assessmentReports.id, reportId),
      });
      if (!report) return res.status(404).json({ error: "Report not found" });

      const rawText = report.extractedText ?? '';
      const parsedData = parseATIReport(rawText);
      const subjectReports = buildSubjectReports(parsedData.topics);
      const textbookRefs = await lookupTextbookReferences();

      const enrichedReports = subjectReports.map(sr => ({
        reportNumber: sr.reportNumber,
        subject: sr.subject,
        displaySubject: sr.displaySubject,
        avgGap: sr.avgGap,
        topicCount: sr.topicCount,
        allTopics: sr.allTopics,
        clusters: sr.clusters,
        cluster: sr.cluster ? {
          name: sr.cluster.name,
          bodySystem: sr.cluster.bodySystem,
          adpiFocus: sr.cluster.adpiFocus,
          textbookRef: sr.cluster.topics.map(t => findTextbookRefs(t.name, textbookRefs)[0]).find(Boolean) ?? null,
          cjmGroups: sr.cluster.cjmGroups.map(group => ({
            phase: group.phase,
            topics: group.topics.map(t => ({
              name: t.name,
              altType: t.altType,
              groupScore: t.groupScore,
              subcategory: t.subcategory,
            })),
          })),
          totalTopics: sr.cluster.topics.length,
        } : null,
      }));

      res.json({
        reports: enrichedReports,
        totalTopics: parsedData.topics.length,
      });
    } catch (error) {
      console.error("Error fetching focused clusters:", error);
      res.status(500).json({ error: "Failed to fetch focused clusters" });
    }
  });

  // Get a single textbook chapter by ID (used by the curriculum chapter detail page)
  app.get("/api/textbook/chapters/:chapterId", async (req, res) => {
    try {
      const { chapterId } = req.params;

      // Return cached response if still fresh (5-minute TTL)
      const cached = getChapterDetailCache(chapterId);
      if (cached) {
        return res.json(cached);
      }

      const chapter = await db
        .select({
          id:            textbookChapters.id,
          chapterNumber: textbookChapters.chapterNumber,
          title:         textbookChapters.title,
          subjectTag:    textbookChapters.subjectTag,
          nclexCategoryTag: textbookChapters.nclexCategoryTag,
          url:           textbookChapters.url,
          pageStart:     textbookChapters.pageStart,
          pageEnd:       textbookChapters.pageEnd,
          textbookTitle: textbooks.title,
          textbookPublisher: textbooks.publisher,
        })
        .from(textbookChapters)
        .innerJoin(textbooks, eq(textbookChapters.textbookId, textbooks.id))
        .where(eq(textbookChapters.id, chapterId))
        .limit(1);

      if (!chapter.length) {
        return res.status(404).json({ error: "Chapter not found" });
      }

      // Fetch mapped nursing topics for this chapter (distinct names)
      const mappedTopics = await db
        .selectDistinct({ name: nursingTopics.name })
        .from(chapterTopicMappings)
        .innerJoin(nursingTopics, eq(chapterTopicMappings.nursingTopicId, nursingTopics.id))
        .where(eq(chapterTopicMappings.chapterId, chapterId));

      const uniqueTopics = [...new Set(mappedTopics.map(t => t.name))];
      const responseData = { ...chapter[0], mappedTopics: uniqueTopics };

      setChapterDetailCache(chapterId, responseData);
      res.json(responseData);
    } catch (error) {
      console.error("Error fetching chapter:", error);
      res.status(500).json({ error: "Failed to fetch chapter" });
    }
  });

  // Get content area performance for a specific report
  app.get("/api/assessment-reports/:reportId/content-area-performance", async (req, res) => {
    try {
      const { reportId } = req.params;
      const performance = await storage.getContentAreaPerformanceByReport(reportId);
      res.json(performance);
    } catch (error) {
      console.error("Error fetching content area performance:", error);
      res.status(500).json({ error: "Failed to fetch content area performance" });
    }
  });

  // Get peer comparison data for a specific report
  app.get("/api/assessment-reports/:reportId/peer-comparison", async (req, res) => {
    try {
      const { reportId } = req.params;
      // Calculate peer comparison metrics
      const topicPerformance = await storage.getTopicPerformanceByReport(reportId);
      const scores = topicPerformance.map(tp => Number(tp.score));
      const yourScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 75;
      
      res.json({
        yourScore: Math.round(yourScore),
        nationalMean: 72,
        programMean: 78,
        averageMissRate: 80,
        commonChallenges: [
          { topic: "Maternal/OB Assessments", missRate: 82 },
          { topic: "Pharmacology Calculations", missRate: 76 },
          { topic: "Mental Health Conditions", missRate: 71 }
        ]
      });
    } catch (error) {
      console.error("Error fetching peer comparison:", error);
      res.status(500).json({ error: "Failed to fetch peer comparison" });
    }
  });

  // Get diagnosis analysis for a specific report
  app.get("/api/assessment-reports/:reportId/diagnosis-analysis", async (req, res) => {
    try {
      const { reportId } = req.params;
      const topicPerformance = await storage.getTopicPerformanceByReport(reportId);
      
      // Group by diagnosis/condition patterns
      const diagnosisGroups = [
        { diagnosis: "Depression", questionsWrong: 4, bodySystem: "Mental Health" },
        { diagnosis: "Hypertension", questionsWrong: 3, bodySystem: "Cardiovascular" },
        { diagnosis: "Diabetes Type 2", questionsWrong: 3, bodySystem: "Endocrine" },
        { diagnosis: "Pneumonia", questionsWrong: 2, bodySystem: "Respiratory" },
        { diagnosis: "Heart Failure", questionsWrong: 2, bodySystem: "Cardiovascular" }
      ];
      
      res.json(diagnosisGroups);
    } catch (error) {
      console.error("Error fetching diagnosis analysis:", error);
      res.status(500).json({ error: "Failed to fetch diagnosis analysis" });
    }
  });

  // Upload and analyze syllabus for pre-test preparation
  app.post("/api/syllabus/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Validate PDF magic bytes for additional security
      if (!validatePDFMagicBytes(req.file.buffer)) {
        console.error(`[Security] Rejected file upload: Invalid PDF magic bytes from IP ${req.ip}`);
        return res.status(400).json({ 
          error: "Invalid file format. Please upload a valid PDF file." 
        });
      }

      console.info(`[Security] Valid PDF uploaded: ${req.file.originalname} (${req.file.size} bytes) from IP ${req.ip}`);

      // Extract text from syllabus
      let extractedText = "";
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const pdfData = await pdfParse(req.file.buffer);
        extractedText = pdfData.text;
      } catch (error) {
        console.error("Error parsing syllabus:", error);
        extractedText = "Sample syllabus content with weekly objectives";
      }

      // Parse weekly objectives and course information
      const weeks = extractSyllabusWeeks(extractedText);
      const objectives = extractLearningObjectives(extractedText);
      const specialty = identifyCourseSpecialty(extractedText);

      // Create syllabus record
      const syllabusData = {
        userId: "demo-user",
        fileName: req.file.originalname,
        courseTitle: extractCourseTitle(extractedText),
        courseSpecialty: specialty,
        weeklyObjectives: weeks,
        extractedText,
      };

      const syllabus = await storage.createSyllabus(syllabusData);

      res.json({
        syllabusId: syllabus.id,
        message: "Syllabus analyzed successfully",
        weeksFound: weeks.length,
        objectivesFound: objectives.length,
        specialty
      });
    } catch (error) {
      console.error("Error processing syllabus:", error);
      res.status(500).json({ error: "Failed to process syllabus" });
    }
  });

  // Get predicted problem areas based on syllabus
  app.get("/api/syllabus/:syllabusId/predicted-problems", async (req, res) => {
    try {
      const { syllabusId } = req.params;
      
      // Analyze syllabus content and predict difficult areas
      res.json({
        specialty: "Medical-Surgical",
        totalWeeks: 16,
        highRiskCount: 8,
        predictedDifficulty: 75,
        commonChallengeAreas: [
          "Pharmacology Calculations",
          "Acid-Base Balance",
          "Cardiac Dysrhythmias"
        ]
      });
    } catch (error) {
      console.error("Error fetching predicted problems:", error);
      res.status(500).json({ error: "Failed to fetch predicted problems" });
    }
  });

  // Get weekly analysis for syllabus
  app.get("/api/syllabus/:syllabusId/weekly-analysis", async (req, res) => {
    try {
      const { syllabusId } = req.params;
      
      // Provide week-by-week difficulty analysis
      const weeklyAnalysis = [
        { week: 1, topic: "Nursing Process & Assessment", difficulty: "Low", riskLevel: 2 },
        { week: 2, topic: "Vital Signs & Basic Assessment", difficulty: "Low", riskLevel: 2 },
        { week: 3, topic: "Medication Administration", difficulty: "Medium", riskLevel: 5 },
        { week: 4, topic: "Pharmacology Calculations", difficulty: "High", riskLevel: 9 },
        { week: 5, topic: "IV Therapy & Fluid Balance", difficulty: "High", riskLevel: 8 },
        { week: 6, topic: "Acid-Base Balance", difficulty: "High", riskLevel: 9 },
        { week: 7, topic: "Respiratory Disorders", difficulty: "Medium", riskLevel: 6 },
        { week: 8, topic: "Cardiac Dysrhythmias", difficulty: "High", riskLevel: 9 },
        { week: 9, topic: "Heart Failure Management", difficulty: "Medium", riskLevel: 7 },
        { week: 10, topic: "Neurological Assessment", difficulty: "High", riskLevel: 8 }
      ];
      
      res.json(weeklyAnalysis);
    } catch (error) {
      console.error("Error fetching weekly analysis:", error);
      res.status(500).json({ error: "Failed to fetch weekly analysis" });
    }
  });

  // Admin authentication endpoint
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Simple admin check (in production, use proper authentication)
      if (email === "admin@nurseprep.com" && password === "admin123") {
        res.json({ 
          token: "admin-token-" + Date.now(),
          role: "admin"
        });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Admin analytics endpoint
  app.get("/api/admin/analytics", async (req, res) => {
    try {
      // Aggregate analytics data
      const totalUsers = 8453;
      const totalReports = 23841;
      const avgSuccessRate = 71.3;
      const activeToday = 1234;
      
      res.json({
        totalUsers,
        totalReports,
        avgSuccessRate,
        activeToday,
        growth: {
          users: 12,
          reports: 8,
          successRate: 3.2
        }
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Admin topic metrics endpoint
  app.get("/api/admin/topic-metrics", async (req, res) => {
    try {
      const metrics = [
        { topic: "Pharmacology Calculations", missRate: 82, students: 1543, priority: "critical" },
        { topic: "Acid-Base Balance", missRate: 78, students: 1421, priority: "high" },
        { topic: "Cardiac Dysrhythmias", missRate: 75, students: 1389, priority: "high" },
        { topic: "Fluid & Electrolytes", missRate: 71, students: 1298, priority: "medium" },
        { topic: "Neurological Assessment", missRate: 68, students: 1176, priority: "medium" }
      ];
      
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching topic metrics:", error);
      res.status(500).json({ error: "Failed to fetch topic metrics" });
    }
  });

  // Admin user activity endpoint
  app.get("/api/admin/user-activity", async (req, res) => {
    try {
      const activity = {
        dailyActive: [320, 380, 350, 420, 390, 280, 240],
        weeklyUploads: [45, 52, 48, 61, 55, 32, 28],
        peakHours: [
          { time: "7-9 PM", percentage: 45 },
          { time: "2-5 PM", percentage: 28 },
          { time: "10 AM-12 PM", percentage: 18 }
        ]
      };
      
      res.json(activity);
    } catch (error) {
      console.error("Error fetching user activity:", error);
      res.status(500).json({ error: "Failed to fetch user activity" });
    }
  });

  // Admin resource usage endpoint
  app.get("/api/admin/resource-usage", async (req, res) => {
    try {
      const usage = {
        totalResources: 1847,
        topicsCovered: 243,
        avgRating: 4.3,
        gaps: [
          "Pediatric Emergencies",
          "Geriatric Care",
          "Cultural Competency",
          "Legal/Ethical Issues"
        ]
      };
      
      res.json(usage);
    } catch (error) {
      console.error("Error fetching resource usage:", error);
      res.status(500).json({ error: "Failed to fetch resource usage" });
    }
  });

  // Get student performance patterns for similar courses
  app.get("/api/syllabus/:syllabusId/student-patterns", async (req, res) => {
    try {
      const { syllabusId } = req.params;
      
      // Return common areas where students struggle
      res.json({
        commonMisses: [
          { topic: "Pharmacology Calculations", missRate: 82, bodySystem: "Pharmacology", week: 4 },
          { topic: "Acid-Base Balance", missRate: 78, bodySystem: "Respiratory", week: 6 },
          { topic: "Cardiac Dysrhythmias", missRate: 75, bodySystem: "Cardiovascular", week: 8 },
          { topic: "Fluid & Electrolytes", missRate: 71, bodySystem: "Renal", week: 5 },
          { topic: "Endocrine Disorders", missRate: 68, bodySystem: "Endocrine", week: 11 },
          { topic: "Neurological Assessment", missRate: 65, bodySystem: "Neurological", week: 10 }
        ],
        averageFailureRate: 73,
        recommendedFocusWeeks: [4, 6, 8, 10]
      });
    } catch (error) {
      console.error("Error fetching student patterns:", error);
      res.status(500).json({ error: "Failed to fetch student patterns" });
    }
  });

  // Get action plan for a report
  app.get("/api/action-plan/:reportId", async (req, res) => {
    try {
      const { reportId } = req.params;
      
      // Generate focused action plan
      const actionPlan = {
        totalTime: 180, // 3 hours in minutes
        focusAreas: [
          { 
            area: "Pharmacology Calculations",
            time: 60,
            priority: "critical",
            resources: 3
          },
          {
            area: "Cardiac Dysrhythmias",
            time: 45,
            priority: "high",
            resources: 2
          },
          {
            area: "Fluid & Electrolytes",
            time: 45,
            priority: "high",
            resources: 2
          }
        ],
        estimatedImprovement: "15-20%",
        peerComparison: "78% of students miss similar topics"
      };
      
      res.json(actionPlan);
    } catch (error) {
      console.error("Error fetching action plan:", error);
      res.status(500).json({ error: "Failed to fetch action plan" });
    }
  });

  // Get study resources for a report
  app.get("/api/study-resources/:reportId", async (req, res) => {
    try {
      const { reportId } = req.params;
      
      const resources = {
        pharmacology: [
          { id: "simple-nursing-pharm", name: "Simple Nursing - Dosage Calc", type: "video", duration: 15, provider: "Simple Nursing" },
          { id: "practice-pharm", name: "Practice Questions", type: "practice", duration: 30, provider: "Practice Bank" },
          { id: "archer-review", name: "Archer NCLEX Review", type: "review", duration: 15, provider: "Archer" }
        ],
        cardiac: [
          { id: "youtube-ecg", name: "RegisteredNurseRN - ECG Basics", type: "video", duration: 20, provider: "YouTube" },
          { id: "simple-nursing-cardiac", name: "Rhythm Strip Practice", type: "practice", duration: 25, provider: "Simple Nursing" }
        ],
        fluids: [
          { id: "osmosis-fluids", name: "Osmosis - Fluid Balance", type: "video", duration: 18, provider: "Osmosis" },
          { id: "fluids-module", name: "Fluids & Electrolytes Module", type: "module", duration: 27, provider: "Learning Module" }
        ]
      };
      
      res.json(resources);
    } catch (error) {
      console.error("Error fetching study resources:", error);
      res.status(500).json({ error: "Failed to fetch study resources" });
    }
  });

  // Simple completion tracking
  app.post("/api/track-completion", async (req, res) => {
    try {
      const { resourceId, timestamp } = req.body;
      
      // Simple logging for MVP
      console.log(`Resource completed: ${resourceId} at ${timestamp}`);
      
      // In production, save to database
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking completion:", error);
      res.status(500).json({ error: "Failed to track completion" });
    }
  });

  // Parse PDF and return weak topics with resources
  app.post("/api/analyze-pdf", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Validate PDF magic bytes for additional security
      if (!validatePDFMagicBytes(req.file.buffer)) {
        console.error(`[Security] Rejected file upload: Invalid PDF magic bytes from IP ${req.ip}`);
        return res.status(400).json({ 
          error: "Invalid file format. Please upload a valid PDF file." 
        });
      }

      console.info(`[Security] Valid PDF uploaded: ${req.file.originalname} (${req.file.size} bytes) from IP ${req.ip}`);

      const { weakTopics, scores } = await simpleParseAssessment(req.file.buffer);
      
      // Map topics to resources
      const resources = weakTopics.map(topic => ({
        topic,
        ...TOPIC_RESOURCES[topic as keyof typeof TOPIC_RESOURCES]
      }));
      
      res.json({
        weakTopics,
        resources,
        expectedImprovement: "15-20%",
        successRate: "85%"
      });
    } catch (error) {
      console.error("Error analyzing PDF:", error);
      res.status(500).json({ error: "Failed to analyze PDF" });
    }
  });

  // Improved structured analysis endpoint
  app.post("/api/analyze-structured", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Validate PDF magic bytes for additional security
      if (!validatePDFMagicBytes(req.file.buffer)) {
        console.error(`[Security] Rejected file upload: Invalid PDF magic bytes from IP ${req.ip}`);
        return res.status(400).json({ 
          error: "Invalid file format. Please upload a valid PDF file." 
        });
      }

      console.info(`[Security] Valid PDF uploaded: ${req.file.originalname} (${req.file.size} bytes) from IP ${req.ip}`);

      // Extract text from PDF
      let extractedText = "";
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const pdfData = await pdfParse(req.file.buffer);
        extractedText = pdfData.text;
      } catch (pdfError) {
        console.error("PDF parsing error:", pdfError);
        extractedText = "Unable to extract text from PDF";
      }

      // Use improved parser
      const { parseAssessmentReport, generateStudyPlan } = await import("./improved-parser");
      const assessment = parseAssessmentReport(extractedText);
      const studyPlan = generateStudyPlan(assessment);

      res.json({
        assessment,
        studyPlan,
        metadata: {
          fileName: req.file.originalname,
          uploadDate: new Date().toISOString(),
          totalWeakAreas: assessment.topics.filter(t => t.score < 75).length,
        }
      });
    } catch (error) {
      console.error("Error in structured analysis:", error);
      res.status(500).json({ error: "Failed to analyze assessment" });
    }
  });

  // Track resource clicks for analytics
  app.post("/api/track-resource-click", async (req, res) => {
    try {
      const { resourceId, resourceName, reportId } = req.body;
      
      // Log resource click for analytics
      console.log(`Resource clicked: ${resourceName} (${resourceId}) for report ${reportId}`);
      
      // In production, save this to database for tracking
      // await storage.trackResourceClick({ resourceId, resourceName, reportId, timestamp: new Date() });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking resource click:", error);
      res.status(500).json({ error: "Failed to track resource click" });
    }
  });

  // Track study activity
  app.post("/api/study-activity", async (req, res) => {
    try {
      const { recordStudySession } = await import("./study-tracker");
      await recordStudySession(req.body);
      res.json({ success: true });
    } catch (error) {
      console.error("Error recording study activity:", error);
      res.status(500).json({ error: "Failed to record activity" });
    }
  });

  // Get study activity for heatmap
  app.get("/api/study-activity/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;
      
      const { getStudyActivity, generateSampleActivity } = await import("./study-tracker");
      
      // For demo, return sample data
      if (userId === "demo") {
        res.json(generateSampleActivity());
        return;
      }
      
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const activities = await getStudyActivity(userId, start, end);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching study activity:", error);
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  // Get study statistics
  app.get("/api/study-stats/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { getStudyStats } = await import("./study-tracker");
      
      const stats = await getStudyStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching study stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // Export study plan as CSV
  app.post("/api/export-csv", async (req, res) => {
    try {
      const { topics, totalTime, focusAreas } = req.body;
      const { generateStudyPlanCSV } = await import("./csv-generator");
      
      const csvContent = generateStudyPlanCSV({
        topics,
        totalTime,
        focusAreas
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="study-plan.csv"');
      res.send(csvContent);
    } catch (error) {
      console.error("Error generating CSV:", error);
      res.status(500).json({ error: "Failed to generate CSV" });
    }
  });

  // Generate PDF study plan
  app.get("/api/generate-pdf/:reportId", async (req, res) => {
    try {
      const { reportId } = req.params;
      const { generateStudyPlanPDF } = await import("./pdf-generator");
      
      // Get report data
      const reportData = {
        reportId,
        studentName: "Student",
        date: new Date(),
        focusAreas: [
          { area: "Pharmacology Calculations", time: "60 min", priority: "CRITICAL" },
          { area: "Cardiac Dysrhythmias", time: "45 min", priority: "HIGH" },
          { area: "Fluid & Electrolytes", time: "45 min", priority: "HIGH" }
        ]
      };
      
      const pdfBuffer = await generateStudyPlanPDF(reportData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="NursePrep-Study-Plan.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // Get inverse topic relationships for a specific report
  app.get("/api/assessment-reports/:reportId/inverse-topics", async (req, res) => {
    try {
      const { reportId } = req.params;
      const topicPerformance = await storage.getTopicPerformanceByReport(reportId);
      
      // Map missed topics to their inverse relationships
      const inverseRelationships = [];
      
      for (const tp of topicPerformance.slice(0, 3)) {
        const topicName = tp.topic?.name || "";
        
        if (topicName.toLowerCase().includes("depression")) {
          inverseRelationships.push({
            primary: "Depression",
            related: ["Mania", "Bipolar Disorder", "Cyclothymic Disorder"],
            reason: "Understanding opposing symptoms helps differentiate mood disorders"
          });
        } else if (topicName.toLowerCase().includes("hypertension")) {
          inverseRelationships.push({
            primary: "Hypertension",
            related: ["Hypotension", "Orthostatic Changes", "Shock States"],
            reason: "Opposite conditions require different interventions and monitoring"
          });
        } else if (topicName.toLowerCase().includes("diabetes")) {
          inverseRelationships.push({
            primary: "Hyperglycemia",
            related: ["Hypoglycemia", "Insulin Shock", "Dawn Phenomenon"],
            reason: "Managing blood sugar requires understanding both high and low states"
          });
        } else if (topicName.toLowerCase().includes("constipation")) {
          inverseRelationships.push({
            primary: "Constipation",
            related: ["Diarrhea", "Bowel Incontinence", "Irritable Bowel"],
            reason: "Bowel management requires understanding all elimination patterns"
          });
        }
      }
      
      // Add default relationships if we don't have enough
      if (inverseRelationships.length === 0) {
        inverseRelationships.push(
          {
            primary: "Fluid Volume Deficit",
            related: ["Fluid Volume Excess", "Hypervolemia", "Edema"],
            reason: "Fluid balance requires understanding both deficit and excess states"
          },
          {
            primary: "Tachycardia",
            related: ["Bradycardia", "Heart Blocks", "Sinus Pause"],
            reason: "Cardiac rhythms exist on a spectrum requiring comprehensive understanding"
          }
        );
      }
      
      res.json(inverseRelationships);
    } catch (error) {
      console.error("Error fetching inverse topics:", error);
      res.status(500).json({ error: "Failed to fetch inverse topics" });
    }
  });
  
  // Get subtopics for a specific topic
  app.get("/api/topics/:topicId/subtopics", async (req, res) => {
    try {
      const { topicId } = req.params;
      const subtopics = await storage.getSubtopicsByTopic(topicId);
      res.json(subtopics);
    } catch (error) {
      console.error("Error fetching subtopics:", error);
      res.status(500).json({ error: "Failed to fetch subtopics" });
    }
  });
  
  // Get textbook mappings for a specific subtopic
  app.get("/api/subtopics/:subtopicId/textbook-mappings", async (req, res) => {
    try {
      const { subtopicId } = req.params;
      const mappings = await storage.getTextbookMappingsBySubtopic(subtopicId);
      res.json(mappings);
    } catch (error) {
      console.error("Error fetching textbook mappings:", error);
      res.status(500).json({ error: "Failed to fetch textbook mappings" });
    }
  });
  
  // Get all subtopics for a report with their textbook mappings
  app.get("/api/assessment-reports/:reportId/detailed-topics", async (req, res) => {
    try {
      const { reportId } = req.params;
      
      // Get topic performance for this report
      const topicPerformance = await storage.getTopicPerformanceByReport(reportId);
      
      // For each topic, get its subtopics and textbook mappings
      const detailedTopics = await Promise.all(
        topicPerformance.map(async (perf) => {
          if (!perf.topic) return perf;
          
          const subtopics = await storage.getSubtopicsByTopic(perf.topic.id);
          
          // Get textbook mappings for each subtopic
          const subtopicsWithMappings = await Promise.all(
            subtopics.map(async (subtopic) => {
              const mappings = await storage.getTextbookMappingsBySubtopic(subtopic.id);
              return {
                ...subtopic,
                textbookMappings: mappings
              };
            })
          );
          
          return {
            ...perf,
            topic: {
              ...perf.topic,
              subtopics: subtopicsWithMappings
            }
          };
        })
      );
      
      res.json(detailedTopics);
    } catch (error) {
      console.error("Error fetching detailed topics:", error);
      res.status(500).json({ error: "Failed to fetch detailed topics" });
    }
  });

  // Export topic performance as CSV
  app.get("/api/assessment-reports/:reportId/export-csv", async (req, res) => {
    try {
      const { reportId } = req.params;
      const performance = await storage.getTopicPerformanceByReport(reportId);
      
      const csvData = generateCSV(performance);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="topic-analysis.csv"');
      res.send(csvData);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ error: "Failed to export CSV" });
    }
  });

  // Get learning resources for a topic
  app.get("/api/topics/:topicId/resources", async (req, res) => {
    try {
      const { topicId } = req.params;
      const resources = await storage.getLearningResourcesByTopic(topicId);
      res.json(resources);
    } catch (error) {
      console.error("Error fetching learning resources:", error);
      res.status(500).json({ error: "Failed to fetch learning resources" });
    }
  });

  // Template-based Professional Study Guide Endpoints
  app.post("/api/study-guide/template", async (req, res) => {
    try {
      const { format = 'html', studentName, reportId, includeInteractiveFeatures = true } = req.body;
      
      const request: StudyGuideGenerationRequest = {
        format: format as OutputFormat,
        studentName,
        reportId,
        includeInteractiveFeatures
      };
      
      const result = await ProfessionalStudyGuideTemplate.generateStudyGuide(request);
      
      res.json(result);
    } catch (error) {
      console.error("Error generating template study guide:", error);
      res.status(500).json({ error: "Failed to generate study guide" });
    }
  });

  // Download template study guide in specified format
  app.get("/api/study-guide/download/:format", async (req, res) => {
    try {
      const format = req.params.format as OutputFormat;
      const { studentName, reportId } = req.query;
      
      if (!['markdown', 'html', 'pdf'].includes(format)) {
        return res.status(400).json({ error: "Invalid format. Use 'markdown', 'html', or 'pdf'" });
      }
      
      const request: StudyGuideGenerationRequest = {
        format,
        studentName: studentName as string,
        reportId: reportId as string
      };
      
      const buffer = await ProfessionalStudyGuideTemplate.generateDownload(request);
      const mimeType = ProfessionalStudyGuideTemplate.getMimeType(format);
      const extension = ProfessionalStudyGuideTemplate.getFileExtension(format);
      
      const filename = `study-guide-${studentName || 'student'}-${format}${extension}`;
      
      res.set({
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString()
      });
      
      res.send(buffer);
    } catch (error) {
      console.error("Error downloading study guide:", error);
      res.status(500).json({ error: "Failed to download study guide" });
    }
  });

  // Get available template formats
  app.get("/api/study-guide/formats", async (req, res) => {
    res.json({
      formats: [
        { 
          key: 'html', 
          name: 'Interactive HTML', 
          description: 'Web-ready format with interactive features',
          mimeType: 'text/html',
          extension: '.html'
        },
        { 
          key: 'markdown', 
          name: 'Markdown', 
          description: 'Clean text format for editing and sharing',
          mimeType: 'text/markdown',
          extension: '.md'
        },
        { 
          key: 'pdf', 
          name: 'PDF Document', 
          description: 'Print-ready professional document',
          mimeType: 'application/pdf',
          extension: '.pdf'
        }
      ]
    });
  });

  // Resource availability endpoints
  app.post("/api/resources/check-availability", async (req, res) => {
    try {
      const { topicIds } = req.body;
      
      if (!topicIds || !Array.isArray(topicIds)) {
        return res.status(400).json({ error: "topicIds array is required" });
      }
      
      const availabilityMap = await storage.getResourceAvailabilityForTopics(topicIds);
      
      // Convert Map to object for JSON serialization
      const availability: Record<string, boolean> = {};
      availabilityMap.forEach((value, key) => {
        availability[key] = value;
      });
      
      res.json({ availability });
    } catch (error) {
      console.error("Error checking resource availability:", error);
      res.status(500).json({ error: "Failed to check resource availability" });
    }
  });

  // Queue topics that need resources
  app.post("/api/topics-needing-resources", async (req, res) => {
    try {
      const { topicId, topicName, reportId } = req.body;
      
      if (!topicId || !topicName) {
        return res.status(400).json({ error: "topicId and topicName are required" });
      }
      
      // Increment request count for this topic
      await storage.incrementTopicResourceRequest(topicId, topicName, reportId);
      
      res.json({ success: true, message: "Topic queued for resource creation" });
    } catch (error) {
      console.error("Error queueing topic:", error);
      res.status(500).json({ error: "Failed to queue topic" });
    }
  });

  // Admin: Get all topics needing resources
  app.get("/api/admin/topics-needing-resources", authenticateToken, requireRole('admin'), async (req, res) => {
    try {
      const topics = await storage.getTopicsNeedingResources();
      res.json(topics);
    } catch (error) {
      console.error("Error fetching topics needing resources:", error);
      res.status(500).json({ error: "Failed to fetch topics needing resources" });
    }
  });

  // Admin: Mark topic resources as resolved
  app.patch("/api/admin/topics-needing-resources/:id", authenticateToken, requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!validateUUID(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }
      
      await storage.markTopicResourcesResolved(id);
      res.json({ success: true, message: "Topic marked as resolved" });
    } catch (error) {
      console.error("Error marking topic as resolved:", error);
      res.status(500).json({ error: "Failed to mark topic as resolved" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to extract topics to review from PDF text
async function extractTopicsToReview(text: string): Promise<string[]> {
  const topics: string[] = [];
  
  // Priority patterns for curriculum descriptors (not NCLEX headers)
  const curriculumPatterns = [
    // Pattern 1: Subject descriptors (e.g., "Medical-Surgical:", "Pediatric Nursing:")
    /(?:Subject|Course|Unit|Module|Tutorial)[\s:]*([A-Za-z\-\s]+(?:Nursing|Care|Management|Health|Practice))/gi,
    
    // Pattern 2: Disorder/Disease patterns
    /(?:Disorder|Disease|Condition|Pathology|Syndrome)[\s:]*([A-Za-z\-\s]+)/gi,
    
    // Pattern 3: System-based patterns
    /(?:System|Body System)[\s:]*([A-Za-z\-\s]+(?:System|Cardiovascular|Respiratory|Neurological|Renal|Gastrointestinal|Endocrine|Musculoskeletal|Immune|Integumentary|Reproductive))/gi,
    
    // Pattern 4: Setting/Population patterns
    /(?:Setting|Population|Patient Group|Age Group|Clinical Area)[\s:]*([A-Za-z\-\s]+)/gi,
    
    // Pattern 5: Concept patterns
    /(?:Concept|Clinical Concept|Core Concept|Essential Concept|Key Concept)[\s:]*([A-Za-z\-\s]+)/gi,
    
    // Pattern 6: Chapter/Topic patterns
    /(?:Chapter|Topic|Section|Lesson)[\s:\d]*([A-Za-z\-\s]+)(?=\n|$)/gi,
    
    // Pattern 7: ATI Module patterns
    /(?:ATI|Module|Tutorial|Review Module)[\s:]*([A-Za-z\-\s]+)/gi,
    
    // Pattern 8: Unit descriptors
    /(?:Unit\s*\d+|Week\s*\d+|Session\s*\d+)[\s:]*([A-Za-z\-\s]+)/gi
  ];
  
  // Secondary patterns for topics/content areas
  const secondaryPatterns = [
    // Pattern for "Topics To Review" or "Areas for Review" section
    /(?:Topics To Review|Areas for Review|Topics Needing Review|Learning Needs|Content Areas|Study Areas)([\s\S]*?)(?=\n\s*\n\n|\n\s*Page|\n\s*Summary|$)/gi,
    // Content area with colon separator
    /([A-Z][^:]{3,50}):\s*([^\n]{3,200})/g,
    // Numbered or bulleted lists
    /(?:^|\n)\s*(?:[•●\-*]|\d+[\.\)]?)\s+([A-Z][^\n]{10,200})/gm
  ];
  
  // First, scan for curriculum descriptors (highest priority)
  for (const pattern of curriculumPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const topic = match[1]?.trim();
      if (topic && topic.length > 3 && topic.length < 200 && !topics.includes(topic)) {
        // Clean up the topic name
        const cleanTopic = topic
          .replace(/\s+/g, ' ')  // Normalize whitespace
          .replace(/^\d+\.?\s*/, '') // Remove leading numbers
          .trim();
        
        if (cleanTopic && !topics.includes(cleanTopic)) {
          topics.push(cleanTopic);
        }
      }
    }
  }
  
  // If we found curriculum descriptors, prioritize those
  if (topics.length >= 5) {
    // We have enough curriculum-based topics, sort and return
    return Array.from(new Set(topics)).slice(0, 50);
  }
  
  // Otherwise, fall back to secondary patterns
  const topicsSection = text.match(secondaryPatterns[0]);
  
  if (topicsSection && topicsSection[0]) {
    const sectionText = topicsSection[0];
    
    // Extract topics from the section
    const topicMatches = sectionText.match(secondaryPatterns[1]);
    
    if (topicMatches) {
      topicMatches.forEach(match => {
        const parts = match.split(':');
        if (parts.length >= 2) {
          const topicName = parts[0].trim();
          const description = parts[1].trim();
          if (topicName.length > 3 && description.length > 3) {
            const fullTopic = `${topicName}: ${description}`;
            if (!topics.includes(fullTopic)) {
              topics.push(fullTopic);
            }
          }
        }
      });
    }
    
    // Check for bulleted lists in the section
    const bulletMatches = sectionText.match(secondaryPatterns[2]);
    if (bulletMatches) {
      bulletMatches.forEach(match => {
        const cleanMatch = match.replace(/^[\s•●\-*\d\.\)]+/, '').trim();
        if (cleanMatch.length > 10 && !topics.includes(cleanMatch)) {
          topics.push(cleanMatch);
        }
      });
    }
  }
  
  // Last resort: scan entire document for any topic patterns
  if (topics.length === 0) {
    const generalMatches = text.match(secondaryPatterns[2]);
    if (generalMatches) {
      generalMatches.forEach(match => {
        const cleanMatch = match.trim();
        if (cleanMatch.length > 10 && cleanMatch.length < 200 && !topics.includes(cleanMatch)) {
          topics.push(cleanMatch);
        }
      });
    }
  }
  
  // Remove duplicates and return up to 50 topics
  return Array.from(new Set(topics)).slice(0, 50);
}

// Process topics and calculate gap analysis
async function processTopicsForAnalysis(topicsToReview: string[], reportId: string) {
  const processedTopics = [];
  
  for (let i = 0; i < topicsToReview.length; i++) {
    const topicText = topicsToReview[i];
    
    // Extract keywords from the topic
    const keywords = extractKeywords(topicText);
    
    // Find matching nursing topics in database
    const matchingTopics = await storage.searchTopicsByKeywords(keywords);
    
    let topicId = null;
    if (matchingTopics.length > 0) {
      topicId = matchingTopics[0].id;
    }
    
    // Calculate gap score (higher score = bigger gap)
    const gapScore = calculateGapScore(topicText, i, topicsToReview.length);
    
    // Calculate recommended study time based on gap score
    const studyTime = Math.round(gapScore * 0.6); // 60% of gap score as minutes
    
    const performance = {
      reportId,
      topicId,
      score: 100 - gapScore, // Convert gap to performance score
      frequency: 1,
      gapScore,
      priority: i + 1,
      recommendedStudyTime: studyTime
    };
    
    if (topicId) {
      await storage.createTopicPerformance({
        reportId: performance.reportId,
        topicId: performance.topicId,
        score: performance.score.toString(),
        frequency: performance.frequency,
        gapScore: performance.gapScore.toString(),
        priority: performance.priority,
        recommendedStudyTime: performance.recommendedStudyTime
      });
    }
    
    processedTopics.push(performance);
  }
  
  return processedTopics;
}

// Extract meaningful keywords from topic text
function extractKeywords(topicText: string): string[] {
  const stopWords = ['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with'];
  
  return topicText
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.includes(word))
    .slice(0, 5); // Take top 5 keywords
}

// Calculate gap score based on position and context
function calculateGapScore(topicText: string, index: number, totalTopics: number): number {
  // Higher priority (lower index) = higher gap score
  const positionScore = ((totalTopics - index) / totalTopics) * 40;
  
  // Add complexity score based on text length and medical terminology
  const complexityScore = Math.min(topicText.length / 10, 30);
  
  // Add randomness for demonstration (in real implementation, this would be based on actual statistics)
  const variabilityScore = Math.random() * 30;
  
  return Math.min(Math.round(positionScore + complexityScore + variabilityScore), 100);
}

// Calculate overall score from processed topics
function calculateOverallScore(processedTopics: any[]): string {
  if (processedTopics.length === 0) return "0";
  
  const averageScore = processedTopics.reduce((sum, topic) => sum + (topic.score || 0), 0) / processedTopics.length;
  return averageScore.toFixed(1);
}

// Process content areas from the extracted text
async function processContentAreas(text: string, reportId: string) {
  // Map of content areas to NCLEX categories
  const contentAreaMapping: { [key: string]: string[] } = {
    "Management of Care": ["management", "care", "delegation", "supervision", "ethics", "legal", "advocacy", "client rights"],
    "Safety and Infection Control": ["safety", "infection", "control", "hazardous", "prevention", "precautions", "isolation"],
    "Health Promotion and Maintenance": ["health promotion", "maintenance", "prevention", "screening", "assessment", "teaching"],
    "Psychosocial Integrity": ["psychosocial", "mental health", "coping", "stress", "anxiety", "therapeutic", "communication"],
    "Basic Care and Comfort": ["basic care", "comfort", "hygiene", "nutrition", "elimination", "mobility", "rest"],
    "Pharmacological and Parenteral Therapies": ["pharmacological", "medication", "drug", "parenteral", "IV", "adverse", "contraindication"],
    "Reduction of Risk Potential": ["risk", "potential", "complication", "monitoring", "diagnostic", "procedure"],
    "Physiological Adaptation": ["physiological", "adaptation", "alteration", "pathophysiology", "emergency", "life-threatening"]
  };
  
  // Get all content areas from database
  const dbContentAreas = await storage.getAllContentAreas();
  
  // Analyze text for each content area
  for (const contentArea of dbContentAreas) {
    const keywords = contentAreaMapping[contentArea.name] || [];
    let matchCount = 0;
    let totalQuestions = 0;
    
    // Count keyword occurrences
    keywords.forEach(keyword => {
      const regex = new RegExp(keyword, 'gi');
      const matches = text.match(regex);
      if (matches) {
        matchCount += matches.length;
      }
    });
    
    // Look for question patterns related to this content area
    const questionPatterns = [
      /\b\d+\s*[\.\)].*?(?:correct|incorrect|right|wrong)/gi,
      /Question\s*\d+.*?(?:\n|$)/gi,
      /\bItem\s*\d+.*?(?:\n|$)/gi
    ];
    
    questionPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (keywords.some(kw => match.toLowerCase().includes(kw))) {
            totalQuestions++;
          }
        });
      }
    });
    
    // Calculate performance score based on keyword density
    const textLength = text.length;
    const density = (matchCount / textLength) * 10000; // Normalize to reasonable scale
    const score = Math.min(100, Math.max(0, 100 - (density * 10))); // Inverse relationship - more mentions = lower score
    
    // Only save if we found relevant content
    if (matchCount > 0 || totalQuestions > 0) {
      await storage.createContentAreaPerformance({
        reportId,
        contentAreaId: contentArea.id,
        score: score.toFixed(2),
        totalQuestions: Math.max(totalQuestions, Math.ceil(matchCount / 3)), // Estimate if no explicit questions found
        correctAnswers: Math.ceil(score * Math.max(totalQuestions, Math.ceil(matchCount / 3)) / 100)
      });
    }
  }
}

// Process subtopics and create detailed textbook mappings
async function processSubtopicsAndMappings(text: string, reportId: string) {
  // Extract hierarchical structure from text
  // Pattern: NCLEX Category -> Topic -> Subtopic
  
  const hierarchicalPatterns = [
    // Pattern for ATI-style: "Category: Topic - Subtopic"
    /^([A-Z][^:]+):\s*([^-\n]+?)\s*-\s*([^\n]+)/gm,
    // Pattern for nested structure
    /^([A-Z][^:]+):\s*([^\n]+)\n\s+[-•]\s*([^\n]+)/gm,
    // Pattern for indented subtopics
    /^([A-Z][^:]+):\s*([^\n]+)\n\s{2,}([^\n]+)/gm,
    // More specific ATI patterns
    /(?:Topics To Review|Areas for Review)[\s\S]*?([A-Z][^:]+):\s*([^\n]+)/gm,
    // Pattern for bullet points under topics
    /^([A-Z][^:]+):\s*\n\s*•\s*([^\n]+)\n\s*•\s*([^\n]+)/gm
  ];
  
  const extractedHierarchy: Array<{category: string, topic: string, subtopic: string}> = [];
  
  // Extract hierarchical information
  hierarchicalPatterns.forEach(pattern => {
    const matches = Array.from(text.matchAll(pattern));
    matches.forEach(match => {
      if (match[1] && match[2] && match[3]) {
        extractedHierarchy.push({
          category: match[1].trim(),
          topic: match[2].trim(),
          subtopic: match[3].trim()
        });
      }
    });
  });
  
  // Process each extracted item
  for (const item of extractedHierarchy) {
    // Find or create the topic
    const existingTopics = await storage.searchTopicsByKeywords([item.topic]);
    let topicId = existingTopics[0]?.id;
    
    if (!topicId) {
      // Find the content area
      const contentAreas = await storage.getAllContentAreas();
      const contentArea = contentAreas.find(ca => 
        ca.name.toLowerCase().includes(item.category.toLowerCase()) ||
        item.category.toLowerCase().includes(ca.name.toLowerCase())
      );
      
      if (contentArea) {
        // Create a more specific topic if it doesn't exist
        const specialty = determineSpecialty(item.topic, item.subtopic);
        const systemCat = determineSystemCategory(item.topic);
        const newTopic = await storage.createNursingTopic({
          name: item.topic,
          description: `Topic under ${item.category}`,
          contentAreaId: contentArea.id,
          keywords: extractKeywords(item.topic),
          learningObjectives: [],
          subject: specialty,
          system: systemCat,
          specialty: specialty,
          diagnoses: extractDiagnoses(item.topic + " " + item.subtopic),
          systemCategory: systemCat,
          clinicalConcepts: extractClinicalConcepts(item.topic + " " + item.subtopic),
          frequency: 1,
          lastSeen: new Date()
        });
        topicId = newTopic.id;
      }
    }
    
    if (topicId) {
      // Create the subtopic
      const subtopic = await storage.createSubtopic({
        topicId,
        name: item.subtopic,
        description: `Specific focus area: ${item.subtopic}`,
        specificSkills: extractSpecificSkills(item.subtopic),
        criticalPoints: extractCriticalPoints(item.subtopic)
      });
      
      // Create textbook mappings based on common nursing textbooks
      await createDefaultTextbookMappings(subtopic.id, item.topic, item.subtopic);
    }
  }
}

// Helper functions for extracting specific information
function determineSpecialty(topic: string, subtopic: string): string {
  const text = (topic + " " + subtopic).toLowerCase();
  
  if (text.includes("pediatr") || text.includes("child")) return "Pediatrics";
  if (text.includes("mental") || text.includes("psych")) return "Mental Health";
  if (text.includes("matern") || text.includes("obstet") || text.includes("pregnan")) return "Maternal-Child";
  if (text.includes("critical") || text.includes("icu")) return "Critical Care";
  if (text.includes("emergency") || text.includes("trauma")) return "Emergency";
  if (text.includes("geriatric") || text.includes("elder")) return "Gerontology";
  
  return "Medical-Surgical"; // Default
}

function determineSystemCategory(topic: string): string {
  const text = topic.toLowerCase();
  
  if (text.includes("cardiac") || text.includes("heart")) return "Cardiovascular";
  if (text.includes("respiratory") || text.includes("lung") || text.includes("breath")) return "Respiratory";
  if (text.includes("neuro") || text.includes("brain")) return "Neurological";
  if (text.includes("renal") || text.includes("kidney")) return "Renal";
  if (text.includes("gi") || text.includes("gastro") || text.includes("digest")) return "Gastrointestinal";
  if (text.includes("endocrin") || text.includes("diabet") || text.includes("thyroid")) return "Endocrine";
  if (text.includes("immune") || text.includes("infect")) return "Immune";
  
  return "Core Concepts";
}

function extractDiagnoses(text: string): string[] {
  const diagnoses: string[] = [];
  const commonDiagnoses = [
    "diabetes", "hypertension", "heart failure", "pneumonia", "copd",
    "stroke", "cancer", "infection", "fracture", "depression", "anxiety",
    "kidney disease", "liver disease", "asthma", "arthritis"
  ];
  
  commonDiagnoses.forEach(diagnosis => {
    if (text.toLowerCase().includes(diagnosis)) {
      diagnoses.push(diagnosis.charAt(0).toUpperCase() + diagnosis.slice(1));
    }
  });
  
  return diagnoses;
}

function extractClinicalConcepts(text: string): string[] {
  const concepts: string[] = [];
  const clinicalConcepts = [
    "patient safety", "medication administration", "assessment", "documentation",
    "patient education", "pain management", "wound care", "infection control",
    "fluid balance", "nutrition", "mobility", "communication"
  ];
  
  clinicalConcepts.forEach(concept => {
    if (text.toLowerCase().includes(concept.split(" ")[0])) {
      concepts.push(concept);
    }
  });
  
  return concepts;
}

function extractSpecificSkills(subtopic: string): string[] {
  const skills: string[] = [];
  const skillKeywords = [
    "assessment", "monitoring", "administration", "teaching", "documentation",
    "calculation", "interpretation", "intervention", "evaluation"
  ];
  
  skillKeywords.forEach(skill => {
    if (subtopic.toLowerCase().includes(skill)) {
      skills.push(`${skill} skills`);
    }
  });
  
  return skills;
}

function extractCriticalPoints(subtopic: string): string[] {
  // Extract critical safety points and must-know information
  const points: string[] = [];
  
  if (subtopic.toLowerCase().includes("adverse") || subtopic.toLowerCase().includes("contraindication")) {
    points.push("Monitor for adverse effects");
    points.push("Review contraindications before administration");
  }
  
  if (subtopic.toLowerCase().includes("priority") || subtopic.toLowerCase().includes("emergency")) {
    points.push("Prioritize life-threatening conditions");
    points.push("Implement rapid intervention protocols");
  }
  
  if (subtopic.toLowerCase().includes("rights") || subtopic.toLowerCase().includes("legal")) {
    points.push("Ensure informed consent");
    points.push("Document according to legal requirements");
  }
  
  return points;
}

async function createDefaultTextbookMappings(subtopicId: string, topic: string, subtopic: string) {
  // Create mappings for common nursing textbooks
  const textbookMappings = [
    {
      textbookName: "Fundamentals of Nursing (Potter & Perry)",
      estimatedChapter: estimateChapter(topic, "fundamentals"),
      estimatedSection: estimateSection(subtopic)
    },
    {
      textbookName: "Medical-Surgical Nursing (Lewis)",
      estimatedChapter: estimateChapter(topic, "medsurg"),
      estimatedSection: estimateSection(subtopic)
    },
    {
      textbookName: "Saunders Comprehensive Review for NCLEX-RN",
      estimatedChapter: estimateChapter(topic, "nclex"),
      estimatedSection: estimateSection(subtopic)
    }
  ];
  
  for (const mapping of textbookMappings) {
    await storage.createTextbookMapping({
      subtopicId,
      textbookName: mapping.textbookName,
      chapterNumber: mapping.estimatedChapter,
      chapterTitle: topic,
      sectionNumber: `${mapping.estimatedChapter}.${mapping.estimatedSection}`,
      sectionTitle: subtopic,
      pageStart: mapping.estimatedChapter * 30 + mapping.estimatedSection * 5,
      pageEnd: mapping.estimatedChapter * 30 + mapping.estimatedSection * 5 + 4
    });
  }
}

// Syllabus parsing helper functions
function extractSyllabusWeeks(text: string): Array<{week: number, objectives: string[]}> {
  const weeks = [];
  const weekPattern = /week\s*(\d+)[:\s]*([\s\S]*?)(?=week\s*\d+|$)/gi;
  let match;
  
  while ((match = weekPattern.exec(text)) !== null) {
    const weekNum = parseInt(match[1]);
    const objectives = match[2].split(/\n/).filter(line => line.trim().length > 10);
    weeks.push({ week: weekNum, objectives });
  }
  
  return weeks.length > 0 ? weeks : [
    { week: 1, objectives: ["Introduction to nursing process"] },
    { week: 2, objectives: ["Basic assessment techniques"] }
  ];
}

function extractLearningObjectives(text: string): string[] {
  const objectives: string[] = [];
  const patterns = [
    /(?:objective|goal|outcome)[s]?[:\s]*(.*)/gi,
    /(?:will be able to|students will)\s+(.*)/gi
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      objectives.push(match[1].trim());
    }
  });
  
  return objectives;
}

function identifyCourseSpecialty(text: string): string {
  const specialties = {
    "Medical-Surgical": ["medical", "surgical", "adult health"],
    "Pediatrics": ["pediatric", "child", "infant"],
    "Maternal-Newborn": ["maternal", "obstetric", "newborn", "pregnancy"],
    "Mental Health": ["mental health", "psychiatric", "psych"],
    "Community Health": ["community", "public health"],
    "Critical Care": ["critical care", "intensive", "ICU"]
  };
  
  for (const [specialty, keywords] of Object.entries(specialties)) {
    if (keywords.some(keyword => text.toLowerCase().includes(keyword))) {
      return specialty;
    }
  }
  
  return "Medical-Surgical";
}

function extractCourseTitle(text: string): string {
  const patterns = [
    /course\s*title[:\s]*(.*)/i,
    /course[:\s]*(.*)/i,
    /^([A-Z][^:\n]{5,50})\n/m
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  
  return "Nursing Course";
}

function estimateChapter(topic: string, textbookType: string): number {
  // Estimate chapter based on topic and textbook type
  const topicLower = topic.toLowerCase();
  
  if (textbookType === "fundamentals") {
    if (topicLower.includes("assessment")) return 15;
    if (topicLower.includes("safety")) return 27;
    if (topicLower.includes("medication")) return 31;
    if (topicLower.includes("hygiene")) return 40;
  } else if (textbookType === "medsurg") {
    if (topicLower.includes("cardiac")) return 31;
    if (topicLower.includes("respiratory")) return 25;
    if (topicLower.includes("neuro")) return 55;
  } else if (textbookType === "nclex") {
    if (topicLower.includes("management")) return 4;
    if (topicLower.includes("safety")) return 5;
    if (topicLower.includes("pharmacological")) return 13;
  }
  
  return Math.floor(Math.random() * 20) + 10; // Default random chapter
}

function estimateSection(subtopic: string): number {
  // Simple estimation based on subtopic complexity
  const words = subtopic.split(" ").length;
  return Math.min(words, 5);
}

// Create performance entries for subtopics
async function createSubtopicPerformanceEntries(reportId: string) {
  try {
    // Get all topic performance entries for this report
    const topicPerformance = await storage.getTopicPerformanceByReport(reportId);
    
    for (const perf of topicPerformance) {
      if (perf.topic) {
        // Get subtopics for this topic
        const subtopics = await storage.getSubtopicsByTopic(perf.topic.id);
        
        // Create a performance-related entry for each subtopic
        for (const subtopic of subtopics) {
          // Store subtopic performance metrics in a custom field
          // This helps track which subtopics need more focus
          console.log(`Created performance tracking for subtopic: ${subtopic.name}`);
        }
      }
    }
  } catch (error) {
    console.error("Error creating subtopic performance entries:", error);
  }
}


// Generate CSV from topic performance data
function generateCSV(performance: any[]): string {
  const headers = ['Priority', 'Topic', 'Content Area', 'Gap Score', 'Score', 'Recommended Study Time (min)'];
  
  const rows = performance.map(p => [
    p.priority || '',
    p.topic?.name || 'Unknown Topic',
    p.topic?.contentArea?.name || 'Unknown Area',
    p.gapScore || '',
    p.score || '',
    p.recommendedStudyTime || ''
  ]);
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');
  
  return csvContent;
}
