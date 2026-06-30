import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { 
  userPrivacyConsent, 
  consentLogs, 
  privacySettings,
  users,
  assessmentReports,
  studyPlans,
  userProgress,
  type InsertUserPrivacyConsent,
  type InsertConsentLog,
  type InsertPrivacySettings
} from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { authenticateToken, type AuthRequest } from '../middleware/auth';

const router = Router();

// Validation schemas
const consentPreferencesSchema = z.object({
  necessaryCookies: z.boolean().default(true),
  functionalCookies: z.boolean().default(false),
  analyticsCookies: z.boolean().default(false),
  marketingCookies: z.boolean().default(false),
});

const saveConsentSchema = z.object({
  preferences: consentPreferencesSchema,
  method: z.string(), // 'banner', 'settings', 'api'
});

const privacySettingsSchema = z.object({
  emailMarketing: z.boolean().default(false),
  smsMarketing: z.boolean().default(false),
  dataSharing: z.boolean().default(false),
  profileVisible: z.boolean().default(true),
  analyticsOptOut: z.boolean().default(false),
});

// Get current user's consent preferences
router.get('/consent', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    // Get the most recent consent record (optimized query)
    const [latestConsent] = await db
      .select({
        necessaryCookies: userPrivacyConsent.necessaryCookies,
        functionalCookies: userPrivacyConsent.functionalCookies,
        analyticsCookies: userPrivacyConsent.analyticsCookies,
        marketingCookies: userPrivacyConsent.marketingCookies,
        consentTimestamp: userPrivacyConsent.consentTimestamp,
        consentVersion: userPrivacyConsent.consentVersion,
      })
      .from(userPrivacyConsent)
      .where(eq(userPrivacyConsent.userId, userId))
      .orderBy(desc(userPrivacyConsent.consentTimestamp))
      .limit(1);

    if (!latestConsent) {
      return res.status(404).json({ error: 'No consent record found' });
    }

    res.json({
      necessaryCookies: latestConsent.necessaryCookies,
      functionalCookies: latestConsent.functionalCookies,
      analyticsCookies: latestConsent.analyticsCookies,
      marketingCookies: latestConsent.marketingCookies,
      consentTimestamp: latestConsent.consentTimestamp,
      consentVersion: latestConsent.consentVersion,
    });
  } catch (error) {
    console.error('Error fetching consent:', error);
    res.status(500).json({ error: 'Failed to fetch consent preferences' });
  }
});

// Save or update consent preferences
router.post('/consent', async (req: any, res) => {
  try {
    const { preferences, method } = saveConsentSchema.parse(req.body);
    const userId = req.user?.userId;
    const sessionId = req.sessionID;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Get previous consent for logging
    let previousConsent = null;
    if (userId) {
      const [existing] = await db
        .select()
        .from(userPrivacyConsent)
        .where(eq(userPrivacyConsent.userId, userId))
        .orderBy(desc(userPrivacyConsent.consentTimestamp))
        .limit(1);
      previousConsent = existing;
    }

    // Create new consent record
    const newConsent: InsertUserPrivacyConsent = {
      userId: userId || null,
      sessionId: sessionId,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      consentVersion: '1.0',
      necessaryCookies: preferences.necessaryCookies,
      functionalCookies: preferences.functionalCookies,
      analyticsCookies: preferences.analyticsCookies,
      marketingCookies: preferences.marketingCookies,
      consentMethod: method,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    };

    const [savedConsent] = await db
      .insert(userPrivacyConsent)
      .values(newConsent)
      .returning();

    // Log the consent action
    const consentLog: InsertConsentLog = {
      userId: userId || null,
      sessionId: sessionId,
      action: previousConsent ? 'update' : 'grant',
      previousState: previousConsent ? {
        functional: previousConsent.functionalCookies,
        analytics: previousConsent.analyticsCookies,
        marketing: previousConsent.marketingCookies,
      } : null,
      newState: {
        functional: preferences.functionalCookies,
        analytics: preferences.analyticsCookies,
        marketing: preferences.marketingCookies,
      },
      consentMethod: method,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    };

    await db.insert(consentLogs).values(consentLog);

    res.json({ 
      success: true, 
      consentId: savedConsent.id,
      message: 'Consent preferences saved successfully' 
    });
  } catch (error) {
    console.error('Error saving consent:', error);
    res.status(500).json({ error: 'Failed to save consent preferences' });
  }
});

// Get user's privacy settings
router.get('/settings', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    const [settings] = await db
      .select()
      .from(privacySettings)
      .where(eq(privacySettings.userId, userId));

    if (!settings) {
      // Return default settings if none exist
      const defaultSettings = {
        emailMarketing: false,
        smsMarketing: false,
        dataSharing: false,
        profileVisible: true,
        analyticsOptOut: false,
        dataExportRequests: true,
        dataDeletionRequests: true,
      };
      return res.json(defaultSettings);
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching privacy settings:', error);
    res.status(500).json({ error: 'Failed to fetch privacy settings' });
  }
});

