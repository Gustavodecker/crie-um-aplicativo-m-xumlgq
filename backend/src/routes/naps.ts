import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

export function registerNapsRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/naps - Creates nap
  app.fastify.post('/api/naps', {
    schema: {
      description: 'Create a new nap record',
      tags: ['naps'],
      body: {
        type: 'object',
        required: ['routineId', 'napNumber', 'startTryTime'],
        properties: {
          routineId: { type: 'string', format: 'uuid' },
          napNumber: { type: 'integer', minimum: 1, maximum: 6 },
          startTryTime: { type: 'string' },
          fellAsleepTime: { type: ['string', 'null'] },
          wakeUpTime: { type: ['string', 'null'] },
          sleepMethod: { type: ['string', 'null'] },
          environment: { type: ['string', 'null'] },
          wakeUpMood: { type: ['string', 'null'] },
          observations: { type: ['string', 'null'] },
          consultantComments: { type: ['string', 'null'] },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            routineId: { type: 'string', format: 'uuid' },
            napNumber: { type: 'integer' },
            startTryTime: { type: 'string' },
            fellAsleepTime: { type: ['string', 'null'] },
            wakeUpTime: { type: ['string', 'null'] },
            sleepMethod: { type: ['string', 'null'] },
            environment: { type: ['string', 'null'] },
            wakeUpMood: { type: ['string', 'null'] },
            observations: { type: ['string', 'null'] },
            consultantComments: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { routineId: string; napNumber: number; startTryTime: string; fellAsleepTime?: string | null; wakeUpTime?: string | null; sleepMethod?: string | null; environment?: string | null; wakeUpMood?: string | null; observations?: string | null; consultantComments?: string | null } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Creating nap');

    const routine = await app.db.query.dailyRoutines.findFirst({
      where: eq(schema.dailyRoutines.id, request.body.routineId),
      with: { baby: true },
    });

    if (!routine) {
      app.logger.warn({ routineId: request.body.routineId }, 'Routine not found');
      return reply.status(404).send({ error: 'Routine not found' });
    }

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    const isMother = routine.baby.motherUserId === session.user.id;
    const isConsultant = consultant && routine.baby.consultantId === consultant.id;

    if (!isMother && !isConsultant) {
      app.logger.warn({ userId: session.user.id, routineId: request.body.routineId }, 'Not authorized');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    const existingNaps = await app.db.query.naps.findMany({
      where: eq(schema.naps.routineId, request.body.routineId),
    });

    if (existingNaps.length >= 6) {
      app.logger.warn({ routineId: request.body.routineId }, 'Maximum 6 naps per routine');
      return reply.status(400).send({ error: 'Maximum 6 naps per routine' });
    }

    const [nap] = await app.db.insert(schema.naps).values({
      routineId: request.body.routineId,
      napNumber: request.body.napNumber,
      startTryTime: request.body.startTryTime,
      fellAsleepTime: request.body.fellAsleepTime || null,
      wakeUpTime: request.body.wakeUpTime || null,
      sleepMethod: request.body.sleepMethod || null,
      environment: request.body.environment || null,
      wakeUpMood: request.body.wakeUpMood || null,
      observations: request.body.observations || null,
      consultantComments: request.body.consultantComments || null,
    }).returning();

    app.logger.info({ napId: nap.id, routineId: request.body.routineId }, 'Nap created successfully');
    return reply.status(201).send(nap);
  });

  // PUT /api/naps/:id - Updates nap
  app.fastify.put('/api/naps/:id', {
    schema: {
      description: 'Update a nap record',
      tags: ['naps'],
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
          napNumber: { type: 'integer', minimum: 1, maximum: 6 },
          startTryTime: { type: 'string' },
          fellAsleepTime: { type: ['string', 'null'] },
          wakeUpTime: { type: ['string', 'null'] },
          sleepMethod: { type: ['string', 'null'] },
          environment: { type: ['string', 'null'] },
          wakeUpMood: { type: ['string', 'null'] },
          observations: { type: ['string', 'null'] },
          consultantComments: { type: ['string', 'null'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            routineId: { type: 'string', format: 'uuid' },
            napNumber: { type: 'integer' },
            startTryTime: { type: 'string' },
            fellAsleepTime: { type: ['string', 'null'] },
            wakeUpTime: { type: ['string', 'null'] },
            sleepMethod: { type: ['string', 'null'] },
            environment: { type: ['string', 'null'] },
            wakeUpMood: { type: ['string', 'null'] },
            observations: { type: ['string', 'null'] },
            consultantComments: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<{ napNumber: number; startTryTime: string; fellAsleepTime: string | null; wakeUpTime: string | null; sleepMethod: string | null; environment: string | null; wakeUpMood: string | null; observations: string | null; consultantComments: string | null }> }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, napId: request.params.id, body: request.body }, 'Updating nap');

    const nap = await app.db.query.naps.findFirst({
      where: eq(schema.naps.id, request.params.id),
      with: {
        routine: { with: { baby: true } },
      },
    });

    if (!nap) {
      app.logger.warn({ napId: request.params.id }, 'Nap not found');
      return reply.status(404).send({ error: 'Nap not found' });
    }

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    const isMother = nap.routine.baby.motherUserId === session.user.id;
    const isConsultant = consultant && nap.routine.baby.consultantId === consultant.id;

    if (!isMother && !isConsultant) {
      app.logger.warn({ userId: session.user.id, napId: request.params.id }, 'Not authorized');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    const [updated] = await app.db.update(schema.naps)
      .set(request.body)
      .where(eq(schema.naps.id, request.params.id))
      .returning();

    app.logger.info({ napId: updated.id }, 'Nap updated successfully');
    return updated;
  });

  // DELETE /api/naps/:id - Deletes nap
  app.fastify.delete('/api/naps/:id', {
    schema: {
      description: 'Delete a nap record',
      tags: ['naps'],
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

    app.logger.info({ userId: session.user.id, napId: request.params.id }, 'Deleting nap');

    const nap = await app.db.query.naps.findFirst({
      where: eq(schema.naps.id, request.params.id),
      with: {
        routine: { with: { baby: true } },
      },
    });

    if (!nap) {
      app.logger.warn({ napId: request.params.id }, 'Nap not found');
      return reply.status(404).send({ error: 'Nap not found' });
    }

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    const isMother = nap.routine.baby.motherUserId === session.user.id;
    const isConsultant = consultant && nap.routine.baby.consultantId === consultant.id;

    if (!isMother && !isConsultant) {
      app.logger.warn({ userId: session.user.id, napId: request.params.id }, 'Not authorized');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    await app.db.delete(schema.naps).where(eq(schema.naps.id, request.params.id));

    app.logger.info({ napId: request.params.id }, 'Nap deleted successfully');
    return reply.status(204).send();
  });
}
