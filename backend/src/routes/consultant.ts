import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

export function registerConsultantRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/consultant/profile - Returns consultant profile
  app.fastify.get('/api/consultant/profile', {
    schema: {
      description: 'Get consultant profile',
      tags: ['consultant'],
      response: {
        200: {
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
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching consultant profile');

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (!consultant) {
      app.logger.warn({ userId: session.user.id }, 'Consultant profile not found');
      return reply.status(404).send({ error: 'Consultant profile not found' });
    }

    return consultant;
  });

  // PUT /api/consultant/profile - Updates consultant profile
  app.fastify.put('/api/consultant/profile', {
    schema: {
      description: 'Update consultant profile',
      tags: ['consultant'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          photo: { type: ['string', 'null'] },
          logo: { type: ['string', 'null'] },
          primaryColor: { type: 'string' },
          secondaryColor: { type: 'string' },
        },
      },
      response: {
        200: {
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
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: Partial<{ name: string; photo: string | null; logo: string | null; primaryColor: string; secondaryColor: string }> }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Updating consultant profile');

    const updated = await app.db.update(schema.consultants)
      .set(request.body)
      .where(eq(schema.consultants.userId, session.user.id))
      .returning();

    if (!updated.length) {
      app.logger.warn({ userId: session.user.id }, 'Failed to update consultant profile');
      return reply.status(404).send({ error: 'Consultant profile not found' });
    }

    app.logger.info({ consultantId: updated[0].id }, 'Consultant profile updated');
    return updated[0];
  });

  // GET /api/consultant/babies - Returns all babies for this consultant with contract status
  app.fastify.get('/api/consultant/babies', {
    schema: {
      description: 'Get all babies for consultant',
      tags: ['consultant', 'babies'],
      querystring: {
        type: 'object',
        properties: {
          includeArchived: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
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
              activeContract: {
                type: ['object', 'null'],
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  status: { type: 'string' },
                  startDate: { type: 'string', format: 'date' },
                  durationDays: { type: 'integer' },
                  contractPdfUrl: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { includeArchived?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const includeArchived = request.query.includeArchived === 'true';
    app.logger.info({ userId: session.user.id, includeArchived }, 'Fetching consultant babies');

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (!consultant) {
      return reply.status(401).send({ error: 'Not a consultant' });
    }

    const whereConditions = includeArchived
      ? eq(schema.babies.consultantId, consultant.id)
      : and(eq(schema.babies.consultantId, consultant.id), eq(schema.babies.archived, false));

    const babyRecords = await app.db.query.babies.findMany({
      where: whereConditions,
      with: {
        contracts: {
          orderBy: (c) => [c.createdAt],
        },
      },
    });

    const today = new Date();
    const babies = babyRecords.map((baby) => {
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

      const activeContract = baby.contracts
        .filter(c => c.status === 'active')
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0] || null;

      return {
        ...baby,
        ageMonths,
        ageDays,
        activeContract,
      };
    });

    app.logger.info({ count: babies.length }, 'Fetched consultant babies');
    return babies;
  });
}
