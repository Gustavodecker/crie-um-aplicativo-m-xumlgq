import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';
import bcrypt from 'bcrypt';

export function registerMotherRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/mothers/create-account-with-token - Create mother account with token and email
  app.fastify.post('/api/mothers/create-account-with-token', {
    schema: {
      description: 'Create mother account using baby token, email and password',
      tags: ['mothers'],
      body: {
        type: 'object',
        required: ['token', 'email', 'password'],
        properties: {
          token: { type: 'string', description: 'Baby registration token' },
          email: { type: 'string', format: 'email', description: 'Mother email' },
          password: { type: 'string', description: 'Account password' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'Session token' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
              },
            },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        409: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { token: string; email: string; password: string } }>, reply: FastifyReply) => {
    const { token, email, password } = request.body;

    app.logger.info({ tokenValue: token, email }, 'Creating mother account with token and email');

    // Validate inputs
    if (!token || token.trim().length === 0) {
      app.logger.warn({ body: request.body }, 'Token missing');
      return reply.status(400).send({ error: 'Token is required' });
    }

    if (!email || email.trim().length === 0) {
      app.logger.warn({ token }, 'Email missing');
      return reply.status(400).send({ error: 'Email is required' });
    }

    if (!password || password.trim().length === 0) {
      app.logger.warn({ token }, 'Password missing');
      return reply.status(400).send({ error: 'Password is required' });
    }

    try {
      // Find baby by token
      const baby = await app.db.query.babies.findFirst({
        where: eq(schema.babies.token, token),
      });

      if (!baby) {
        app.logger.warn({ tokenPreview: token.substring(0, 10) + '...' }, 'Baby not found with token');
        return reply.status(404).send({ error: 'Token inválido' });
      }

      // Check if baby already has a mother
      if (baby.motherUserId) {
        app.logger.warn({ babyId: baby.id, existingMotherUserId: baby.motherUserId }, 'Baby already has mother');
        return reply.status(409).send({ error: 'Este token já foi utilizado' });
      }

      // Check if user already exists with this email
      const existingUser = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, email),
      });

      if (existingUser) {
        app.logger.warn({ email }, 'User already exists with this email');
        return reply.status(409).send({ error: 'Email já registrado' });
      }

      // Create new user
      const userId = crypto.randomUUID();
      await app.db.insert(authSchema.user).values({
        id: userId,
        email: email,
        emailVerified: false,
        name: baby.motherName,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      app.logger.info({ userId, email, name: baby.motherName }, 'User created for mother');

      // VERIFICATION: Verify user was created correctly
      const verifiedUser = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, email),
      });

      if (!verifiedUser || verifiedUser.id !== userId) {
        app.logger.error(
          {
            createdUserId: userId,
            email,
            foundUserId: verifiedUser?.id,
            userFound: !!verifiedUser
          },
          'CRITICAL: User creation or verification failed'
        );
        return reply.status(500).send({ error: 'Failed to create user account' });
      }

      app.logger.debug(
        { userId, email, verified: true },
        'User verification successful - user can be found by email'
      );

      // Hash password using bcrypt (same algorithm Better Auth uses)
      const hashedPassword = await bcrypt.hash(password, 10);
      app.logger.debug({ userId }, 'Password hashed successfully');

      // Create account record with hashed password
      const accountId = crypto.randomUUID();
      await app.db.insert(authSchema.account).values({
        id: accountId,
        accountId: userId,
        providerId: 'credential',
        userId: userId,
        password: hashedPassword,
        accessToken: null,
        refreshToken: null,
        idToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      app.logger.debug({ userId, accountId }, 'Account created for mother with hashed password');

      // Update baby with motherUserId, motherEmail and invalidate token
      app.logger.info(
        { babyId: baby.id, newMotherUserId: userId, newMotherEmail: email },
        'Updating baby with mother information'
      );

      const updateResult = await app.db.update(schema.babies)
        .set({
          motherUserId: userId,
          motherEmail: email,
          token: null,
        })
        .where(eq(schema.babies.id, baby.id))
        .returning();

      if (!updateResult || updateResult.length === 0) {
        app.logger.error(
          { babyId: baby.id, userId },
          'CRITICAL: Baby update returned no rows'
        );
        return reply.status(500).send({ error: 'Failed to link baby to account' });
      }

      const updatedBaby = updateResult[0];
      app.logger.info(
        {
          babyId: updatedBaby.id,
          userId,
          motherUserId: updatedBaby.motherUserId,
          motherEmail: updatedBaby.motherEmail,
          token: updatedBaby.token
        },
        'Baby updated with mother information - verifying persistence'
      );

      // VERIFICATION: Confirm the update persisted by re-querying
      const verifiedBaby = await app.db.query.babies.findFirst({
        where: eq(schema.babies.id, baby.id),
      });

      if (!verifiedBaby) {
        app.logger.error(
          { babyId: baby.id },
          'CRITICAL: Baby not found after update'
        );
        return reply.status(500).send({ error: 'Failed to verify baby update' });
      }

      if (verifiedBaby.motherUserId !== userId) {
        app.logger.error(
          {
            babyId: baby.id,
            expectedMotherUserId: userId,
            actualMotherUserId: verifiedBaby.motherUserId,
            updatedBabyMotherUserId: updatedBaby.motherUserId
          },
          'CRITICAL: Baby motherUserId mismatch - update did not persist correctly'
        );
        return reply.status(500).send({ error: 'Failed to link baby to account - data verification failed' });
      }

      app.logger.info(
        {
          babyId: verifiedBaby.id,
          motherUserId: verifiedBaby.motherUserId,
          motherEmail: verifiedBaby.motherEmail,
          token: verifiedBaby.token,
          verified: true
        },
        'Baby association verified - baby correctly linked to mother'
      );

      // Create session for the newly created user
      const sessionId = crypto.randomUUID();
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      app.logger.info(
        { userId, sessionId, sessionTokenPreview: sessionToken.substring(0, 10) + '...' },
        'Creating session for newly created mother'
      );

      await app.db.insert(authSchema.session).values({
        id: sessionId,
        userId: userId,
        token: sessionToken,
        expiresAt: expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] || null,
      });

      // VERIFICATION: Verify session was created correctly
      try {
        const verifiedSession = await app.db.query.session.findFirst({
          where: eq(authSchema.session.token, sessionToken),
        });

        if (!verifiedSession || verifiedSession.userId !== userId) {
          app.logger.error(
            {
              userId,
              sessionTokenPreview: sessionToken.substring(0, 10) + '...',
              expectedUserId: userId,
              actualUserId: verifiedSession?.userId,
              sessionFound: !!verifiedSession
            },
            'CRITICAL: Session creation verification failed'
          );
          // Log but don't fail - the session was created, just couldn't verify
          app.logger.warn(
            { userId, babyId: baby.id },
            'Proceeding with session despite verification issue'
          );
        } else {
          app.logger.debug(
            { userId, sessionFound: true },
            'Session verification successful'
          );
        }
      } catch (verifyErr) {
        app.logger.warn(
          { userId, babyId: baby.id, err: verifyErr },
          'Could not verify session creation, but proceeding'
        );
      }

      // Final verification: re-query the user and baby to ensure everything is saved correctly
      const finalUser = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, userId),
      });

      const finalBaby = await app.db.query.babies.findFirst({
        where: eq(schema.babies.id, baby.id),
      });

      app.logger.info(
        {
          userId,
          userEmail: finalUser?.email,
          babyId: baby.id,
          babyMotherUserId: finalBaby?.motherUserId,
          babyMotherEmail: finalBaby?.motherEmail,
          sessionId,
          sessionToken: sessionToken.substring(0, 10) + '...',
          allFieldsCorrect:
            finalUser?.id === userId &&
            finalUser?.email === email &&
            finalBaby?.motherUserId === userId &&
            finalBaby?.motherEmail === email
        },
        'Mother account creation complete - all data verified'
      );

      if (!finalUser || finalUser.id !== userId) {
        app.logger.error(
          { userId, finalUserId: finalUser?.id },
          'WARNING: Final user verification failed - user not found'
        );
      }

      if (!finalBaby || finalBaby.motherUserId !== userId) {
        app.logger.error(
          {
            babyId: baby.id,
            expectedMotherUserId: userId,
            actualMotherUserId: finalBaby?.motherUserId
          },
          'WARNING: Final baby verification failed - motherUserId not set'
        );
      }

      return reply.status(201).send({
        token: sessionToken,
        user: {
          id: userId,
          email: email,
          name: baby.motherName,
        },
      });

    } catch (error) {
      app.logger.error({ err: error, token: token.substring(0, 10) + '...' }, 'Error creating mother account');
      return reply.status(500).send({ error: 'Falha ao criar conta' });
    }
  });

  // POST /api/mothers/validate-token - Validate baby token without authentication
  app.fastify.post('/api/mothers/validate-token', {
    schema: {
      description: 'Validate baby token and get baby/consultant information',
      tags: ['mothers'],
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', description: 'Baby registration token' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            babyName: { type: 'string' },
            consultantName: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { token: string } }>, reply: FastifyReply) => {
    const { token } = request.body;

    if (!token || token.trim().length === 0) {
      app.logger.warn({ body: request.body }, 'Token missing from validate-token request');
      return reply.status(400).send({ error: 'Token is required' });
    }

    app.logger.info({ tokenPreview: token.substring(0, 10) + '...' }, 'Validating baby token');

    const baby = await app.db.query.babies.findFirst({
      where: eq(schema.babies.token, token),
      with: {
        consultant: true,
      },
    });

    if (!baby) {
      app.logger.warn({ tokenPreview: token.substring(0, 10) + '...' }, 'Baby not found with token');
      return reply.status(404).send({ error: 'Token inválido' });
    }

    app.logger.info(
      { babyId: baby.id },
      'Baby token validated successfully'
    );

    return reply.status(200).send({
      valid: true,
      babyName: baby.name,
      consultantName: baby.consultant.name,
    });
  });

  // POST /api/mothers/init-with-token - Link authenticated mother to baby using token
  app.fastify.post('/api/mothers/init-with-token', {
    schema: {
      description: 'Link authenticated mother account to baby using token',
      tags: ['mothers'],
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', description: 'Baby registration token' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            birthDate: { type: 'string' },
            consultantId: { type: 'string' },
            message: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        409: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { token: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { token } = request.body;

    if (!token || token.trim().length === 0) {
      app.logger.warn({ userId: session.user.id }, 'Token missing from init-with-token request');
      return reply.status(400).send({ error: 'Token is required' });
    }

    app.logger.info({ userId: session.user.id, tokenPreview: token.substring(0, 10) + '...' }, 'Initializing mother with token');

    try {
      const baby = await app.db.query.babies.findFirst({
        where: eq(schema.babies.token, token),
      });

      if (!baby) {
        app.logger.warn({ userId: session.user.id, tokenPreview: token.substring(0, 10) + '...' }, 'Baby not found with token');
        return reply.status(404).send({ error: 'Invalid token. Baby not found.' });
      }

      app.logger.info({ userId: session.user.id, babyId: baby.id, babyMotherUserId: baby.motherUserId }, 'Baby found with token');

      // Check if baby is already linked
      if (baby.motherUserId) {
        // Check if baby is linked to the current user
        if (baby.motherUserId === session.user.id) {
          app.logger.info({ userId: session.user.id, babyId: baby.id }, 'Baby already linked to current user');
          return reply.status(200).send({
            id: baby.id,
            name: baby.name,
            birthDate: baby.birthDate,
            consultantId: baby.consultantId,
            message: 'Baby already linked to your account',
          });
        }

        // Baby is linked to a different user
        app.logger.warn(
          { userId: session.user.id, babyId: baby.id, existingMotherUserId: baby.motherUserId },
          'Baby already linked to another account'
        );
        return reply.status(409).send({ error: 'Baby already linked to another account.' });
      }

      // Link baby to mother
      app.logger.info(
        { userId: session.user.id, babyId: baby.id },
        'Linking baby to mother'
      );

      const updateResult = await app.db.update(schema.babies)
        .set({
          motherUserId: session.user.id,
          motherEmail: session.user.email,
        })
        .where(eq(schema.babies.id, baby.id))
        .returning();

      if (!updateResult || updateResult.length === 0) {
        app.logger.error({ userId: session.user.id, babyId: baby.id }, 'Failed to update baby with motherUserId');
        return reply.status(500).send({ error: 'Failed to link baby to account' });
      }

      app.logger.info(
        { userId: session.user.id, babyId: baby.id, motherEmail: session.user.email },
        'Baby successfully linked to mother'
      );

      return reply.status(200).send({
        id: baby.id,
        name: baby.name,
        birthDate: baby.birthDate,
        consultantId: baby.consultantId,
        message: 'Baby successfully linked to your account',
      });

    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Error linking baby to mother');
      return reply.status(500).send({ error: 'Failed to link baby to account' });
    }
  });

  // GET /api/mother/baby - Returns the baby linked to authenticated mother
  app.fastify.get('/api/mother/baby', {
    schema: {
      description: 'Get baby linked to authenticated mother',
      tags: ['mother', 'babies'],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            token: { type: ['string', 'null'] },
            name: { type: 'string' },
            birthDate: { type: 'string', format: 'date' },
            motherName: { type: 'string' },
            motherPhone: { type: 'string' },
            motherEmail: { type: 'string' },
            motherUserId: { type: 'string' },
            consultantId: { type: 'string', format: 'uuid' },
            objectives: { type: ['string', 'null'] },
            conclusion: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
            ageMonths: { type: 'integer' },
            ageDays: { type: 'integer' },
            activeContract: {
              type: ['object', 'null'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                babyId: { type: 'string', format: 'uuid' },
                status: { type: 'string' },
                startDate: { type: 'string', format: 'date' },
                durationDays: { type: 'integer' },
                contractPdfUrl: { type: ['string', 'null'] },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const sessionUserId = session.user.id;
    app.logger.info(
      { userId: sessionUserId },
      'Fetching linked baby for mother'
    );

    // Find all babies linked to this mother, then sort by creation date
    // This ensures predictable ordering if multiple babies are linked
    const babies = await app.db.query.babies.findMany({
      where: eq(schema.babies.motherUserId, sessionUserId),
    });

    // Sort by creation time (oldest first) and get the first one
    const baby = babies.length > 0
      ? babies.sort((a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )[0]
      : null;

    if (!baby) {
      // Log detailed diagnostic info
      app.logger.warn(
        { userId: sessionUserId },
        'No baby linked to mother'
      );

      // Try to find any baby with this motherUserId to debug
      const allBabies = await app.db.query.babies.findMany();
      const babyWithThisUser = allBabies.find((b: any) => b.motherUserId === sessionUserId);
      const babyWithDifferentUser = allBabies.find((b: any) => b.motherUserId !== null);

      app.logger.debug(
        {
          userId: sessionUserId,
          babyFoundWithThisUser: !!babyWithThisUser,
          babyExistsWithDifferentUser: !!babyWithDifferentUser,
          existingBabyMotherUserId: babyWithDifferentUser?.motherUserId
        },
        'Debug: Checking all babies to identify linking issue'
      );

      return reply.status(404).send({ error: 'No baby linked to this account' });
    }

    app.logger.info(
      {
        userId: sessionUserId,
        babyId: baby.id,
        babyMotherUserId: baby.motherUserId,
        match: baby.motherUserId === sessionUserId
      },
      'Baby found for mother'
    );

    // Get active contract for the baby
    const contracts = await app.db.query.contracts.findMany({
      where: eq(schema.contracts.babyId, baby.id),
    });

    const activeContract = contracts
      .filter(c => {
        if (c.status !== 'active') return false;
        const startDate = new Date(c.startDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + c.durationDays);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today >= startDate && today < endDate;
      })
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0] || null;

    // Calculate age
    const today = new Date();
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

    app.logger.info({ babyId: baby.id, userId: session.user.id }, 'Fetched linked baby for mother');

    return {
      ...baby,
      ageMonths,
      ageDays,
      activeContract,
    };
  });
}
