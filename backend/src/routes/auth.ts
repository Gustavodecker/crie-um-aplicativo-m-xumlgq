import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as authSchema from '../db/schema/auth-schema.js';
import crypto from 'crypto';

export function registerAuthRoutes(app: App) {
  app.logger.info('Registering custom auth helper routes');

  // ==========================================
  // CUSTOM SIGN-IN ENDPOINT
  // Registered at /api/auth-debug/sign-in to avoid conflict with Better Auth
  // This endpoint is for testing and debugging purposes only
  // ==========================================
  app.fastify.post('/api/auth-debug/sign-in', {
    schema: {
      description: 'Sign in with email and password',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', description: 'User email address' },
          password: { type: 'string', description: 'Plain-text password' },
        },
      },
      response: {
        200: {
          description: 'Sign in successful',
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: ['string', 'null'] },
                emailVerified: { type: 'boolean' },
              },
            },
            mustChangePassword: { type: 'boolean', description: 'Whether user must change password after temporary password login' },
          },
        },
        401: {
          description: 'Invalid email or password',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { email: string; password: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const { email, password } = request.body;
    const normalizedEmail = email.toLowerCase();

    app.logger.info({ email: normalizedEmail }, 'Custom sign-in endpoint called');

    try {
      // Look up user by email (case-insensitive)
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, normalizedEmail),
      });

      if (!user) {
        app.logger.warn({ email: normalizedEmail }, 'Sign-in failed - user not found');
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      app.logger.debug({ userId: user.id }, 'User found, checking credential account');

      // Find credential account for this user
      const credentialAccounts = await app.db.query.account.findMany({
        where: eq(authSchema.account.userId, user.id),
      });

      const credentialAccount = credentialAccounts.find(acc => acc.providerId === 'credential');

      if (!credentialAccount || !credentialAccount.password) {
        app.logger.warn({ userId: user.id, email: normalizedEmail }, 'Sign-in failed - no credential account or password');
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      app.logger.debug({ userId: user.id, accountId: credentialAccount.id }, 'Credential account found, verifying password');

      // Verify password
      const bcrypt = await import('bcrypt');
      const passwordValid = await bcrypt.default.compare(password, credentialAccount.password);

      if (!passwordValid) {
        app.logger.warn({ userId: user.id, email: normalizedEmail }, 'Sign-in failed - invalid password');
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      app.logger.debug({ userId: user.id }, 'Password verified, checking temporary password status');

      // Check if temporary password has expired
      let mustChangePassword = user.mustChangePassword;
      if (user.mustChangePassword && user.tempPasswordExpiresAt) {
        if (new Date() > new Date(user.tempPasswordExpiresAt)) {
          // Temporary password has expired, clear the flag
          app.logger.debug({ userId: user.id }, 'Temporary password expired, clearing flag');
          await app.db.update(authSchema.user)
            .set({ mustChangePassword: false })
            .where(eq(authSchema.user.id, user.id));
          mustChangePassword = false;
        }
      }

      // Create session
      const sessionToken = crypto.randomBytes(16).toString('hex');
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const ipAddress = request.ip || '';
      const userAgent = request.headers['user-agent'] || '';

      await app.db.insert(authSchema.session).values({
        id: sessionId,
        token: sessionToken,
        userId: user.id,
        expiresAt,
        ipAddress,
        userAgent,
      });

      app.logger.info({ userId: user.id, email: normalizedEmail, sessionId, mustChangePassword }, 'Sign-in successful, session created');

      return reply.status(200).send({
        token: sessionToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
        },
        mustChangePassword,
      });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      app.logger.error({ err: error, email: normalizedEmail }, 'Sign-in error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ==========================================
  // CUSTOM SIGN-UP ENDPOINT
  // Registered at /api/auth-debug/sign-up to avoid conflict with Better Auth
  // This endpoint is for testing and debugging purposes only
  // ==========================================
  app.fastify.post('/api/auth-debug/sign-up', {
    schema: {
      description: 'Sign up with email and password',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email', description: 'Email address' },
          password: { type: 'string', description: 'Password (will be hashed)' },
          name: { type: 'string', description: 'User name' },
        },
      },
      response: {
        201: {
          description: 'Sign up successful',
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: ['string', 'null'] },
                emailVerified: { type: 'boolean' },
              },
            },
          },
        },
        409: {
          description: 'Email already exists',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { email: string; password: string; name: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const { email, password, name } = request.body;
    const normalizedEmail = email.toLowerCase();

    app.logger.info({ email: normalizedEmail, name }, 'Custom sign-up endpoint called');

    try {
      // Check if user already exists
      const existingUser = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, normalizedEmail),
      });

      if (existingUser) {
        app.logger.warn({ email: normalizedEmail }, 'Sign-up failed - email already exists');
        return reply.status(409).send({ error: 'Email already exists' });
      }

      // Hash password
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.default.hash(password, 10);

      app.logger.debug({ email: normalizedEmail }, 'Password hashed, creating user and account');

      // Create user
      const userId = crypto.randomUUID();
      await app.db.insert(authSchema.user).values({
        id: userId,
        email: normalizedEmail,
        name,
        emailVerified: true,
        requirePasswordChange: false,
        role: null,
      });

      // Create credential account
      const accountId = crypto.randomUUID();
      await app.db.insert(authSchema.account).values({
        id: accountId,
        accountId: normalizedEmail,
        providerId: 'credential',
        userId,
        password: hashedPassword,
      });

      // Create session
      const sessionToken = crypto.randomBytes(16).toString('hex');
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const ipAddress = request.ip || '';
      const userAgent = request.headers['user-agent'] || '';

      await app.db.insert(authSchema.session).values({
        id: sessionId,
        token: sessionToken,
        userId,
        expiresAt,
        ipAddress,
        userAgent,
      });

      app.logger.info({ userId, email: normalizedEmail }, 'Sign-up successful');

      return reply.status(201).send({
        token: sessionToken,
        user: {
          id: userId,
          email: normalizedEmail,
          name,
          role: null,
          emailVerified: true,
        },
      });
    } catch (error: unknown) {
      app.logger.error({ err: error, email: normalizedEmail }, 'Sign-up error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
  // POST /api/auth-debug/test-signin - Test sign-in credentials without creating a session (for debugging)
  app.fastify.post('/api/auth-debug/test-signin', {
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

  app.logger.info('Debug auth routes registered at /api/auth-debug/* - Better Auth handling all /api/auth/* endpoints');
}
