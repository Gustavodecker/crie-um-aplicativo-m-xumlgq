import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, or } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { createCustomRequireAuth } from '../index.js';

export function registerMessageRoutes(app: App) {
  const requireAuth = createCustomRequireAuth(app);

  app.fastify.get('/api/messages', {
    schema: {
      description: 'List messages',
      tags: ['messages'],
      response: { 200: { type: 'object', properties: { data: { type: 'array' } } } },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'GET /api/messages');

    const messages = await app.db.query.messages.findMany({
      where: or(
        eq(schema.messages.senderId, session.user.id),
        eq(schema.messages.receiverId, session.user.id),
      ),
    });

    return { data: messages };
  });

  app.fastify.post('/api/messages', {
    schema: {
      description: 'Send message',
      tags: ['messages'],
      body: {
        type: 'object',
        required: ['receiverId', 'content'],
        properties: {
          receiverId: { type: 'string' },
          content: { type: 'string' },
        },
      },
      response: { 201: { type: 'object' } },
    },
  }, async (request: FastifyRequest<{ Body: { receiverId: string; content: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'POST /api/messages');

    const messageId = crypto.randomUUID();
    const now = new Date();
    const messages = await app.db.insert(schema.messages).values({
      id: messageId,
      senderId: session.user.id,
      receiverId: request.body.receiverId,
      content: request.body.content,
      read: false,
      createdAt: now,
    }).returning();

    app.logger.info({ messageId }, 'Message created successfully');
    return reply.status(201).send(messages[0]);
  });

  app.fastify.put('/api/messages/:id/read', {
    schema: {
      description: 'Mark message as read',
      tags: ['messages'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
      response: { 200: { type: 'object' } },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const message = await app.db.query.messages.findFirst({
      where: eq(schema.messages.id, request.params.id),
    });

    if (!message) return reply.status(404).send({ error: 'Not found' });
    if (message.receiverId !== session.user.id) return reply.status(403).send({ error: 'Forbidden' });

    app.logger.info({ messageId: request.params.id }, 'PUT /api/messages/:id/read');

    const [updated] = await app.db.update(schema.messages)
      .set({ read: true })
      .where(eq(schema.messages.id, request.params.id))
      .returning();

    return updated;
  });

  app.fastify.delete('/api/messages/:id', {
    schema: {
      description: 'Delete message',
      tags: ['messages'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const message = await app.db.query.messages.findFirst({
      where: eq(schema.messages.id, request.params.id),
    });

    if (!message) return reply.status(404).send({ error: 'Not found' });
    if (message.senderId !== session.user.id) return reply.status(403).send({ error: 'Forbidden' });

    app.logger.info({ messageId: request.params.id }, 'DELETE /api/messages/:id');

    await app.db.delete(schema.messages).where(eq(schema.messages.id, request.params.id));
    return reply.status(200).send({ success: true });
  });
}
