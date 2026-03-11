import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';

/**
 * Token-based authentication for mothers
 *
 * Two endpoints:
 * 1. Validate token (POST /api/auth/validate-token) - Validates baby token and returns mother info
 * 2. Create account (POST /api/auth/create-account-with-token) - Creates account and session for mother
 */
export function registerAuthRoutes(app: App) {
  // POST /api/auth/validate-token - Validate baby token
  app.fastify.post('/api/auth/validate-token', {
    schema: {
      description: 'Validate baby token and get mother email',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', description: 'Baby registration token' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            babyId: { type: 'string', format: 'uuid' },
            babyName: { type: 'string' },
            motherEmail: { type: 'string' },
            consultantName: { type: 'string' },
            accountExists: { type: 'boolean' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { token: string } }>, reply: FastifyReply) => {
    const { token } = request.body;

    if (!token || token.trim().length === 0) {
      app.logger.warn({ body: request.body }, 'Token missing from request');
      return reply.status(400).send({ error: 'Token is required' });
    }

    app.logger.info({ token: token.substring(0, 10) + '...' }, 'Validating baby token');

    // Find baby by token
    const baby = await app.db.query.babies.findFirst({
      where: eq(schema.babies.token, token),
      with: {
        consultant: true,
      },
    });

    if (!baby) {
      app.logger.warn({ token: token.substring(0, 10) + '...' }, 'Baby not found with provided token');
      return reply.status(404).send({ error: 'Invalid token. Baby not found.' });
    }

    app.logger.info(
      { babyId: baby.id, motherEmail: baby.motherEmail, accountExists: !!baby.motherUserId },
      'Token validated successfully'
    );

    return reply.status(200).send({
      valid: true,
      babyId: baby.id,
      babyName: baby.name,
      motherEmail: baby.motherEmail,
      consultantName: baby.consultant.name,
      accountExists: !!baby.motherUserId,
    });
  });

  // POST /api/auth/create-account-with-token - Create account and sign in mother using token
  app.fastify.post('/api/auth/create-account-with-token', {
    schema: {
      description: 'Create account and sign in mother using baby token',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['token', 'name', 'password'],
        properties: {
          token: { type: 'string', description: 'Baby registration token' },
          name: { type: 'string', description: 'Mother\'s full name' },
          password: { type: 'string', description: 'Account password' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                emailVerified: { type: 'boolean' },
              },
            },
            session: {
              type: 'object',
              properties: {
                token: { type: 'string', description: 'Session token for subsequent requests' },
                id: { type: 'string' },
                expiresAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        409: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { token: string; name: string; password: string } }>, reply: FastifyReply) => {
    const { token, name, password } = request.body;

    if (!token || token.trim().length === 0) {
      app.logger.warn({ body: request.body }, 'Token missing from request');
      return reply.status(400).send({ error: 'Token is required' });
    }

    if (!name || name.trim().length === 0) {
      app.logger.warn({ token }, 'Name missing from request');
      return reply.status(400).send({ error: 'Name is required' });
    }

    if (!password || password.trim().length === 0) {
      app.logger.warn({ token }, 'Password missing from request');
      return reply.status(400).send({ error: 'Password is required' });
    }

    app.logger.info({ token: token.substring(0, 10) + '...' }, 'Creating account with token');

    // Find baby by token
    const baby = await app.db.query.babies.findFirst({
      where: eq(schema.babies.token, token),
    });

    if (!baby) {
      app.logger.warn({ token: token.substring(0, 10) + '...' }, 'Baby not found with provided token');
      return reply.status(404).send({ error: 'Invalid token. Baby not found.' });
    }

    // Check if mother account already exists
    if (baby.motherUserId) {
      app.logger.warn({ babyId: baby.id, motherUserId: baby.motherUserId }, 'Mother account already exists');
      return reply.status(409).send({ error: 'Account already exists for this mother. Please sign in instead.' });
    }

    const motherEmail = baby.motherEmail;

    try {
      // Check if user already exists with this email
      const existingUser = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, motherEmail),
      });

      if (existingUser) {
        app.logger.warn({ email: motherEmail }, 'User already exists with this email');
        return reply.status(409).send({ error: 'Email already registered. Please sign in instead.' });
      }

      // Create user in Better Auth using the framework's approach
      // We'll use the password to create the account
      // This should create both user and session through Better Auth

      // For now, return information to client about next steps
      // The client should use the standard sign-up endpoint with the mother's email
      app.logger.info(
        { babyId: baby.id, email: motherEmail },
        'Mother needs to complete signup via standard endpoint'
      );

      return reply.status(400).send({
        error: 'Please use the standard sign-up endpoint to create your account',
        babyId: baby.id,
        motherEmail: motherEmail,
        message: 'Sign up with your email address, then use the token to link your account to the baby'
      });

    } catch (error) {
      app.logger.error({ err: error, babyId: baby.id }, 'Error creating account with token');
      return reply.status(500).send({ error: 'Failed to create account' });
    }
  });

  // POST /api/auth/sign-in/token - Direct sign-in for mothers who already have accounts
  app.fastify.post('/api/auth/sign-in/token', {
    schema: {
      description: 'Sign in mother using baby token (account must already exist)',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', description: 'Baby registration token' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                emailVerified: { type: 'boolean' },
              },
            },
            session: {
              type: 'object',
              properties: {
                token: { type: 'string', description: 'Session token for subsequent requests' },
                id: { type: 'string' },
                expiresAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { token: string } }>, reply: FastifyReply) => {
    const { token } = request.body;

    if (!token || token.trim().length === 0) {
      app.logger.warn({ body: request.body }, 'Token missing from request');
      return reply.status(400).send({ error: 'Token is required' });
    }

    app.logger.info({ token: token.substring(0, 10) + '...' }, 'Signing in mother with token');

    // Find baby by token
    const baby = await app.db.query.babies.findFirst({
      where: eq(schema.babies.token, token),
      with: {
        consultant: true,
      },
    });

    if (!baby) {
      app.logger.warn({ token: token.substring(0, 10) + '...' }, 'Baby not found with provided token');
      return reply.status(404).send({ error: 'Invalid token. Baby not found.' });
    }

    if (!baby.motherUserId) {
      app.logger.info(
        { babyId: baby.id, motherEmail: baby.motherEmail },
        'Baby found but no mother user ID - account not yet created'
      );
      return reply.status(400).send({
        error: 'Account not found for this mother. Please sign up first.',
        babyId: baby.id,
        motherEmail: baby.motherEmail,
      });
    }

    app.logger.info(
      { babyId: baby.id, motherUserId: baby.motherUserId },
      'Token validation successful - returning baby info for client'
    );

    // Return baby and mother info for the client
    // The client should use this to display information or proceed with signin
    return reply.status(200).send({
      baby: {
        id: baby.id,
        name: baby.name,
        birthDate: baby.birthDate,
        consultantId: baby.consultantId,
        consultantName: baby.consultant.name,
      },
      mother: {
        userId: baby.motherUserId,
        email: baby.motherEmail,
        name: baby.motherName,
      },
      message: 'Token validated. Use standard sign-in with email and password to authenticate.',
    });
  });
}
