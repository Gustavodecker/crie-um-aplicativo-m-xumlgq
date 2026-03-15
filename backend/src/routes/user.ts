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
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', description: 'Current password' },
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
  }, async (request: FastifyRequest<{ Body: { currentPassword: string; newPassword: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { currentPassword, newPassword } = request.body;
    const userId = session.user.id;

    app.logger.info({ userId }, 'Attempting to change password');

    // Validate currentPassword
    if (!currentPassword || currentPassword.length === 0) {
      app.logger.warn({ userId }, 'Current password is empty');
      return reply.status(400).send({ error: 'currentPassword is required' });
    }

    // Validate newPassword length
    if (!newPassword || newPassword.length < 6) {
      app.logger.warn({ userId }, 'New password too short');
      return reply.status(400).send({ error: 'newPassword is required and must be at least 6 characters' });
    }

    try {
      // Step 1: Get user and verify they exist
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, userId),
      });

      if (!user) {
        app.logger.error({ userId }, 'User not found');
        return reply.status(401).send({ error: 'User not found' });
      }

      app.logger.info({ userId, email: user.email }, 'Retrieved user for password change');

      // Step 2: Get credential account for this user
      const credentialAccount = await app.db.query.account.findFirst({
        where: and(
          eq(authSchema.account.userId, userId),
          eq(authSchema.account.providerId, 'credential')
        ),
      });

      if (!credentialAccount) {
        app.logger.warn({ userId }, 'Credential account not found');
        return reply.status(404).send({ error: 'No credential account found' });
      }

      if (!credentialAccount.password) {
        app.logger.warn({ userId }, 'Credential account has no password set');
        return reply.status(401).send({ error: 'Invalid current password' });
      }

      app.logger.info({ userId }, 'Retrieved credential account');

      // Step 3: Verify current password (handle both bcrypt hashes and plain text)
      let passwordMatches = false;

      if (credentialAccount.password.startsWith('$2')) {
        // Password is a bcrypt hash - use hash comparison
        app.logger.debug({ userId }, 'Verifying hashed password');
        passwordMatches = await bcrypt.compare(currentPassword, credentialAccount.password);
      } else {
        // Password is plain text - compare directly
        app.logger.debug({ userId }, 'Verifying plain text password');
        passwordMatches = currentPassword === credentialAccount.password;
      }

      if (!passwordMatches) {
        app.logger.warn({ userId }, 'Current password verification failed');
        return reply.status(401).send({ error: 'Invalid current password' });
      }

      app.logger.info({ userId }, 'Current password verified successfully');

      // Step 4: Hash new password using bcrypt (same as Better Auth)
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      app.logger.info({ userId }, 'New password hashed');

      // Step 5: Update account with new password hash
      await app.db.update(authSchema.account)
        .set({ password: hashedNewPassword })
        .where(eq(authSchema.account.id, credentialAccount.id));

      app.logger.info({ userId, accountId: credentialAccount.id }, 'Account password updated');

      // Step 6: Clear requirePasswordChange flag
      await app.db.update(authSchema.user)
        .set({ requirePasswordChange: false })
        .where(eq(authSchema.user.id, userId));

      app.logger.info({ userId }, 'requirePasswordChange flag cleared');

      return reply.status(200).send({ message: 'Password changed successfully' });

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
