import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as authSchema from '../db/schema/auth-schema.js';
import { resend } from '@specific-dev/framework';
import crypto from 'crypto';

export function registerPasswordResetRoutes(app: App) {
  app.logger.info('Registering password reset routes');

  // ==========================================
  // POST /api/password-reset/request
  // Request password reset token
  // ==========================================
  app.fastify.post('/api/password-reset/request', {
    schema: {
      description: 'Request a password reset token (sends email to user)',
      tags: ['password-reset'],
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
            success: { type: 'boolean' },
          },
        },
        400: {
          description: 'Invalid request',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { email: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const { email } = request.body;
    const normalizedEmail = email.toLowerCase();

    app.logger.info({ email: normalizedEmail }, 'Password reset requested');

    try {
      // Look up user by email (case-insensitive)
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, normalizedEmail),
      });

      if (!user) {
        app.logger.warn({ email: normalizedEmail }, 'Password reset requested for non-existent user (returning success for security)');
        return reply.status(200).send({ success: true });
      }

      app.logger.debug({ userId: user.id, email: normalizedEmail }, 'User found, generating reset token');

      // Generate secure random token (32 bytes, hex encoded)
      const token = crypto.randomBytes(32).toString('hex');
      const verificationId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Delete any existing verification records for this email
      const existingVerifications = await app.db.query.verification.findMany({
        where: eq(authSchema.verification.identifier, normalizedEmail),
      });

      if (existingVerifications.length > 0) {
        app.logger.debug({ email: normalizedEmail, count: existingVerifications.length }, 'Deleting existing verification records');
        for (const verification of existingVerifications) {
          await app.db.delete(authSchema.verification)
            .where(eq(authSchema.verification.id, verification.id));
        }
      }

      // Insert new verification record
      await app.db.insert(authSchema.verification).values({
        id: verificationId,
        identifier: normalizedEmail,
        value: token,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      app.logger.info({ userId: user.id, email: normalizedEmail, verificationId }, 'Verification record created');

      // Send reset email
      resend.emails.send({
        from: 'onboarding@resend.dev',
        to: normalizedEmail,
        subject: 'Redefinição de senha',
        html: `
          <p>Olá, ${user.name}!</p>
          <p>Clique no link abaixo para redefinir sua senha:</p>
          <p><a href="crie-um-aplicativo-m://change-password?token=${token}">Redefinir senha</a></p>
          <p>Este link expira em 1 hora.</p>
          <p>Se você não solicitou a redefinição de senha, ignore este email.</p>
        `,
      });

      app.logger.info({ userId: user.id, email: normalizedEmail }, 'Password reset email sent');

      return reply.status(200).send({ success: true });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      app.logger.error({ err: error, email: normalizedEmail }, 'Password reset request error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ==========================================
  // POST /api/password-reset/confirm
  // Confirm password reset with token and new password
  // ==========================================
  app.fastify.post('/api/password-reset/confirm', {
    schema: {
      description: 'Confirm password reset by providing reset token and new password',
      tags: ['password-reset'],
      body: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token: { type: 'string', description: 'Password reset token from email' },
          newPassword: { type: 'string', description: 'New password (will be hashed)' },
        },
      },
      response: {
        200: {
          description: 'Password reset successful',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        400: {
          description: 'Invalid token, expired token, or other validation error',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { token: string; newPassword: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const { token, newPassword } = request.body;

    app.logger.info({ tokenPrefix: token.substring(0, 8) }, 'Password reset confirmation requested');

    try {
      // Look up verification record by token
      const verification = await app.db.query.verification.findFirst({
        where: eq(authSchema.verification.value, token),
      });

      if (!verification) {
        app.logger.warn({ tokenPrefix: token.substring(0, 8) }, 'Password reset failed - token not found');
        return reply.status(400).send({ error: 'Token inválido ou expirado' });
      }

      // Check if token has expired
      if (new Date() > new Date(verification.expiresAt)) {
        app.logger.warn({ verificationId: verification.id, email: verification.identifier }, 'Token expired, deleting verification record');
        await app.db.delete(authSchema.verification)
          .where(eq(authSchema.verification.id, verification.id));
        return reply.status(400).send({ error: 'Token inválido ou expirado' });
      }

      app.logger.debug({ verificationId: verification.id, email: verification.identifier }, 'Token valid, proceeding with password reset');

      const email = verification.identifier;

      // Look up user by email
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, email),
      });

      if (!user) {
        app.logger.error({ email, verificationId: verification.id }, 'User not found for reset token');
        return reply.status(400).send({ error: 'Usuário não encontrado' });
      }

      app.logger.debug({ userId: user.id, email }, 'User found, hashing new password');

      // Hash new password with bcrypt
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.default.hash(newPassword, 10);

      app.logger.debug({ userId: user.id, email }, 'Password hashed, updating account');

      // Update password in account table
      const updatedAccounts = await app.db.update(authSchema.account)
        .set({ password: hashedPassword })
        .where(
          eq(authSchema.account.userId, user.id) &&
          eq(authSchema.account.providerId, 'credential')
        );

      app.logger.info({ userId: user.id, email }, 'Password updated successfully');

      // Delete verification record
      await app.db.delete(authSchema.verification)
        .where(eq(authSchema.verification.id, verification.id));

      app.logger.info({ userId: user.id, email, verificationId: verification.id }, 'Verification record deleted');

      return reply.status(200).send({ success: true });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      app.logger.error({ err: error, tokenPrefix: token.substring(0, 8) }, 'Password reset confirmation error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.logger.info('Password reset routes configured');
}
