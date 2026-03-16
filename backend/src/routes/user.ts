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
          },
        },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { newPassword: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { newPassword } = request.body;
    const userId = session.user.id;

    app.logger.info({ userId }, 'Password change request received');

    try {
      // Hash newPassword using Better Auth's internal password hashing utility
      // This ensures the hash format is compatible with Better Auth's sign-in verification
      let hashedNewPassword: string;

      // Try to access Better Auth's password utility from the auth instance
      if ((app as any).auth?.password?.hash) {
        hashedNewPassword = await (app as any).auth.password.hash(newPassword);
        app.logger.info({ userId }, 'Password hashed using Better Auth internal utility');
      } else if ((app as any).betterAuth?.password?.hash) {
        hashedNewPassword = await (app as any).betterAuth.password.hash(newPassword);
        app.logger.info({ userId }, 'Password hashed using Better Auth internal utility');
      } else {
        // Fallback: use bcrypt with same configuration as Better Auth
        // Better Auth's credential provider uses bcrypt with 10 salt rounds
        hashedNewPassword = await bcrypt.hash(newPassword, 10);
        app.logger.warn({ userId }, 'Using fallback bcrypt hashing (Better Auth utility not accessible)');
      }

      // Update account password and updated_at timestamp
      await app.db.update(authSchema.account)
        .set({ password: hashedNewPassword, updatedAt: new Date() })
        .where(and(
          eq(authSchema.account.providerId, 'credential'),
          eq(authSchema.account.userId, userId)
        ));

      app.logger.info({ userId }, 'Account password updated in database');

      // Clear requirePasswordChange flag and update user timestamp
      await app.db.update(authSchema.user)
        .set({ requirePasswordChange: false, updatedAt: new Date() })
        .where(eq(authSchema.user.id, userId));

      app.logger.info({ userId }, 'User requirePasswordChange flag cleared');

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
