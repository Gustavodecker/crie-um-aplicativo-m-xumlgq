import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';

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

  // POST /api/consultant/register-baby-and-mother - Register baby and create mother account
  app.fastify.post('/api/consultant/register-baby-and-mother', {
    schema: {
      description: 'Register a baby and create mother account with provisional password',
      tags: ['consultant', 'babies', 'mother'],
      body: {
        type: 'object',
        required: ['babyName', 'birthDate', 'motherName', 'motherPhone', 'motherEmail'],
        properties: {
          babyName: { type: 'string', description: 'Baby name' },
          birthDate: { type: 'string', format: 'date', description: 'Baby birth date (YYYY-MM-DD)' },
          motherName: { type: 'string', description: 'Mother name' },
          motherPhone: { type: 'string', description: 'Mother phone' },
          motherEmail: { type: 'string', format: 'email', description: 'Mother email' },
          objectives: { type: ['string', 'null'], description: 'Baby care objectives' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            babyId: { type: 'string', format: 'uuid' },
            motherUserId: { type: 'string' },
            motherEmail: { type: 'string' },
            provisionalPassword: { type: 'string', description: 'Provisional password for mother to use on first login' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        409: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { babyName: string; birthDate: string; motherName: string; motherPhone: string; motherEmail: string; objectives?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { babyName, birthDate, motherName, motherPhone, motherEmail: rawMotherEmail, objectives } = request.body;

    // Normalize email to lowercase
    const motherEmail = rawMotherEmail.toLowerCase().trim();

    app.logger.info(
      { consultantUserId: session.user.id, babyName, motherEmail },
      'Registering baby and creating mother account'
    );

    // Validate required fields
    if (!babyName || babyName.trim().length === 0) {
      return reply.status(400).send({ error: 'Baby name is required' });
    }
    if (!birthDate || birthDate.trim().length === 0) {
      return reply.status(400).send({ error: 'Birth date is required' });
    }
    if (!motherName || motherName.trim().length === 0) {
      return reply.status(400).send({ error: 'Mother name is required' });
    }
    if (!motherPhone || motherPhone.trim().length === 0) {
      return reply.status(400).send({ error: 'Mother phone is required' });
    }
    if (!motherEmail || motherEmail.length === 0) {
      return reply.status(400).send({ error: 'Mother email is required' });
    }

    try {

      // Step 2: Get consultant
      const consultant = await app.db.query.consultants.findFirst({
        where: eq(schema.consultants.userId, session.user.id),
      });

      if (!consultant) {
        app.logger.warn({ userId: session.user.id }, 'Consultant not found');
        return reply.status(401).send({ error: 'Not a consultant' });
      }

      // Step 3: Generate provisional password (12 alphanumeric + special characters)
      const provisionalPassword = Math.random().toString(36).substring(2, 9) +
                                 Math.random().toString(36).substring(2, 6).toUpperCase() +
                                 '!@#'[Math.floor(Math.random() * 3)];

      app.logger.debug({ provisionalPasswordLength: provisionalPassword.length }, 'Generated provisional password');

      // Step 4: Create mother account using Better Auth's signup mechanism
      // This ensures the password is hashed using Better Auth's internal mechanism,
      // which is compatible with Better Auth's login flow
      let motherUserId: string;

      try {
        const signupResponse = await app.fastify.inject({
          method: 'POST',
          url: '/api/auth/sign-up/email',
          payload: {
            email: motherEmail,
            password: provisionalPassword,
            name: motherName,
          },
        });

        // Check for error responses from Better Auth
        if (signupResponse.statusCode !== 200 && signupResponse.statusCode !== 201) {
          const errorData = signupResponse.json() as { error?: { message?: string }; message?: string };
          const errorMessage = errorData.error?.message || errorData.message || '';

          app.logger.warn(
            { status: signupResponse.statusCode, errorMessage, motherEmail },
            'Better Auth signup returned error'
          );

          // Check if it's a duplicate email error
          if (
            signupResponse.statusCode === 409 ||
            errorMessage.toLowerCase().includes('email') ||
            errorMessage.toLowerCase().includes('already') ||
            errorMessage.toLowerCase().includes('exists')
          ) {
            app.logger.warn({ motherEmail }, 'Email already exists');
            return reply.status(409).send({ error: 'Email already exists. Please use a different email.' });
          }

          app.logger.error(
            { status: signupResponse.statusCode, error: errorData, motherEmail },
            'Failed to create mother account via Better Auth signup'
          );
          return reply.status(500).send({ error: 'Failed to create mother account' });
        }

        const signupData = signupResponse.json() as { user?: { id: string } };
        motherUserId = signupData.user?.id;

        if (!motherUserId) {
          app.logger.error(
            { responseData: JSON.stringify(signupData) },
            'Failed to extract user ID from Better Auth signup response'
          );
          return reply.status(500).send({ error: 'Failed to create mother account' });
        }

        app.logger.info({ motherUserId, motherEmail }, 'Mother account created via Better Auth signup');
      } catch (signupError) {
        app.logger.error(
          { err: signupError, motherEmail },
          'Error calling Better Auth signup internally'
        );
        return reply.status(500).send({ error: 'Failed to create mother account' });
      }

      // Step 5: Update user to set requirePasswordChange flag
      await app.db.update(authSchema.user)
        .set({ requirePasswordChange: true })
        .where(eq(authSchema.user.id, motherUserId));

      app.logger.info({ motherUserId }, 'requirePasswordChange flag set for mother account');

      // Step 7: Create baby with motherUserId already set
      const babyId = crypto.randomUUID();
      await app.db.insert(schema.babies).values({
        id: babyId,
        name: babyName,
        birthDate: birthDate,
        motherName: motherName,
        motherPhone: motherPhone,
        motherEmail: motherEmail,
        motherUserId: motherUserId,
        consultantId: consultant.id,
        objectives: objectives || null,
      });

      app.logger.info(
        { babyId, motherUserId, consultantId: consultant.id },
        'Baby created with mother linked'
      );

      app.logger.info(
        { motherEmail, babyName, motherUserId },
        'Baby and mother account created successfully'
      );

      return reply.status(201).send({
        success: true,
        babyId,
        motherUserId,
        motherEmail,
        provisionalPassword,
      });

    } catch (error) {
      app.logger.error(
        { err: error, babyName, motherEmail },
        'Error registering baby and creating mother account'
      );
      return reply.status(500).send({ error: 'Failed to register baby and create mother account' });
    }
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

      // Step 3: Archive the baby
      await app.db.update(schema.babies)
        .set({ archived: true })
        .where(eq(schema.babies.id, babyId));

      app.logger.info({ babyId, consultantId: consultant.id }, 'Baby archived successfully');

      return reply.status(200).send({ success: true });
    } catch (error) {
      app.logger.error({ err: error, babyId }, 'Error archiving baby');
      return reply.status(500).send({ error: 'Failed to archive baby' });
    }
  });
}
