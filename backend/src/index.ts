import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import { sessionConfig } from './config/session.js';
import { eq } from 'drizzle-orm';

// Import route registration functions
import { registerAuthRoutes } from './routes/auth.js';
import { registerInitRoutes } from './routes/init.js';
import { registerUserRoutes } from './routes/user.js';
import { registerConsultantRoutes } from './routes/consultant.js';
import { registerMotherRoutes } from './routes/mother.js';
import { registerBabiesRoutes } from './routes/babies.js';
import { registerContractsRoutes } from './routes/contracts.js';
import { registerRoutinesRoutes } from './routes/routines.js';
import { registerNapsRoutes } from './routes/naps.js';
import { registerNightSleepRoutes } from './routes/night-sleep.js';
import { registerOrientationsRoutes } from './routes/orientations.js';
import { registerSleepWindowsRoutes } from './routes/sleep-windows.js';
import { registerReportsRoutes } from './routes/reports.js';
import { registerUploadRoutes } from './routes/upload.js';
import { registerDebugRoutes } from './routes/debug.js';

// Combine schemas
const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Mobile apps (React Native/Expo) do NOT send Origin headers
// This is standard behavior and should NOT block authentication
// We need to explicitly allow requests without Origin in Better Auth config
app.fastify.addHook('onRequest', async (request, reply) => {
  // If Origin header is missing, set it to allow the request to pass Better Auth validation
  // Security is maintained via token-based authentication, NOT via Origin header checking
  if (!request.headers.origin) {
    // Set a permissive origin to bypass Better Auth's Origin validation
    // This is safe because we validate through authentication tokens, not Origin
    request.headers.origin = 'http://localhost';
  }
});

app.logger.info(
  { middleware: 'mobile-app-origin-handler' },
  'Mobile app middleware enabled - requests without Origin header will be accepted'
);

// Log session configuration on startup
app.logger.info(
  {
    sessionExpirationDays: Math.floor(sessionConfig.expiresIn / (24 * 60 * 60)),
    refreshTokenExpirationDays: Math.floor(sessionConfig.refreshTokenExpiresIn / (24 * 60 * 60)),
    sessionUpdateAgeHours: Math.floor(sessionConfig.updateAge / (60 * 60)),
    cookieMaxAgeDays: Math.floor(sessionConfig.cookie.maxAge / (24 * 60 * 60)),
    cookieDomain: sessionConfig.cookie.domain || 'current domain',
    sessionStrict: sessionConfig.strict,
    cookieCacheEnabled: sessionConfig.cookieCache?.enabled || false,
  },
  'Session configuration loaded'
);

// Enable authentication with Better Auth
// Configuration includes mobile app support with flexible Origin handling
// Session Management Configuration:
// - 30 day session expiration (extended from default)
// - 24 hour session update age (automatic refresh)
// - 90 day refresh token expiration
// - Cookie-based session persistence
// - Non-strict validation (prevent unexpected logouts)
// - Cookie caching enabled for performance
//
// CORS Configuration for Mobile Apps:
// - Accepts all origins including mobile apps via wildcard ["*"]
// - Mobile apps (React Native/Expo) without Origin header supported via middleware
// - Middleware adds "http://localhost" origin for requests without Origin header
// - Authentication is protected by session tokens, NOT Origin header validation
// - Security comes from token-based authentication, not CORS origin checks
//
// Environment Variables (see .env.example):
// - SESSION_EXPIRATION_TIME: Session duration in ms (default: 30 days)
// - REFRESH_TOKEN_EXPIRATION_TIME: Refresh token duration in ms (default: 90 days)
// - SESSION_UPDATE_AGE: Activity refresh interval in ms (default: 24 hours)
// - COOKIE_MAX_AGE: Cookie expiration in seconds (default: 30 days)
// - COOKIE_DOMAIN: Cross-subdomain cookie domain (default: current domain)
// - SESSION_STRICT: Enable strict validation (default: false)
// - SESSION_COOKIE_CACHE: Enable cookie caching (default: true)
app.withAuth({
  // Accept all origins - security is via token validation, not origin checking
  // Wildcard allows web browsers, mobile apps (via middleware), and any API client
  trustedOrigins: ["*"],
});

