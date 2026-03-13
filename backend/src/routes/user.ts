import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
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

  // POST /api/user/change-password - Change user password
  app.fastify.post('/api/user/change-password', {
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
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { currentPassword: string; newPassword: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { currentPassword, newPassword } = request.body;
    const userId = session.user.id;

    app.logger.info({ userId }, 'Attempting to change password');

    // Validate newPassword length
    if (!newPassword || newPassword.length < 6) {
      app.logger.warn({ userId }, 'New password too short');
      return reply.status(400).send({ error: 'New password must be at least 6 characters' });
    }

    try {
      // Step 1: Find user's credential account
      const account = await app.db.query.account.findFirst({
        where: eq(authSchema.account.userId, userId),
      });

      if (!account || !account.password) {
        app.logger.error({ userId }, 'Account or password not found');
        return reply.status(400).send({ error: 'Account not found or password not set' });
      }

      // Step 2: Verify current password
      const passwordMatches = await bcrypt.compare(currentPassword, account.password);
      if (!passwordMatches) {
        app.logger.warn({ userId }, 'Current password incorrect');
        return reply.status(400).send({ error: 'Current password is incorrect' });
      }

      // Step 3: Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Step 4: Update account password
      await app.db.update(authSchema.account)
        .set({ password: hashedNewPassword })
        .where(eq(authSchema.account.id, account.id));

      app.logger.info({ userId }, 'Account password updated');

      // Step 5: Clear requirePasswordChange flag
      await app.db.update(authSchema.user)
        .set({ requirePasswordChange: false })
        .where(eq(authSchema.user.id, userId));

      app.logger.info({ userId }, 'Password changed successfully and requirePasswordChange flag cleared');

      return reply.status(200).send({
        success: true,
        message: 'Password changed successfully',
      });

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
