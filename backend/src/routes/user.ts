import type { App } from '../index.js';
import { createCustomRequireAuth } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as authSchema from '../db/schema/auth-schema.js';

/**
 * User Routes
 *
 * POST /api/user/set-password - Set user password (no current password required)
 *   - Requires authentication
 *   - Sets new password and clears requirePasswordChange flag
 */

export function registerUserRoutes(app: App) {
  const requireAuth = createCustomRequireAuth(app);

  // POST /api/user/set-password - Set user password without verification
  app.fastify.post('/api/user/set-password', {
    schema: {
      description: 'Set user password',
      tags: ['user'],
      body: {
        type: 'object',
        required: ['newPassword'],
        properties: {
          newPassword: { type: 'string', description: 'New password', minLength: 6 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
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

    // Validate password
    if (!newPassword || (typeof newPassword === 'string' && newPassword.trim().length === 0)) {
      app.logger.warn({ userId }, 'newPassword is required or empty');
      return reply.status(400).send({ error: 'newPassword is required' });
    }

    if (newPassword.length < 6) {
      app.logger.warn({ userId }, 'newPassword is too short');
      return reply.status(400).send({ error: 'newPassword must be at least 6 characters' });
    }

    app.logger.info({ userId }, 'Password set request received');

    try {
      // Find the credential account
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
          return reply.status(500).send({ error: 'Internal server error' });
        }

        app.logger.info({ userId, accountId: credentialAccount.id }, 'Found credential account');
      } catch (queryError) {
        app.logger.error({ err: queryError, userId }, 'Failed to query credential account');
        return reply.status(500).send({ error: 'Internal server error' });
      }

      // Hash the new password using bcryptjs
      app.logger.info({ userId }, 'Hashing new password using bcryptjs');

      let hashedPassword: string;

      try {
        const bcrypt = await import('bcryptjs');
        hashedPassword = await bcrypt.hash(newPassword, 10);
        app.logger.info({ userId, hashLength: hashedPassword.length }, 'New password hashed successfully');
      } catch (hashError) {
        app.logger.error({ err: hashError, userId, errorMsg: (hashError as Error).message }, 'Failed to hash new password');
        return reply.status(500).send({ error: 'Internal server error' });
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

        app.logger.info({ userId, accountId: credentialAccount.id }, 'Password set successfully in transaction');
      } catch (transactionError) {
        app.logger.error({ err: transactionError, userId, accountId: credentialAccount.id }, 'Failed to set password in transaction');
        return reply.status(500).send({ error: 'Internal server error' });
      }

      return reply.status(200).send({ success: true });

    } catch (error) {
      app.logger.error({ err: error, userId }, 'Unexpected error setting password');
      return reply.status(500).send({ error: 'Internal server error' });
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
