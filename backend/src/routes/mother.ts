import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

export function registerMotherRoutes(app: App) {
  const requireAuth = app.requireAuth();

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
