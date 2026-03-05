/**
 * Session Management Configuration
 *
 * Configures Better Auth session handling with extended durations
 * to prevent unexpected logouts and ensure persistent authentication.
 *
 * Environment Variables:
 * - SESSION_EXPIRATION_TIME: Session expiration in milliseconds (default: 30 days)
 * - REFRESH_TOKEN_EXPIRATION_TIME: Refresh token expiration in ms (default: 90 days)
 * - SESSION_UPDATE_AGE: Session activity refresh interval in ms (default: 24 hours)
 * - COOKIE_MAX_AGE: Cookie max age in seconds (default: 30 days)
 * - COOKIE_DOMAIN: Domain for cross-subdomain cookies (default: current domain)
 * - SESSION_STRICT: Enable strict validation (default: false)
 * - SESSION_COOKIE_CACHE: Enable cookie caching (default: true)
 */

// Session durations in milliseconds
const SESSION_EXPIRATION_TIME = parseInt(
  process.env.SESSION_EXPIRATION_TIME || '2592000000', // 30 days
  10
);

const REFRESH_TOKEN_EXPIRATION_TIME = parseInt(
  process.env.REFRESH_TOKEN_EXPIRATION_TIME || '7776000000', // 90 days
  10
);

const SESSION_UPDATE_AGE = parseInt(
  process.env.SESSION_UPDATE_AGE || '86400000', // 24 hours
  10
);

const COOKIE_MAX_AGE = parseInt(
  process.env.COOKIE_MAX_AGE || '2592000', // 30 days in seconds
  10
);

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '';

const SESSION_STRICT = process.env.SESSION_STRICT === 'true' ? true : false;

const SESSION_COOKIE_CACHE = process.env.SESSION_COOKIE_CACHE === 'false' ? false : true;

/**
 * Better Auth session configuration
 *
 * Configuration details:
 * - 30 day session expiration: Sessions remain valid for 30 days
 * - 24 hour update age: Session activity is refreshed every 24 hours
 * - 90 day refresh token: Refresh tokens remain valid for 90 days
 * - Cookie caching: Sessions are cached to prevent excessive database queries
 * - Non-strict validation: Temporary validation errors don't invalidate sessions
 * - Cross-subdomain cookies: Supports subdomain sharing via cookie domain
 */
export const sessionConfig = {
  // Session expiration in seconds
  expiresIn: Math.floor(SESSION_EXPIRATION_TIME / 1000),

  // Refresh token expiration in seconds
  refreshTokenExpiresIn: Math.floor(REFRESH_TOKEN_EXPIRATION_TIME / 1000),

  // Session update age in seconds - refresh activity every 24 hours
  updateAge: Math.floor(SESSION_UPDATE_AGE / 1000),

  // Cookie configuration
  cookie: {
    maxAge: COOKIE_MAX_AGE,
    domain: COOKIE_DOMAIN || undefined,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
  },

  // Enable cookie caching for better performance
  cookieCache: {
    enabled: SESSION_COOKIE_CACHE,
    maxAge: COOKIE_MAX_AGE,
  },

  // Non-strict validation to prevent unexpected logouts
  strict: SESSION_STRICT,
};

/**
 * Session validation options
 *
 * These settings make session validation more resilient:
 * - Don't invalidate on temporary errors
 * - Don't invalidate on concurrent requests
 * - Only invalidate on explicit logout or token tampering
 */
export const sessionValidationOptions = {
  // Don't invalidate session on validation errors
  throwOnValidationError: false,

  // Don't invalidate on concurrent requests
  allowConcurrentRequests: true,

  // Allow graceful fallback if session validation fails temporarily
  fallbackToAnonymous: false,
};

/**
 * Get session configuration object for Better Auth initialization
 */
export function getSessionConfig() {
  return {
    session: sessionConfig,
    advanced: {
      ...sessionValidationOptions,
      // Session will persist across restarts via database
      persistSessions: true,
    },
  };
}
