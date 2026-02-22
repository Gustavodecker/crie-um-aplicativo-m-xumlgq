import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

export function registerSleepWindowsRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/sleep-windows - Returns all sleep window configs for consultant
  app.fastify.get('/api/sleep-windows', {
    schema: {
      description: 'Get all sleep window configurations for consultant',
      tags: ['sleep-windows'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              consultantId: { type: 'string', format: 'uuid' },
              ageMonthsMin: { type: 'integer' },
              ageMonthsMax: { type: 'integer' },
              windowMinutes: { type: 'integer' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching sleep window configurations');

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (!consultant) {
      app.logger.warn({ userId: session.user.id }, 'Not a consultant');
      return reply.status(401).send({ error: 'Not a consultant' });
    }

    const configs = await app.db.query.sleepWindowsConfig.findMany({
      where: eq(schema.sleepWindowsConfig.consultantId, consultant.id),
    });

    return configs;
  });

  // POST /api/sleep-windows - Creates config
  app.fastify.post('/api/sleep-windows', {
    schema: {
      description: 'Create a new sleep window configuration',
      tags: ['sleep-windows'],
      body: {
        type: 'object',
        required: ['ageMonthsMin', 'ageMonthsMax', 'windowMinutes'],
        properties: {
          ageMonthsMin: { type: 'integer' },
          ageMonthsMax: { type: 'integer' },
          windowMinutes: { type: 'integer' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            consultantId: { type: 'string', format: 'uuid' },
            ageMonthsMin: { type: 'integer' },
            ageMonthsMax: { type: 'integer' },
            windowMinutes: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { ageMonthsMin: number; ageMonthsMax: number; windowMinutes: number } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Creating sleep window configuration');

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (!consultant) {
      app.logger.warn({ userId: session.user.id }, 'Not a consultant');
      return reply.status(401).send({ error: 'Not a consultant' });
    }

    const [config] = await app.db.insert(schema.sleepWindowsConfig).values({
      consultantId: consultant.id,
      ageMonthsMin: request.body.ageMonthsMin,
      ageMonthsMax: request.body.ageMonthsMax,
      windowMinutes: request.body.windowMinutes,
    }).returning();

    app.logger.info({ configId: config.id, consultantId: consultant.id }, 'Sleep window configuration created successfully');
    return reply.status(201).send(config);
  });

  // PUT /api/sleep-windows/:id - Updates config
  app.fastify.put('/api/sleep-windows/:id', {
    schema: {
      description: 'Update a sleep window configuration',
      tags: ['sleep-windows'],
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
          ageMonthsMin: { type: 'integer' },
          ageMonthsMax: { type: 'integer' },
          windowMinutes: { type: 'integer' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            consultantId: { type: 'string', format: 'uuid' },
            ageMonthsMin: { type: 'integer' },
            ageMonthsMax: { type: 'integer' },
            windowMinutes: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<{ ageMonthsMin: number; ageMonthsMax: number; windowMinutes: number }> }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, configId: request.params.id, body: request.body }, 'Updating sleep window configuration');

    const config = await app.db.query.sleepWindowsConfig.findFirst({
      where: eq(schema.sleepWindowsConfig.id, request.params.id),
    });

    if (!config) {
      app.logger.warn({ configId: request.params.id }, 'Configuration not found');
      return reply.status(404).send({ error: 'Configuration not found' });
    }

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (!consultant || config.consultantId !== consultant.id) {
      app.logger.warn({ userId: session.user.id, configId: request.params.id }, 'Not authorized');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    const [updated] = await app.db.update(schema.sleepWindowsConfig)
      .set(request.body)
      .where(eq(schema.sleepWindowsConfig.id, request.params.id))
      .returning();

    app.logger.info({ configId: updated.id }, 'Sleep window configuration updated successfully');
    return updated;
  });
}
