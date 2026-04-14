import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { createCustomRequireAuth } from '../index.js';

export function registerNotificationRoutes(app: App) {
  const requireAuth = createCustomRequireAuth(app);

  app.fastify.get('/api/notifications', { schema: { description: 'List notifications', tags: ['notifications'], response: { 200: { type: 'object' } } } }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;
    const notifications = await app.db.query.notifications.findMany({ where: eq(schema.notifications.userId, session.user.id) });
    return { data: notifications };
  });

  app.fastify.put('/api/notifications/:id/read', { schema: { description: 'Mark notification as read', tags: ['notifications'], params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } } } }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;
    const notification = await app.db.query.notifications.findFirst({ where: eq(schema.notifications.id, request.params.id) });
    if (!notification) return reply.status(404).send({ error: 'Not found' });
    if (notification.userId !== session.user.id) return reply.status(403).send({ error: 'Forbidden' });
    const updated = await app.db.update(schema.notifications).set({ read: true }).where(eq(schema.notifications.id, request.params.id)).returning();
    return updated[0];
  });

  app.fastify.delete('/api/notifications/:id', { schema: { description: 'Delete notification', tags: ['notifications'], params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } } } }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;
    const notification = await app.db.query.notifications.findFirst({ where: eq(schema.notifications.id, request.params.id) });
    if (!notification) return reply.status(404).send({ error: 'Not found' });
    if (notification.userId !== session.user.id) return reply.status(403).send({ error: 'Forbidden' });
    await app.db.delete(schema.notifications).where(eq(schema.notifications.id, request.params.id));
    return reply.status(200).send({ success: true });
  });
}
