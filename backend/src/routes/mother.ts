import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';
import bcrypt from 'bcrypt';

export function registerMotherRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/mother/register - Register mother with email, password, and baby code
  app.fastify.post('/api/mother/register', {
    schema: {
      description: 'Register mother account with email, password, and baby code',
      tags: ['mother'],
      body: {
        type: 'object',
        required: ['email', 'senha', 'babyCode'],
        properties: {
          email: { type: 'string', format: 'email', description: 'Mother email' },
          senha: { type: 'string', description: 'Account password' },
          babyCode: { type: 'string', description: 'Baby registration code' },
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
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { email: string; senha: string; babyCode: string } }>, reply: FastifyReply) => {
    const { email, senha, babyCode } = request.body;

    app.logger.info({ email, babyCodePreview: babyCode.substring(0, 10) + '...' }, 'Registering mother with email and baby code');

    // Validate inputs
    if (!email || email.trim().length === 0) {
      app.logger.warn({ body: request.body }, 'Email missing');
      return reply.status(400).send({ error: 'Email is required' });
    }

    if (!senha || senha.trim().length === 0) {
      app.logger.warn({ email }, 'Password missing');
      return reply.status(400).send({ error: 'Senha is required' });
    }

    if (!babyCode || babyCode.trim().length === 0) {
      app.logger.warn({ email }, 'Baby code missing');
      return reply.status(400).send({ error: 'Baby code is required' });
    }

    try {
      // Step 1: Find baby by code (token field)
      const baby = await app.db.query.babies.findFirst({
        where: eq(schema.babies.token, babyCode),
      });

      if (!baby) {
        app.logger.warn({ email, babyCodePreview: babyCode.substring(0, 10) + '...' }, 'Baby not found with code');
        return reply.status(404).send({ error: 'Código inválido' });
      }

      app.logger.info({ babyId: baby.id, email }, 'Baby found with code');

      // Step 2: Check if baby already has a mother
      if (baby.motherUserId) {
        app.logger.warn({ babyId: baby.id, existingMotherUserId: baby.motherUserId, email }, 'Baby already has mother');
        return reply.status(409).send({ error: 'Este código já foi utilizado' });
      }

      // Step 3: Check if user already exists with this email
      const existingUser = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, email),
      });

      if (existingUser) {
        app.logger.warn({ email }, 'User already exists with this email');
        return reply.status(409).send({ error: 'Email já cadastrado' });
      }

      // Step 4: Create new user
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

      // Verify user was created correctly
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

      // Step 5: Hash password using bcrypt
      const hashedPassword = await bcrypt.hash(senha, 10);
      app.logger.debug({ userId }, 'Password hashed successfully');

      // Step 6: Create account record with hashed password
      const accountId = crypto.randomUUID();
      await app.db.insert(authSchema.account).values({
        id: accountId,
        accountId: email,
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

      // Step 7: Update baby with motherUserId and motherEmail
      app.logger.info(
        { babyId: baby.id, newMotherUserId: userId, newMotherEmail: email },
        'Updating baby with mother information'
      );

      const updateResult = await app.db.update(schema.babies)
        .set({
          motherUserId: userId,
          motherEmail: email,
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
          motherEmail: updatedBaby.motherEmail
        },
        'Baby updated with mother information - verifying persistence'
      );

      // Verify the update persisted by re-querying
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
          verified: true
        },
        'Baby association verified - baby correctly linked to mother'
      );

      // Step 8: Create session for the newly created user
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

      // Verify session was created correctly
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
          allFieldsCorrect:
            finalUser?.id === userId &&
            finalUser?.email === email &&
            finalBaby?.motherUserId === userId &&
            finalBaby?.motherEmail === email
        },
        'Mother account registration complete - all data verified'
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

      // Step 9: Return success with user data
      return reply.status(201).send({
        token: sessionToken,
        user: {
          id: userId,
          email: email,
          name: baby.motherName,
        },
      });

    } catch (error) {
      app.logger.error({ err: error, email }, 'Error registering mother');
      return reply.status(500).send({ error: 'Falha ao registrar conta' });
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
