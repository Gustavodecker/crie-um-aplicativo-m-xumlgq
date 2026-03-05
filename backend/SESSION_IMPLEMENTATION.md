# Session Management Implementation Guide

This guide shows how to properly implement session management in routes to prevent unexpected logouts and ensure persistent authentication.

## Quick Start

### 1. Basic Protected Route

```typescript
import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

export function registerMyRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.get('/api/protected', {
    schema: {
      description: 'Protected endpoint',
      tags: ['my-routes'],
      response: {
        200: { type: 'object', properties: { message: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Get session - will return 401 if not authenticated
    const session = await requireAuth(request, reply);
    if (!session) return; // Session is invalid, requireAuth already sent 401

    // Log the request with session info
    app.logger.info({ userId: session.user.id }, 'Processing protected request');

    return { message: 'Success' };
  });
}
```

### 2. Resilient Session Validation

For routes that should handle temporary validation errors gracefully:

```typescript
import { validateSessionSafe } from '../utils/auth.js';

app.fastify.get('/api/data', async (request: FastifyRequest, reply: FastifyReply) => {
  // Use resilient validation - won't throw on temporary errors
  const session = await validateSessionSafe(app, request, reply);
  if (!session) return; // Not authenticated

  app.logger.info({ userId: session.user.id }, 'Fetching data');
  return { data: [...] };
});
```

### 3. Handling Concurrent Requests

For routes that might receive multiple concurrent requests:

```typescript
app.fastify.post('/api/update', async (request: FastifyRequest, reply: FastifyReply) => {
  const session = await requireAuth(request, reply);
  if (!session) return;

  // Process update - concurrent requests won't invalidate each other
  const [updated] = await app.db.update(schema.items)
    .set(request.body)
    .where(eq(schema.items.userId, session.user.id))
    .returning();

  app.logger.info({ userId: session.user.id, itemId: updated.id }, 'Item updated');
  return updated;
});
```

### 4. Ensuring Token Persistence

For sign-in and sign-up endpoints, ensure the token is in the response:

```typescript
import { responseWithToken, setSessionToken } from '../utils/response.js';

app.fastify.post('/api/auth/signin', async (request: FastifyRequest, reply: FastifyReply) => {
  // Process sign-in (usually handled by Better Auth)
  const session = await authService.signin(request.body);

  // Ensure token is in both response body and headers
  if (session && session.session?.token) {
    setSessionToken(reply, session.session.token);
    return responseWithToken(session, session.session.token);
  }

  return session;
});
```

## Best Practices

### 1. Always Check Session

```typescript
// ✅ CORRECT: Check if session exists before using it
const session = await requireAuth(request, reply);
if (!session) return;

const userId = session.user.id;
```

```typescript
// ❌ WRONG: Assuming session exists
const session = await requireAuth(request, reply);
const userId = session.user.id; // Might throw if session is null
```

### 2. Log Session Information

```typescript
// ✅ GOOD: Log session info for debugging
app.logger.info({ userId: session.user.id, sessionId: session.session.id }, 'Request processed');
```

```typescript
// ❌ BAD: Don't log tokens or sensitive data
app.logger.info({ token: session.session.token }, 'User signed in'); // Never log tokens!
```

### 3. Handle Errors Gracefully

```typescript
// ✅ GOOD: Catch and log validation errors without invalidating
try {
  const session = await requireAuth(request, reply);
  if (!session) return;
  // Process request
} catch (error) {
  app.logger.warn({ err: error }, 'Session validation error - retrying');
  // Don't invalidate - could be temporary
}
```

### 4. Use Proper Error Codes

```typescript
// ✅ CORRECT: 401 only for truly invalid sessions
if (!session) {
  return reply.status(401).send({ error: 'Not authenticated' });
}

// 404 for resource not found
if (!resource) {
  return reply.status(404).send({ error: 'Resource not found' });
}

// 500 for unexpected server errors (don't invalidate session)
if (dbError) {
  app.logger.error({ err: dbError }, 'Database error');
  return reply.status(500).send({ error: 'Internal server error' });
}
```

## Configuration for Different Scenarios

### Scenario 1: Mobile App (Extended Offline Support)

```env
# Users might be offline for days, then return
SESSION_EXPIRATION_TIME=5184000000  # 60 days
REFRESH_TOKEN_EXPIRATION_TIME=15552000000  # 180 days
SESSION_UPDATE_AGE=259200000  # 3 days
COOKIE_MAX_AGE=5184000  # 60 days
SESSION_STRICT=false
SESSION_COOKIE_CACHE=true
```

### Scenario 2: Web App (Standard Configuration)

