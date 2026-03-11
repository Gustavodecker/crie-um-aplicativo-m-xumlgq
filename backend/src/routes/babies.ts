import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { generateToken } from '../utils/token.js';

export function registerBabiesRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/babies - Creates baby (consultant only)
  app.fastify.post('/api/babies', {
    schema: {
      description: 'Create a new baby',
      tags: ['babies'],
      body: {
        type: 'object',
        required: ['name', 'birthDate', 'motherName', 'motherPhone'],
        properties: {
          name: { type: 'string' },
          birthDate: { type: 'string', format: 'date' },
          motherName: { type: 'string' },
          motherPhone: { type: 'string' },
          objectives: { type: ['string', 'null'] },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            token: { type: 'string' },
            name: { type: 'string' },
            birthDate: { type: 'string', format: 'date' },
            motherName: { type: 'string' },
            motherPhone: { type: 'string' },
            motherEmail: { type: ['string', 'null'] },
            motherUserId: { type: ['string', 'null'] },
            consultantId: { type: 'string', format: 'uuid' },
            objectives: { type: ['string', 'null'] },
            conclusion: { type: ['string', 'null'] },
            archived: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { name: string; birthDate: string; motherName: string; motherPhone: string; objectives?: string } }>, reply: FastifyReply) => {
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

    // Generate unique token with retry logic
    let token: string;
    let maxRetries = 10;
    let created = false;

    while (maxRetries > 0 && !created) {
      token = generateToken();

      // Check if token already exists
      const existing = await app.db.query.babies.findFirst({
        where: eq(schema.babies.token, token),
      });

      if (!existing) {
        try {
          const [baby] = await app.db.insert(schema.babies).values({
            token: token,
            name: request.body.name,
            birthDate: request.body.birthDate,
            motherName: request.body.motherName,
            motherPhone: request.body.motherPhone,
            motherEmail: null,
            objectives: request.body.objectives || null,
            consultantId: consultant.id,
          }).returning();

          app.logger.info({ babyId: baby.id, token: baby.token, consultantId: consultant.id }, 'Baby created successfully');
          return reply.status(201).send(baby);
        } catch (err) {
          // Token collision or other error, retry
          maxRetries--;
          if (maxRetries === 0) {
            app.logger.error({ err, userId: session.user.id }, 'Failed to create baby after retries');
            return reply.status(500).send({ error: 'Failed to create baby' });
          }
        }
      } else {
        maxRetries--;
      }
    }

    app.logger.error({ userId: session.user.id }, 'Failed to generate unique token');
    return reply.status(500).send({ error: 'Failed to create baby' });
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
            token: { type: ['string', 'null'] },
            name: { type: 'string' },
            birthDate: { type: 'string', format: 'date' },
            motherName: { type: 'string' },
            motherPhone: { type: 'string' },
            motherEmail: { type: 'string' },
            motherUserId: { type: ['string', 'null'] },
            consultantId: { type: 'string', format: 'uuid' },
            objectives: { type: ['string', 'null'] },
            conclusion: { type: ['string', 'null'] },
            archived: { type: 'boolean' },
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
            token: { type: ['string', 'null'] },
            name: { type: 'string' },
            birthDate: { type: 'string', format: 'date' },
            motherName: { type: 'string' },
            motherPhone: { type: 'string' },
            motherEmail: { type: 'string' },
            motherUserId: { type: ['string', 'null'] },
            consultantId: { type: 'string', format: 'uuid' },
            objectives: { type: ['string', 'null'] },
            conclusion: { type: ['string', 'null'] },
            archived: { type: 'boolean' },
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

    return {
      id: baby.id,
      token: baby.token,
      name: baby.name,
      birthDate: baby.birthDate,
      motherName: baby.motherName,
      motherPhone: baby.motherPhone,
      motherEmail: baby.motherEmail,
      motherUserId: baby.motherUserId,
      consultantId: baby.consultantId,
      objectives: baby.objectives,
      conclusion: baby.conclusion,
      archived: baby.archived,
      createdAt: baby.createdAt,
      ageMonths,
      ageDays,
    };
  });

  // PUT /api/babies/:id/archive - Archives a baby (consultant only)
  app.fastify.put('/api/babies/:id/archive', {
    schema: {
      description: 'Archive a baby',
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
          archived: { type: 'boolean' },
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
            motherEmail: { type: 'string' },
            motherUserId: { type: ['string', 'null'] },
            consultantId: { type: 'string', format: 'uuid' },
            objectives: { type: ['string', 'null'] },
            conclusion: { type: ['string', 'null'] },
            archived: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { archived: boolean } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, babyId: request.params.id, archived: request.body.archived }, 'Archiving baby');

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
      app.logger.warn({ userId: session.user.id, babyId: request.params.id }, 'Not authorized to archive baby');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    const [updated] = await app.db.update(schema.babies)
      .set({ archived: request.body.archived })
      .where(eq(schema.babies.id, request.params.id))
      .returning();

    app.logger.info({ babyId: updated.id, archived: updated.archived }, 'Baby archived successfully');
    return updated;
  });

  // DELETE /api/babies/:id - Deletes baby permanently (consultant only)
  app.fastify.delete('/api/babies/:id', {
    schema: {
      description: 'Delete a baby permanently',
      tags: ['babies'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        204: { type: 'null' },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, babyId: request.params.id }, 'Deleting baby');

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
      app.logger.warn({ userId: session.user.id, babyId: request.params.id }, 'Not authorized to delete baby');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    await app.db.delete(schema.babies).where(eq(schema.babies.id, request.params.id));

    app.logger.info({ babyId: request.params.id }, 'Baby deleted successfully');
    return reply.status(204).send();
  });
}
