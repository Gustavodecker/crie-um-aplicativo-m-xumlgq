import type { App } from '../index.js';

/**
 * NOTE: Custom auth endpoints should NOT be created under /api/auth/*
 * Better Auth automatically handles all /api/auth/* paths:
 * - POST /api/auth/sign-up/email - Standard email/password signup (password hashing included)
 * - POST /api/auth/sign-in/email - Standard email/password signin
 * - POST /api/auth/sign-out - Sign out
 * - GET /api/auth/get-session - Get current session
 * - POST /api/auth/change-password - Change password with hashing
 * etc.
 *
 * For mother token-based flows, see: src/routes/mother.ts
 * For consultant registration with auto-profile creation, see: src/index.ts withAuth hooks
 */
export function registerAuthRoutes(app: App) {
  // This file is empty - Better Auth handles all authentication
  // Custom endpoints are registered in other route files (mother.ts, consultant.ts)
  app.logger.info('Auth routes configured - Better Auth handling /api/auth/* endpoints with automatic password hashing');
}
