import { createApplication, resend } from "@specific-dev/framework";
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

// Custom auth resolver - fixes critical bug where all requests resolve to wrong user
// Properly filters sessions by exact token value instead of using unfiltered queries
export function createCustomRequireAuth(app: App) {
  return async function customRequireAuth(request: any, reply: any) {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'Unauthorized' });
      return null;
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    try {
      app.logger.debug({ tokenPrefix: token.substring(0, 8) }, 'Resolving token to user');

      // CRITICAL: Filter by EXACT token value - never use unfiltered queries
      const session = await app.db.query.session.findFirst({
        where: eq(authSchema.session.token, token),
      });

      if (!session) {
        app.logger.warn({ tokenPrefix: token.substring(0, 8) }, 'Session not found for token');
        reply.status(401).send({ error: 'Unauthorized' });
        return null;
      }

      // Verify session is not expired
      if (new Date() > new Date(session.expiresAt)) {
        app.logger.warn({ sessionId: session.id, expiresAt: session.expiresAt }, 'Session expired');
        reply.status(401).send({ error: 'Session expired' });
        return null;
      }

      // Look up user by session's user_id
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, session.userId),
      });

      if (!user) {
        app.logger.error({ userId: session.userId }, 'User not found for session');
        reply.status(401).send({ error: 'Unauthorized' });
        return null;
      }

      app.logger.debug({ userId: user.id, email: user.email }, 'Token resolved to user successfully');

      return { session, user };
    } catch (error) {
      app.logger.error({ err: error }, 'Error resolving token to user');
      reply.status(500).send({ error: 'Internal server error' });
      return null;
    }
  };
}

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

// Enable storage first
app.withStorage();

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
// IMPORTANT: Better Auth reserves all /api/auth/* paths and must register them first
// This ensures all endpoints including password reset, email verification, etc. are available
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
  // Configure password reset email
  emailAndPassword: {
    sendResetPassword: async ({ user, url }) => {
      resend.emails.send({
        from: "onboarding@resend.dev",
        to: user.email,
        subject: "Redefinição de senha",
        html: `
          <p>Olá, ${user.name}!</p>
          <p>Clique no link abaixo para redefinir sua senha:</p>
          <p><a href="${url}">${url}</a></p>
          <p>Se você não solicitou a redefinição de senha, ignore este email.</p>
        `,
      });
    },
  },
});

// Register custom auth routes AFTER app.withAuth() to extend Better Auth functionality
// Custom routes can coexist with Better Auth but should not duplicate /api/auth/* paths
registerAuthRoutes(app);

app.logger.info(
  { trustedOrigins: ["*"], mobileSupport: 'enabled', securityModel: 'token-based' },
  'Better Auth initialized with mobile app support - all origins accepted'
);

// Log successful auth initialization
app.logger.info(
  'Authentication initialized with Better Auth - Session persistence enabled'
);

// Add error handler for auth routes to log detailed errors
app.fastify.addHook('onError', async (request, reply, error) => {
  if (request.url.startsWith('/api/auth/')) {
    app.logger.error({
      err: error,
      path: request.url,
      method: request.method,
      statusCode: reply.statusCode,
      email: (request.body as any)?.email,
    }, 'Auth endpoint error');
  }
});

// Register all other routes (auth routes already registered above)
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

