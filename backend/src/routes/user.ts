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
          newPassword: { type: 'string', description: 'New password' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { newPassword: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { newPassword } = request.body;
    const userId = session.user.id;

    if (!newPassword || (typeof newPassword === 'string' && newPassword.trim().length === 0)) {
      app.logger.warn({ userId, hasPassword: !!newPassword }, 'newPassword is required or empty');
      return reply.status(400).send({ error: 'newPassword is required' });
    }

    app.logger.info({ userId }, 'Password change request received');

    try {
      // Hash the new password using bcrypt (Better Auth's default)
      app.logger.info({ userId }, 'Hashing password using bcrypt');

      let hashedPassword: string;

      try {
        // Use bcrypt with default rounds (10)
        hashedPassword = await bcrypt.hash(newPassword, 10);

        app.logger.info({ userId, hashLength: hashedPassword.length }, 'Password hashed successfully');
      } catch (hashError) {
        app.logger.error({ err: hashError, userId, errorMsg: (hashError as Error).message }, 'Failed to hash password');
        return reply.status(500).send({ error: 'Failed to change password' });
      }

      // First, find the credential account to ensure it exists
      app.logger.info({ userId }, 'Looking up credential account');

      let credentialAccount;
      try {
        credentialAccount = await app.db.query.account.findFirst({
          where: and(
            eq(authSchema.account.userId, userId),
            eq(authSchema.account.providerId, 'credential')
          ),
        });

        if (!credentialAccount) {
          app.logger.warn({ userId }, 'No credential account found for user');
          return reply.status(404).send({ error: 'No credential account found for this user' });
        }

        app.logger.info({ userId, accountId: credentialAccount.id }, 'Found credential account');
      } catch (queryError) {
        app.logger.error({ err: queryError, userId }, 'Failed to query credential account');
        return reply.status(500).send({ error: 'Failed to change password' });
      }

      // Update password and clear flag in atomic transaction
      try {
        await app.db.transaction(async (tx) => {
          app.logger.debug({ userId, accountId: credentialAccount.id }, 'Updating account password in transaction');

          const accountUpdateResult = await tx.update(authSchema.account)
            .set({ password: hashedPassword })
            .where(eq(authSchema.account.id, credentialAccount.id))
            .returning();

          if (!accountUpdateResult.length) {
            throw new Error('Failed to update account password - no rows affected');
          }

          app.logger.debug({ userId, accountId: credentialAccount.id }, 'Password updated in account');

          app.logger.debug({ userId }, 'Clearing requirePasswordChange flag in transaction');

          const userUpdateResult = await tx.update(authSchema.user)
            .set({ requirePasswordChange: false })
            .where(eq(authSchema.user.id, userId))
            .returning();

          if (!userUpdateResult.length) {
            throw new Error('Failed to clear requirePasswordChange flag - no rows affected');
          }

          app.logger.debug({ userId }, 'Cleared requirePasswordChange flag');
        });

        app.logger.info({ userId, accountId: credentialAccount.id }, 'Password changed successfully in transaction');
      } catch (transactionError) {
        app.logger.error({ err: transactionError, userId, accountId: credentialAccount.id }, 'Failed to change password in transaction');
        return reply.status(500).send({ error: 'Failed to change password' });
      }

      return reply.status(200).send({ success: true, message: 'Password changed successfully' });

    } catch (error) {
      app.logger.error({ err: error, userId }, 'Unexpected error changing password');
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
