import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

export function registerInitRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/init/consultant - Initialize consultant profile after signup
  app.fastify.post('/api/init/consultant', {
    schema: {
      description: 'Initialize consultant profile',
      tags: ['init'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          photo: { type: ['string', 'null'] },
          logo: { type: ['string', 'null'] },
          primaryColor: { type: ['string', 'null'] },
          secondaryColor: { type: ['string', 'null'] },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            name: { type: 'string' },
            photo: { type: ['string', 'null'] },
            logo: { type: ['string', 'null'] },
            primaryColor: { type: 'string' },
            secondaryColor: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { name: string; photo?: string | null; logo?: string | null; primaryColor?: string | null; secondaryColor?: string | null } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Initializing consultant profile');

    const existing = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (existing) {
      app.logger.warn({ userId: session.user.id }, 'Consultant profile already exists');
      return reply.status(400).send({ error: 'Consultant profile already exists' });
    }

    const [consultant] = await app.db.insert(schema.consultants).values({
      userId: session.user.id,
      name: request.body.name,
      photo: request.body.photo || null,
      logo: request.body.logo || null,
      primaryColor: request.body.primaryColor || '#6B4CE6',
      secondaryColor: request.body.secondaryColor || '#9D7FEA',
    }).returning();

    app.logger.info({ consultantId: consultant.id, userId: session.user.id }, 'Consultant profile initialized');
    return reply.status(201).send(consultant);
  });
}