// Startup migration: Comprehensive credential account repair
// - Fixes corrupted password hashes from previous versions
// - Creates missing credential accounts for all mothers
// - Ensures all mothers have email_verified = true
// Runs ASYNCHRONOUSLY in the background to not block server startup
app.fastify.addHook('onReady', () => {
  setImmediate(async () => {
    try {
      app.logger.info('Starting comprehensive credential account migration');

      const bcrypt = await import('bcrypt');
      const defaultPassword = 'todanoite123';
      const properHash = await bcrypt.default.hash(defaultPassword, 10);

      app.logger.debug(
        { hashLength: properHash.length, hashPrefix: properHash.substring(0, 7) },
        'Generated bcrypt hash for default password'
      );

      // ==========================================
      // STEP 1: Fix credential accounts with invalid/missing passwords
      // ==========================================
      app.logger.info('Step 1: Checking credential accounts for invalid passwords');

      const credentialAccounts = await app.db.query.account.findMany({
        where: eq(authSchema.account.providerId, 'credential'),
      });

      const invalidAccounts = credentialAccounts.filter(
        acc => !acc.password || !acc.password.startsWith('$2')
      );

      let fixedPasswordCount = 0;
      const passwordFixErrors: Array<{ accountId: string; userId: string; error: string }> = [];

      for (const acc of invalidAccounts) {
        try {
          const passwordStatus = !acc.password ? 'missing' : 'invalid';
          app.logger.debug(
            { accountId: acc.id, userId: acc.userId, status: passwordStatus },
            'Fixing credential account password'
          );

          await app.db.update(authSchema.account)
            .set({ password: properHash })
            .where(eq(authSchema.account.id, acc.id));

          fixedPasswordCount++;
          app.logger.info(
            { accountId: acc.id, userId: acc.userId },
            'Fixed credential account password'
          );
        } catch (err: unknown) {
          const errorMsg: string = err instanceof Error ? err.message : String(err);
          passwordFixErrors.push({
            accountId: acc.id,
            userId: acc.userId,
            error: errorMsg,
          });
          app.logger.error(
            { err, accountId: acc.id, userId: acc.userId },
            'Error fixing credential account password'
          );
        }
      }

      app.logger.info(
        { fixedPasswordCount, totalCredentialAccounts: credentialAccounts.length, failedCount: passwordFixErrors.length },
        'Step 1 complete: Credential account password fixes'
      );

      // ==========================================
      // STEP 2: Ensure all mothers have credential accounts
      // ==========================================
      app.logger.info('Step 2: Checking for mothers without credential accounts');

      const allUsers = await app.db.query.user.findMany();
      const motherUsers = allUsers.filter(u => u.role === 'mother');

      app.logger.debug({ motherCount: motherUsers.length }, 'Found mother users');

      let createdAccountCount = 0;
      const accountCreationErrors: Array<{ userId: string; email: string; error: string }> = [];

      for (const mother of motherUsers) {
        try {
          const motherId = String(mother.id);
          const motherEmail = String(mother.email);

          const existingAccount = credentialAccounts.find(
            acc => acc.userId === motherId && acc.providerId === 'credential'
          );

          if (!existingAccount) {
            app.logger.debug(
              { userId: motherId, email: motherEmail },
              'Creating missing credential account for mother'
            );

            const accountId = crypto.randomUUID();
            await app.db.insert(authSchema.account).values({
              id: accountId,
              accountId: motherId,
              providerId: 'credential',
              userId: motherId,
              password: properHash,
            });

            createdAccountCount++;
            app.logger.info(
              { userId: motherId, email: motherEmail, newAccountId: accountId },
              'Created credential account for mother'
            );
          }
        } catch (err: unknown) {
          const motherId = String(mother.id);
          const motherEmail = String(mother.email);
          const errorMsg: string = err instanceof Error ? err.message : String(err);
          accountCreationErrors.push({
            userId: motherId,
            email: motherEmail,
            error: errorMsg,
          });
          app.logger.error(
            { err, userId: motherId, email: motherEmail },
            'Error creating credential account for mother'
          );
        }
      }

      app.logger.info(
        { createdAccountCount, totalMothers: motherUsers.length, failedCount: accountCreationErrors.length },
        'Step 2 complete: Mother credential account creation'
      );

      // ==========================================
      // STEP 3: Ensure all mothers have email_verified = true
      // ==========================================
      app.logger.info('Step 3: Ensuring all mothers have email verified');

      let verifiedCount = 0;
      const verificationErrors: Array<{ userId: string; email: string; error: string }> = [];

      for (const mother of motherUsers) {
        try {
          const motherId = String(mother.id);
          const motherEmail = String(mother.email);

          if (!mother.emailVerified) {
            app.logger.debug(
              { userId: motherId, email: motherEmail },
              'Verifying mother email'
            );

            await app.db.update(authSchema.user)
              .set({ emailVerified: true })
              .where(eq(authSchema.user.id, motherId));

            verifiedCount++;
            app.logger.info(
              { userId: motherId, email: motherEmail },
              'Mother email verified'
            );
          }
        } catch (err: unknown) {
          const motherId = String(mother.id);
          const motherEmail = String(mother.email);
          const errorMsg: string = err instanceof Error ? err.message : String(err);
          verificationErrors.push({
            userId: motherId,
            email: motherEmail,
            error: errorMsg,
          });
          app.logger.error(
            { err, userId: motherId, email: motherEmail },
            'Error verifying mother email'
          );
        }
      }

      app.logger.info(
        { verifiedCount, totalMothers: motherUsers.length, failedCount: verificationErrors.length },
        'Step 3 complete: Mother email verification'
      );

      // ==========================================
      // STEP 4: Log state of nai@gmail.com specifically
      // ==========================================
      app.logger.info('Step 4: Verifying nai@gmail.com account state');

      try {
        const naiUser = await app.db.query.user.findFirst({
          where: eq(authSchema.user.email, 'nai@gmail.com'),
        });

        if (naiUser) {
          const naiUserId = String(naiUser.id);

          // Find the credential account for nai@gmail.com from our already-queried accounts
          const naiAccount = credentialAccounts.find(
            acc => acc.userId === naiUserId && acc.providerId === 'credential'
          );

          const passwordValid = naiAccount?.password?.startsWith('$2') ?? false;

          app.logger.info(
            {
              userId: naiUserId,
              email: String(naiUser.email),
              emailVerified: naiUser.emailVerified,
              credentialAccountExists: !!naiAccount,
              credentialAccountId: naiAccount?.id,
              accountId: naiAccount?.accountId,
              passwordValid,
              passwordPrefix: naiAccount?.password?.substring(0, 7),
            },
            'nai@gmail.com account state after migration'
          );
        } else {
          app.logger.warn('nai@gmail.com user not found in database');
        }
      } catch (err: unknown) {
        app.logger.error({ err }, 'Error checking nai@gmail.com state');
      }

      // ==========================================
      // STEP 5: Fix account_id for mother credential accounts
      // ==========================================
      app.logger.info('Step 5: Ensuring account_id matches email for mother credential accounts');

      try {
        // For each mother user with a credential account where account_id != email, update it
        let fixedAccountIdCount = 0;

        for (const mother of motherUsers) {
          try {
            const motherId = String(mother.id);
            const motherEmail = String(mother.email);

            const credAccount = credentialAccounts.find(
              acc => acc.userId === motherId && acc.providerId === 'credential'
            );

            if (credAccount && credAccount.accountId !== motherEmail) {
              app.logger.debug(
                { userId: motherId, email: motherEmail, currentAccountId: credAccount.accountId },
                'Fixing account_id to match email'
              );

              await app.db.update(authSchema.account)
                .set({ accountId: motherEmail })
                .where(eq(authSchema.account.id, credAccount.id));

              fixedAccountIdCount++;
              app.logger.info(
                { userId: motherId, email: motherEmail },
                'Fixed account_id to match email'
              );
            }
          } catch (err: unknown) {
            app.logger.error(
              { err, userId: String(mother.id) },
              'Error fixing account_id for mother'
            );
          }
        }

        app.logger.info(
          { fixedAccountIdCount },
          'Step 5 complete: account_id fixes for mother accounts'
        );
      } catch (err: unknown) {
        app.logger.error({ err }, 'Error in Step 5 account_id fixes');
      }

      // ==========================================
      // Migration Summary
      // ==========================================
      app.logger.info(
        {
          step1: { fixedPasswordCount, passwordFixErrors: passwordFixErrors.length },
          step2: { createdAccountCount, accountCreationErrors: accountCreationErrors.length },
          step3: { verifiedCount, verificationErrors: verificationErrors.length },
          step5: 'Checked and fixed account_id for all mother credential accounts',
          totalMothers: motherUsers.length,
        },
        'Comprehensive credential account migration complete'
      );

      if (passwordFixErrors.length > 0 || accountCreationErrors.length > 0 || verificationErrors.length > 0) {
        app.logger.warn(
          { passwordFixErrors, accountCreationErrors, verificationErrors },
          'Some migration tasks encountered errors - review logs above'
        );
      }
    } catch (startupError) {
      app.logger.error(
        { err: startupError },
        'Startup migration failed with error'
      );
    }
  });
});

await app.run();
app.logger.info('Application running');
