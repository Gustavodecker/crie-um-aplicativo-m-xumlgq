import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as authSchema from '../db/schema/auth-schema.js';

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
  // POST /api/auth/test-signin - Test sign-in credentials without creating a session (for debugging)
  app.fastify.post('/api/auth/test-signin', {
    schema: {
      description: 'Test sign-in credentials and diagnose authentication issues (no session created)',
      tags: ['auth', 'debug'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', description: 'User email' },
          password: { type: 'string', description: 'Plain-text password to test' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            userFound: { type: 'boolean' },
            userId: { type: ['string', 'null'] },
            emailVerified: { type: ['boolean', 'null'] },
            credentialAccountFound: { type: ['boolean', 'null'] },
            accountIdMatches: { type: ['boolean', 'null'] },
            passwordVerified: { type: ['boolean', 'null'] },
            issues: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { email: string; password: string } }>, reply: FastifyReply) => {
    const { email, password } = request.body;
    const normalizedEmail = email.toLowerCase();

    app.logger.info({ email: normalizedEmail }, 'Testing sign-in credentials');

    try {
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Step 1: Find user by email
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, normalizedEmail),
      });

      if (!user) {
        app.logger.warn({ email: normalizedEmail }, 'User not found for sign-in test');
        return reply.status(200).send({
          email: normalizedEmail,
          userFound: false,
          userId: null,
          emailVerified: null,
          credentialAccountFound: null,
          accountIdMatches: null,
          passwordVerified: null,
          issues: ['User does not exist'],
          recommendations: ['Create a user account first'],
        });
      }

      app.logger.debug({ userId: user.id, email: normalizedEmail }, 'User found');

      // Step 2: Check email verification
      if (!user.emailVerified) {
        issues.push('Email is not verified (email_verified = false)');
        recommendations.push('Verify the email address or update user.email_verified = true');
      }

      // Step 3: Find credential account
      const credentialAccount = await app.db.query.account.findFirst({
        where: and(
          eq(authSchema.account.userId, user.id),
          eq(authSchema.account.providerId, 'credential')
        ),
      });

      if (!credentialAccount) {
        issues.push('No credential account found for this user');
        recommendations.push('Create an account row with provider_id=credential and a hashed password');
        app.logger.warn({ userId: user.id }, 'Credential account not found');
      } else {
        app.logger.debug({ userId: user.id, accountId: credentialAccount.id }, 'Credential account found');

        // Step 4: Check if account_id matches email
        if (credentialAccount.accountId !== normalizedEmail) {
          issues.push(`account_id mismatch: expected "${normalizedEmail}", found "${credentialAccount.accountId}"`);
          recommendations.push('Update account.account_id to match the user email');
          app.logger.warn({ userId: user.id, expected: normalizedEmail, actual: credentialAccount.accountId }, 'account_id mismatch');
        }

        // Step 5: Check if password exists and verify it
        if (!credentialAccount.password) {
          issues.push('No password hash stored in account');
          recommendations.push('Set a proper bcrypt-hashed password in account.password');
          app.logger.warn({ userId: user.id }, 'No password hash found');
        } else {
          try {
            const bcrypt = await import('bcrypt');
            const passwordMatches = await bcrypt.default.compare(password, credentialAccount.password);

            app.logger.debug({ userId: user.id, passwordMatches }, 'Password verification completed');

            if (!passwordMatches) {
              issues.push('Password does not match the stored hash');
              recommendations.push('Check the password - ensure it matches what was set during registration');
            }

            return reply.status(200).send({
              email: normalizedEmail,
              userFound: true,
              userId: user.id,
              emailVerified: user.emailVerified,
              credentialAccountFound: true,
              accountIdMatches: credentialAccount.accountId === normalizedEmail,
              passwordVerified: passwordMatches,
              issues: issues.length === 0 ? [] : issues,
              recommendations: recommendations.length === 0 ? (issues.length === 0 ? ['Sign-in should work'] : recommendations) : recommendations,
            });
          } catch (err) {
            app.logger.error({ err, userId: user.id }, 'Error verifying password');
            issues.push(`Error verifying password: ${String(err instanceof Error ? err.message : 'Unknown error')}`);
            recommendations.push('Check the password hash format - should be a valid bcrypt hash');
          }
        }
      }

      return reply.status(200).send({
        email: normalizedEmail,
        userFound: true,
        userId: user.id,
        emailVerified: user.emailVerified,
        credentialAccountFound: !!credentialAccount,
        accountIdMatches: credentialAccount ? credentialAccount.accountId === normalizedEmail : null,
        passwordVerified: null,
        issues,
        recommendations,
      });
    } catch (error) {
      app.logger.error({ err: error, email: normalizedEmail }, 'Error testing sign-in credentials');
      return reply.status(500).send({ error: 'Error testing sign-in' });
    }
  });

  app.logger.info('Auth routes configured - Better Auth handling /api/auth/* endpoints with automatic password hashing');
}
