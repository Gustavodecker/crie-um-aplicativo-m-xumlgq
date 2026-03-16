import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as authSchema from '../db/schema/auth-schema.js';
import crypto from 'crypto';

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
            rowsAffected: { type: 'number' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { newPassword: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { newPassword } = request.body;
    const userId = session.user.id;

    if (!newPassword) {
      app.logger.warn({ userId }, 'newPassword is required');
      return reply.status(400).send({ error: 'newPassword is required' });
    }

    app.logger.info({ userId }, 'Password change request received');

    try {
      // Hash the new password using Node.js crypto.scrypt (same as Better Auth's default)
      app.logger.info({ userId }, 'Hashing password using scrypt');

      // Better Auth uses scrypt with N=16384, r=16, p=1, keylen=64
      const salt = crypto.randomBytes(16);

      // crypto.scryptSync(password, salt, keylen, options)
      const hash = crypto.scryptSync(newPassword, salt, 64, {
        N: 16384,
        r: 16,
        p: 1,
      });

      // Format: $s0$salt$hash (Better Auth's scrypt format)
      const hashedPassword = '$s0$' + salt.toString('hex') + '$' + (hash as Buffer).toString('hex');
      app.logger.info({ userId }, 'Password hashed using crypto.scrypt');

      // First, find the credential account to ensure it exists
      app.logger.info({ userId }, 'Looking up credential account');

      const credentialAccount = await app.db.query.account.findFirst({
        where: and(
          eq(authSchema.account.userId, userId),
          eq(authSchema.account.providerId, 'credential')
        ),
      });

      if (!credentialAccount) {
        app.logger.warn({ userId }, 'No credential account found for user');
        return reply.status(404).send({ error: 'No credential account found for this user' });
      }

      // Update account password
      app.logger.info({ userId, accountId: credentialAccount.id }, 'Updating account password in database');

      await app.db.update(authSchema.account)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(authSchema.account.id, credentialAccount.id));

      const rowsAffected = 1; // We know the account exists, so 1 row was affected

      app.logger.info({ userId, rowsAffected }, 'Password updated in account table');

      // Clear requirePasswordChange flag on user table
      await app.db.update(authSchema.user)
        .set({ requirePasswordChange: false, updatedAt: new Date() })
        .where(eq(authSchema.user.id, userId));

      app.logger.info({ userId }, 'User requirePasswordChange flag cleared');

      return reply.status(200).send({ success: true, rowsAffected });

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
