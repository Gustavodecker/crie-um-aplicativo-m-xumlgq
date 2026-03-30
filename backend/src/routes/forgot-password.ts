import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as authSchema from '../db/schema/auth-schema.js';
import { resend } from '@specific-dev/framework';
import crypto from 'crypto';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export function registerForgotPasswordRoutes(app: App) {
  app.logger.info('Registering forgot password routes');

  // ==========================================
  // POST /api/forgot-password
  // Public endpoint - request temporary password
  // ==========================================
  app.fastify.post('/api/forgot-password', {
    schema: {
      description: 'Request a temporary password (sends email to user)',
      tags: ['forgot-password'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', description: 'User email address' },
        },
      },
      response: {
        200: {
          description: 'Temporary password request processed (returns success regardless of whether user exists)',
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
    request: FastifyRequest<{ Body: { email: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const { email } = request.body;
    const normalizedEmail = email.toLowerCase();

    app.logger.info({ email: normalizedEmail }, 'Forgot password requested');

    try {
      // Look up user by email (case-insensitive)
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, normalizedEmail),
      });

      if (!user) {
        app.logger.warn({ email: normalizedEmail }, 'Forgot password requested for non-existent user (returning success for security)');
        return reply.status(200).send({ message: 'Se o email estiver cadastrado, você receberá uma nova senha por email' });
      }

      app.logger.debug({ userId: user.id, email: normalizedEmail }, 'User found, generating temporary password');

      // Generate temporary password
      const tempPassword = generateTempPassword();

      // Hash password with bcryptjs
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      app.logger.debug({ userId: user.id, email: normalizedEmail }, 'Temporary password hashed, updating account');

      // Update password in account table
      await app.db.update(authSchema.account)
        .set({ password: hashedPassword })
        .where(
          and(
            eq(authSchema.account.userId, user.id),
            eq(authSchema.account.providerId, 'credential')
          )
        );

      app.logger.debug({ userId: user.id, email: normalizedEmail }, 'Password updated, setting must_change_password flag');

      // Calculate expiration time (30 minutes from now)
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      // Update user table
      await app.db.update(authSchema.user)
        .set({
          mustChangePassword: true,
          tempPasswordExpiresAt: expiresAt,
        })
        .where(eq(authSchema.user.id, user.id));

      app.logger.info({ userId: user.id, email: normalizedEmail }, 'User flags updated, sending email');

      // Send email
      const html = `
        <p>Olá, ${user.name}!</p>
        <p><strong>Consulta Bebê</strong></p>
        <p>Sua nova senha provisória é:</p>
        <p style="font-size: 18px; font-weight: bold; color: #6B4CE6;">${tempPassword}</p>
        <p>Use esta senha para fazer login. Você será obrigado a criar uma nova senha no primeiro acesso.</p>
        <p style="color: #999; font-size: 12px;">⚠️ Segurança: Esta senha expira em 30 minutos.</p>
      `;
      const text = `Olá, ${user.name}!\n\nSua nova senha provisória é: ${tempPassword}\n\nUse esta senha para fazer login. Você será obrigado a criar uma nova senha no primeiro acesso.\n\nSegurança: Esta senha expira em 30 minutos.`;

      resend.emails.send({
        from: 'onboarding@resend.dev',
        to: normalizedEmail,
        subject: 'Sua nova senha provisória',
        html,
        text,
      });

      app.logger.info({ userId: user.id, email: normalizedEmail }, 'Temporary password email sent');

      return reply.status(200).send({ message: 'Se o email estiver cadastrado, você receberá uma nova senha por email' });
    } catch (error: unknown) {
      app.logger.error({ err: error, email: normalizedEmail }, 'Forgot password request error');
      return reply.status(200).send({ message: 'Se o email estiver cadastrado, você receberá uma nova senha por email' });
    }
  });

  // ==========================================
  // POST /api/change-password
  // Protected endpoint - change password after receiving temporary password
  // ==========================================
  app.fastify.post('/api/change-password', {
    schema: {
      description: 'Change password (requires authentication)',
      tags: ['forgot-password'],
      body: {
        type: 'object',
        required: ['newPassword'],
        properties: {
          newPassword: { type: 'string', description: 'New password (minimum 6 characters)' },
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
          description: 'Validation error',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { newPassword: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const { newPassword } = request.body;

    app.logger.info('Change password requested');

    try {
      // Get authenticated user
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        app.logger.warn('Change password - no authorization header');
        return reply.status(401).send({ error: 'unauthorized', message: 'Token inválido ou expirado' });
      }

      const token = authHeader.slice(7);

      const session = await app.db.query.session.findFirst({
        where: eq(authSchema.session.token, token),
      });

      if (!session) {
        app.logger.warn({ tokenPrefix: token.substring(0, 8) }, 'Session not found for token');
        return reply.status(401).send({ error: 'unauthorized', message: 'Token inválido ou expirado' });
      }

      // Verify session is not expired
      if (new Date() > new Date(session.expiresAt)) {
        app.logger.warn({ sessionId: session.id }, 'Session expired');
        return reply.status(401).send({ error: 'unauthorized', message: 'Token inválido ou expirado' });
      }

      const userId = session.userId;

      // Look up user
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, userId),
      });

      if (!user) {
        app.logger.error({ userId }, 'User not found for session');
        return reply.status(401).send({ error: 'unauthorized', message: 'Token inválido ou expirado' });
      }

      // Validate password length
      if (!newPassword || newPassword.length < 6) {
        app.logger.warn({ userId }, 'Invalid password length');
        return reply.status(400).send({ error: 'validation_error', message: 'A senha deve ter pelo menos 6 caracteres' });
      }

      app.logger.debug({ userId }, 'Password validation passed, hashing new password');

      // Hash new password
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      app.logger.debug({ userId }, 'Password hashed, updating account');

      // Update account table
      await app.db.update(authSchema.account)
        .set({ password: hashedPassword })
        .where(
          and(
            eq(authSchema.account.userId, userId),
            eq(authSchema.account.providerId, 'credential')
          )
        );

      app.logger.debug({ userId }, 'Account updated, clearing must_change_password flag');

      // Update user table
      await app.db.update(authSchema.user)
        .set({
          mustChangePassword: false,
          tempPasswordExpiresAt: null,
        })
        .where(eq(authSchema.user.id, userId));

      app.logger.info({ userId, email: user.email }, 'Password changed successfully');

      return reply.status(200).send({ message: 'Senha alterada com sucesso' });
    } catch (error: unknown) {
      app.logger.error({ err: error }, 'Change password error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ==========================================
  // POST /api/login-check
  // Protected endpoint - check if password change is required
  // ==========================================
  app.fastify.post('/api/login-check', {
    schema: {
      description: 'Check if password change is required after login (requires authentication)',
      tags: ['forgot-password'],
      response: {
        200: {
          description: 'Login check successful',
          type: 'object',
          properties: {
            mustChangePassword: { type: 'boolean' },
            userId: { type: 'string' },
          },
        },
        401: {
          description: 'Unauthorized or temporary password expired',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    app.logger.info('Login check requested');

    try {
      // Get authenticated user
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        app.logger.warn('Login check - no authorization header');
        return reply.status(401).send({ error: 'unauthorized', message: 'Token inválido ou expirado' });
      }

      const token = authHeader.slice(7);

      const session = await app.db.query.session.findFirst({
        where: eq(authSchema.session.token, token),
      });

      if (!session) {
        app.logger.warn({ tokenPrefix: token.substring(0, 8) }, 'Session not found for token');
        return reply.status(401).send({ error: 'unauthorized', message: 'Token inválido ou expirado' });
      }

      // Verify session is not expired
      if (new Date() > new Date(session.expiresAt)) {
        app.logger.warn({ sessionId: session.id }, 'Session expired');
        return reply.status(401).send({ error: 'unauthorized', message: 'Token inválido ou expirado' });
      }

      const userId = session.userId;

      // Look up user
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, userId),
      });

      if (!user) {
        app.logger.error({ userId }, 'User not found for session');
        return reply.status(401).send({ error: 'unauthorized', message: 'Token inválido ou expirado' });
      }

      app.logger.debug({ userId, mustChangePassword: user.mustChangePassword }, 'Login check - checking password change status');

      // Check if must change password
      if (user.mustChangePassword) {
        // Check if temporary password has expired
        if (user.tempPasswordExpiresAt && new Date() > new Date(user.tempPasswordExpiresAt)) {
          app.logger.warn({ userId, expiresAt: user.tempPasswordExpiresAt }, 'Temporary password expired');
          return reply.status(401).send({ error: 'temp_password_expired', message: 'Sua senha provisória expirou. Solicite uma nova.' });
        }

        app.logger.info({ userId }, 'Login check - password change required');
        return reply.status(200).send({ mustChangePassword: true, userId });
      }

      app.logger.info({ userId }, 'Login check - no password change required');
      return reply.status(200).send({ mustChangePassword: false, userId });
    } catch (error: unknown) {
      app.logger.error({ err: error }, 'Login check error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.logger.info('Forgot password routes configured');
}
