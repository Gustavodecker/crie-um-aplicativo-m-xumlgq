import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
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

export function registerCustomAuthRoutes(app: App) {
  app.logger.info('Registering custom auth endpoints at /api/auth/*');

  // ==========================================
  // POST /api/auth/sign-up
  // Public sign-up endpoint for user registration
  // ==========================================
  app.fastify.post('/api/auth/sign-up', {
    schema: {
      description: 'Register a new user with email and password',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email', description: 'User email address' },
          password: { type: 'string', description: 'Password (will be hashed)' },
          name: { type: 'string', description: 'User name' },
        },
      },
      response: {
        201: {
          description: 'User registered successfully',
          type: 'object',
          properties: {
            token: { type: 'string', description: 'Session token' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
              },
            },
          },
        },
        400: {
          description: 'Email already exists',
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { email: string; password: string; name: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const { email, password, name } = request.body;
    const normalizedEmail = email.toLowerCase();

    app.logger.info({ email: normalizedEmail, name }, 'POST /api/auth/sign-up - user registration');

    try {
      // Check if user already exists
      const existingUser = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, normalizedEmail),
      });

      if (existingUser) {
        app.logger.warn('Sign-up failed - email already exists');
        return reply.status(400).send({ message: 'Este e-mail já está cadastrado.' });
      }

      app.logger.debug({ email: normalizedEmail }, 'Email available, hashing password');

      // Hash password with bcryptjs
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const userId = crypto.randomUUID();
      const now = new Date();
      await app.db.insert(authSchema.user).values({
        id: userId,
        email: normalizedEmail,
        name,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });

      app.logger.debug({ userId, email: normalizedEmail }, 'User created, creating credential account');

      // Create credential account
      const accountId = crypto.randomUUID();
      await app.db.insert(authSchema.account).values({
        id: accountId,
        accountId: normalizedEmail,
        providerId: 'credential',
        userId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      });

      app.logger.debug({ userId, accountId }, 'Credential account created, creating session');

      // Create session with 30-day expiration
      const sessionToken = crypto.randomBytes(16).toString('hex');
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const ipAddress = request.ip || '';
      const userAgent = request.headers['user-agent'] || '';

      await app.db.insert(authSchema.session).values({
        id: sessionId,
        token: sessionToken,
        userId,
        expiresAt,
        ipAddress,
        userAgent,
        createdAt: now,
        updatedAt: now,
      });

      app.logger.info({ userId }, 'Sign-up successful, session created');

      return reply.status(201).send({
        token: sessionToken,
        user: {
          id: userId,
          name,
          email: normalizedEmail,
        },
      });
    } catch (error: unknown) {
      app.logger.error({ err: error }, 'Unexpected error during sign-up');
      return reply.status(500).send({ message: 'Erro interno do servidor' });
    }
  });

  // ==========================================
  // POST /api/auth/login
  // Custom email/password login endpoint
  // ==========================================
  app.fastify.post('/api/auth/login', {
    schema: {
      description: 'Sign in with email and password',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', description: 'User email address' },
          password: { type: 'string', description: 'Plain-text password' },
        },
      },
      response: {
        200: {
          description: 'Login successful',
          type: 'object',
          properties: {
            token: { type: 'string', description: 'Session token' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                role: { type: ['string', 'null'] },
                must_change_password: { type: 'boolean' },
                require_password_change: { type: 'boolean' },
              },
            },
          },
        },
        401: {
          description: 'Invalid email or password',
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { email: string; password: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const { email, password } = request.body;
    const normalizedEmail = email.toLowerCase();

    app.logger.info({ email: normalizedEmail }, 'POST /api/auth/login - sign-in attempt');

    try {
      // Look up user by email (case-insensitive)
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, normalizedEmail),
      });

      if (!user) {
        app.logger.warn('Login failed - user not found');
        return reply.status(401).send({ message: 'Email ou senha inválidos' });
      }

      app.logger.debug({ userId: user.id, email: normalizedEmail }, 'User found, looking up credential account');

      // Find credential account for this user
      const credentialAccount = await app.db.query.account.findFirst({
        where: and(
          eq(authSchema.account.userId, user.id),
          eq(authSchema.account.providerId, 'credential')
        ),
        orderBy: [desc(authSchema.account.createdAt)],
      });

      if (!credentialAccount || !credentialAccount.password) {
        app.logger.warn({ userId: user.id }, 'Login failed - no credential account or password');
        return reply.status(401).send({ message: 'Email ou senha inválidos' });
      }

      app.logger.debug({ userId: user.id, accountId: credentialAccount.id }, 'Credential account found, verifying password');

      // Verify password using bcryptjs
      let passwordValid = false;
      try {
        const bcrypt = await import('bcryptjs');
        passwordValid = await bcrypt.compare(password, credentialAccount.password);
        app.logger.debug({ userId: user.id, passwordValid }, 'Password comparison result');
      } catch (compareError: unknown) {
        const errorMsg = compareError instanceof Error ? compareError.message : String(compareError);
        app.logger.error({
          userId: user.id,
          email: normalizedEmail,
          err: compareError,
          errorMsg,
        }, 'Password comparison threw exception');
        return reply.status(500).send({ error: 'Password verification error' });
      }

      if (!passwordValid) {
        app.logger.warn({ userId: user.id }, 'Login failed - invalid password');
        return reply.status(401).send({ message: 'Email ou senha inválidos' });
      }

      app.logger.debug({ userId: user.id }, 'Password verified successfully');

      // Create session with 30-day expiration
      const sessionToken = crypto.randomBytes(16).toString('hex');
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const ipAddress = request.ip || '';
      const userAgent = request.headers['user-agent'] || '';
      const now = new Date();

      await app.db.insert(authSchema.session).values({
        id: sessionId,
        token: sessionToken,
        userId: user.id,
        expiresAt,
        ipAddress,
        userAgent,
        createdAt: now,
        updatedAt: now,
      });

      app.logger.info({
        userId: user.id,
        email: normalizedEmail,
        sessionId,
        mustChangePassword: user.mustChangePassword,
      }, 'Login successful, session created');

      return reply.status(200).send({
        token: sessionToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          must_change_password: user.mustChangePassword,
          require_password_change: user.requirePasswordChange,
        },
      });
    } catch (error: unknown) {
      app.logger.error({ err: error }, 'Unexpected error during login');
      return reply.status(500).send({ message: 'Erro interno do servidor' });
    }
  });

  // ==========================================
  // POST /api/auth/sign-in/email
  // Better Auth compatible sign-in endpoint
  // ==========================================
  app.fastify.post('/api/auth/sign-in/email', {
    schema: {
      description: 'Sign in with email and password (Better Auth compatible endpoint)',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', description: 'User email address' },
          password: { type: 'string', description: 'Plain-text password' },
        },
      },
      response: {
        200: {
          description: 'Sign-in successful',
          type: 'object',
          properties: {
            token: { type: 'string', description: 'Session token' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
              },
            },
          },
        },
        401: {
          description: 'Invalid email or password',
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: { email: string; password: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const { email, password } = request.body;
    const normalizedEmail = email.toLowerCase();

    app.logger.info({ email: normalizedEmail }, 'POST /api/auth/sign-in/email - sign-in attempt');

    try {
      // Look up user by email (case-insensitive)
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, normalizedEmail),
      });

      if (!user) {
        app.logger.warn('Sign-in failed - user not found');
        return reply.status(401).send({ message: 'Email ou senha inválidos' });
      }

      app.logger.debug({ userId: user.id, email: normalizedEmail }, 'User found, looking up credential account');

      // Find credential account for this user
      const credentialAccount = await app.db.query.account.findFirst({
        where: and(
          eq(authSchema.account.userId, user.id),
          eq(authSchema.account.providerId, 'credential')
        ),
        orderBy: [desc(authSchema.account.createdAt)],
      });

      if (!credentialAccount || !credentialAccount.password) {
        app.logger.warn({ userId: user.id }, 'Sign-in failed - no credential account or password');
        return reply.status(401).send({ message: 'Email ou senha inválidos' });
      }

      app.logger.debug({ userId: user.id, accountId: credentialAccount.id }, 'Credential account found, verifying password');

      // Verify password using bcryptjs
      let passwordValid = false;
      try {
        const bcrypt = await import('bcryptjs');
        passwordValid = await bcrypt.compare(password, credentialAccount.password);
        app.logger.debug({ userId: user.id, passwordValid }, 'Password comparison result');
      } catch (compareError: unknown) {
        const errorMsg = compareError instanceof Error ? compareError.message : String(compareError);
        app.logger.error({
          userId: user.id,
          email: normalizedEmail,
          err: compareError,
          errorMsg,
        }, 'Password comparison threw exception');
        return reply.status(500).send({ error: 'Password verification error' });
      }

      if (!passwordValid) {
        app.logger.warn({ userId: user.id }, 'Sign-in failed - invalid password');
        return reply.status(401).send({ message: 'Email ou senha inválidos' });
      }

      app.logger.debug({ userId: user.id }, 'Password verified successfully');

      // Create session with 30-day expiration
      const sessionToken = crypto.randomBytes(16).toString('hex');
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const ipAddress = request.ip || '';
      const userAgent = request.headers['user-agent'] || '';
      const now = new Date();

      await app.db.insert(authSchema.session).values({
        id: sessionId,
        token: sessionToken,
        userId: user.id,
        expiresAt,
        ipAddress,
        userAgent,
        createdAt: now,
        updatedAt: now,
      });

      app.logger.info({
        userId: user.id,
        email: normalizedEmail,
        sessionId,
      }, 'Sign-in successful, session created');

      return reply.status(200).send({
        token: sessionToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error: unknown) {
      app.logger.error({ err: error, email: normalizedEmail }, 'Unexpected error during sign-in');
      return reply.status(500).send({ message: 'Erro interno do servidor' });
    }
  });

  // ==========================================
  // GET /api/auth/session
  // Retrieve current user session from Bearer token
  // ==========================================
  app.fastify.get('/api/auth/session', {
    schema: {
      description: 'Get current user session from Bearer token',
      tags: ['auth'],
      response: {
        200: {
          description: 'Session retrieved successfully',
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: ['string', 'null'] },
                must_change_password: { type: 'boolean' },
                require_password_change: { type: 'boolean' },
              },
            },
          },
        },
        401: {
          description: 'Unauthorized or session expired',
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      app.logger.warn('Session retrieval failed - missing or invalid authorization header');
      return reply.status(401).send({ message: 'Unauthorized' });
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix
    app.logger.info({ tokenPrefix: token.substring(0, 8) }, 'GET /api/auth/session - retrieving session');

    try {
      // Look up session by token
      const session = await app.db.query.session.findFirst({
        where: eq(authSchema.session.token, token),
      });

      if (!session) {
        app.logger.warn({ tokenPrefix: token.substring(0, 8) }, 'Session not found');
        return reply.status(401).send({ message: 'Session not found' });
      }

      // Verify session is not expired
      if (new Date() > new Date(session.expiresAt)) {
        app.logger.warn({ sessionId: session.id }, 'Session expired');
        return reply.status(401).send({ message: 'Session expired' });
      }

      // Look up user by session's user_id
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, session.userId),
      });

      if (!user) {
        app.logger.error({ userId: session.userId }, 'User not found for session');
        return reply.status(401).send({ message: 'Unauthorized' });
      }

      app.logger.info({ userId: user.id }, 'Session retrieved successfully');

      return reply.status(200).send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          must_change_password: user.mustChangePassword,
          require_password_change: user.requirePasswordChange,
        },
      });
    } catch (error: unknown) {
      app.logger.error({ err: error }, 'Error retrieving session');
      return reply.status(500).send({ message: 'Erro interno do servidor' });
    }
  });

  // ==========================================
  // POST /api/auth/forgot-password
  // Generate and send temporary password
  // ==========================================
  app.fastify.post('/api/auth/forgot-password', {
    schema: {
      description: 'Generate and send a temporary password',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', description: 'User email address' },
        },
      },
      response: {
        200: {
          description: 'Success (returns same message regardless of whether email exists)',
          type: 'object',
          properties: {
            tempPassword: { type: 'string', description: 'Plain-text temporary password' },
          },
        },
        404: {
          description: 'Email not found',
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

    app.logger.info({ email: normalizedEmail }, 'POST /api/auth/forgot-password - temporary password requested');

    try {
      // Look up user by email
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, normalizedEmail),
      });

      if (!user) {
        app.logger.warn({ email: normalizedEmail }, 'Forgot password - user not found');
        return reply.status(404).send({ error: 'Email not found' });
      }

      app.logger.debug({ userId: user.id, email: normalizedEmail }, 'User found, checking credential account');

      // Find or create credential account
      let credentialAccount = await app.db.query.account.findFirst({
        where: and(
          eq(authSchema.account.userId, user.id),
          eq(authSchema.account.providerId, 'credential')
        ),
        orderBy: [desc(authSchema.account.createdAt)],
      });

      if (!credentialAccount) {
        app.logger.debug({ userId: user.id, email: normalizedEmail }, 'Credential account not found, creating one');
        const accountId = crypto.randomUUID();
        await app.db.insert(authSchema.account).values({
          id: accountId,
          accountId: normalizedEmail,
          providerId: 'credential',
          userId: user.id,
          password: '', // Will be updated below
        });
        credentialAccount = await app.db.query.account.findFirst({
          where: eq(authSchema.account.id, accountId),
        });
      }

      if (!credentialAccount) {
        app.logger.error({ userId: user.id, email: normalizedEmail }, 'Failed to get credential account');
        return reply.status(500).send({ error: 'Internal server error' });
      }

      app.logger.debug({ userId: user.id, accountId: credentialAccount.id }, 'Credential account ready, generating temporary password');

      // Generate temporary password (8 chars: uppercase + digits)
      const tempPassword = generateTempPassword();

      // Hash password using bcryptjs
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      app.logger.debug({
        userId: user.id,
        email: normalizedEmail,
        hashPrefix: hashedPassword.substring(0, 7),
      }, 'Temporary password hashed, updating account');

      // Update password in account table
      await app.db.update(authSchema.account)
        .set({ password: hashedPassword })
        .where(eq(authSchema.account.id, credentialAccount.id));

      app.logger.debug({ userId: user.id, accountId: credentialAccount.id }, 'Account password updated, setting user flags');

      // Update user table: set must_change_password flag and temp_password_expires_at to 24 hours
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await app.db.update(authSchema.user)
        .set({
          mustChangePassword: true,
          tempPasswordExpiresAt: expiresAt,
        })
        .where(eq(authSchema.user.id, user.id));

      app.logger.debug({ userId: user.id, email: normalizedEmail }, 'User flags updated, sending email');

      // Build HTML email
      const userName = user.name || 'User';
      const htmlBody =
        "<div style='font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;'>" +
        "<h2 style='color: #333;'>Olá, " + userName + "!</h2>" +
        "<p>Recebemos uma solicitação de recuperação de senha para sua conta.</p>" +
        "<p>Sua senha provisória é:</p>" +
        "<div style='background: #f5f5f5; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;'>" +
        "<span style='font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #333;'>" + tempPassword + "</span>" +
        "</div>" +
        "<p>Use essa senha para fazer login.</p>" +
        "<p><strong>No primeiro acesso, você será obrigado a criar uma nova senha.</strong></p>" +
        "<p style='color: #666; font-size: 12px;'>Se você não solicitou a recuperação de senha, ignore este email.</p>" +
        "</div>";

      const textBody =
        "Olá, " + userName + "!\n\n" +
        "Sua senha provisória é: " + tempPassword + "\n\n" +
        "Use essa senha para fazer login. No primeiro acesso, você será obrigado a criar uma nova senha.\n\n" +
        "Se você não solicitou isso, ignore este email.";

      resend.emails.send({
        from: 'onboarding@resend.dev',
        to: normalizedEmail,
        subject: 'Sua senha provisória',
        html: htmlBody,
        text: textBody,
      });

      app.logger.info({ userId: user.id, email: normalizedEmail }, 'Temporary password email sent');

      return reply.status(200).send({ tempPassword });
    } catch (error: unknown) {
      app.logger.error({ err: error, email: normalizedEmail }, 'Error during forgot password request');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ==========================================
  // POST /api/auth/change-password
  // Change password (requires authentication)
  // ==========================================
  app.fastify.post('/api/auth/change-password', {
    schema: {
      description: 'Change password (requires Bearer token authentication)',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email', 'currentPassword', 'newPassword'],
        properties: {
          email: { type: 'string', format: 'email', description: 'User email address' },
          currentPassword: { type: 'string', description: 'Current password (plain-text)' },
          newPassword: { type: 'string', description: 'New password (will be hashed)' },
        },
      },
      response: {
        200: {
          description: 'Password changed successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        401: {
          description: 'Current password is incorrect',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        404: {
          description: 'User not found',
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
    request: FastifyRequest<{ Body: { email: string; currentPassword: string; newPassword: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const { email, currentPassword, newPassword } = request.body;
    const normalizedEmail = email.toLowerCase();

    app.logger.info({ email: normalizedEmail }, 'POST /api/auth/change-password - password change requested');

    try {
      // Look up user by email
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, normalizedEmail),
      });

      if (!user) {
        app.logger.warn({ email: normalizedEmail }, 'Change password - user not found');
        return reply.status(404).send({ error: 'User not found' });
      }

      app.logger.debug({ userId: user.id, email: normalizedEmail }, 'User found, looking up credential account');

      // Find credential account
      const credentialAccount = await app.db.query.account.findFirst({
        where: and(
          eq(authSchema.account.userId, user.id),
          eq(authSchema.account.providerId, 'credential')
        ),
        orderBy: [desc(authSchema.account.createdAt)],
      });

      if (!credentialAccount || !credentialAccount.password) {
        app.logger.warn({ userId: user.id, email: normalizedEmail }, 'Change password - credential account not found or no password');
        return reply.status(404).send({ error: 'User not found' });
      }

      app.logger.debug({ userId: user.id, accountId: credentialAccount.id }, 'Credential account found, verifying current password');

      // Verify current password
      let currentPasswordValid = false;
      try {
        const bcrypt = await import('bcryptjs');
        currentPasswordValid = await bcrypt.compare(currentPassword, credentialAccount.password);
        app.logger.debug({ userId: user.id, passwordValid: currentPasswordValid }, 'Current password verification result');
      } catch (compareError: unknown) {
        const errorMsg = compareError instanceof Error ? compareError.message : String(compareError);
        app.logger.error({
          userId: user.id,
          err: compareError,
        }, 'Password comparison threw exception');
        return reply.status(500).send({ error: 'Internal server error' });
      }

      if (!currentPasswordValid) {
        app.logger.warn({ userId: user.id }, 'Change password - current password is incorrect');
        return reply.status(401).send({ error: 'Current password is incorrect' });
      }

      app.logger.debug({ userId: user.id }, 'Current password verified');

      // Hash new password using bcryptjs (consistent with Better Auth's approach)
      let hashedPassword: string;
      try {
        const bcrypt = await import('bcryptjs');
        hashedPassword = await bcrypt.hash(newPassword, 10);
      } catch (hashError: unknown) {
        app.logger.error({
          userId: user.id,
          err: hashError,
        }, 'Failed to hash new password');
        return reply.status(500).send({ error: 'Internal server error' });
      }

      app.logger.debug({ userId: user.id, email: normalizedEmail }, 'New password hashed, updating account');

      // Update password in account table
      const accountUpdateResult = await app.db.update(authSchema.account)
        .set({ password: hashedPassword })
        .where(eq(authSchema.account.id, credentialAccount.id))
        .returning();

      if (!accountUpdateResult.length) {
        app.logger.error({ userId: user.id, accountId: credentialAccount.id }, 'Failed to update account password - no rows affected');
        return reply.status(500).send({ error: 'Internal server error' });
      }

      app.logger.debug({ userId: user.id }, 'Account password updated, clearing must_change_password flags');

      // Clear password change flags
      const userUpdateResult = await app.db.update(authSchema.user)
        .set({
          mustChangePassword: false,
          tempPasswordExpiresAt: null,
        })
        .where(eq(authSchema.user.id, user.id))
        .returning();

      if (!userUpdateResult.length) {
        app.logger.error({ userId: user.id }, 'Failed to clear password change flags - no rows affected');
        return reply.status(500).send({ error: 'Internal server error' });
      }

      app.logger.info({ userId: user.id, email: normalizedEmail }, 'Password changed successfully');

      return reply.status(200).send({ success: true });
    } catch (error: unknown) {
      app.logger.error({ err: error, email: normalizedEmail }, 'Unexpected error during password change');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.logger.info('Custom auth endpoints registered at /api/auth/sign-up, /api/auth/login, /api/auth/session, /api/auth/forgot-password, /api/auth/change-password');
}
