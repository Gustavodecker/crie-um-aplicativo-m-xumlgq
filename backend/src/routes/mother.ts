import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';

export function registerMotherRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/mothers/create-account-with-token - Create mother account with baby token
  app.fastify.post('/api/mothers/create-account-with-token', {
    schema: {
      description: 'Create mother account using baby token and return session',
      tags: ['mothers'],
      body: {
        type: 'object',
        required: ['token', 'name', 'password'],
        properties: {
          token: { type: 'string', description: 'Baby registration token' },
          name: { type: 'string', description: 'Mother name' },
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
                token: { type: 'string' },
                id: { type: 'string' },
                expiresAt: { type: 'string' },
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

    // Log the token value at the start for debugging
    app.logger.info({ tokenValue: token, tokenPreview: token?.substring(0, 10) + '...' }, 'Creating mother account with token');

    // Validate inputs
    if (!token || token.trim().length === 0) {
      app.logger.warn({ body: request.body }, 'Token missing from create-account request');
      return reply.status(400).send({ error: 'Token is required' });
    }

    if (!name || name.trim().length === 0) {
      app.logger.warn({ token }, 'Name missing from create-account request');
      return reply.status(400).send({ error: 'Name is required' });
    }

    if (!password || password.trim().length === 0) {
      app.logger.warn({ token }, 'Password missing from create-account request');
      return reply.status(400).send({ error: 'Password is required' });
    }

    try {
      // Find baby by token using same logic as validate-token endpoint
      const baby = await app.db.query.babies.findFirst({
        where: eq(schema.babies.token, token),
      });

      if (!baby) {
        app.logger.warn({ token: token.substring(0, 10) + '...' }, 'Baby not found with token');
        return reply.status(404).send({ error: 'Token não encontrado' });
      }

      // Check if mother account already exists for this baby
      if (baby.motherUserId) {
        app.logger.warn({ babyId: baby.id, existingMotherUserId: baby.motherUserId }, 'Mother account already exists for baby');
        return reply.status(409).send({ error: 'Já existe uma conta para este token' });
      }

      const motherEmail = baby.motherEmail;

      // Check if user already exists with this email
      const existingUser = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, motherEmail),
      });

      if (existingUser) {
        app.logger.warn({ email: motherEmail }, 'User already exists with this email');
        return reply.status(409).send({ error: 'Email já registrado' });
      }

      // Create new user
      const userId = crypto.randomUUID();
      await app.db.insert(authSchema.user).values({
        id: userId,
        email: motherEmail,
        emailVerified: false,
        name: name,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      app.logger.debug({ userId, email: motherEmail }, 'User created for mother');

      // Create account record with password
      const accountId = crypto.randomUUID();
      await app.db.insert(authSchema.account).values({
        id: accountId,
        accountId: userId,
        providerId: 'credential',
        userId: userId,
        password: password,
        accessToken: null,
        refreshToken: null,
        idToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      app.logger.debug({ userId, accountId }, 'Account created for mother');

      // Update baby with motherUserId
      await app.db.update(schema.babies)
        .set({ motherUserId: userId })
        .where(eq(schema.babies.id, baby.id));

      app.logger.debug({ babyId: baby.id, motherUserId: userId }, 'Baby updated with motherUserId');

      // Create session
      const sessionId = crypto.randomUUID();
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await app.db.insert(authSchema.session).values({
        id: sessionId,
        userId: userId,
        token: sessionToken,
        expiresAt: expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] || null,
      });

      app.logger.info(
        { userId, babyId: baby.id, sessionId },
        'Mother account created and session established'
      );

      return reply.status(201).send({
        user: {
          id: userId,
          email: motherEmail,
          name: name,
          emailVerified: false,
        },
        session: {
          token: sessionToken,
          id: sessionId,
          expiresAt: expiresAt.toISOString(),
        },
      });

    } catch (error) {
      app.logger.error({ err: error, token: token.substring(0, 10) + '...' }, 'Error creating mother account with token');
      return reply.status(500).send({ error: 'Falha ao criar conta' });
    }
  });

  // POST /api/mothers/validate-token - Validate baby token without authentication
  app.fastify.post('/api/mothers/validate-token', {
    schema: {
      description: 'Validate baby token and get mother/baby information',
      tags: ['mothers'],
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
            babyId: { type: 'string' },
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
      app.logger.warn({ body: request.body }, 'Token missing from validate-token request');
      return reply.status(400).send({ error: 'Token is required' });
    }

    app.logger.info({ tokenPreview: token.substring(0, 10) + '...' }, 'Validating baby token');

    const baby = await app.db.query.babies.findFirst({
      where: eq(schema.babies.token, token),
      with: {
        consultant: true,
      },
    });

    if (!baby) {
      app.logger.warn({ tokenPreview: token.substring(0, 10) + '...' }, 'Baby not found with token');
      return reply.status(404).send({ error: 'Invalid token. Baby not found.' });
    }

    app.logger.info(
      { babyId: baby.id, accountExists: !!baby.motherUserId },
      'Baby token validated successfully'
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

  // POST /api/mothers/init-with-token - Link authenticated mother to baby using token
  app.fastify.post('/api/mothers/init-with-token', {
    schema: {
      description: 'Link authenticated mother account to baby using token',
      tags: ['mothers'],
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
            id: { type: 'string' },
            name: { type: 'string' },
            birthDate: { type: 'string' },
            consultantId: { type: 'string' },
            message: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        409: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { token: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { token } = request.body;

    if (!token || token.trim().length === 0) {
      app.logger.warn({ userId: session.user.id }, 'Token missing from init-with-token request');
      return reply.status(400).send({ error: 'Token is required' });
    }

    app.logger.info({ userId: session.user.id, tokenPreview: token.substring(0, 10) + '...' }, 'Initializing mother with token');

    try {
      const baby = await app.db.query.babies.findFirst({
        where: eq(schema.babies.token, token),
      });

      if (!baby) {
        app.logger.warn({ userId: session.user.id, tokenPreview: token.substring(0, 10) + '...' }, 'Baby not found with token');
        return reply.status(404).send({ error: 'Invalid token. Baby not found.' });
      }

      // Check if already linked to any mother
      if (baby.motherUserId) {
        app.logger.warn({ userId: session.user.id, babyId: baby.id, existingMotherUserId: baby.motherUserId }, 'Baby already linked to a mother');
        return reply.status(409).send({ error: 'This baby is already linked to a mother account' });
      }

      // Link baby to mother
      await app.db.update(schema.babies)
        .set({ motherUserId: session.user.id })
        .where(eq(schema.babies.id, baby.id));

      app.logger.info({ userId: session.user.id, babyId: baby.id }, 'Baby linked to mother successfully');

      return reply.status(200).send({
        id: baby.id,
        name: baby.name,
        birthDate: baby.birthDate,
        consultantId: baby.consultantId,
        message: 'Mother successfully linked to baby',
      });

    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Error initializing mother with token');
      return reply.status(500).send({ error: 'Failed to link baby to account' });
    }
  });

  // GET /api/mother/baby - Returns the baby linked to authenticated mother
  app.fastify.get('/api/mother/baby', {
    schema: {
      description: 'Get baby linked to authenticated mother',
      tags: ['mother', 'babies'],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            token: { type: ['string', 'null'] },
            name: { type: 'string' },
            birthDate: { type: 'string', format: 'date' },
            motherName: { type: 'string' },
            motherPhone: { type: 'string' },
            motherEmail: { type: 'string' },
            motherUserId: { type: 'string' },
            consultantId: { type: 'string', format: 'uuid' },
            objectives: { type: ['string', 'null'] },
            conclusion: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
            ageMonths: { type: 'integer' },
            ageDays: { type: 'integer' },
            activeContract: {
              type: ['object', 'null'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                babyId: { type: 'string', format: 'uuid' },
                status: { type: 'string' },
                startDate: { type: 'string', format: 'date' },
                durationDays: { type: 'integer' },
                contractPdfUrl: { type: ['string', 'null'] },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching linked baby for mother');

    const baby = await app.db.query.babies.findFirst({
      where: eq(schema.babies.motherUserId, session.user.id),
    });

    if (!baby) {
      app.logger.warn({ userId: session.user.id }, 'No baby linked to mother');
      return reply.status(404).send({ error: 'No baby linked to this account' });
    }

    // Get active contract for the baby
    const contracts = await app.db.query.contracts.findMany({
      where: eq(schema.contracts.babyId, baby.id),
    });

    const activeContract = contracts
      .filter(c => {
        if (c.status !== 'active') return false;
        const startDate = new Date(c.startDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + c.durationDays);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today >= startDate && today < endDate;
      })
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0] || null;

    // Calculate age
    const today = new Date();
    const birthDate = new Date(baby.birthDate);
    let ageMonths = 0;
    let ageDays = 0;

    const monthDiff = today.getMonth() - birthDate.getMonth();
    const yearDiff = today.getFullYear() - birthDate.getFullYear();
    ageMonths = yearDiff * 12 + monthDiff;

    const dayDiff = today.getDate() - birthDate.getDate();
    if (dayDiff < 0) {
      ageMonths--;
      const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      ageDays = prevMonth.getDate() + dayDiff;
    } else {
      ageDays = dayDiff;
    }

    app.logger.info({ babyId: baby.id, userId: session.user.id }, 'Fetched linked baby for mother');

    return {
      ...baby,
      ageMonths,
      ageDays,
      activeContract,
    };
  });
}
