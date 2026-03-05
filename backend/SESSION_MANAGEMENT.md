# Session Management Configuration

This document describes the session management system and how to prevent unexpected logouts.

## Overview

The application uses Better Auth with extended session durations to ensure persistent authentication and prevent unexpected logouts. Sessions are configured to last 30 days with automatic refresh every 24 hours.

## Configuration

### Session Durations

- **Session Expiration**: 30 days (default)
  - Sessions remain valid for 30 days from creation
  - Automatically refreshed every 24 hours if still in use
  - Environment variable: `SESSION_EXPIRATION_TIME` (in milliseconds)

- **Refresh Token Expiration**: 90 days (default)
  - Refresh tokens remain valid for 90 days
  - Allows creating new sessions even after main session expires
  - Environment variable: `REFRESH_TOKEN_EXPIRATION_TIME` (in milliseconds)

- **Session Update Age**: 24 hours (default)
  - Session activity is automatically refreshed every 24 hours
  - Keeps active sessions alive
  - Environment variable: `SESSION_UPDATE_AGE` (in milliseconds)

### Cookie Configuration

- **Cookie Max Age**: 30 days (default)
  - Matches session expiration for consistency
  - Environment variable: `COOKIE_MAX_AGE` (in seconds)

- **Cross-Subdomain Support**: Configurable
  - Cookie domain can be set to support subdomains
  - Environment variable: `COOKIE_DOMAIN`
  - Examples: `.example.com` for all subdomains

### Session Validation

- **Strict Mode**: Disabled (default)
  - Non-strict validation prevents unexpected logouts on temporary errors
  - Temporary validation failures don't invalidate sessions
  - Environment variable: `SESSION_STRICT` (set to `true` to enable)

- **Cookie Caching**: Enabled (default)
  - Improves performance by caching session lookups
  - Reduces database queries
  - Environment variable: `SESSION_COOKIE_CACHE` (set to `false` to disable)

## Environment Variables

Create a `.env` file in the project root with the following variables (or use defaults):

```env
# Session expiration in milliseconds (30 days = 2592000000 ms)
SESSION_EXPIRATION_TIME=2592000000

# Refresh token expiration in milliseconds (90 days = 7776000000 ms)
REFRESH_TOKEN_EXPIRATION_TIME=7776000000

# Session update age in milliseconds (24 hours = 86400000 ms)
SESSION_UPDATE_AGE=86400000

# Cookie max age in seconds (30 days = 2592000 seconds)
COOKIE_MAX_AGE=2592000

# Cookie domain for cross-subdomain support (leave empty for current domain)
COOKIE_DOMAIN=

# Session validation settings
SESSION_STRICT=false

# Enable session cookie caching
SESSION_COOKIE_CACHE=true
```

## Session Persistence

Sessions are persisted in the database using the following tables:

- **user**: User account information
- **session**: Active sessions with tokens and expiration times
- **account**: OAuth and password authentication details
- **verification**: Email verification tokens

Key fields in the session table:
- `id`: Unique session identifier
- `token`: Session token (must be stored client-side)
- `expiresAt`: Session expiration timestamp
- `userId`: Associated user
- `createdAt`: Session creation time
- `updatedAt`: Last activity time

## Token Management

### Session Token

The session token must be:
1. **Returned in API responses**: Sign-in and sign-up responses include the session token
2. **Stored client-side**: Client must persist the token in localStorage or similar
3. **Sent with requests**: Client includes token in headers or cookies with each request

### Token Persistence Pattern

**For HTTP Requests:**
```
Authorization: Bearer <session-token>
```

**For Cookie-Based Requests:**
- Session cookie is automatically managed by the browser
- Token is included in `Set-Cookie` response headers

## Preventing Unexpected Logouts

### Best Practices

1. **Enable Automatic Session Refresh**
   - Sessions are automatically refreshed every 24 hours
   - No action required from user

2. **Use Session Update Age**
   - Activity timestamps are updated without full refresh
   - Keeps sessions alive based on actual usage

3. **Implement Graceful Error Handling**
   - Don't invalidate sessions on temporary network errors
   - Retry failed requests before redirecting to login

4. **Token Persistence**
   - Always store and return session tokens
   - Include tokens in both response body and cookies

5. **Cross-Subdomain Support**
   - Set `COOKIE_DOMAIN` if using multiple subdomains
   - Ensures sessions work across your domain hierarchy

## Troubleshooting

### Users Getting Logged Out Unexpectedly

**Symptoms:**
- User is redirected to login page
- Session still valid in database
- Happens during active use or after idle period

**Solutions:**
1. Check that `SESSION_EXPIRATION_TIME` is set to 30 days (2592000000 ms)
2. Verify `SESSION_UPDATE_AGE` is configured (default: 24 hours)
3. Ensure `SESSION_STRICT` is `false` (disabled)
4. Check logs for validation errors
5. Verify token is being returned in sign-in/sign-up responses

### Sessions Expiring Too Quickly

**Symptoms:**
- Users logged out after a few hours
- Despite setting long expiration time

**Solutions:**
1. Check that `SESSION_EXPIRATION_TIME` environment variable is set correctly
2. Verify database timestamp settings (use UTC)
3. Check server time synchronization
4. Review `expiresAt` timestamps in session table

### Token Not Being Persisted

**Symptoms:**
- Client-side token storage is empty
- Session works in same browser but fails on refresh

**Solutions:**
1. Verify API returns session token in response body
2. Check client-side code stores token in localStorage
3. Confirm token is sent with subsequent requests
4. Check browser cookie settings if using cookies

### Sessions Not Working Across Subdomains

**Symptoms:**
- Session valid on `app.example.com`
- Session invalid on `api.example.com`

**Solutions:**
1. Set `COOKIE_DOMAIN=.example.com` (note the leading dot)
2. Verify all subdomains are served over HTTPS in production
3. Check SameSite cookie policy settings

## Monitoring

### Key Metrics to Monitor

1. **Session Expiration Rate**
   - Number of sessions reaching `expiresAt`
   - Should be low if users are active

2. **Session Refresh Rate**
   - Number of sessions updated via `SESSION_UPDATE_AGE`
   - Indicates active user count

3. **Validation Errors**
   - Log level: WARN for temporary validation failures
   - Should not cause 401 responses unless session is invalid

4. **Token Return Rate**
   - Percentage of auth requests returning session token
   - Should be 100% for sign-in/sign-up endpoints

## Implementation Details

### Configuration Loading

Session configuration is loaded from `src/config/session.ts`:
- Reads environment variables on application start
- Falls back to sensible defaults (30 day expiration)
- Logs configuration on startup for debugging

### Session Validation Utilities

Located in `src/utils/auth.ts`:
- `createResilientAuth()`: Wrapper for resilient session validation
- `getSafeSession()`: Non-throwing session retrieval
- `validateSessionSafe()`: Graceful session validation

These utilities:
- Log validation attempts and failures
- Don't throw exceptions on temporary errors
- Only return 401 for truly invalid sessions
- Allow concurrent requests without conflicts

## Related Files

- `src/config/session.ts`: Session configuration
- `src/utils/auth.ts`: Session validation utilities
- `.env.example`: Environment variable template
- `src/index.ts`: Authentication initialization
- `src/db/schema/auth-schema.ts`: Better Auth schema definitions
