import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

const EDIT_WINDOW_HOURS = 48;

function isContractActive(contract: { startDate: string; durationDays: number; status: string }): boolean {
  if (contract.status !== 'active') return false;

  const startDate = new Date(contract.startDate);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + contract.durationDays);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return today >= startDate && today < endDate;
}

function canEditRoutine(createdAt: Date): boolean {
  const now = new Date();
  const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  return diffHours < EDIT_WINDOW_HOURS;
}

export function registerRoutinesRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/routines/baby/:babyId - Returns all routines for baby
  app.fastify.get('/api/routines/baby/:babyId', {
    schema: {
      description: 'Get all routines for baby',
      tags: ['routines'],
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
              wakeUpTime: { type: 'string' },
              motherObservations: { type: ['string', 'null'] },
              consultantComments: { type: ['string', 'null'] },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              naps: { type: 'array' },
              nightSleep: { type: ['object', 'null'] },
            },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { babyId: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, babyId: request.params.babyId }, 'Fetching routines');

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

    const routines = await app.db.query.dailyRoutines.findMany({
      where: eq(schema.dailyRoutines.babyId, request.params.babyId),
      with: {
        naps: true,
        nightSleep: {
          with: { wakings: true },
        },
      },
    });

    // Transform each routine to match the expected response format
    return routines.map((routine) => {
      const nightSleepRecord = (routine.nightSleep && routine.nightSleep.length > 0) ? routine.nightSleep[0] : null;

      if (nightSleepRecord) {
        app.logger.info({ routineId: routine.id, nightSleepId: nightSleepRecord.id, wakingsCount: nightSleepRecord.wakings?.length || 0 }, 'Night sleep found for routine');
      } else {
        app.logger.debug({ routineId: routine.id }, 'No night sleep found for routine');
      }

      return {
        id: routine.id,
        babyId: routine.babyId,
        date: routine.date,
        wakeUpTime: routine.wakeUpTime,
        motherObservations: routine.motherObservations,
        consultantComments: routine.consultantComments,
        createdAt: routine.createdAt,
        updatedAt: routine.updatedAt,
        naps: routine.naps,
        nightSleep: nightSleepRecord,
      };
    });
  });

  // GET /api/routines/:id - Returns specific routine with naps and night sleep
  app.fastify.get('/api/routines/:id', {
    schema: {
      description: 'Get specific routine with naps and night sleep',
      tags: ['routines'],
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
            babyId: { type: 'string', format: 'uuid' },
            date: { type: 'string', format: 'date' },
            wakeUpTime: { type: 'string' },
            motherObservations: { type: ['string', 'null'] },
            consultantComments: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            naps: { type: 'array' },
            nightSleep: { type: ['object', 'null'] },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, routineId: request.params.id }, 'Fetching routine details');

    const routine = await app.db.query.dailyRoutines.findFirst({
      where: eq(schema.dailyRoutines.id, request.params.id),
      with: {
        baby: true,
        naps: true,
        nightSleep: {
          with: { wakings: true },
        },
      },
    });

    if (!routine) {
      app.logger.warn({ routineId: request.params.id }, 'Routine not found');
      return reply.status(404).send({ error: 'Routine not found' });
    }

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    const isConsultant = consultant && routine.baby.consultantId === consultant.id;
    const isMother = routine.baby.motherUserId === session.user.id;

    if (!isConsultant && !isMother) {
      app.logger.warn({ userId: session.user.id, routineId: request.params.id }, 'Not authorized');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    const nightSleepRecord = (routine.nightSleep && routine.nightSleep.length > 0) ? routine.nightSleep[0] : null;

    if (nightSleepRecord) {
      app.logger.info({ routineId: routine.id, nightSleepId: nightSleepRecord.id, wakingsCount: nightSleepRecord.wakings?.length || 0 }, 'Night sleep found for routine');
    } else {
      app.logger.debug({ routineId: routine.id }, 'No night sleep found for routine');
    }

    return {
      id: routine.id,
      babyId: routine.babyId,
      date: routine.date,
      wakeUpTime: routine.wakeUpTime,
      motherObservations: routine.motherObservations,
      consultantComments: routine.consultantComments,
      createdAt: routine.createdAt,
      updatedAt: routine.updatedAt,
      naps: routine.naps,
      nightSleep: nightSleepRecord,
    };
  });

  // POST /api/routines - Creates routine
  app.fastify.post('/api/routines', {
    schema: {
      description: 'Create a new daily routine',
      tags: ['routines'],
      body: {
        type: 'object',
        required: ['babyId', 'date', 'wakeUpTime'],
        properties: {
          babyId: { type: 'string', format: 'uuid' },
          date: { type: 'string', format: 'date' },
          wakeUpTime: { type: 'string' },
          motherObservations: { type: ['string', 'null'] },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            babyId: { type: 'string', format: 'uuid' },
            date: { type: 'string', format: 'date' },
            wakeUpTime: { type: 'string' },
            motherObservations: { type: ['string', 'null'] },
            consultantComments: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { babyId: string; date: string; wakeUpTime: string; motherObservations?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Creating routine');

    const baby = await app.db.query.babies.findFirst({
      where: eq(schema.babies.id, request.body.babyId),
    });

    if (!baby) {
      app.logger.warn({ babyId: request.body.babyId }, 'Baby not found');
      return reply.status(404).send({ error: 'Baby not found' });
    }

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    const isMother = baby.motherUserId === session.user.id;
    const isConsultant = consultant && baby.consultantId === consultant.id;

    if (!isMother && !isConsultant) {
      app.logger.warn({ userId: session.user.id, babyId: request.body.babyId }, 'Not authorized');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    const contracts = await app.db.query.contracts.findMany({
      where: eq(schema.contracts.babyId, request.body.babyId),
    });

    const activeContract = contracts
      .filter(c => c.status === 'active')
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];

    if (!activeContract || !isContractActive(activeContract)) {
      app.logger.warn({ babyId: request.body.babyId }, 'No active contract');
      return reply.status(403).send({ error: 'No active contract for this baby' });
    }

    const [routine] = await app.db.insert(schema.dailyRoutines).values({
      babyId: request.body.babyId,
      date: request.body.date,
      wakeUpTime: request.body.wakeUpTime,
      motherObservations: request.body.motherObservations || null,
    }).returning();

    app.logger.info({ routineId: routine.id, babyId: request.body.babyId }, 'Routine created successfully');
    return reply.status(201).send(routine);
  });

  // PUT /api/routines/:id - Updates routine
  app.fastify.put('/api/routines/:id', {
    schema: {
      description: 'Update a daily routine',
      tags: ['routines'],
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
          wakeUpTime: { type: 'string' },
          motherObservations: { type: ['string', 'null'] },
          consultantComments: { type: ['string', 'null'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            babyId: { type: 'string', format: 'uuid' },
            date: { type: 'string', format: 'date' },
            wakeUpTime: { type: 'string' },
            motherObservations: { type: ['string', 'null'] },
            consultantComments: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<{ wakeUpTime: string; motherObservations: string | null; consultantComments: string | null }> }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, routineId: request.params.id, body: request.body }, 'Updating routine');

    const routine = await app.db.query.dailyRoutines.findFirst({
      where: eq(schema.dailyRoutines.id, request.params.id),
      with: { baby: true },
    });

    if (!routine) {
      app.logger.warn({ routineId: request.params.id }, 'Routine not found');
      return reply.status(404).send({ error: 'Routine not found' });
    }

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    const isConsultant = consultant && routine.baby.consultantId === consultant.id;
    const isMother = routine.baby.motherUserId === session.user.id;

    if (!isConsultant && !isMother) {
      app.logger.warn({ userId: session.user.id, routineId: request.params.id }, 'Not authorized');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    // Allow observations and comments to be updated anytime (auto-save pattern)
    // Only restrict wakeUpTime changes to 48-hour window
    if (request.body.wakeUpTime !== undefined && !canEditRoutine(routine.createdAt)) {
      app.logger.warn({ routineId: request.params.id }, 'Wake up time cannot be edited after 48 hours');
      return reply.status(403).send({ error: 'Wake up time cannot be edited after 48 hours' });
    }

    if (isMother && request.body.consultantComments !== undefined) {
      app.logger.warn({ userId: session.user.id, routineId: request.params.id }, 'Mother cannot edit consultant comments');
      return reply.status(401).send({ error: 'Mother cannot edit consultant comments' });
    }

    const updateData: any = { ...request.body };
    if (isMother) {
      delete updateData.consultantComments;
    }

    const [updated] = await app.db.update(schema.dailyRoutines)
      .set(updateData)
      .where(eq(schema.dailyRoutines.id, request.params.id))
      .returning();

    app.logger.info({ routineId: updated.id }, 'Routine updated successfully');
    return updated;
  });
}
