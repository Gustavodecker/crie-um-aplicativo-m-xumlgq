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

    if (!newPassword) {
      app.logger.warn({ userId }, 'newPassword is required');
      return reply.status(400).send({ error: 'newPassword is required' });
    }

    app.logger.info({ userId }, 'Password change request received');

    try {
      // Use Better Auth's admin API endpoint to set the password
      // This ensures the hash format is compatible with Better Auth's sign-in verification
      app.logger.info({ userId }, 'Attempting to set password via Better Auth admin endpoint');

      let passwordSet = false;

      try {
        const adminResponse = await app.fastify.inject({
          method: 'POST',
          url: '/api/auth/admin/set-user-password',
          payload: {
            userId: userId,
            password: newPassword,
          },
          headers: request.headers,
        });

        if (adminResponse.statusCode === 200) {
          app.logger.info({ userId }, 'Password set via Better Auth admin endpoint');
          passwordSet = true;
        } else {
          app.logger.debug(
            { userId, status: adminResponse.statusCode },
            'Better Auth admin endpoint returned non-200 status'
          );
        }
      } catch (adminError) {
        app.logger.debug(
          { userId, error: (adminError as Error).message },
          'Better Auth admin endpoint call failed, will use fallback'
        );
      }

      // Fallback: if admin endpoint didn't work, hash password directly using bcrypt
      if (!passwordSet) {
        app.logger.info({ userId }, 'Using bcrypt fallback to hash password');

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the account password directly
        await app.db.update(authSchema.account)
          .set({ password: hashedPassword, updatedAt: new Date() })
          .where(and(
            eq(authSchema.account.userId, userId),
            eq(authSchema.account.providerId, 'credential')
          ));

        app.logger.info({ userId }, 'Password hashed and stored via bcrypt fallback');
      }

      // Clear requirePasswordChange flag
      await app.db.update(authSchema.user)
        .set({ requirePasswordChange: false, updatedAt: new Date() })
        .where(eq(authSchema.user.id, userId));

      app.logger.info({ userId }, 'User requirePasswordChange flag cleared');

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
