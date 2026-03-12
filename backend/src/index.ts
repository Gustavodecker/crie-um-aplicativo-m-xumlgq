import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import { sessionConfig } from './config/session.js';

// Import route registration functions
import { registerAuthRoutes } from './routes/auth.js';
import { registerInitRoutes } from './routes/init.js';
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

// Combine schemas
const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Add middleware to allow requests without Origin header (for mobile apps)
// This is necessary because mobile apps (React Native/Expo) don't send Origin headers
// and Better Auth should not reject them based on missing Origin
app.fastify.addHook('preHandler', async (request, reply) => {
  // If Origin header is missing, add a permissive one
  // This allows mobile apps to proceed without Origin validation issues
  if (!request.headers.origin) {
    // For requests without Origin (mobile apps), we set a placeholder
    // The actual security comes from authentication tokens, not Origin
    request.headers.origin = 'mobile-app';
  }
});

app.logger.info(
  { middleware: 'origin-header-normalization' },
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
// Configuration includes mobile app support with flexible CORS handling
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
// - Mobile apps (React Native/Expo) don't send Origin header
// - Middleware adds "mobile-app" origin for requests without Origin header
// - Authentication is protected by session tokens, not Origin
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
  // Accept all origins including the "mobile-app" placeholder
  // Mobile apps get "mobile-app" origin from middleware if they don't send Origin header
  trustedOrigins: ["*", "mobile-app"],
});

app.logger.info(
  { trustedOrigins: ["*", "mobile-app"], mobileMiddleware: 'enabled' },
  'Better Auth configured for mobile app support - all origins accepted, mobile apps without Origin header are handled by middleware'
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

await app.run();
app.logger.info('Application running');
