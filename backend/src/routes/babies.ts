import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

export function registerBabiesRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/babies - Creates baby (consultant only)
  app.fastify.post('/api/babies', {
    schema: {
      description: 'Create a new baby',
      tags: ['babies'],
      body: {
        type: 'object',
        required: ['name', 'birthDate', 'motherName', 'motherPhone', 'motherEmail'],
        properties: {
          name: { type: 'string' },
          birthDate: { type: 'string', format: 'date' },
          motherName: { type: 'string' },
          motherPhone: { type: 'string' },
          motherEmail: { type: 'string' },
          objectives: { type: ['string', 'null'] },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            birthDate: { type: 'string', format: 'date' },
            motherName: { type: 'string' },
            motherPhone: { type: 'string' },
            motherEmail: { type: 'string' },
            motherUserId: { type: ['string', 'null'] },
            consultantId: { type: 'string', format: 'uuid' },
            objectives: { type: ['string', 'null'] },
            conclusion: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { name: string; birthDate: string; motherName: string; motherPhone: string; motherEmail: string; objectives?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Creating baby');

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (!consultant) {
      app.logger.warn({ userId: session.user.id }, 'Not a consultant');
      return reply.status(401).send({ error: 'Not a consultant' });
    }

    const [baby] = await app.db.insert(schema.babies).values({
      name: request.body.name,
      birthDate: request.body.birthDate,
      motherName: request.body.motherName,
      motherPhone: request.body.motherPhone,
      motherEmail: request.body.motherEmail,
      objectives: request.body.objectives || null,
      consultantId: consultant.id,
    }).returning();

    app.logger.info({ babyId: baby.id, consultantId: consultant.id }, 'Baby created successfully');
    return reply.status(201).send(baby);
  });

  // PUT /api/babies/:id - Updates baby (consultant can edit conclusion)
  app.fastify.put('/api/babies/:id', {
    schema: {
      description: 'Update baby details',
      tags: ['babies'],
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
          name: { type: 'string' },
          objectives: { type: ['string', 'null'] },
          conclusion: { type: ['string', 'null'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            birthDate: { type: 'string', format: 'date' },
            motherName: { type: 'string' },
            motherPhone: { type: 'string' },
            motherEmail: { type: 'string' },
            motherUserId: { type: ['string', 'null'] },
            consultantId: { type: 'string', format: 'uuid' },
            objectives: { type: ['string', 'null'] },
            conclusion: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<{ name: string; objectives: string | null; conclusion: string | null }> }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, babyId: request.params.id, body: request.body }, 'Updating baby');

    const baby = await app.db.query.babies.findFirst({
      where: eq(schema.babies.id, request.params.id),
    });

    if (!baby) {
      app.logger.warn({ babyId: request.params.id }, 'Baby not found');
      return reply.status(404).send({ error: 'Baby not found' });
    }

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (!consultant || baby.consultantId !== consultant.id) {
      app.logger.warn({ userId: session.user.id, babyId: request.params.id }, 'Not authorized to update baby');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    const [updated] = await app.db.update(schema.babies)
      .set(request.body)
      .where(eq(schema.babies.id, request.params.id))
      .returning();

    app.logger.info({ babyId: updated.id }, 'Baby updated successfully');
    return updated;
  });

  // GET /api/babies/:id - Returns baby details with current age calculation
  app.fastify.get('/api/babies/:id', {
    schema: {
      description: 'Get baby details with age calculation',
      tags: ['babies'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            birthDate: { type: 'string', format: 'date' },
            motherName: { type: 'string' },
            motherPhone: { type: 'string' },
            motherEmail: { type: 'string' },
            motherUserId: { type: ['string', 'null'] },
            consultantId: { type: 'string', format: 'uuid' },
            objectives: { type: ['string', 'null'] },
            conclusion: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
            ageMonths: { type: 'integer' },
            ageDays: { type: 'integer' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, babyId: request.params.id }, 'Fetching baby details');

    const baby = await app.db.query.babies.findFirst({
      where: eq(schema.babies.id, request.params.id),
    });

    if (!baby) {
      app.logger.warn({ babyId: request.params.id }, 'Baby not found');
      return reply.status(404).send({ error: 'Baby not found' });
    }

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    const isConsultant = consultant && baby.consultantId === consultant.id;
    const isMother = baby.motherUserId === session.user.id;

    if (!isConsultant && !isMother) {
      app.logger.warn({ userId: session.user.id, babyId: request.params.id }, 'Not authorized to view baby');
      return reply.status(401).send({ error: 'Not authorized' });
    }

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

    return { ...baby, ageMonths, ageDays };
  });
}
