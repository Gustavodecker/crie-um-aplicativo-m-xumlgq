import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as authSchema from '../db/schema/auth-schema.js';
import bcrypt from 'bcrypt';

/**
 * User Routes
 *
 * POST /api/user/change-password - Change user password
 *   - Requires authentication
 *   - Validates current password
 *   - Updates password and clears requirePasswordChange flag
 */

export function registerUserRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // PATCH /api/user/change-password - Change user password
  app.fastify.patch('/api/user/change-password', {
    schema: {
      description: 'Change user password',
      tags: ['user'],
      body: {
        type: 'object',
        required: ['newPassword'],
        properties: {
          currentPassword: { type: 'string', description: 'Current password (optional if require_password_change is true)' },
          newPassword: { type: 'string', description: 'New password (minimum 6 characters)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { currentPassword?: string; newPassword: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { currentPassword, newPassword } = request.body;
    const userId = session.user.id;

    app.logger.info({ userId, hasCurrentPassword: !!currentPassword, hasNewPassword: !!newPassword }, 'Password change request received');

    // Validate newPassword
    if (!newPassword || newPassword.length < 6) {
      app.logger.warn({ userId }, 'New password too short');
      return reply.status(400).send({ error: 'newPassword is required and must be at least 6 characters' });
    }

    try {
      // Step 1: Fetch user row from user table
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, userId),
      });

      if (!user) {
        app.logger.error({ userId }, 'User not found');
        return reply.status(401).send({ error: 'User not found' });
      }

      app.logger.info(
        { userId, requirePasswordChange: user.requirePasswordChange },
        `Retrieved user: require_password_change = ${user.requirePasswordChange}`
      );

      // Step 2: Fetch credential account row
      const credentialAccount = await app.db.query.account.findFirst({
        where: and(
          eq(authSchema.account.userId, userId),
          eq(authSchema.account.providerId, 'credential')
        ),
      });

      if (!credentialAccount) {
        app.logger.warn({ userId }, 'Credential account not found');
        return reply.status(404).send({ error: 'Credential account not found' });
      }

      app.logger.info({ userId, hasStoredPassword: !!credentialAccount.password }, 'Retrieved credential account');

      // Step 3: Conditional password verification
      // If require_password_change = true, skip currentPassword verification (first-time setup)
      // If require_password_change = false, verify currentPassword
      if (!user.requirePasswordChange) {
        // User is changing an existing password - verify current password
        app.logger.info({ userId }, 'User has existing password - verification required');

        if (!currentPassword) {
          app.logger.warn({ userId }, 'Current password required but not provided');
          return reply.status(400).send({ error: 'currentPassword is required' });
        }

        if (!credentialAccount.password) {
          app.logger.warn({ userId }, 'No password stored for credential account');
          return reply.status(401).send({ error: 'Current password is incorrect' });
        }

        // Verify current password (handle both bcrypt and scrypt hashes, plus plain text)
        let passwordMatches = false;
        let hashType = 'unknown';

        if (credentialAccount.password.startsWith('$2')) {
          // Password is a bcrypt hash
          hashType = 'bcrypt';
          app.logger.debug({ userId }, 'Verifying bcrypt-hashed password');
          passwordMatches = await bcrypt.compare(currentPassword, credentialAccount.password);
        } else if (credentialAccount.password.startsWith('$7')) {
          // Password is a scrypt hash - bcrypt.compare will handle it for scrypt-compatible hashes
          hashType = 'scrypt';
          app.logger.debug({ userId }, 'Verifying scrypt-hashed password');
          try {
            passwordMatches = await bcrypt.compare(currentPassword, credentialAccount.password);
          } catch (err) {
            // If bcrypt fails with scrypt, password doesn't match
            app.logger.debug({ userId, error: (err as Error).message }, 'Scrypt comparison via bcrypt failed');
            passwordMatches = false;
          }
        } else {
          // Password is plain text
          hashType = 'plaintext';
          app.logger.debug({ userId }, 'Verifying plain text password');
          passwordMatches = currentPassword === credentialAccount.password;
        }

        if (!passwordMatches) {
          app.logger.warn({ userId, hashType }, 'Current password verification failed');
          return reply.status(401).send({ error: 'Current password is incorrect' });
        }

        app.logger.info({ userId, hashType }, 'Current password verified successfully');
      } else {
        // User is setting password for first time - skip currentPassword verification
        app.logger.info({ userId }, 'First-time password setup - skipping currentPassword verification');
      }

      // Step 4: Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      app.logger.info({ userId }, 'New password hashed with bcrypt (10 rounds)');

      // Step 5: Update account with new password hash
      await app.db.update(authSchema.account)
        .set({ password: hashedNewPassword, updatedAt: new Date() })
        .where(and(
          eq(authSchema.account.providerId, 'credential'),
          eq(authSchema.account.userId, userId)
        ));

      app.logger.info({ userId, accountId: credentialAccount.id }, 'Account password hash updated in database');

      // Step 6: Clear requirePasswordChange flag
      await app.db.update(authSchema.user)
        .set({ requirePasswordChange: false, updatedAt: new Date() })
        .where(eq(authSchema.user.id, userId));

      app.logger.info({ userId }, 'User require_password_change flag set to false');

      return reply.status(200).send({ message: 'Password updated successfully' });

    } catch (error) {
      app.logger.error({ err: error, userId }, 'Error changing password');
      return reply.status(500).send({ error: 'Failed to change password' });
    }
  });

  // GET /api/user/flags - Get user feature flags
  app.fastify.get('/api/user/flags', {
    schema: {
      description: 'Get user feature flags',
      tags: ['user'],
      response: {
        200: {
          type: 'object',
          properties: {
            requirePasswordChange: { type: 'boolean', description: 'Whether user must change password on next interaction' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    app.logger.info({ userId }, 'Fetching user flags');

    try {
      // Get user record to retrieve requirePasswordChange flag
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, userId),
      });

      if (!user) {
        app.logger.error({ userId }, 'User not found');
        return reply.status(401).send({ error: 'User not found' });
      }

      app.logger.info({ userId, requirePasswordChange: user.requirePasswordChange }, 'User flags retrieved');

      return reply.status(200).send({
        requirePasswordChange: user.requirePasswordChange,
      });
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Error fetching user flags');
      return reply.status(500).send({ error: 'Failed to fetch user flags' });
    }
  });
}
