import type { App } from '../index.js';
import { createCustomRequireAuth } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';
import crypto from 'crypto';

export function registerInitRoutes(app: App) {
  const requireAuth = createCustomRequireAuth(app);

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

  // POST /api/init/fix-mother-account - Fix corrupted mother account (data migration endpoint)
  app.fastify.post('/api/init/fix-mother-account', {
    schema: {
      description: 'Fix corrupted mother account with correct credential setup',
      tags: ['init', 'maintenance'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', description: 'Mother email to fix' },
          password: { type: 'string', description: 'Password to set (default: todanoite123)', default: 'todanoite123' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            userId: { type: 'string' },
            email: { type: 'string' },
            emailVerified: { type: 'boolean' },
            accountCreated: { type: 'boolean' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { email: string; password?: string } }>, reply: FastifyReply) => {
    const email = request.body.email.toLowerCase();
    const password = request.body.password || 'todanoite123';

    app.logger.info({ email }, 'Fixing mother account');

    try {
      // Find user by email
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, email),
      });

      if (!user) {
        app.logger.warn({ email }, 'User not found for account fix');
        return reply.status(404).send({ error: 'User not found' });
      }

      app.logger.debug({ userId: user.id, email }, 'Found user');

      // Hash the password using bcryptjs
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.default.hash(password, 10);

      app.logger.debug({ userId: user.id }, 'Generated bcrypt hash');

      // Fix account in transaction
      let accountCreated = false;

      await app.db.transaction(async (tx) => {
        // Step 1: Ensure email_verified is true
        await tx.update(authSchema.user)
          .set({
            emailVerified: true,
          })
          .where(eq(authSchema.user.id, user.id));

        app.logger.debug({ userId: user.id }, 'Updated email_verified to true');

        // Step 2: Delete any existing credential accounts for this user
        await tx.delete(authSchema.account)
          .where(
            and(
              eq(authSchema.account.userId, user.id),
              eq(authSchema.account.providerId, 'credential')
            )
          );

        app.logger.debug({ userId: user.id }, 'Deleted existing credential accounts');

        // Step 3: Insert correct credential account with email as account_id
        const accountId = crypto.randomUUID();
        await tx.insert(authSchema.account).values({
          id: accountId,
          accountId: email,
          providerId: 'credential',
          userId: user.id,
          password: hashedPassword,
        });

        accountCreated = true;
        app.logger.info({ userId: user.id, accountId: email }, 'Created credential account with correct account_id');
      });

      app.logger.info({ userId: user.id, email }, 'Mother account fixed successfully');

      return reply.status(200).send({
        message: 'Mother account fixed successfully',
        userId: user.id,
        email: user.email,
        emailVerified: true,
        accountCreated,
      });
    } catch (error) {
      app.logger.error({ err: error, email }, 'Error fixing mother account');
      return reply.status(500).send({ error: 'Failed to fix mother account' });
    }
  });
}
