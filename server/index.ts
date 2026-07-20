import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDatabase } from "./seed";
import { seedCatalog } from "./seed-catalog";
import { seedATIExcelTopics } from "./seed-ati-excel-topics";
import { seedMentalHealthCurriculum } from "./seed-mental-health-curriculum";
import { setupSecurityMiddleware } from "./middleware/security";
import { apiLimiter } from "./middleware/rate-limiter";
import { AppLogger } from "./logger";
import { performanceMonitor, initializeMonitoring, errorRateMonitor } from "./middleware/monitoring";
import { registerHealthEndpoints } from "./health";
import { MagicLinkService } from "./magic-link-service";
import { setupPgVector } from "./pgvector-setup";

// Set default email configuration for deployment if not provided
if (!process.env.FROM_EMAIL) {
  process.env.FROM_EMAIL = 'noreply@nurseprep.app';
}
if (!process.env.FROM_NAME) {
  process.env.FROM_NAME = 'NursePrep Analytics';
}

const app = express();

// Configure Express to trust proxy headers (required for Replit infrastructure)
app.set('trust proxy', 1);

// Initialize monitoring
initializeMonitoring();

// PRODUCTION CONFIG VALIDATION: Validate critical environment variables at startup
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = [
    'DATABASE_URL',
    'SESSION_SECRET'
    // FROM_EMAIL/FROM_NAME use defaults; SENDGRID_API_KEY is required only when email delivery is enabled.
  ];
  
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ STARTUP FAILED: Missing required environment variables in production:');
    console.error(`   Missing: ${missing.join(', ')}`);
    console.error('   Please configure these environment variables before starting the application.');
    process.exit(1);
  }
  
  const emailDeliveryEnabled = process.env.ENABLE_EMAIL_DELIVERY === 'true';

  if (emailDeliveryEnabled && !process.env.SENDGRID_API_KEY) {
    console.error('❌ STARTUP FAILED: ENABLE_EMAIL_DELIVERY=true requires SENDGRID_API_KEY');
    console.error('   Set SENDGRID_API_KEY or disable email delivery for the pilot launch.');
    process.exit(1);
  }

  // Validate SendGrid configuration when provided.
  const sendGridKey = process.env.SENDGRID_API_KEY;
  if (sendGridKey && (!sendGridKey.startsWith('SG.') || sendGridKey.length < 50)) {
    console.error('❌ STARTUP FAILED: Invalid SENDGRID_API_KEY format');
    console.error('   SendGrid API keys should start with "SG." and be at least 50 characters');
    process.exit(1);
  }
  
  // Validate SESSION_SECRET strength in production
  const sessionSecret = process.env.SESSION_SECRET;
  if (sessionSecret && sessionSecret.length < 32) {
    console.error('❌ STARTUP FAILED: SESSION_SECRET is too weak for production');
    console.error('   Please use a strong secret with at least 32 characters');
    process.exit(1);
  }
  
  console.log(`✅ Production environment validation passed${emailDeliveryEnabled ? '' : ' (email delivery disabled)'}`);
}

// Setup security middleware first
setupSecurityMiddleware(app);

// Add simple health check endpoint at the root for deployment readiness
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Health check endpoints (before rate limiting)
registerHealthEndpoints(app);

// Performance monitoring
app.use(performanceMonitor);

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure PostgreSQL session store for production scalability
const PgSession = connectPgSimple(session);

// Add session middleware with PostgreSQL store
app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'user_sessions',
    createTableIfMissing: true,
    ttl: 365 * 24 * 60 * 60, // 1 year in seconds
    pruneSessionInterval: 60 * 60, // Prune expired sessions every hour
  }),
  secret: process.env.SESSION_SECRET || 'nurseprep-analytics-session-secret-2024',
  resave: false,
  saveUninitialized: false, // Changed to false to reduce session storage
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    sameSite: 'lax'
  },
  name: 'nurseprep.sid' // Custom session cookie name
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    
    // Track error rates
    errorRateMonitor(res.statusCode >= 400);
    
    if (path.startsWith("/api")) {
      // Log using structured logger
      AppLogger.api(req.method, path, res.statusCode, duration, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      // Keep existing console logging for development
      if (process.env.NODE_ENV === 'development') {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse && res.statusCode >= 400) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use("/api", (req: Request, res: Response) => {
    res.status(404).json({
      error: "API route not found",
      path: req.originalUrl,
    });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ error: message });
    console.error(err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  const listenOptions = {
    port,
    host: "0.0.0.0",
    ...(process.platform === "win32" ? {} : { reusePort: true }),
  };
  server.listen(listenOptions, async () => {
    log(`serving on port ${port}`);

    // pgvector is an optional search enhancement. Run its idempotent setup after
    // the HTTP listener is ready so a slow database connection or schema lock
    // cannot prevent the application from passing its deployment health check.
    setupPgVector().catch(error => {
      AppLogger.error(
        'pgvector background setup failed (non-critical):',
        error instanceof Error ? error : new Error(String(error)),
      );
    });

    // Seed the database in background after server starts
    seedDatabase().then(() => {
      AppLogger.info('Database seeding completed');
    }).catch(error => {
      AppLogger.error('Database seeding failed (non-critical):', error instanceof Error ? error : new Error(String(error)));
    });

    // Pre-load textbook catalog (ATI, Open RN, Pearson) on first startup — idempotent
    seedCatalog().then((result) => {
      AppLogger.info(`Textbook catalog seed: ${result.totalInserted} inserted, ${result.totalSkipped} skipped`);
    }).catch(error => {
      AppLogger.error('Textbook catalog seeding failed (non-critical):', error instanceof Error ? error : new Error(String(error)));
    });

    // Pre-load 62 real NCLEX topic categories derived from cohort assessment data
    seedATIExcelTopics().then(({ inserted, skipped }) => {
      AppLogger.info(`Assessment topic seed: ${inserted} inserted, ${skipped} skipped`);
    }).catch(error => {
      AppLogger.error('Assessment topic seeding failed (non-critical):', error instanceof Error ? error : new Error(String(error)));
    });

    // Seed Mental Health Nursing curriculum catalog from NUR2200 blueprint Excel
    seedMentalHealthCurriculum().then(({ objectives, assessments, mappings }) => {
      AppLogger.info(`Mental Health curriculum seed: ${objectives.inserted} objectives, ${assessments.inserted} assessments, ${mappings.inserted} mappings`);
    }).catch(error => {
      AppLogger.error('Mental Health curriculum seeding failed (non-critical):', error instanceof Error ? error : new Error(String(error)));
    });
    
    // Set up periodic cleanup for expired rate limit entries
    // Run cleanup every 15 minutes
    setInterval(async () => {
      try {
        await MagicLinkService.cleanupExpiredRateLimits();
        await MagicLinkService.cleanupExpiredTokens();
        AppLogger.info('Cleaned up expired rate limits and tokens');
      } catch (error) {
        AppLogger.error('Failed to cleanup expired entries:', error instanceof Error ? error : new Error(String(error)));
      }
    }, 15 * 60 * 1000); // 15 minutes
    
    // Run initial cleanup on startup (in background)
    MagicLinkService.cleanupExpiredRateLimits().catch(err => 
      AppLogger.error('Initial rate limit cleanup failed:', err instanceof Error ? err : new Error(String(err)))
    );
  });
})();
