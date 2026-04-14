import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { createCustomRequireAuth } from '../index.js';

export function registerFeedingLogRoutes(app: App) {
  const requireAuth = createCustomRequireAuth(app);

  app.fastify.get('/api/feeding-logs', { schema: { description: 'List feeding logs', tags: ['feeding-logs'], response: { 200: { type: 'object' } } } }, async (request: FastifyRequest<{ Querystring: { babyId?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;
    const logs = await app.db.query.feedingLogs.findMany({ where: request.query.babyId ? eq(schema.feedingLogs.babyId, request.query.babyId) : undefined });
    return { data: logs };
  });

  app.fastify.get('/api/feeding-logs/:id', { schema: { description: 'Get feeding log', tags: ['feeding-logs'], params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } } } }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;
    const log = await app.db.query.feedingLogs.findFirst({ where: eq(schema.feedingLogs.id, request.params.id) });
    if (!log) return reply.status(404).send({ error: 'Not found' });
    if (log.userId !== session.user.id) return reply.status(403).send({ error: 'Forbidden' });
    return log;
  });

  app.fastify.post('/api/feeding-logs', { schema: { description: 'Create feeding log', tags: ['feeding-logs'], body: { type: 'object', required: ['babyId', 'time', 'type'] } } }, async (request: FastifyRequest<{ Body: { babyId: string; time: string; type: string; duration?: number; amount?: string; notes?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;
    const logId = crypto.randomUUID();
    const now = new Date();
    const log = await app.db.insert(schema.feedingLogs).values({
      id: logId,
      babyId: request.body.babyId,
      userId: session.user.id,
      time: new Date(request.body.time),
      type: request.body.type,
      duration: request.body.duration,
      amount: request.body.amount ? request.body.amount : null,
      notes: request.body.notes,
      createdAt: now,
    }).returning();
    app.logger.info({ logId }, 'Feeding log created successfully');
    return reply.status(200).send(log[0]);
  });

  app.fastify.put('/api/feeding-logs/:id', { schema: { description: 'Update feeding log', tags: ['feeding-logs'], params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } }, body: { type: 'object' } } }, async (request: FastifyRequest<{ Params: { id: string }; Body: { duration?: number; amount?: string; notes?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;
    const log = await app.db.query.feedingLogs.findFirst({ where: eq(schema.feedingLogs.id, request.params.id) });
    if (!log) return reply.status(404).send({ error: 'Not found' });
    if (log.userId !== session.user.id) return reply.status(403).send({ error: 'Forbidden' });
    const updateData: any = {};
    if (request.body.duration !== undefined) updateData.duration = request.body.duration;
    if (request.body.amount !== undefined) updateData.amount = request.body.amount;
    if (request.body.notes !== undefined) updateData.notes = request.body.notes;
    if (Object.keys(updateData).length === 0) return log;
    const updated = await app.db.update(schema.feedingLogs).set(updateData).where(eq(schema.feedingLogs.id, request.params.id)).returning();
    return updated[0];
  });

  app.fastify.delete('/api/feeding-logs/:id', { schema: { description: 'Delete feeding log', tags: ['feeding-logs'], params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } } } }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;
    const log = await app.db.query.feedingLogs.findFirst({ where: eq(schema.feedingLogs.id, request.params.id) });
    if (!log) return reply.status(404).send({ error: 'Not found' });
    if (log.userId !== session.user.id) return reply.status(403).send({ error: 'Forbidden' });
    await app.db.delete(schema.feedingLogs).where(eq(schema.feedingLogs.id, request.params.id));
    return reply.status(200).send({ success: true });
  });
}