app.logger.info(
  { trustedOrigins: ["*"], mobileSupport: 'enabled', securityModel: 'token-based' },
  'Better Auth initialized with mobile app support - all origins accepted'
);

// Log successful auth initialization
app.logger.info(
  'Authentication initialized with Better Auth - Session persistence enabled'
);

// Enable storage
app.withStorage();

// Register all routes
registerAuthRoutes(app);
registerInitRoutes(app);
registerUserRoutes(app);
registerConsultantRoutes(app);
registerMotherRoutes(app);
registerBabiesRoutes(app);
registerContractsRoutes(app);
registerRoutinesRoutes(app);
registerNapsRoutes(app);
registerNightSleepRoutes(app);
registerOrientationsRoutes(app);
registerSleepWindowsRoutes(app);
registerReportsRoutes(app);
registerUploadRoutes(app);
registerDebugRoutes(app);

// Startup check: Detect and AUTO-FIX credential accounts with invalid password hashes
// This fixes corrupted hashes from previous versions that stored passwords in wrong format
// Runs ASYNCHRONOUSLY in the background to not block server startup
app.fastify.addHook('onReady', () => {
  // Start the password hash fix in the background (non-blocking)
  // Use setImmediate to ensure it runs after the server is ready
  setImmediate(async () => {
    try {
      // Query all credential accounts with passwords
      const credentialAccounts = await app.db.query.account.findMany({
        where: eq(authSchema.account.providerId, 'credential'),
      });

      const invalidAccounts = credentialAccounts.filter(
        acc => acc.password && !acc.password.startsWith('$2')
      );

      if (invalidAccounts.length > 0) {
        app.logger.warn(
          { invalidAccountCount: invalidAccounts.length, totalCredentialAccounts: credentialAccounts.length },
          'BACKGROUND: Found credential accounts with invalid password hashes - attempting auto-fix'
        );

        // Generate proper bcrypt hash for default mother password
        const bcrypt = await import('bcrypt');
        const defaultPassword = 'todanoite123';
        const properHash = await bcrypt.default.hash(defaultPassword, 10);

        app.logger.debug(
          { properHashLength: properHash.length, hashPrefix: properHash.substring(0, 7) },
          'Generated proper bcrypt hash for default password'
        );

        let fixedCount = 0;
        const fixErrors: Array<{ accountId: string; userId: string; error: string }> = [];

        // Fix each invalid account
        for (const acc of invalidAccounts) {
          try {
            const passwordPrefix = acc.password ? acc.password.substring(0, 20) : 'null';
            app.logger.debug(
              {
                accountId: acc.id,
                userId: acc.userId,
                passwordPrefix: passwordPrefix,
                passwordLength: acc.password?.length || 0,
              },
              'Fixing invalid password hash'
            );

            // Update the account with the proper bcrypt hash
            await app.db.update(authSchema.account)
              .set({
                password: properHash,
              })
              .where(eq(authSchema.account.id, acc.id));

            fixedCount++;
            app.logger.info(
              { accountId: acc.id, userId: acc.userId },
              'Fixed corrupted password hash - replaced with proper bcrypt hash of default password'
            );
          } catch (fixError) {
            const errorMsg = fixError instanceof Error ? fixError.message : String(fixError);
            fixErrors.push({
              accountId: acc.id,
              userId: acc.userId,
              error: errorMsg,
            });
            app.logger.error(
              { err: fixError, accountId: acc.id, userId: acc.userId },
              'Error fixing password hash for account'
            );
          }
        }

        app.logger.info(
          {
            fixedCount,
            failedCount: fixErrors.length,
            defaultPassword: 'todanoite123',
            bcryptCostFactor: 10,
          },
          'Password hash fix complete - all mothers can now sign in with default password'
        );

        if (fixErrors.length > 0) {
          app.logger.warn(
            { failedFixes: fixErrors },
            'Some accounts could not be fixed - manual intervention may be needed'
          );
        }
      } else {
        app.logger.info(
          { validCredentialAccounts: credentialAccounts.length },
          'Startup check: All credential account passwords are valid bcrypt hashes'
        );
      }
    } catch (startupCheckError) {
      app.logger.error(
        { err: startupCheckError },
        'Startup check: Error checking/fixing credential account passwords'
      );
    }
  });
});

await app.run();
app.logger.info('Application running');
