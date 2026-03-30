import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as authSchema from '../db/schema/auth-schema.js';
import { resend } from '@specific-dev/framework';
import crypto from 'crypto';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(bytes[i] % chars.length);
  }
  return password;
}

export function registerForgotPasswordRoutes(app: App) {
  app.logger.info('Registering password management routes');

  // ==========================================
  // POST /api/password/forgot-password
  // Public endpoint - generate and send temporary password
  // ==========================================
  app.fastify.post('/api/password/forgot-password', {
    schema: {
      description: 'Generate and send a temporary password',
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
          description: 'Temporary password generated (returns success regardless of whether user exists)',
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

      console.log('[forgot-password] user.id:', user?.id);

      if (!user) {
        app.logger.warn({ email: normalizedEmail }, 'Forgot password requested for non-existent user (returning success for security)');
        return reply.status(200).send({ message: 'If this email exists, a temporary password was sent.' });
      }

      app.logger.debug({ userId: user.id, email: normalizedEmail }, 'User found, verifying credential account exists');

      // Verify credential account exists
      const credentialAccount = await app.db.query.account.findFirst({
        where: and(
          eq(authSchema.account.userId, user.id),
          eq(authSchema.account.providerId, 'credential')
        ),
      });

      console.log('[forgot-password] account.id:', credentialAccount?.id, 'providerId:', credentialAccount?.providerId);

      if (!credentialAccount) {
        app.logger.error({ userId: user.id, email: normalizedEmail }, 'Credential account not found for user');
        return reply.status(200).send({ message: 'If this email exists, a temporary password was sent.' });
      }

      app.logger.debug({ userId: user.id, accountId: credentialAccount.id }, 'Credential account found, generating temporary password');

      // Generate temporary password (8 chars: uppercase + digits)
      const tempPassword = generateTempPassword();

      // Hash password using bcryptjs (same library Better Auth uses internally)
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      console.log('[forgot-password] hash prefix:', hashedPassword?.substring(0, 7));

      app.logger.debug({ userId: user.id, email: normalizedEmail, hashPrefix: hashedPassword.substring(0, 7) }, 'Temporary password hashed, updating account with new hash');

      // Update password in account table where id matches
      const updateAccountResult = await app.db.update(authSchema.account)
        .set({ password: hashedPassword })
        .where(eq(authSchema.account.id, credentialAccount.id));

      console.log('[forgot-password] rows updated:', (updateAccountResult as any)?.rowCount || 1);

      // Verify the hash was stored correctly by querying it back
      const storedAccount = await app.db.query.account.findFirst({
        where: eq(authSchema.account.id, credentialAccount.id),
      });

      if (storedAccount?.password) {
        app.logger.info({
          email: normalizedEmail,
          hash20: storedAccount.password.substring(0, 20),
          hashLength: storedAccount.password.length,
          isValidBcryptFormat: storedAccount.password.startsWith('$2')
        }, 'Stored temp password hash prefix (first 20 chars)');
      }

      app.logger.debug({ userId: user.id, email: normalizedEmail, accountId: credentialAccount.id }, 'Account password updated, setting must_change_password flags');

      // Update user table - set must_change_password, temp_password_expires_at to 24 hours from now, and updated_at
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const updateUserResult = await app.db.update(authSchema.user)
        .set({
          mustChangePassword: true,
          tempPasswordExpiresAt: expiresAt,
        })
        .where(eq(authSchema.user.id, user.id));

      app.logger.info({ userId: user.id, email: normalizedEmail }, 'User flags updated, sending email');

      // Build HTML email using string concatenation
      const userName = user.name || 'User';
      const htmlBody =
        "<div style='font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;'>" +
        "<h2 style='color: #333;'>Olá, " + userName + "!</h2>" +
        "<p>Recebemos uma solicitação de recuperação de senha para sua conta no <strong>Consulta Bebê</strong>.</p>" +
        "<p>Sua senha provisória é:</p>" +
        "<div style='background: #f5f5f5; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;'>" +
        "<span style='font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #333;'>" + tempPassword + "</span>" +
        "</div>" +
        "<p>Use essa senha para fazer login no app.</p>" +
        "<p><strong>No primeiro acesso, você será obrigado a criar uma nova senha.</strong></p>" +
        "<p style='color: #666; font-size: 12px;'>Se você não solicitou a recuperação de senha, ignore este email.</p>" +
        "</div>";

      // Build text email using string concatenation
      const textBody =
        "Olá, " + userName + "!\n\n" +
        "Sua senha provisória para o Consulta Bebê é: " + tempPassword + "\n\n" +
        "Use essa senha para fazer login. No primeiro acesso, você será obrigado a criar uma nova senha.\n\n" +
        "Se você não solicitou isso, ignore este email.";

      resend.emails.send({
        from: 'onboarding@resend.dev',
        to: normalizedEmail,
        subject: 'Sua senha provisória - Consulta Bebê',
        html: htmlBody,
        text: textBody,
      });

      app.logger.info({ email: normalizedEmail }, 'Temporary password generated and sent to: ' + normalizedEmail);

      return reply.status(200).send({ message: 'If this email exists, a temporary password was sent.' });
    } catch (error: unknown) {
      app.logger.error({ err: error, email: normalizedEmail }, 'Forgot password request error');
      return reply.status(200).send({ message: 'If this email exists, a temporary password was sent.' });
    }
  });

  // ==========================================
  // POST /api/password/change-password
  // Protected endpoint - change password
  // ==========================================
  app.fastify.post('/api/password/change-password', {
    schema: {
      description: 'Change password (requires authentication)',
      tags: ['password'],
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
    request: FastifyRequest<{ Body: { newPassword?: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const { newPassword } = request.body;

    app.logger.info('Change password requested');

    try {
      // Check if newPassword is provided
      if (!newPassword) {
        app.logger.warn('Missing newPassword');
        return reply.status(400).send({ error: 'newPassword is required' });
      }

      // Validate password length
      if (newPassword.length < 6) {
        app.logger.warn('newPassword too short');
        return reply.status(400).send({ error: 'A senha deve ter pelo menos 6 caracteres' });
      }

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

      app.logger.debug({ userId }, 'Account updated, clearing must_change_password flags');

      // Update user table - clear both must_change_password and require_password_change flags
      await app.db.update(authSchema.user)
        .set({
          mustChangePassword: false,
          requirePasswordChange: false,
          tempPasswordExpiresAt: null,
        })
        .where(eq(authSchema.user.id, userId));

      app.logger.info({ userId, email: user.email }, 'Password changed successfully');

      return reply.status(200).send({ message: 'Password changed successfully' });
    } catch (error: unknown) {
      app.logger.error({ err: error }, 'Change password error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ==========================================
  // POST /api/password/login-check
  // Protected endpoint - check if password change is required
  // ==========================================
  app.fastify.post('/api/password/login-check', {
    schema: {
      description: 'Check if password change is required after login (requires authentication)',
      tags: ['password'],
      response: {
        200: {
          description: 'Login check successful',
          type: 'object',
          properties: {
            mustChangePassword: { type: 'boolean' },
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
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    app.logger.info('Login check requested');

    try {
      // Get authenticated user
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        app.logger.warn('Login check - no authorization header');
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const sessionToken = authHeader.slice(7);

      try {
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

        // Read mustChangePassword flag defensively, defaulting to false on any error
        let mustChangePassword = false;
        try {
          mustChangePassword = user.mustChangePassword ?? false;
        } catch (flagError: unknown) {
          app.logger.warn({ userId, err: flagError }, 'Error reading mustChangePassword flag, defaulting to false');
          mustChangePassword = false;
        }

        app.logger.debug({ userId, mustChangePassword }, 'Login check - checking password change status');

        app.logger.info({ userId, mustChangePassword }, 'Login check - password change status');
        return reply.status(200).send({ mustChangePassword });
      } catch (sessionError: unknown) {
        app.logger.error({ err: sessionError }, 'Error checking session');
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    } catch (error: unknown) {
      app.logger.error({ err: error }, 'Login check error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.logger.info('Password management routes configured');
}
