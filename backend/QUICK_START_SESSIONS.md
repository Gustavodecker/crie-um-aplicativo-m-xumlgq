# Session Management - Quick Start Guide

## TL;DR

Sessions now last **30 days** with automatic refresh every **24 hours**. No unexpected logouts.

## Setup (1 minute)

```bash
# Copy configuration template
cp .env.example .env

# Optional: Adjust settings
vim .env

# Deploy
npm run build && npm start
```

## Verify It Works

Check startup logs for:
```
[INFO] Session configuration loaded {
  sessionExpirationDays: 30,
  refreshTokenExpirationDays: 90,
  sessionUpdateAgeHours: 24,
  ...
}
[INFO] Authentication initialized with Better Auth
```

## In Your Routes

```typescript
export function registerMyRoutes(app: App) {
  const requireAuth = app.requireAuth();

  app.fastify.get('/api/protected', async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;  // 401 already sent if not authenticated

    app.logger.info({ userId: session.user.id }, 'Processing request');
    return { data: 'secret' };
  });
}
```

That's it! Sessions persist for 30 days automatically.

## Configuration (Optional)

All environment variables have defaults that work great:

| Variable | Default | Purpose |
|----------|---------|---------|
| `SESSION_EXPIRATION_TIME` | 30 days | How long before session expires |
| `REFRESH_TOKEN_EXPIRATION_TIME` | 90 days | How long refresh token lasts |
| `SESSION_UPDATE_AGE` | 24 hours | Auto-refresh active sessions |
| `COOKIE_MAX_AGE` | 30 days | Cookie lifetime |
| `COOKIE_DOMAIN` | (unset) | For multi-domain: `.example.com` |
| `SESSION_STRICT` | false | Don't invalidate on errors |
| `SESSION_COOKIE_CACHE` | true | Cache sessions (faster) |

## Key Points

✅ **Sessions persist 30 days** - Users stay logged in for a month
✅ **Auto-refresh every 24 hours** - Active sessions never expire
✅ **Resilient** - Network errors don't log you out
✅ **Tokens included** - Returned in response for client storage
✅ **No code changes needed** - Just works with defaults

## Troubleshooting

### Sessions still expiring too quickly?

```bash
# Check environment variable is set
echo $SESSION_EXPIRATION_TIME

# Should show: 2592000000 (30 days in milliseconds)
# If empty, defaults to 30 days automatically
```

### Users logged out unexpectedly?

Check `SESSION_STRICT` is `false`:
```bash
echo $SESSION_STRICT  # Should be unset or "false"
```

### Token not persisted?

Check sign-in endpoint returns token:
```bash
curl -X POST http://localhost:3000/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' | jq '.session.token'
```

## Documentation

- **Want to understand configuration?** → `SESSION_MANAGEMENT.md`
- **Want to see code examples?** → `SESSION_IMPLEMENTATION.md`
- **Want all details?** → `SESSION_FIXES_SUMMARY.md`
- **Want to verify deployment?** → `SESSION_IMPLEMENTATION_CHECKLIST.md`

## Common Scenarios

### Mobile App (Offline for days)

```env
SESSION_EXPIRATION_TIME=5184000000  # 60 days
REFRESH_TOKEN_EXPIRATION_TIME=15552000000  # 180 days
SESSION_UPDATE_AGE=259200000  # 3 days
```

### Web App (Standard - default)

```env
# Use defaults - nothing to configure!
```

### High-Security App (Banking/Medical)

```env
SESSION_EXPIRATION_TIME=86400000  # 1 day
SESSION_STRICT=true  # Stricter validation
```

## That's All!

Sessions are now configured for **persistent authentication**. Users won't experience unexpected logouts.

For more details, see the full documentation files.
