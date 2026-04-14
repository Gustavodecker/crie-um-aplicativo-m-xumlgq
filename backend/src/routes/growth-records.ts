import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { createCustomRequireAuth } from '../index.js';

export function registerGrowthRecordRoutes(app: App) {
  const requireAuth = createCustomRequireAuth(app);

  app.fastify.get('/api/growth-records', { schema: { description: 'List growth records', tags: ['growth-records'], response: { 200: { type: 'object' } } } }, async (request: FastifyRequest<{ Querystring: { babyId?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;
    const records = await app.db.query.growthRecords.findMany({ where: request.query.babyId ? eq(schema.growthRecords.babyId, request.query.babyId) : undefined });
    return { data: records };
  });

  app.fastify.get('/api/growth-records/:id', { schema: { description: 'Get growth record', tags: ['growth-records'], params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } } } }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;
    const record = await app.db.query.growthRecords.findFirst({ where: eq(schema.growthRecords.id, request.params.id) });
    if (!record) return reply.status(404).send({ error: 'Not found' });
    if (record.userId !== session.user.id) return reply.status(403).send({ error: 'Forbidden' });
    return record;
  });

  app.fastify.post('/api/growth-records', { schema: { description: 'Create growth record', tags: ['growth-records'], body: { type: 'object', required: ['babyId', 'date'] } } }, async (request: FastifyRequest<{ Body: { babyId: string; date: string; weight?: string; height?: string; headCircumference?: string; notes?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;
    const recordId = crypto.randomUUID();
    const now = new Date();
    const record = await app.db.insert(schema.growthRecords).values({
      id: recordId,
      babyId: request.body.babyId,
      userId: session.user.id,
      date: request.body.date,
      weight: request.body.weight,
      height: request.body.height,
      headCircumference: request.body.headCircumference,
      notes: request.body.notes,
      createdAt: now,
    }).returning();
    app.logger.info({ recordId }, 'Growth record created successfully');
    return reply.status(200).send(record[0]);
  });

  app.fastify.put('/api/growth-records/:id', { schema: { description: 'Update growth record', tags: ['growth-records'], params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } }, body: { type: 'object' } } }, async (request: FastifyRequest<{ Params: { id: string }; Body: { weight?: string; height?: string; headCircumference?: string; notes?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;
    const record = await app.db.query.growthRecords.findFirst({ where: eq(schema.growthRecords.id, request.params.id) });
    if (!record) return reply.status(404).send({ error: 'Not found' });
    if (record.userId !== session.user.id) return reply.status(403).send({ error: 'Forbidden' });
    const updated = await app.db.update(schema.growthRecords).set({ weight: request.body.weight, height: request.body.height, headCircumference: request.body.headCircumference, notes: request.body.notes }).where(eq(schema.growthRecords.id, request.params.id)).returning();
    return updated[0];
  });

  app.fastify.delete('/api/growth-records/:id', { schema: { description: 'Delete growth record', tags: ['growth-records'], params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } } } }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;
    const record = await app.db.query.growthRecords.findFirst({ where: eq(schema.growthRecords.id, request.params.id) });
    if (!record) return reply.status(404).send({ error: 'Not found' });
    if (record.userId !== session.user.id) return reply.status(403).send({ error: 'Forbidden' });
    await app.db.delete(schema.growthRecords).where(eq(schema.growthRecords.id, request.params.id));
    return reply.status(200).send({ success: true });
  });
}
