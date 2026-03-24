import type { App } from '../index.js';
import { createCustomRequireAuth } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';
import crypto from 'crypto';

export function registerConsultantRoutes(app: App) {
  // Use custom auth resolver that properly filters by token (fixes critical bug)
  const requireAuth = createCustomRequireAuth(app);

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

    try {
      const [baby] = await app.db.insert(schema.babies).values({
        name: request.body.name,
        birthDate: request.body.birthDate,
        motherName: request.body.motherName,
        motherPhone: request.body.motherPhone,
        motherEmail: null,
        motherUserId: null,
        objectives: request.body.objectives || null,
        consultantId: consultant.id,
      }).returning();

      app.logger.info(
        { babyId: baby.id, consultantId: consultant.id },
        'Baby created successfully for consultant'
      );
      return reply.status(201).send(baby);
    } catch (err) {
      app.logger.error({ err, userId: session.user.id }, 'Failed to create baby');
      return reply.status(500).send({ error: 'Failed to create baby' });
    }
  });

  // POST /api/consultant/register-baby-and-mother - Register a baby and create/reuse mother account
  app.fastify.post('/api/consultant/register-baby-and-mother', {
    schema: {
      description: 'Register a baby and create/reuse mother account for the authenticated consultant',
      tags: ['consultant', 'babies', 'mother'],
      body: {
        type: 'object',
        required: ['name', 'birthDate', 'motherName', 'motherPhone', 'motherEmail'],
        properties: {
          name: { type: 'string', description: 'Baby name' },
          birthDate: { type: 'string', format: 'date', description: 'Birth date' },
          motherName: { type: 'string', description: 'Mother name' },
          motherPhone: { type: 'string', description: 'Mother phone' },
          motherEmail: { type: 'string', description: 'Mother email' },
          objectives: { type: ['string', 'null'], description: 'Baby care objectives (optional)' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
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
            temporaryPassword: { type: ['string', 'null'] },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { name: string; birthDate: string; motherName: string; motherPhone: string; motherEmail: string; objectives?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const userId = session.user.id;
    const { name, birthDate, motherName, motherPhone, motherEmail, objectives } = request.body;

    app.logger.info({ userId, name, motherEmail }, 'Registering baby and mother');

    // Validate required fields
    if (!name || !name.trim()) {
      app.logger.warn({ userId }, 'Baby name is required');
      return reply.status(400).send({ error: 'Baby name is required' });
    }
    if (!birthDate || !birthDate.trim()) {
      app.logger.warn({ userId }, 'Birth date is required');
      return reply.status(400).send({ error: 'Birth date is required' });
    }
    if (!motherName || !motherName.trim()) {
      app.logger.warn({ userId }, 'Mother name is required');
      return reply.status(400).send({ error: 'Mother name is required' });
    }
    if (!motherPhone || !motherPhone.trim()) {
      app.logger.warn({ userId }, 'Mother phone is required');
      return reply.status(400).send({ error: 'Mother phone is required' });
    }
    if (!motherEmail || !motherEmail.trim()) {
      app.logger.warn({ userId }, 'Mother email is required');
      return reply.status(400).send({ error: 'Mother email is required' });
    }

    try {
      // Look up consultant
      const consultant = await app.db.query.consultants.findFirst({
        where: eq(schema.consultants.userId, userId),
      });

      if (!consultant) {
        app.logger.warn({ userId }, 'Consultant profile not found');
        return reply.status(403).send({ error: 'Consultant profile not found' });
      }

      app.logger.info({ userId, consultantId: consultant.id }, 'Found consultant');

      const normalizedEmail = motherEmail.toLowerCase();
      let motherUserId: string | null = null;
      let temporaryPassword: string | null = null;

      // Use fixed provisional password
      const provisionalPassword = 'todanoite123';
      app.logger.debug({ password: provisionalPassword }, 'Using fixed provisional password');

      // Hash the provisional password using bcrypt
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.default.hash(provisionalPassword, 10);

      // Check if user already exists with this email
      const existingUser = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, normalizedEmail),
      });

      if (existingUser) {
        app.logger.info({ userId, motherEmail: normalizedEmail, existingUserId: existingUser.id }, 'Using existing mother user');
        motherUserId = existingUser.id;

        // Update existing user to ensure email_verified = true and create credential account
        await app.db.transaction(async (tx) => {
          // Update user to mark email as verified and disable password change requirement
          await tx.update(authSchema.user)
            .set({
              emailVerified: true,
              requirePasswordChange: false,
            })
            .where(eq(authSchema.user.id, existingUser.id));

          app.logger.debug({ motherId: existingUser.id }, 'Mother user updated with email_verified=true and requirePasswordChange=false');

          // Delete existing credential account if it exists
          await tx.delete(authSchema.account)
            .where(
              and(
                eq(authSchema.account.userId, existingUser.id),
                eq(authSchema.account.providerId, 'credential')
              )
            );

          app.logger.debug({ motherId: existingUser.id }, 'Deleted existing credential account');

          // Create new credential account with hashed password
          const accountId = crypto.randomUUID();
          await tx.insert(authSchema.account).values({
            id: accountId,
            accountId: normalizedEmail,
            providerId: 'credential',
            userId: existingUser.id,
            password: hashedPassword,
          });

          app.logger.debug({ accountId, motherId: existingUser.id }, 'Credential account created for existing user');
        });

        app.logger.info({ motherEmail: normalizedEmail, userId: existingUser.id }, 'Mother account created/updated successfully');
      } else {
        // Create mother user account in transaction
        const motherId = crypto.randomUUID();
        const accountId = crypto.randomUUID();

        await app.db.transaction(async (tx) => {
          // Create user with email_verified = true and requirePasswordChange = false
          await tx.insert(authSchema.user).values({
            id: motherId,
            name: motherName,
            email: normalizedEmail,
            emailVerified: true,
            requirePasswordChange: false,
            role: 'mother',
          });

          app.logger.debug({ motherId, motherEmail: normalizedEmail }, 'Mother user created with email_verified=true and requirePasswordChange=false');

          // Create account for the user
          await tx.insert(authSchema.account).values({
            id: accountId,
            accountId: normalizedEmail,
            providerId: 'credential',
            userId: motherId,
            password: hashedPassword,
          });

          app.logger.debug({ accountId, motherId }, 'Mother account created');
        });

        motherUserId = motherId;
        app.logger.info({ motherEmail: normalizedEmail, userId: motherId }, 'Mother account created/updated successfully');
      }

      temporaryPassword = provisionalPassword;

      // Create baby record
      const [babyRecord] = await app.db.insert(schema.babies).values({
        name: name,
        birthDate: birthDate,
        motherName: motherName,
        motherPhone: motherPhone,
        motherEmail: normalizedEmail,
        motherUserId: motherUserId,
        consultantId: consultant.id,
        objectives: objectives || null,
        archived: false,
      }).returning();

      app.logger.info(
        { babyId: babyRecord.id, motherUserId, consultantId: consultant.id },
        'Baby and mother registered successfully'
      );

      return reply.status(201).send({
        ...babyRecord,
        temporaryPassword,
      });
    } catch (err) {
      app.logger.error({ err, userId, name, motherEmail }, 'Failed to register baby and mother');
      return reply.status(500).send({ error: 'Failed to register baby and mother' });
    }
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
      description: 'Get all babies for consultant (including archived)',
      tags: ['consultant', 'babies'],
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching consultant babies');

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (!consultant) {
      return reply.status(401).send({ error: 'Not a consultant' });
    }

    // Query ALL babies for this consultant - no filter on archived status
    const babyRecords = await app.db.query.babies.findMany({
      where: eq(schema.babies.consultantId, consultant.id),
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

  // DELETE /api/consultant/babies/:id - Delete a baby
  app.fastify.delete('/api/consultant/babies/:id', {
    schema: {
      description: 'Delete a baby (consultant only)',
      tags: ['consultant', 'babies'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const babyId = request.params.id;
    app.logger.info({ userId: session.user.id, babyId }, 'Attempting to delete baby');

    try {
      // Step 1: Get consultant for authenticated user
      const consultant = await app.db.query.consultants.findFirst({
        where: eq(schema.consultants.userId, session.user.id),
      });

      if (!consultant) {
        app.logger.warn({ userId: session.user.id }, 'Consultant not found');
        return reply.status(404).send({ error: 'Not found' });
      }

      // Step 2: Find baby and verify it belongs to this consultant
      const baby = await app.db.query.babies.findFirst({
        where: and(
          eq(schema.babies.id, babyId),
          eq(schema.babies.consultantId, consultant.id)
        ),
      });

      if (!baby) {
        app.logger.warn(
          { userId: session.user.id, babyId, consultantId: consultant.id },
          'Baby not found or does not belong to consultant'
        );
        return reply.status(404).send({ error: 'Not found' });
      }

      // Step 3: Delete the baby
      await app.db.delete(schema.babies).where(eq(schema.babies.id, babyId));

      app.logger.info({ babyId, consultantId: consultant.id }, 'Baby deleted successfully');

      return reply.status(200).send({ success: true });
    } catch (error) {
      app.logger.error({ err: error, babyId }, 'Error deleting baby');
      return reply.status(500).send({ error: 'Failed to delete baby' });
    }
  });

  // PATCH /api/consultant/babies/:id/archive - Archive a baby
  app.fastify.patch('/api/consultant/babies/:id/archive', {
    schema: {
      description: 'Archive a baby (consultant only)',
      tags: ['consultant', 'babies'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const babyId = request.params.id;
    app.logger.info({ userId: session.user.id, babyId }, 'Attempting to archive baby');

    try {
      // Step 1: Get consultant for authenticated user
      const consultant = await app.db.query.consultants.findFirst({
        where: eq(schema.consultants.userId, session.user.id),
      });

      if (!consultant) {
        app.logger.warn({ userId: session.user.id }, 'Consultant not found');
        return reply.status(404).send({ error: 'Not found' });
      }

      // Step 2: Find baby and verify it belongs to this consultant
      const baby = await app.db.query.babies.findFirst({
        where: and(
          eq(schema.babies.id, babyId),
          eq(schema.babies.consultantId, consultant.id)
        ),
      });

      if (!baby) {
        app.logger.warn(
          { userId: session.user.id, babyId, consultantId: consultant.id },
          'Baby not found or does not belong to consultant'
        );
        return reply.status(404).send({ error: 'Not found' });
      }

      // Step 3: Archive baby and suspend contracts in atomic transaction
      await app.db.transaction(async (tx) => {
        // Update 1: Archive the baby
        await tx.update(schema.babies)
          .set({ archived: true })
          .where(eq(schema.babies.id, babyId));

        app.logger.debug({ babyId }, 'Baby archived in transaction');

        // Update 2: Suspend all contracts for this baby
        await tx.update(schema.contracts)
          .set({ status: 'suspended' })
          .where(eq(schema.contracts.babyId, babyId));

        app.logger.debug({ babyId }, 'Contracts suspended in transaction');
      });

      app.logger.info({ babyId, consultantId: consultant.id }, 'Baby and contracts archived successfully');

      return reply.status(200).send({ success: true });
    } catch (error) {
      app.logger.error({ err: error, babyId }, 'Error archiving baby');
      return reply.status(500).send({ error: 'Failed to archive baby' });
    }
  });

  // PATCH /api/consultant/babies/:id/unarchive - Unarchive a baby
  app.fastify.patch('/api/consultant/babies/:id/unarchive', {
    schema: {
      description: 'Unarchive a baby and reactivate contracts (consultant only)',
      tags: ['consultant', 'babies'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const babyId = request.params.id;
    app.logger.info({ userId: session.user.id, babyId }, 'Attempting to unarchive baby');

    try {
      // Step 1: Get consultant for authenticated user
      const consultant = await app.db.query.consultants.findFirst({
        where: eq(schema.consultants.userId, session.user.id),
      });

      if (!consultant) {
        app.logger.warn({ userId: session.user.id }, 'Consultant not found');
        return reply.status(404).send({ error: 'Not found' });
      }

      // Step 2: Find baby and verify it belongs to this consultant
      const baby = await app.db.query.babies.findFirst({
        where: and(
          eq(schema.babies.id, babyId),
          eq(schema.babies.consultantId, consultant.id)
        ),
      });

      if (!baby) {
        app.logger.warn(
          { userId: session.user.id, babyId, consultantId: consultant.id },
          'Baby not found or does not belong to consultant'
        );
        return reply.status(404).send({ error: 'Not found' });
      }

      // Step 3: Unarchive baby and reactivate contracts in atomic transaction
      await app.db.transaction(async (tx) => {
        // Update 1: Unarchive the baby
        await tx.update(schema.babies)
          .set({ archived: false })
          .where(and(
            eq(schema.babies.id, babyId),
            eq(schema.babies.consultantId, consultant.id)
          ));

        app.logger.debug({ babyId }, 'Baby unarchived in transaction');

        // Update 2: Reactivate all contracts for this baby
        await tx.update(schema.contracts)
          .set({ status: 'active' })
          .where(eq(schema.contracts.babyId, babyId));

        app.logger.debug({ babyId }, 'Contracts reactivated in transaction');
      });

      app.logger.info({ babyId, consultantId: consultant.id }, 'Baby and contracts unarchived successfully');

      return reply.status(200).send({ success: true });
    } catch (error) {
      app.logger.error({ err: error, babyId }, 'Error unarchiving baby');
      return reply.status(500).send({ error: 'Failed to unarchive baby' });
    }
  });

  // PATCH /api/consultant/contracts/:id/archive - Archive a contract
  app.fastify.patch('/api/consultant/contracts/:id/archive', {
    schema: {
      description: 'Archive a contract for the authenticated consultant',
      tags: ['consultant', 'contracts'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Contract ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            babyId: { type: 'string', format: 'uuid' },
            consultantId: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const contractId = request.params.id;
    const userId = session.user.id;

    app.logger.info({ userId, contractId }, 'Archive contract request received');

    try {
      // Look up consultant
      const consultant = await app.db.query.consultants.findFirst({
        where: eq(schema.consultants.userId, userId),
      });

      if (!consultant) {
        app.logger.warn({ userId }, 'Consultant not found');
        return reply.status(403).send({ error: 'Access denied' });
      }

      // Look up contract
      const contract = await app.db.query.contracts.findFirst({
        where: eq(schema.contracts.id, contractId),
      });

      if (!contract) {
        app.logger.warn({ contractId }, 'Contract not found');
        return reply.status(404).send({ error: 'Contract not found' });
      }

      // Verify ownership: contract's baby_id belongs to consultant
      const baby = await app.db.query.babies.findFirst({
        where: and(
          eq(schema.babies.id, contract.babyId),
          eq(schema.babies.consultantId, consultant.id)
        ),
      });

      if (!baby) {
        app.logger.warn({ contractId, consultantId: consultant.id }, 'Contract does not belong to consultant');
        return reply.status(403).send({ error: 'Access denied' });
      }

      // Archive the contract
      const [updatedContract] = await app.db.update(schema.contracts)
        .set({ status: 'archived' })
        .where(eq(schema.contracts.id, contractId))
        .returning();

      app.logger.info({ contractId, consultantId: consultant.id }, 'Contract archived successfully');

      return reply.status(200).send(updatedContract);
    } catch (error) {
      app.logger.error({ err: error, contractId, userId }, 'Failed to archive contract');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/consultant/contracts/:id - Delete a contract
  app.fastify.delete('/api/consultant/contracts/:id', {
    schema: {
      description: 'Delete a contract for the authenticated consultant',
      tags: ['consultant', 'contracts'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Contract ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const contractId = request.params.id;
    const userId = session.user.id;

    app.logger.info({ userId, contractId }, 'Delete contract request received');

    try {
      // Look up consultant
      const consultant = await app.db.query.consultants.findFirst({
        where: eq(schema.consultants.userId, userId),
      });

      if (!consultant) {
        app.logger.warn({ userId }, 'Consultant not found');
        return reply.status(403).send({ error: 'Access denied' });
      }

      // Look up contract
      const contract = await app.db.query.contracts.findFirst({
        where: eq(schema.contracts.id, contractId),
      });

      if (!contract) {
        app.logger.warn({ contractId }, 'Contract not found');
        return reply.status(404).send({ error: 'Contract not found' });
      }

      // Verify ownership: contract's baby_id belongs to consultant
      const baby = await app.db.query.babies.findFirst({
        where: and(
          eq(schema.babies.id, contract.babyId),
          eq(schema.babies.consultantId, consultant.id)
        ),
      });

      if (!baby) {
        app.logger.warn({ contractId, consultantId: consultant.id }, 'Contract does not belong to consultant');
        return reply.status(403).send({ error: 'Access denied' });
      }

      // Delete the contract
      await app.db.delete(schema.contracts)
        .where(eq(schema.contracts.id, contractId));

      app.logger.info({ contractId, consultantId: consultant.id }, 'Contract deleted successfully');

      return reply.status(200).send({ message: 'Contract deleted successfully' });
    } catch (error) {
      app.logger.error({ err: error, contractId, userId }, 'Failed to delete contract');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/consultant/repair-mother-accounts - Repair broken mother account rows
  app.fastify.post('/api/consultant/repair-mother-accounts', {
    schema: {
      description: 'Repair broken mother account rows where account_id does not match email',
      tags: ['consultant', 'maintenance'],
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            repaired: { type: 'array', items: { type: 'object', properties: { userId: { type: 'string' }, email: { type: 'string' }, action: { type: 'string' } } } },
            errors: { type: 'array', items: { type: 'object', properties: { userId: { type: 'string' }, email: { type: 'string' }, error: { type: 'string' } } } },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Starting mother account repair');

    try {
      // Find all mother users that have babies linked
      const motherUsers = await app.db.query.user.findMany({
        where: eq(authSchema.user.role, 'mother'),
      });

      app.logger.debug({ count: motherUsers.length }, 'Found mother users');

      const repaired: Array<{ userId: string; email: string; action: string }> = [];
      const errors: Array<{ userId: string; email: string; error: string }> = [];

      // For each mother user, check and fix their credential account
      for (const user of motherUsers) {
        try {
          // Find their credential account
          const credentialAccount = await app.db.query.account.findFirst({
            where: and(
              eq(authSchema.account.userId, user.id),
              eq(authSchema.account.providerId, 'credential')
            ),
          });

          if (credentialAccount) {
            // Check if account_id matches email
            if (credentialAccount.accountId !== user.email) {
              app.logger.warn({ userId: user.id, email: user.email, currentAccountId: credentialAccount.accountId }, 'Fixing account_id mismatch');

              // Update the account row to fix account_id
              await app.db.update(authSchema.account)
                .set({
                  accountId: user.email,
                })
                .where(eq(authSchema.account.id, credentialAccount.id));

              repaired.push({
                userId: user.id,
                email: user.email,
                action: `Fixed account_id: ${credentialAccount.accountId} → ${user.email}`,
              });

              app.logger.info({ userId: user.id, email: user.email }, 'Repaired account_id mismatch');
            }
          } else {
            // No credential account exists - log as warning but don't auto-create
            app.logger.warn({ userId: user.id, email: user.email }, 'Mother user has no credential account');
            errors.push({
              userId: user.id,
              email: user.email,
              error: 'No credential account found (manual intervention may be needed)',
            });
          }
        } catch (err) {
          app.logger.error({ err, userId: user.id, email: user.email }, 'Error repairing mother account');
          errors.push({
            userId: user.id,
            email: user.email,
            error: String(err instanceof Error ? err.message : 'Unknown error'),
          });
        }
      }

      app.logger.info({ repaired: repaired.length, errors: errors.length }, 'Mother account repair completed');

      return reply.status(200).send({
        message: 'Repair completed',
        repaired,
        errors,
      });
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to repair mother accounts');
      return reply.status(500).send({ error: 'Failed to repair mother accounts' });
    }
  });

  // GET /api/consultant/diagnose-mother-account/:email - Diagnose a mother account issue
  app.fastify.get('/api/consultant/diagnose-mother-account/:email', {
    schema: {
      description: 'Diagnose sign-in issues for a specific mother account',
      tags: ['consultant', 'maintenance'],
      params: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', description: 'Mother email address' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            userFound: { type: 'boolean' },
            userId: { type: ['string', 'null'] },
            emailVerified: { type: ['boolean', 'null'] },
            credentialAccountFound: { type: 'boolean' },
            accountIdMatches: { type: ['boolean', 'null'] },
            passwordHashed: { type: ['boolean', 'null'] },
            passwordLength: { type: ['integer', 'null'] },
            issues: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { email: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const email = request.params.email.toLowerCase();
    app.logger.info({ email }, 'Diagnosing mother account');

    try {
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, email),
      });

      if (!user) {
        app.logger.info({ email }, 'User not found for diagnosis');
        return reply.status(404).send({
          email,
          userFound: false,
          userId: null,
          emailVerified: null,
          credentialAccountFound: false,
          accountIdMatches: null,
          passwordHashed: null,
          passwordLength: null,
          issues: ['User does not exist'],
          recommendations: ['Create the user account using the registration endpoint'],
        });
      }

      const credentialAccount = await app.db.query.account.findFirst({
        where: and(
          eq(authSchema.account.userId, user.id),
          eq(authSchema.account.providerId, 'credential')
        ),
      });

      const issues: string[] = [];
      const recommendations: string[] = [];

      if (!credentialAccount) {
        issues.push('No credential account found');
        recommendations.push('Create a credential account with the properly hashed password');
      } else {
        if (credentialAccount.accountId !== email) {
          issues.push(`account_id mismatch: expected "${email}", found "${credentialAccount.accountId}"`);
          recommendations.push('Run POST /api/consultant/repair-mother-accounts to fix');
        }
        if (!credentialAccount.password) {
          issues.push('No password hash stored');
          recommendations.push('Set a proper bcrypt-hashed password');
        }
      }

      if (!user.emailVerified) {
        issues.push('Email not verified (email_verified = false)');
        recommendations.push('Update user to set email_verified = true');
      }

      return reply.status(200).send({
        email,
        userFound: true,
        userId: user.id,
        emailVerified: user.emailVerified,
        credentialAccountFound: !!credentialAccount,
        accountIdMatches: credentialAccount ? credentialAccount.accountId === email : null,
        passwordHashed: credentialAccount ? !!credentialAccount.password : null,
        passwordLength: credentialAccount && credentialAccount.password ? credentialAccount.password.length : null,
        issues,
        recommendations,
      });
    } catch (error) {
      app.logger.error({ err: error, email }, 'Error diagnosing mother account');
      return reply.status(500).send({ error: 'Failed to diagnose account' });
    }
  });
}
