import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

export function registerNightSleepRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/night-sleep - Creates night sleep
  app.fastify.post('/api/night-sleep', {
    schema: {
      description: 'Create night sleep record',
      tags: ['night-sleep'],
      body: {
        type: 'object',
        required: ['routineId'],
        properties: {
          routineId: { type: 'string', format: 'uuid' },
          startTryTime: { type: ['string', 'null'] },
          fellAsleepTime: { type: ['string', 'null'] },
          finalWakeTime: { type: ['string', 'null'] },
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
            startTryTime: { type: ['string', 'null'] },
            fellAsleepTime: { type: ['string', 'null'] },
            finalWakeTime: { type: ['string', 'null'] },
            sleepMethod: { type: ['string', 'null'] },
            environment: { type: ['string', 'null'] },
            wakeUpMood: { type: ['string', 'null'] },
            observations: { type: ['string', 'null'] },
            consultantComments: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
            wakings: { type: 'array' },
          },
        },
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            routineId: { type: 'string', format: 'uuid' },
            startTryTime: { type: ['string', 'null'] },
            fellAsleepTime: { type: ['string', 'null'] },
            finalWakeTime: { type: ['string', 'null'] },
            sleepMethod: { type: ['string', 'null'] },
            environment: { type: ['string', 'null'] },
            wakeUpMood: { type: ['string', 'null'] },
            observations: { type: ['string', 'null'] },
            consultantComments: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
            wakings: { type: 'array' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { routineId: string; startTryTime?: string | null; fellAsleepTime?: string | null; finalWakeTime?: string | null; sleepMethod?: string | null; environment?: string | null; wakeUpMood?: string | null; observations?: string | null; consultantComments?: string | null } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, routineId: request.body.routineId }, '[POST /api/night-sleep] STARTING - Received routineId');

    const routine = await app.db.query.dailyRoutines.findFirst({
      where: eq(schema.dailyRoutines.id, request.body.routineId),
      with: { baby: true },
    });

    if (!routine) {
      app.logger.warn({ routineId: request.body.routineId }, '[POST /api/night-sleep] Routine not found');
      return reply.status(404).send({ error: 'Routine not found' });
    }

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    const isMother = routine.baby.motherUserId === session.user.id;
    const isConsultant = consultant && routine.baby.consultantId === consultant.id;

    if (!isMother && !isConsultant) {
      app.logger.warn({ userId: session.user.id, routineId: request.body.routineId }, '[POST /api/night-sleep] Not authorized');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    // Check if night sleep record already exists for this routine
    app.logger.debug({ routineId: request.body.routineId }, '[POST /api/night-sleep] Checking for existing record');
    const existingRecord = await app.db.query.nightSleep.findFirst({
      where: eq(schema.nightSleep.routineId, request.body.routineId),
    });

    if (existingRecord) {
      app.logger.info({ existingNightSleepId: existingRecord.id, routineId: request.body.routineId }, '[POST /api/night-sleep] Found existing night sleep record');
    } else {
      app.logger.info({ routineId: request.body.routineId }, '[POST /api/night-sleep] No existing night sleep record found, creating new one');
    }

    let nightSleepRecord;

    if (existingRecord) {
      // Update existing record
      app.logger.debug({ nightSleepId: existingRecord.id, routineId: request.body.routineId }, '[POST /api/night-sleep] Updating existing record');
      const [updated] = await app.db.update(schema.nightSleep)
        .set({
          startTryTime: (request.body.startTryTime && request.body.startTryTime.trim()) ? request.body.startTryTime : null,
          fellAsleepTime: (request.body.fellAsleepTime && request.body.fellAsleepTime.trim()) ? request.body.fellAsleepTime : null,
          finalWakeTime: (request.body.finalWakeTime && request.body.finalWakeTime.trim()) ? request.body.finalWakeTime : null,
          sleepMethod: request.body.sleepMethod || null,
          environment: request.body.environment || null,
          wakeUpMood: request.body.wakeUpMood || null,
          observations: request.body.observations || null,
          consultantComments: request.body.consultantComments || null,
        })
        .where(eq(schema.nightSleep.id, existingRecord.id))
        .returning();
      nightSleepRecord = updated;
      app.logger.info({
        nightSleepId: nightSleepRecord.id,
        routineId: nightSleepRecord.routineId,
        createdAt: nightSleepRecord.createdAt,
        startTryTime: nightSleepRecord.startTryTime
      }, '[POST /api/night-sleep] UPDATED - Record persisted');
    } else {
      // Create new record
      app.logger.debug({ routineId: request.body.routineId }, '[POST /api/night-sleep] Inserting new record');
      const [created] = await app.db.insert(schema.nightSleep).values({
        routineId: request.body.routineId,
        startTryTime: (request.body.startTryTime && request.body.startTryTime.trim()) ? request.body.startTryTime : null,
        fellAsleepTime: (request.body.fellAsleepTime && request.body.fellAsleepTime.trim()) ? request.body.fellAsleepTime : null,
        finalWakeTime: (request.body.finalWakeTime && request.body.finalWakeTime.trim()) ? request.body.finalWakeTime : null,
        sleepMethod: request.body.sleepMethod || null,
        environment: request.body.environment || null,
        wakeUpMood: request.body.wakeUpMood || null,
        observations: request.body.observations || null,
        consultantComments: request.body.consultantComments || null,
      }).returning();
      nightSleepRecord = created;
      app.logger.info({
        nightSleepId: nightSleepRecord.id,
        routineId: nightSleepRecord.routineId,
        createdAt: nightSleepRecord.createdAt,
        startTryTime: nightSleepRecord.startTryTime
      }, '[POST /api/night-sleep] CREATED - Record persisted');
    }

    // Fetch complete record with wakings for response
    const completeRecord = await app.db.query.nightSleep.findFirst({
      where: eq(schema.nightSleep.routineId, request.body.routineId),
      with: { wakings: true },
    });

    if (completeRecord) {
      app.logger.info({
        verifiedNightSleepId: completeRecord.id,
        routineId: completeRecord.routineId,
        createdAt: completeRecord.createdAt,
        wakingsCount: completeRecord.wakings?.length || 0
      }, '[POST /api/night-sleep] VERIFICATION SUCCESS - Record confirmed in database with wakings');
    } else {
      app.logger.error({ routineId: request.body.routineId }, '[POST /api/night-sleep] VERIFICATION FAILED - Record not found after insert/update!');
    }

    return reply.status(existingRecord ? 200 : 201).send(completeRecord || nightSleepRecord);
  });

  // PUT /api/night-sleep/:id - Updates night sleep
  app.fastify.put('/api/night-sleep/:id', {
    schema: {
      description: 'Update night sleep record',
      tags: ['night-sleep'],
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
          startTryTime: { type: ['string', 'null'] },
          fellAsleepTime: { type: ['string', 'null'] },
          finalWakeTime: { type: ['string', 'null'] },
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
            startTryTime: { type: ['string', 'null'] },
            fellAsleepTime: { type: ['string', 'null'] },
            finalWakeTime: { type: ['string', 'null'] },
            sleepMethod: { type: ['string', 'null'] },
            environment: { type: ['string', 'null'] },
            wakeUpMood: { type: ['string', 'null'] },
            observations: { type: ['string', 'null'] },
            consultantComments: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
            wakings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  nightSleepId: { type: 'string', format: 'uuid' },
                  startTime: { type: 'string' },
                  endTime: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<{ startTryTime: string | null; fellAsleepTime: string | null; finalWakeTime: string | null; sleepMethod: string | null; environment: string | null; wakeUpMood: string | null; observations: string | null; consultantComments: string | null }> }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, nightSleepId: request.params.id }, '[PUT /api/night-sleep/:id] STARTING - Updating night sleep record');

    const nightSleepRecord = await app.db.query.nightSleep.findFirst({
      where: eq(schema.nightSleep.id, request.params.id),
      with: {
        routine: { with: { baby: true } },
      },
    });

    if (!nightSleepRecord) {
      app.logger.warn({ nightSleepId: request.params.id }, '[PUT /api/night-sleep/:id] Night sleep record not found');
      return reply.status(404).send({ error: 'Night sleep record not found' });
    }

    app.logger.info({
      nightSleepId: nightSleepRecord.id,
      routineId: nightSleepRecord.routineId,
      updatingFields: Object.keys(request.body)
    }, '[PUT /api/night-sleep/:id] Record found, updating fields');

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    const isMother = nightSleepRecord.routine.baby.motherUserId === session.user.id;
    const isConsultant = consultant && nightSleepRecord.routine.baby.consultantId === consultant.id;

    if (!isMother && !isConsultant) {
      app.logger.warn({ userId: session.user.id, nightSleepId: request.params.id }, '[PUT /api/night-sleep/:id] Not authorized');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    // Normalize time fields: convert empty strings to null
    const updateData: any = { ...request.body };
    if ('startTryTime' in updateData && updateData.startTryTime !== null && (!updateData.startTryTime || !updateData.startTryTime.trim())) {
      updateData.startTryTime = null;
    }
    if ('fellAsleepTime' in updateData && updateData.fellAsleepTime !== null && (!updateData.fellAsleepTime || !updateData.fellAsleepTime.trim())) {
      updateData.fellAsleepTime = null;
    }
    if ('finalWakeTime' in updateData && updateData.finalWakeTime !== null && (!updateData.finalWakeTime || !updateData.finalWakeTime.trim())) {
      updateData.finalWakeTime = null;
    }

    app.logger.debug({ nightSleepId: request.params.id, normalizedData: updateData }, '[PUT /api/night-sleep/:id] Executing update');
    const [updated] = await app.db.update(schema.nightSleep)
      .set(updateData)
      .where(eq(schema.nightSleep.id, request.params.id))
      .returning();

    app.logger.info({
      nightSleepId: updated.id,
      routineId: updated.routineId,
      startTryTime: updated.startTryTime,
      fellAsleepTime: updated.fellAsleepTime,
      finalWakeTime: updated.finalWakeTime
    }, '[PUT /api/night-sleep/:id] UPDATED - Record persisted successfully');

    // Fetch complete record with wakings for response
    const completeRecord = await app.db.query.nightSleep.findFirst({
      where: eq(schema.nightSleep.id, request.params.id),
      with: { wakings: true },
    });

    return completeRecord || updated;
  });

  // POST /api/night-wakings - Adds night waking
  app.fastify.post('/api/night-wakings', {
    schema: {
      description: 'Add a night waking',
      tags: ['night-sleep'],
      body: {
        type: 'object',
        required: ['nightSleepId', 'startTime', 'endTime'],
        properties: {
          nightSleepId: { type: 'string', format: 'uuid' },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            nightSleepId: { type: 'string', format: 'uuid' },
            startTime: { type: 'string' },
            endTime: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { nightSleepId: string; startTime: string; endTime: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Creating night waking');

    const nightSleepRecord = await app.db.query.nightSleep.findFirst({
      where: eq(schema.nightSleep.id, request.body.nightSleepId),
      with: {
        routine: { with: { baby: true } },
      },
    });

    if (!nightSleepRecord) {
      app.logger.warn({ nightSleepId: request.body.nightSleepId }, 'Night sleep record not found');
      return reply.status(404).send({ error: 'Night sleep record not found' });
    }

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    const isMother = nightSleepRecord.routine.baby.motherUserId === session.user.id;
    const isConsultant = consultant && nightSleepRecord.routine.baby.consultantId === consultant.id;

    if (!isMother && !isConsultant) {
      app.logger.warn({ userId: session.user.id, nightSleepId: request.body.nightSleepId }, 'Not authorized');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    const [waking] = await app.db.insert(schema.nightWakings).values({
      nightSleepId: request.body.nightSleepId,
      startTime: request.body.startTime,
      endTime: request.body.endTime,
    }).returning();

    app.logger.info({ wakingId: waking.id, nightSleepId: request.body.nightSleepId }, 'Night waking created successfully');
    return reply.status(201).send(waking);
  });

  // PUT /api/night-wakings/:id - Updates night waking
  app.fastify.put('/api/night-wakings/:id', {
    schema: {
      description: 'Update a night waking',
      tags: ['night-sleep'],
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
          startTime: { type: 'string' },
          endTime: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            nightSleepId: { type: 'string', format: 'uuid' },
            startTime: { type: 'string' },
            endTime: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<{ startTime: string; endTime: string }> }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, wakingId: request.params.id, body: request.body }, 'Updating night waking');

    const waking = await app.db.query.nightWakings.findFirst({
      where: eq(schema.nightWakings.id, request.params.id),
      with: {
        nightSleep: {
          with: {
            routine: { with: { baby: true } },
          },
        },
      },
    });

    if (!waking) {
      app.logger.warn({ wakingId: request.params.id }, 'Night waking not found');
      return reply.status(404).send({ error: 'Night waking not found' });
    }

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    const isMother = waking.nightSleep.routine.baby.motherUserId === session.user.id;
    const isConsultant = consultant && waking.nightSleep.routine.baby.consultantId === consultant.id;

    if (!isMother && !isConsultant) {
      app.logger.warn({ userId: session.user.id, wakingId: request.params.id }, 'Not authorized');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    const [updated] = await app.db.update(schema.nightWakings)
      .set(request.body)
      .where(eq(schema.nightWakings.id, request.params.id))
      .returning();

    app.logger.info({ wakingId: updated.id }, 'Night waking updated successfully');
    return updated;
  });

  // DELETE /api/night-wakings/:id - Deletes night waking
  app.fastify.delete('/api/night-wakings/:id', {
    schema: {
      description: 'Delete a night waking',
      tags: ['night-sleep'],
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

    app.logger.info({ userId: session.user.id, wakingId: request.params.id }, 'Deleting night waking');

    const waking = await app.db.query.nightWakings.findFirst({
      where: eq(schema.nightWakings.id, request.params.id),
      with: {
        nightSleep: {
          with: {
            routine: { with: { baby: true } },
          },
        },
      },
    });

    if (!waking) {
      app.logger.warn({ wakingId: request.params.id }, 'Night waking not found');
      return reply.status(404).send({ error: 'Night waking not found' });
    }

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    const isMother = waking.nightSleep.routine.baby.motherUserId === session.user.id;
    const isConsultant = consultant && waking.nightSleep.routine.baby.consultantId === consultant.id;

    if (!isMother && !isConsultant) {
      app.logger.warn({ userId: session.user.id, wakingId: request.params.id }, 'Not authorized');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    await app.db.delete(schema.nightWakings).where(eq(schema.nightWakings.id, request.params.id));

    app.logger.info({ wakingId: request.params.id }, 'Night waking deleted successfully');
    return reply.status(204).send();
  });
}
