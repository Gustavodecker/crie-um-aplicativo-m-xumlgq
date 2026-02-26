import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

export function registerContractsRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/contracts - Creates contract
  app.fastify.post('/api/contracts', {
    schema: {
      description: 'Create a new contract',
      tags: ['contracts'],
      body: {
        type: 'object',
        required: ['babyId', 'startDate', 'durationDays', 'status'],
        properties: {
          babyId: { type: 'string', format: 'uuid' },
          startDate: { type: 'string', format: 'date' },
          durationDays: { type: 'integer' },
          status: { type: 'string', enum: ['active', 'paused', 'completed'] },
          contractPdfUrl: { type: ['string', 'null'] },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            babyId: { type: 'string', format: 'uuid' },
            startDate: { type: 'string', format: 'date' },
            durationDays: { type: 'integer' },
            status: { type: 'string' },
            contractPdfUrl: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { babyId: string; startDate: string; durationDays: number; status: string; contractPdfUrl?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Creating contract');

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

    const [contract] = await app.db.insert(schema.contracts).values({
      babyId: request.body.babyId,
      startDate: request.body.startDate,
      durationDays: request.body.durationDays,
      status: request.body.status,
      contractPdfUrl: request.body.contractPdfUrl || null,
    }).returning();

    app.logger.info({ contractId: contract.id, babyId: request.body.babyId }, 'Contract created successfully');
    return reply.status(201).send(contract);
  });

  // PUT /api/contracts/:id - Updates contract
  app.fastify.put('/api/contracts/:id', {
    schema: {
      description: 'Update a contract',
      tags: ['contracts'],
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
          startDate: { type: 'string', format: 'date' },
          durationDays: { type: 'integer' },
          status: { type: 'string', enum: ['active', 'paused', 'completed'] },
          contractPdfUrl: { type: ['string', 'null'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            babyId: { type: 'string', format: 'uuid' },
            startDate: { type: 'string', format: 'date' },
            durationDays: { type: 'integer' },
            status: { type: 'string' },
            contractPdfUrl: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<{ startDate: string; durationDays: number; status: string; contractPdfUrl: string | null }> }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, contractId: request.params.id, body: request.body }, 'Updating contract');

    const contract = await app.db.query.contracts.findFirst({
      where: eq(schema.contracts.id, request.params.id),
      with: { baby: true },
    });

    if (!contract) {
      app.logger.warn({ contractId: request.params.id }, 'Contract not found');
      return reply.status(404).send({ error: 'Contract not found' });
    }

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (!consultant || contract.baby.consultantId !== consultant.id) {
      app.logger.warn({ userId: session.user.id, contractId: request.params.id }, 'Not authorized');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    const [updated] = await app.db.update(schema.contracts)
      .set(request.body)
      .where(eq(schema.contracts.id, request.params.id))
      .returning();

    app.logger.info({ contractId: updated.id }, 'Contract updated successfully');
    return updated;
  });

  // GET /api/contracts/baby/:babyId - Returns active contract for baby
  app.fastify.get('/api/contracts/baby/:babyId', {
    schema: {
      description: 'Get active contract for baby',
      tags: ['contracts'],
      params: {
        type: 'object',
        required: ['babyId'],
        properties: {
          babyId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: ['object', 'null'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            babyId: { type: 'string', format: 'uuid' },
            startDate: { type: 'string', format: 'date' },
            durationDays: { type: 'integer' },
            status: { type: 'string' },
            contractPdfUrl: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { babyId: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, babyId: request.params.babyId }, 'Fetching active contract');

    const baby = await app.db.query.babies.findFirst({
      where: eq(schema.babies.id, request.params.babyId),
    });

    if (!baby) {
      app.logger.warn({ babyId: request.params.babyId }, 'Baby not found');
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

    const contracts = await app.db.query.contracts.findMany({
      where: eq(schema.contracts.babyId, request.params.babyId),
    });

    const activeContract = contracts
      .filter(c => c.status === 'active')
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0] || null;

    return activeContract;
  });
}