```env
# Standard web application
SESSION_EXPIRATION_TIME=2592000000  # 30 days (default)
REFRESH_TOKEN_EXPIRATION_TIME=7776000000  # 90 days (default)
SESSION_UPDATE_AGE=86400000  # 24 hours (default)
COOKIE_MAX_AGE=2592000  # 30 days (default)
SESSION_STRICT=false
SESSION_COOKIE_CACHE=true
```

### Scenario 3: High-Security App (Shorter Sessions)

```env
# Medical or financial application - shorter sessions
SESSION_EXPIRATION_TIME=86400000  # 1 day
REFRESH_TOKEN_EXPIRATION_TIME=604800000  # 7 days
SESSION_UPDATE_AGE=3600000  # 1 hour
COOKIE_MAX_AGE=86400  # 1 day
SESSION_STRICT=true
SESSION_COOKIE_CACHE=false
```

## Debugging Session Issues

### Check Session Configuration on Startup

The application logs session configuration on startup:

```
[INFO] Session configuration loaded {
  sessionExpirationDays: 30,
  refreshTokenExpirationDays: 90,
  sessionUpdateAgeHours: 24,
  cookieMaxAgeDays: 30,
  cookieDomain: "current domain",
  sessionStrict: false,
  cookieCacheEnabled: true
}
```

### Enable Debug Logging

All routes should log session-related operations:

```typescript
app.logger.debug({ userId: session.user.id }, 'Session validated');
app.logger.warn({ sessionId: session.session.id }, 'Session expiring soon');
app.logger.error({ err: error }, 'Session validation failed');
```

### Common Issues and Solutions

#### Issue: Users logged out after few hours

```bash
# Check environment variables
echo $SESSION_EXPIRATION_TIME  # Should be 2592000000 (30 days)
echo $SESSION_STRICT  # Should be false
```

**Solution:** Set `SESSION_EXPIRATION_TIME=2592000000`

#### Issue: Token not persisted on client

**Check:**
1. Is `/api/auth/sign-in` returning session token in response body?
2. Is client storing the token in localStorage?
3. Is client sending token in subsequent requests?

**Solution:** Ensure sign-in endpoint includes:
```typescript
return responseWithToken(session, session.session.token);
```

#### Issue: Session not working across subdomains

**Check:**
1. Is `COOKIE_DOMAIN` set? (e.g., `.example.com`)
2. Are all subdomains using HTTPS?
3. Is SameSite policy correctly set?

**Solution:** Set environment variable:
```env
COOKIE_DOMAIN=.example.com
```

## Client-Side Token Management

### TypeScript/JavaScript Example

```typescript
// After successful sign-in
const response = await fetch('/api/auth/sign-in', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});

const data = await response.json();

// Store session token
if (data.sessionToken) {
  localStorage.setItem('sessionToken', data.sessionToken);
}

// Store full session info for reference
if (data.session) {
  localStorage.setItem('session', JSON.stringify(data.session));
}
```

### Sending Token in Subsequent Requests

```typescript
const sessionToken = localStorage.getItem('sessionToken');

const response = await fetch('/api/protected', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${sessionToken}`,
  },
});
```

## Testing Session Management

### Test Session Persistence

```bash
# 1. Sign in and get session token
curl -X POST http://localhost:3000/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  -c cookies.txt

# 2. Use token in subsequent request
curl -X GET http://localhost:3000/api/protected \
  -H "Authorization: Bearer <session-token>" \
  -b cookies.txt
```

### Monitor Session in Database

```sql
-- Check active sessions
SELECT id, user_id, expires_at, created_at, updated_at
FROM "session"
WHERE expires_at > NOW()
ORDER BY updated_at DESC;

-- Check session expiration distribution
SELECT
  CASE
    WHEN expires_at < NOW() THEN 'expired'
    WHEN expires_at < NOW() + INTERVAL '1 day' THEN '< 1 day'
    WHEN expires_at < NOW() + INTERVAL '7 days' THEN '< 7 days'
    ELSE '> 7 days'
  END as expiration_range,
  COUNT(*) as count
FROM "session"
GROUP BY expiration_range;
```

## Troubleshooting Checklist

- [ ] Environment variables configured in `.env`
- [ ] Session configuration logged on application startup
- [ ] Routes using proper auth pattern (`const session = await requireAuth(...)`)
- [ ] Routes checking if session is null before using
- [ ] Error handling doesn't invalidate sessions
- [ ] Sign-in/sign-up endpoints return session token in response
- [ ] Client-side code stores session token
- [ ] Client-side code sends token with requests
- [ ] Database session table has entries with future `expiresAt` times
- [ ] Logs show session-related operations (especially errors)

## Related Files

- `src/config/session.ts`: Configuration loading
- `src/utils/auth.ts`: Resilient session validation
- `src/utils/response.ts`: Response formatting with tokens
- `SESSION_MANAGEMENT.md`: Configuration reference
- `.env.example`: Environment variable template
