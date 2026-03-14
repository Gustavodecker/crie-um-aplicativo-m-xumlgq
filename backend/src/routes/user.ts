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
            success: { type: 'boolean' },
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
      return reply.status(400).send({ error: 'newPassword is required and must be at least 6 characters' });
    }

    try {
      // Use Better Auth's change-password endpoint to handle password verification and hashing
      // This ensures password operations use the same system as registration and sign-in
      app.logger.info({ userId }, 'Attempting password change via Better Auth');

      const changePasswordResponse = await app.fastify.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        payload: {
          currentPassword,
          newPassword,
          revokeOtherSessions: false,
        },
        headers: request.headers,
      });

      if (changePasswordResponse.statusCode !== 200) {
        const errorData = changePasswordResponse.json() as { error?: { message?: string }; message?: string };
        const errorMessage = errorData.error?.message || errorData.message || '';

        app.logger.warn(
          { userId, status: changePasswordResponse.statusCode, errorMessage },
          'Better Auth password change rejected'
        );

        if (changePasswordResponse.statusCode === 400) {
          return reply.status(400).send({ error: 'Invalid current password' });
        }

        return reply.status(400).send({ error: 'Password change failed' });
      }

      app.logger.info({ userId }, 'Password changed successfully via Better Auth');

      // Step 2: Clear requirePasswordChange flag
      await app.db.update(authSchema.user)
        .set({ requirePasswordChange: false })
        .where(eq(authSchema.user.id, userId));

      app.logger.info({ userId }, 'requirePasswordChange flag cleared');

      return reply.status(200).send({ success: true });

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
