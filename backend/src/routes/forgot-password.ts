import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as authSchema from '../db/schema/auth-schema.js';
import { resend } from '@specific-dev/framework';
import crypto from 'crypto';

export function registerForgotPasswordRoutes(app: App) {
  app.logger.info('Registering password management routes');

  // ==========================================
  // POST /api/password/forgot-password
  // Public endpoint - request password reset token
  // ==========================================
  app.fastify.post('/api/password/forgot-password', {
    schema: {
      description: 'Request a password reset token (sends email to user)',
      tags: ['password'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', description: 'User email address' },
        },
      },
      response: {
        200: {
          description: 'Password reset request processed (returns success regardless of whether user exists)',
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        400: {
          description: 'Invalid request',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { email?: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const { email } = request.body;

    if (!email) {
      app.logger.warn('Forgot password requested without email');
      return reply.status(400).send({ error: 'email is required' });
    }

    const normalizedEmail = email.toLowerCase();

    app.logger.info({ email: normalizedEmail }, 'Forgot password requested');

    try {
      // Look up user by email (case-insensitive)
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, normalizedEmail),
      });

      if (!user) {
        app.logger.warn({ email: normalizedEmail }, 'Forgot password requested for non-existent user (returning success for security)');
        return reply.status(200).send({ message: 'If this email is registered, a reset link has been sent.' });
      }

      app.logger.debug({ userId: user.id, email: normalizedEmail }, 'User found, generating reset token');

      // Generate secure random token (32 bytes, hex encoded)
      const token = crypto.randomBytes(32).toString('hex');
      const verificationId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Delete any existing password-reset verification records for this email
      const existingVerifications = await app.db.query.verification.findMany({
        where: eq(authSchema.verification.identifier, `password-reset:${normalizedEmail}`),
      });

      if (existingVerifications.length > 0) {
        app.logger.debug({ email: normalizedEmail, count: existingVerifications.length }, 'Deleting existing password-reset verification records');
        for (const verification of existingVerifications) {
          await app.db.delete(authSchema.verification)
            .where(eq(authSchema.verification.id, verification.id));
        }
      }

      // Insert new verification record
      await app.db.insert(authSchema.verification).values({
        id: verificationId,
        identifier: `password-reset:${normalizedEmail}`,
        value: token,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      app.logger.info({ userId: user.id, email: normalizedEmail, verificationId }, 'Password reset verification record created');

      // Send reset email
      const resetLink = `crie-um-aplicativo-m://reset-password?token=${token}`;
      const name = user.name;
      const html = `<p>Olá, ${name}!</p><p>Clique no link abaixo para redefinir sua senha:</p><p><a href="${resetLink}">${resetLink}</a></p>`;
      const text = `Acesse o link para redefinir sua senha: ${resetLink}`;

      resend.emails.send({
        from: 'onboarding@resend.dev',
        to: normalizedEmail,
        subject: 'Redefinição de senha',
        html,
        text,
      });

      app.logger.info({ userId: user.id, email: normalizedEmail }, 'Password reset email sent');

      return reply.status(200).send({ message: 'If this email is registered, a reset link has been sent.' });
    } catch (error: unknown) {
      app.logger.error({ err: error, email: normalizedEmail }, 'Forgot password request error');
      return reply.status(200).send({ message: 'If this email is registered, a reset link has been sent.' });
    }
  });

  // ==========================================
  // POST /api/password/change-password
  // Supports two flows: token-based reset (unauthenticated) and authenticated password change
  // ==========================================
  app.fastify.post('/api/password/change-password', {
    schema: {
      description: 'Change password via token (unauthenticated) or when authenticated',
      tags: ['password'],
      body: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'Password reset token (for token-based flow)' },
          newPassword: { type: 'string', description: 'New password' },
        },
      },
      response: {
        200: {
          description: 'Password changed successfully',
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        400: {
          description: 'Validation error or invalid token',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { token?: string; newPassword?: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const { token, newPassword } = request.body;

    app.logger.info('Change password requested');

    try {
      const bcrypt = await import('bcryptjs');

      // Check if newPassword is provided and valid
      if (!newPassword) {
        app.logger.warn('Missing newPassword');
        return reply.status(400).send({ error: 'newPassword is required' });
      }

      if (newPassword.length < 6) {
        app.logger.warn('newPassword too short');
        return reply.status(400).send({ error: 'Password must be at least 6 characters' });
      }

      // Flow A: Token-based reset (unauthenticated)
      if (token) {
        app.logger.debug({ tokenPrefix: token.substring(0, 8) }, 'Processing token-based password reset');

        // Look up verification record by token
        const verification = await app.db.query.verification.findFirst({
          where: eq(authSchema.verification.value, token),
        });

        if (!verification) {
          app.logger.warn({ tokenPrefix: token.substring(0, 8) }, 'Token not found');
          return reply.status(400).send({ error: 'Invalid or expired token' });
        }

        // Check if token has expired
        if (new Date() > new Date(verification.expiresAt)) {
          app.logger.warn({ verificationId: verification.id }, 'Token expired');
          await app.db.delete(authSchema.verification)
            .where(eq(authSchema.verification.id, verification.id));
          return reply.status(400).send({ error: 'Invalid or expired token' });
        }

        // Verify identifier format (should be "password-reset:email")
        if (!verification.identifier.startsWith('password-reset:')) {
          app.logger.warn({ verificationId: verification.id }, 'Invalid verification identifier format');
          return reply.status(400).send({ error: 'Invalid or expired token' });
        }

        const email = verification.identifier.substring('password-reset:'.length);
        app.logger.debug({ email }, 'Extracted email from verification identifier');

        // Look up user by email
        const user = await app.db.query.user.findFirst({
          where: eq(authSchema.user.email, email),
        });

        if (!user) {
          app.logger.error({ email, verificationId: verification.id }, 'User not found for reset token');
          return reply.status(400).send({ error: 'User not found' });
        }

        app.logger.debug({ userId: user.id, email }, 'User found, hashing new password');

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        app.logger.debug({ userId: user.id, email }, 'Password hashed, updating account');

        // Update password in account table
        await app.db.update(authSchema.account)
          .set({ password: hashedPassword })
          .where(
            and(
              eq(authSchema.account.userId, user.id),
              eq(authSchema.account.providerId, 'credential')
            )
          );

        app.logger.info({ userId: user.id, email }, 'Password updated via token');

        // Delete verification record
        await app.db.delete(authSchema.verification)
          .where(eq(authSchema.verification.id, verification.id));

        app.logger.info({ userId: user.id, email, verificationId: verification.id }, 'Verification record deleted');

        return reply.status(200).send({ message: 'Password changed successfully' });
      }

      // Flow B: Authenticated password change (no token provided)
      app.logger.debug('Processing authenticated password change');

      // Get authenticated user
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        app.logger.warn('Change password - no authorization header');
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const sessionToken = authHeader.slice(7);

      const session = await app.db.query.session.findFirst({
        where: eq(authSchema.session.token, sessionToken),
      });

      if (!session) {
        app.logger.warn({ tokenPrefix: sessionToken.substring(0, 8) }, 'Session not found for token');
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Verify session is not expired
      if (new Date() > new Date(session.expiresAt)) {
        app.logger.warn({ sessionId: session.id }, 'Session expired');
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const userId = session.userId;

      // Look up user
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, userId),
      });

      if (!user) {
        app.logger.error({ userId }, 'User not found for session');
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      app.logger.debug({ userId, email: user.email }, 'User found, hashing new password');

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      app.logger.debug({ userId }, 'New password hashed, updating account');

      // Update account with new password
      await app.db.update(authSchema.account)
        .set({ password: hashedPassword })
        .where(
          and(
            eq(authSchema.account.userId, userId),
            eq(authSchema.account.providerId, 'credential')
          )
        );

      app.logger.info({ userId, email: user.email }, 'Password changed successfully via authenticated flow');

      return reply.status(200).send({ message: 'Password changed successfully' });
    } catch (error: unknown) {
      app.logger.error({ err: error }, 'Change password error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.logger.info('Password management routes configured');
}