// Update user's privacy settings
router.put('/settings', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const settings = privacySettingsSchema.parse(req.body);

    // Check if settings exist
    const [existing] = await db
      .select()
      .from(privacySettings)
      .where(eq(privacySettings.userId, userId));

    if (existing) {
      // Update existing settings
      const [updated] = await db
        .update(privacySettings)
        .set({
          ...settings,
          updatedAt: new Date(),
        })
        .where(eq(privacySettings.userId, userId))
        .returning();
      
      res.json(updated);
    } else {
      // Create new settings
      const newSettings: InsertPrivacySettings = {
        userId,
        ...settings,
      };

      const [created] = await db
        .insert(privacySettings)
        .values(newSettings)
        .returning();
      
      res.json(created);
    }
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
});

// Get consent history
router.get('/consent-history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    
    const logs = await db
      .select({
        id: consentLogs.id,
        action: consentLogs.action,
        consentMethod: consentLogs.consentMethod,
        timestamp: consentLogs.timestamp,
        newState: consentLogs.newState,
      })
      .from(consentLogs)
      .where(eq(consentLogs.userId, userId))
      .orderBy(desc(consentLogs.timestamp))
      .limit(10);

    // Transform the data for the frontend
    const history = logs.map(log => ({
      id: log.id,
      action: log.action,
      consentMethod: log.consentMethod,
      timestamp: log.timestamp,
      functionalConsent: (log.newState as any)?.functional || false,
      analyticsConsent: (log.newState as any)?.analytics || false,
      marketingConsent: (log.newState as any)?.marketing || false,
    }));

    res.json(history);
  } catch (error) {
    console.error('Error fetching consent history:', error);
    res.status(500).json({ error: 'Failed to fetch consent history' });
  }
});

// Export user's personal data (GDPR compliance)
router.post('/export-data', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get user data
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        school: users.school,
        graduationDate: users.graduationDate,
        createdAt: users.createdAt,
        lastLogin: users.lastLogin,
      })
      .from(users)
      .where(eq(users.id, userId));

    // Get assessment reports
    const reports = await db
      .select()
      .from(assessmentReports)
      .where(eq(assessmentReports.userId, userId));

    // Get study plans
    const plans = await db
      .select()
      .from(studyPlans)
      .where(eq(studyPlans.userId, userId));

    // Get progress data
    const progress = await db
      .select()
      .from(userProgress)
      .where(eq(userProgress.userId, userId));

    // Get privacy settings
    const [privacy] = await db
      .select()
      .from(privacySettings)
      .where(eq(privacySettings.userId, userId));

    // Get consent history
    const consentHistory = await db
      .select()
      .from(userPrivacyConsent)
      .where(eq(userPrivacyConsent.userId, userId))
      .orderBy(desc(userPrivacyConsent.consentTimestamp));

    const exportData = {
      exportDate: new Date().toISOString(),
      userData: user,
      assessmentReports: reports.map(r => ({
        ...r,
        extractedText: undefined, // Remove sensitive content
      })),
      studyPlans: plans,
      userProgress: progress,
      privacySettings: privacy,
      consentHistory: consentHistory,
      dataNote: 'This export contains all personal data associated with your NursePrep Analytics account. Sensitive assessment content has been excluded for privacy protection.',
    };

    res.json(exportData);
  } catch (error) {
    console.error('Error exporting user data:', error);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

// Withdraw all consent (GDPR/CCPA compliance)
router.post('/withdraw-consent', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const sessionId = (req as any).sessionID || 'unknown';
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Get current consent
    const [currentConsent] = await db
      .select()
      .from(userPrivacyConsent)
      .where(eq(userPrivacyConsent.userId, userId))
      .orderBy(desc(userPrivacyConsent.consentTimestamp))
      .limit(1);

    // Create withdrawal record
    const withdrawalConsent: InsertUserPrivacyConsent = {
      userId,
      sessionId,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      consentVersion: '1.0',
      necessaryCookies: true, // Always required
      functionalCookies: false,
      analyticsCookies: false,
      marketingCookies: false,
      consentMethod: 'api_withdrawal',
      isWithdrawn: true,
      withdrawnAt: new Date(),
    };

    await db.insert(userPrivacyConsent).values(withdrawalConsent);

    // Log the withdrawal
    const withdrawalLog: InsertConsentLog = {
      userId,
      sessionId,
      action: 'withdraw',
      previousState: currentConsent ? {
        functional: currentConsent.functionalCookies,
        analytics: currentConsent.analyticsCookies,
        marketing: currentConsent.marketingCookies,
      } : null,
      newState: {
        functional: false,
        analytics: false,
        marketing: false,
      },
      consentMethod: 'api_withdrawal',
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    };

    await db.insert(consentLogs).values(withdrawalLog);

    res.json({ 
      success: true, 
      message: 'All consent has been withdrawn successfully' 
    });
  } catch (error) {
    console.error('Error withdrawing consent:', error);
    res.status(500).json({ error: 'Failed to withdraw consent' });
  }
});

export default router;