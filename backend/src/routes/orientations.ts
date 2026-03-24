import type { App } from '../index.js';
import { createCustomRequireAuth } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

export function registerOrientationsRoutes(app: App) {
  const requireAuth = createCustomRequireAuth(app);

  // GET /api/orientations/baby/:babyId - Returns all orientations for baby
  app.fastify.get('/api/orientations/baby/:babyId', {
    schema: {
      description: 'Get all orientations for baby',
      tags: ['orientations'],
      params: {
        type: 'object',
        required: ['babyId'],
        properties: {
          babyId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              babyId: { type: 'string', format: 'uuid' },
              date: { type: 'string', format: 'date' },
              orientationText: { type: 'string' },
              results: { type: ['string', 'null'] },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { babyId: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, babyId: request.params.babyId }, 'Fetching orientations');

    const baby = await app.db.query.babies.findFirst({
      where: eq(schema.babies.id, request.params.babyId),
    });

    if (!baby) {
      return reply.status(401).send({ error: 'Not authorized' });
    }

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    const isConsultant = consultant && baby.consultantId === consultant.id;
    const isMother = baby.motherUserId === session.user.id;

    if (!isConsultant && !isMother) {
      app.logger.warn({ userId: session.user.id, babyId: request.params.babyId }, 'Not authorized');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    const orientations = await app.db.query.orientations.findMany({
      where: eq(schema.orientations.babyId, request.params.babyId),
    });

    return orientations;
  });

  // POST /api/orientations - Creates orientation (consultant only)
  app.fastify.post('/api/orientations', {
    schema: {
      description: 'Create a new orientation',
      tags: ['orientations'],
      body: {
        type: 'object',
        required: ['babyId', 'date', 'orientationText'],
        properties: {
          babyId: { type: 'string', format: 'uuid' },
          date: { type: 'string', format: 'date' },
          orientationText: { type: 'string' },
          results: { type: ['string', 'null'] },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            babyId: { type: 'string', format: 'uuid' },
            date: { type: 'string', format: 'date' },
            orientationText: { type: 'string' },
            results: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { babyId: string; date: string; orientationText: string; results?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Creating orientation');

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (!consultant) {
      app.logger.warn({ userId: session.user.id }, 'Not a consultant');
      return reply.status(401).send({ error: 'Not a consultant' });
    }

    const baby = await app.db.query.babies.findFirst({
      where: eq(schema.babies.id, request.body.babyId),
    });

    if (!baby || baby.consultantId !== consultant.id) {
      app.logger.warn({ babyId: request.body.babyId }, 'Baby not found or not authorized');
      return reply.status(404).send({ error: 'Baby not found' });
    }

    const [orientation] = await app.db.insert(schema.orientations).values({
      babyId: request.body.babyId,
      date: request.body.date,
      orientationText: request.body.orientationText,
      results: request.body.results || null,
    }).returning();

    app.logger.info({ orientationId: orientation.id, babyId: request.body.babyId }, 'Orientation created successfully');
    return reply.status(201).send(orientation);
  });

  // PUT /api/orientations/:id - Updates orientation (consultant only)
  app.fastify.put('/api/orientations/:id', {
    schema: {
      description: 'Update an orientation',
      tags: ['orientations'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          orientationText: { type: 'string' },
          results: { type: ['string', 'null'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            babyId: { type: 'string', format: 'uuid' },
            date: { type: 'string', format: 'date' },
            orientationText: { type: 'string' },
            results: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<{ orientationText: string; results: string | null }> }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, orientationId: request.params.id, body: request.body }, 'Updating orientation');

    const orientation = await app.db.query.orientations.findFirst({
      where: eq(schema.orientations.id, request.params.id),
      with: { baby: true },
    });

    if (!orientation) {
      app.logger.warn({ orientationId: request.params.id }, 'Orientation not found');
      return reply.status(404).send({ error: 'Orientation not found' });
    }

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (!consultant || orientation.baby.consultantId !== consultant.id) {
      app.logger.warn({ userId: session.user.id, orientationId: request.params.id }, 'Not authorized');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    const [updated] = await app.db.update(schema.orientations)
      .set(request.body)
      .where(eq(schema.orientations.id, request.params.id))
      .returning();

    app.logger.info({ orientationId: updated.id }, 'Orientation updated successfully');
    return updated;
  });
}
