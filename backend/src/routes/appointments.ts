import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';
import { createCustomRequireAuth } from '../index.js';

export function registerAppointmentRoutes(app: App) {
  const requireAuth = createCustomRequireAuth(app);

  // GET /api/appointments - List appointments
  app.fastify.get('/api/appointments', {
    schema: {
      description: 'List appointments for authenticated user',
      tags: ['appointments'],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { type: 'object' },
            },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'GET /api/appointments');

    const appointments = await app.db.query.appointments.findMany({
      where: eq(schema.appointments.userId, session.user.id),
    });

    return { data: appointments };
  });

  // GET /api/appointments/:id
  app.fastify.get('/api/appointments/:id', {
    schema: {
      description: 'Get single appointment',
      tags: ['appointments'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: { 200: { type: 'object' }, 404: { type: 'object' } },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ appointmentId: request.params.id }, 'GET /api/appointments/:id');

    const appointment = await app.db.query.appointments.findFirst({
      where: eq(schema.appointments.id, request.params.id),
    });

    if (!appointment) return reply.status(404).send({ error: 'Not found' });
    if (appointment.userId !== session.user.id) return reply.status(403).send({ error: 'Forbidden' });

    return appointment;
  });

  // POST /api/appointments
  app.fastify.post('/api/appointments', {
    schema: {
      description: 'Create appointment',
      tags: ['appointments'],
      body: {
        type: 'object',
        required: ['consultantId', 'dateTime'],
        properties: {
          consultantId: { type: 'string', format: 'uuid' },
          babyId: { type: 'string', format: 'uuid' },
          dateTime: { type: 'string', format: 'date-time' },
          status: { type: 'string' },
          notes: { type: 'string' },
        },
      },
      response: { 201: { type: 'object' }, 401: { type: 'object' } },
    },
  }, async (request: FastifyRequest<{ Body: { consultantId: string; babyId?: string; dateTime: string; status?: string; notes?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'POST /api/appointments');

    const appointmentId = crypto.randomUUID();
    const now = new Date();
    const appointments = await app.db.insert(schema.appointments).values({
      id: appointmentId,
      consultantId: request.body.consultantId,
      userId: session.user.id,
      babyId: request.body.babyId,
      dateTime: new Date(request.body.dateTime),
      status: request.body.status || 'scheduled',
      notes: request.body.notes,
      createdAt: now,
    }).returning();

    app.logger.info({ appointmentId }, 'Appointment created successfully');
    return reply.status(201).send(appointments[0]);
  });

  // PUT /api/appointments/:id
  app.fastify.put('/api/appointments/:id', {
    schema: {
      description: 'Update appointment',
      tags: ['appointments'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: { type: 'object' },
      response: { 200: { type: 'object' }, 403: { type: 'object' }, 404: { type: 'object' } },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { dateTime?: string; status?: string; notes?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const appointment = await app.db.query.appointments.findFirst({
      where: eq(schema.appointments.id, request.params.id),
    });

    if (!appointment) return reply.status(404).send({ error: 'Not found' });
    if (appointment.userId !== session.user.id) return reply.status(403).send({ error: 'Forbidden' });

    app.logger.info({ appointmentId: request.params.id }, 'PUT /api/appointments/:id');

    const [updated] = await app.db.update(schema.appointments)
      .set({
        dateTime: request.body.dateTime ? new Date(request.body.dateTime) : undefined,
        status: request.body.status,
        notes: request.body.notes,
      })
      .where(eq(schema.appointments.id, request.params.id))
      .returning();

    return updated;
  });

  // DELETE /api/appointments/:id
  app.fastify.delete('/api/appointments/:id', {
    schema: {
      description: 'Delete appointment',
      tags: ['appointments'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const appointment = await app.db.query.appointments.findFirst({
      where: eq(schema.appointments.id, request.params.id),
    });

    if (!appointment) return reply.status(404).send({ error: 'Not found' });
    if (appointment.userId !== session.user.id) return reply.status(403).send({ error: 'Forbidden' });

    app.logger.info({ appointmentId: request.params.id }, 'DELETE /api/appointments/:id');

    await app.db.delete(schema.appointments).where(eq(schema.appointments.id, request.params.id));
    return reply.status(200).send({ success: true });
  });
}
