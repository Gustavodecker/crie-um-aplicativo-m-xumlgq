import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

export function registerInitRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/init/consultant - Initialize consultant profile after signup
  app.fastify.post('/api/init/consultant', {
    schema: {
      description: 'Initialize consultant profile',
      tags: ['init'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          photo: { type: ['string', 'null'] },
          logo: { type: ['string', 'null'] },
          primaryColor: { type: ['string', 'null'] },
          secondaryColor: { type: ['string', 'null'] },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            name: { type: 'string' },
            photo: { type: ['string', 'null'] },
            logo: { type: ['string', 'null'] },
            primaryColor: { type: 'string' },
            secondaryColor: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { name: string; photo?: string | null; logo?: string | null; primaryColor?: string | null; secondaryColor?: string | null } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Initializing consultant profile');

    const existing = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (existing) {
      app.logger.warn({ userId: session.user.id }, 'Consultant profile already exists');
      return reply.status(400).send({ error: 'Consultant profile already exists' });
    }

    const [consultant] = await app.db.insert(schema.consultants).values({
      userId: session.user.id,
      name: request.body.name,
      photo: request.body.photo || null,
      logo: request.body.logo || null,
      primaryColor: request.body.primaryColor || '#6B4CE6',
      secondaryColor: request.body.secondaryColor || '#9D7FEA',
    }).returning();

    app.logger.info({ consultantId: consultant.id, userId: session.user.id }, 'Consultant profile initialized');
    return reply.status(201).send(consultant);
  });

  // POST /api/init/mother - Register as mother for a baby using token (for backward compatibility)
  app.fastify.post('/api/init/mother', {
    schema: {
      description: 'Register as mother for a baby using token',
      tags: ['init'],
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
        },
      },
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
            motherEmail: { type: ['string', 'null'] },
            motherUserId: { type: 'string' },
            consultantId: { type: 'string', format: 'uuid' },
            objectives: { type: ['string', 'null'] },
            conclusion: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
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
      app.logger.warn({ userId: session.user.id }, 'Token missing from init/mother request');
      return reply.status(400).send({ error: 'Token is required' });
    }

    app.logger.info({ userId: session.user.id, tokenPreview: token.substring(0, 10) + '...' }, 'Registering as mother with token');

    try {
      const baby = await app.db.query.babies.findFirst({
        where: eq(schema.babies.token, token),
      });

      if (!baby) {
        app.logger.warn({ userId: session.user.id, tokenPreview: token.substring(0, 10) + '...' }, 'Baby not found with token');
        return reply.status(404).send({ error: 'Baby not found' });
      }

      // Check if baby already has a registered mother
      if (baby.motherUserId) {
        app.logger.warn({ userId: session.user.id, babyId: baby.id, existingMotherUserId: baby.motherUserId }, 'Baby already has a registered mother');
        return reply.status(409).send({ error: 'Baby already linked to a mother account' });
      }

      // Link baby to authenticated mother user
      const [updated] = await app.db.update(schema.babies)
        .set({ motherUserId: session.user.id })
        .where(eq(schema.babies.token, token))
        .returning();

      app.logger.info({ babyId: updated.id, userId: session.user.id }, 'Mother registered successfully');
      return updated;

    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Error registering mother');
      return reply.status(500).send({ error: 'Failed to register as mother' });
    }
  });
}
