import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { createCustomRequireAuth } from '../index.js';

export function registerSleepLogRoutes(app: App) {
  const requireAuth = createCustomRequireAuth(app);

  app.fastify.get('/api/sleep-logs', {
    schema: { description: 'List sleep logs', tags: ['sleep-logs'], response: { 200: { type: 'object' } } },
  }, async (request: FastifyRequest<{ Querystring: { babyId?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'GET /api/sleep-logs');

    const logs = await app.db.query.sleepLogs.findMany({
      where: request.query.babyId ? eq(schema.sleepLogs.babyId, request.query.babyId) : undefined,
    });

    return { data: logs };
  });

  app.fastify.get('/api/sleep-logs/:id', {
    schema: { description: 'Get sleep log', tags: ['sleep-logs'], params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } } },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const log = await app.db.query.sleepLogs.findFirst({ where: eq(schema.sleepLogs.id, request.params.id) });
    if (!log) return reply.status(404).send({ error: 'Not found' });
    if (log.userId !== session.user.id) return reply.status(403).send({ error: 'Forbidden' });

    return log;
  });

  app.fastify.post('/api/sleep-logs', {
    schema: { description: 'Create sleep log', tags: ['sleep-logs'], body: { type: 'object', required: ['babyId', 'startTime'] } },
  }, async (request: FastifyRequest<{ Body: { babyId: string; startTime: string; endTime?: string; quality?: string; notes?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'POST /api/sleep-logs');

    const logId = crypto.randomUUID();
    const now = new Date();
    const logs = await app.db.insert(schema.sleepLogs).values({
      id: logId,
      babyId: request.body.babyId,
      userId: session.user.id,
      startTime: new Date(request.body.startTime),
      endTime: request.body.endTime ? new Date(request.body.endTime) : null,
      quality: request.body.quality,
      notes: request.body.notes,
      createdAt: now,
    }).returning();

    app.logger.info({ logId }, 'Sleep log created successfully');
    return reply.status(200).send(logs[0]);
  });

  app.fastify.put('/api/sleep-logs/:id', {
    schema: { description: 'Update sleep log', tags: ['sleep-logs'], params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } }, body: { type: 'object' } },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { endTime?: string; quality?: string; notes?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const log = await app.db.query.sleepLogs.findFirst({ where: eq(schema.sleepLogs.id, request.params.id) });
    if (!log) return reply.status(404).send({ error: 'Not found' });
    if (log.userId !== session.user.id) return reply.status(403).send({ error: 'Forbidden' });

    const [updated] = await app.db.update(schema.sleepLogs).set({
      endTime: request.body.endTime ? new Date(request.body.endTime) : undefined,
      quality: request.body.quality,
      notes: request.body.notes,
    }).where(eq(schema.sleepLogs.id, request.params.id)).returning();

    return updated;
  });

  app.fastify.delete('/api/sleep-logs/:id', {
    schema: { description: 'Delete sleep log', tags: ['sleep-logs'], params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } } },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const log = await app.db.query.sleepLogs.findFirst({ where: eq(schema.sleepLogs.id, request.params.id) });
    if (!log) return reply.status(404).send({ error: 'Not found' });
    if (log.userId !== session.user.id) return reply.status(403).send({ error: 'Forbidden' });

    await app.db.delete(schema.sleepLogs).where(eq(schema.sleepLogs.id, request.params.id));
    return reply.status(200).send({ success: true });
  });
}
