import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import { generateToken } from '../utils/token.js';

export function registerConsultantRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/consultant/babies - Creates baby for authenticated consultant
  app.fastify.post('/api/consultant/babies', {
    schema: {
      description: 'Create a new baby for the authenticated consultant',
      tags: ['consultant', 'babies'],
      body: {
        type: 'object',
        required: ['name', 'birthDate', 'motherName', 'motherPhone'],
        properties: {
          name: { type: 'string' },
          birthDate: { type: 'string', format: 'date' },
          motherName: { type: 'string' },
          motherPhone: { type: 'string' },
          objectives: { type: ['string', 'null'] },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            token: { type: 'string' },
            name: { type: 'string' },
            birthDate: { type: 'string', format: 'date' },
            motherName: { type: 'string' },
            motherPhone: { type: 'string' },
            motherEmail: { type: ['string', 'null'] },
            motherUserId: { type: ['string', 'null'] },
            consultantId: { type: 'string', format: 'uuid' },
            objectives: { type: ['string', 'null'] },
            conclusion: { type: ['string', 'null'] },
            archived: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { name: string; birthDate: string; motherName: string; motherPhone: string; objectives?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Creating baby for consultant');

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (!consultant) {
      app.logger.warn({ userId: session.user.id }, 'User is not a consultant');
      return reply.status(401).send({ error: 'Not a consultant' });
    }

    // Generate unique token with retry logic
    let token: string;
    let maxRetries = 10;
    let created = false;

    while (maxRetries > 0 && !created) {
      token = generateToken();

      // Check if token already exists
      const existing = await app.db.query.babies.findFirst({
        where: eq(schema.babies.token, token),
      });

      if (!existing) {
        try {
          const [baby] = await app.db.insert(schema.babies).values({
            token: token,
            name: request.body.name,
            birthDate: request.body.birthDate,
            motherName: request.body.motherName,
            motherPhone: request.body.motherPhone,
            motherEmail: null,
            objectives: request.body.objectives || null,
            consultantId: consultant.id,
          }).returning();

          app.logger.info(
            { babyId: baby.id, token: baby.token, consultantId: consultant.id },
            'Baby created successfully for consultant'
          );
          return reply.status(201).send(baby);
        } catch (err) {
          // Token collision or other error, retry
          maxRetries--;
          if (maxRetries === 0) {
            app.logger.error({ err, userId: session.user.id }, 'Failed to create baby after retries');
            return reply.status(500).send({ error: 'Failed to create baby' });
          }
        }
      } else {
        maxRetries--;
      }
    }

    app.logger.error({ userId: session.user.id }, 'Failed to generate unique token after retries');
    return reply.status(500).send({ error: 'Failed to create baby' });
  });

  // POST /api/consultants/create-profile - Create consultant profile after signup
  app.fastify.post('/api/consultants/create-profile', {
    schema: {
      description: 'Create consultant profile (called after signing up via /api/auth/sign-up/email)',
      tags: ['consultant'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', description: 'Consultant/professional name' },
          professionalTitle: { type: ['string', 'null'], description: 'Professional title (e.g., Dr., Sleep Coach)' },
          description: { type: ['string', 'null'], description: 'Professional description/bio' },
          primaryColor: { type: 'string', default: '#007AFF', description: 'Primary brand color (hex)' },
          secondaryColor: { type: 'string', default: '#5AC8FA', description: 'Secondary brand color (hex)' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            name: { type: 'string' },
            professionalTitle: { type: ['string', 'null'] },
            description: { type: ['string', 'null'] },
            primaryColor: { type: 'string' },
            secondaryColor: { type: 'string' },
            createdAt: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        409: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (
    request: FastifyRequest<{
      Body: {
        name: string;
        professionalTitle?: string | null;
        description?: string | null;
        primaryColor?: string;
        secondaryColor?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { name, professionalTitle, description, primaryColor = '#007AFF', secondaryColor = '#5AC8FA' } = request.body;

    if (!name || name.trim().length === 0) {
      app.logger.warn({ userId: session.user.id }, 'Name missing from create-profile request');
      return reply.status(400).send({ error: 'Name is required' });
    }

    app.logger.info({ userId: session.user.id, name }, 'Creating consultant profile');

    try {
      // Check if consultant profile already exists
      const existingConsultant = await app.db.query.consultants.findFirst({
        where: eq(schema.consultants.userId, session.user.id),
      });

      if (existingConsultant) {
        app.logger.warn({ userId: session.user.id, consultantId: existingConsultant.id }, 'Consultant profile already exists');
        return reply.status(409).send({
          error: 'Consultant profile already exists for this account',
          consultantId: existingConsultant.id,
        });
      }

      // Create consultant profile
      const createdConsultant = await app.db
        .insert(schema.consultants)
        .values({
          userId: session.user.id,
          name,
          professionalTitle: professionalTitle ?? undefined,
          description: description ?? undefined,
          primaryColor,
          secondaryColor,
          photo: undefined,
          logo: undefined,
        })
        .returning();

      app.logger.info(
        { userId: session.user.id, consultantId: createdConsultant[0].id, name },
        'Consultant profile created successfully'
      );

      return reply.status(201).send(createdConsultant[0]);
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Error creating consultant profile');
      return reply.status(500).send({ error: 'Failed to create consultant profile' });
    }
  });

  // GET /api/consultant/profile - Returns consultant profile
  app.fastify.get('/api/consultant/profile', {
    schema: {
      description: 'Get consultant profile',
      tags: ['consultant'],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            name: { type: 'string' },
            photo: { type: ['string', 'null'] },
            logo: { type: ['string', 'null'] },
            professionalTitle: { type: ['string', 'null'] },
            description: { type: ['string', 'null'] },
            primaryColor: { type: 'string' },
            secondaryColor: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching consultant profile');

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (!consultant) {
      app.logger.warn({ userId: session.user.id }, 'Consultant profile not found');
      return reply.status(404).send({ error: 'Consultant profile not found' });
    }

    return consultant;
  });

  // PUT /api/consultant/profile - Updates consultant profile
  app.fastify.put('/api/consultant/profile', {
    schema: {
      description: 'Update consultant profile',
      tags: ['consultant'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          photo: { type: ['string', 'null'] },
          logo: { type: ['string', 'null'] },
          professionalTitle: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
          primaryColor: { type: 'string' },
          secondaryColor: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            name: { type: 'string' },
            photo: { type: ['string', 'null'] },
            logo: { type: ['string', 'null'] },
            professionalTitle: { type: ['string', 'null'] },
            description: { type: ['string', 'null'] },
            primaryColor: { type: 'string' },
            secondaryColor: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: Partial<{ name: string; photo: string | null; logo: string | null; professionalTitle: string | null; description: string | null; primaryColor: string; secondaryColor: string }> }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Updating consultant profile');

    const updated = await app.db.update(schema.consultants)
      .set(request.body)
      .where(eq(schema.consultants.userId, session.user.id))
      .returning();

    if (!updated.length) {
      app.logger.warn({ userId: session.user.id }, 'Failed to update consultant profile');
      return reply.status(404).send({ error: 'Consultant profile not found' });
    }

    app.logger.info({ consultantId: updated[0].id }, 'Consultant profile updated');
    return updated[0];
  });

  // GET /api/consultant/babies - Returns all babies for this consultant with contract status
  app.fastify.get('/api/consultant/babies', {
    schema: {
      description: 'Get all babies for consultant',
      tags: ['consultant', 'babies'],
      querystring: {
        type: 'object',
        properties: {
          includeArchived: { type: 'string', enum: ['true', 'false'] },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              token: { type: ['string', 'null'] },
              name: { type: 'string' },
              birthDate: { type: 'string', format: 'date' },
              motherName: { type: 'string' },
              motherPhone: { type: 'string' },
              motherEmail: { type: 'string' },
              motherUserId: { type: ['string', 'null'] },
              consultantId: { type: 'string', format: 'uuid' },
              objectives: { type: ['string', 'null'] },
              conclusion: { type: ['string', 'null'] },
              archived: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
              ageMonths: { type: 'integer' },
              ageDays: { type: 'integer' },
              activeContract: {
                type: ['object', 'null'],
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  status: { type: 'string' },
                  startDate: { type: 'string', format: 'date' },
                  durationDays: { type: 'integer' },
                  contractPdfUrl: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { includeArchived?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const includeArchived = request.query.includeArchived === 'true';
    app.logger.info({ userId: session.user.id, includeArchived }, 'Fetching consultant babies');

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (!consultant) {
      return reply.status(401).send({ error: 'Not a consultant' });
    }

    const whereConditions = includeArchived
      ? eq(schema.babies.consultantId, consultant.id)
      : and(eq(schema.babies.consultantId, consultant.id), eq(schema.babies.archived, false));

    const babyRecords = await app.db.query.babies.findMany({
      where: whereConditions,
      with: {
        contracts: {
          orderBy: (c) => [c.createdAt],
        },
      },
    });

    const today = new Date();
    const babies = babyRecords.map((baby) => {
      const birthDate = new Date(baby.birthDate);
      let ageMonths = 0;
      let ageDays = 0;

      const monthDiff = today.getMonth() - birthDate.getMonth();
      const yearDiff = today.getFullYear() - birthDate.getFullYear();
      ageMonths = yearDiff * 12 + monthDiff;

      const dayDiff = today.getDate() - birthDate.getDate();
      if (dayDiff < 0) {
        ageMonths--;
        const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        ageDays = prevMonth.getDate() + dayDiff;
      } else {
        ageDays = dayDiff;
      }

      const activeContract = baby.contracts
        .filter(c => c.status === 'active')
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0] || null;

      return {
        ...baby,
        ageMonths,
        ageDays,
        activeContract,
      };
    });

    app.logger.info({ count: babies.length }, 'Fetched consultant babies');
    return babies;
  });

  // GET /api/mother/consultant - Returns consultant profile for mother's linked baby
  app.fastify.get('/api/mother/consultant', {
    schema: {
      description: 'Get consultant profile for mother\'s linked baby',
      tags: ['consultant'],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            name: { type: 'string' },
            photo: { type: ['string', 'null'] },
            logo: { type: ['string', 'null'] },
            professionalTitle: { type: ['string', 'null'] },
            description: { type: ['string', 'null'] },
            primaryColor: { type: 'string' },
            secondaryColor: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching consultant profile for mother');

    // Find all babies linked to this mother, then sort by creation date
    // This ensures predictable ordering if multiple babies are linked
    const babies = await app.db.query.babies.findMany({
      where: eq(schema.babies.motherUserId, session.user.id),
    });

    // Sort by creation time (oldest first) and get the first one
    const baby = babies.length > 0
      ? babies.sort((a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )[0]
      : null;

    if (!baby) {
      app.logger.warn({ userId: session.user.id }, 'No baby linked to mother');
      return reply.status(404).send({ error: 'No baby linked to this mother' });
    }

    // Get consultant profile
    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.id, baby.consultantId),
    });

    if (!consultant) {
      app.logger.warn({ babyId: baby.id, consultantId: baby.consultantId }, 'Consultant not found');
      return reply.status(404).send({ error: 'Consultant not found' });
    }

    app.logger.info({ consultantId: consultant.id, motherUserId: session.user.id }, 'Consultant profile fetched for mother');
    return consultant;
  });
}
