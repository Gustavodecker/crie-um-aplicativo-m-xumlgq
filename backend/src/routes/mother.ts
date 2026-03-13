import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import * as authSchema from '../db/schema/auth-schema.js';
import bcrypt from 'bcrypt';

/**
 * Mother Routes
 *
 * POST /api/mother/register - Register mother with email, password, and baby code
 *   - Creates user in auth.user table
 *   - Creates account in auth.account table with credential provider
 *   - Links baby to mother via motherUserId
 *   - Returns session token for immediate login
 *   - Account is compatible with Better Auth's standard /api/auth/sign-in/email endpoint
 *
 * POST /api/mother/test-login - Debug endpoint to test authentication (TEMPORARY)
 *   - Verifies account can be found by email
 *   - Tests password verification independently of Better Auth
 *   - Returns detailed account information
 *   - Use this to debug: "account not found" vs "password mismatch" vs "user mismatch"
 *
 * GET /api/mother/baby - Get baby linked to authenticated mother
 *   - Requires authentication (session token)
 *   - Returns baby object with age and active contract info
 *
 * Authentication Flow for Mothers:
 *   1. Mother registers via POST /api/mother/register with email, password, baby code
 *   2. Account created with accountId=email, providerId='credential'
 *   3. Password hashed with bcrypt (10 salt rounds)
 *   4. Session token returned immediately (no email verification needed)
 *   5. Mother can login via POST /api/auth/sign-in/email with email + password
 *   6. Better Auth verifies password using bcrypt.compare()
 *   7. Session created and returned
 *
 * Debugging Mother Login Issues:
 *   1. Check registration logs for "Mother registration successful"
 *   2. Use POST /api/mother/test-login to verify:
 *      - Account exists (accountFound=true)
 *      - User exists (userFound=true)
 *      - Password matches (passwordMatches=true)
 *   3. If any of above is false, check the actual database values using the account details returned
 */

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
    const { email: rawEmail, senha, babyCode } = request.body;
    // Normalize email to lowercase for consistent lookups with Better Auth
    const email = rawEmail.toLowerCase().trim();

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
      // Step 1: Check if user already exists with this email (early check to prevent wasted DB operations)
      app.logger.debug({ email }, 'Checking if email already exists');
      const existingUser = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, email),
      });

      if (existingUser) {
        app.logger.warn(
          { email, existingUserId: existingUser.id },
          'User already exists with this email - duplicate account prevention'
        );
        return reply.status(409).send({
          error: 'EMAIL_ALREADY_EXISTS',
          message: 'Já existe uma conta com este email. Use a opção de login.',
        });
      }

      // Step 2: Find baby by code (token field)
      const baby = await app.db.query.babies.findFirst({
        where: eq(schema.babies.token, babyCode),
      });

      if (!baby) {
        app.logger.warn({ email, babyCodePreview: babyCode.substring(0, 10) + '...' }, 'Baby not found with code');
        return reply.status(404).send({ error: 'Código inválido' });
      }

      app.logger.info({ babyId: baby.id, email, motherUserId: baby.motherUserId }, 'Baby found with code');

      // Step 3: Check if baby already has a mother (code already used)
      if (baby.motherUserId) {
        app.logger.warn(
          { babyId: baby.id, existingMotherUserId: baby.motherUserId, email },
          'Baby already linked to a mother - code already used'
        );
        return reply.status(409).send({ error: 'Este código já foi utilizado' });
      }

      // Step 4: Create new user (email verified to be unique above)
      // Set emailVerified: true since mothers are pre-approved by consultant via baby code
      const userId = crypto.randomUUID();
      await app.db.insert(authSchema.user).values({
        id: userId,
        email: email,
        emailVerified: true,
        name: baby.motherName,
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
      app.logger.debug(
        {
          userId,
          providedPasswordLength: senha.length,
          saltRounds: 10,
          algorithm: 'bcrypt',
        },
        'Starting password hashing'
      );

      const hashedPassword = await bcrypt.hash(senha, 10);

      app.logger.debug(
        {
          userId,
          hashedPasswordLength: hashedPassword.length,
          hashedPasswordAlgorithm: hashedPassword.substring(0, 4), // Should be $2a or $2b or $2y
          hashCorrectFormat: hashedPassword.startsWith('$2'),
        },
        'Password hashed successfully - verifying format'
      );

      // Verify the hash is valid by testing it immediately
      const hashVerification = await bcrypt.compare(senha, hashedPassword);
      if (!hashVerification) {
        app.logger.error(
          { userId, hashedPasswordLength: hashedPassword.length },
          'CRITICAL: Password hash verification failed immediately after hashing'
        );
        return reply.status(500).send({ error: 'Failed to create password hash' });
      }

      app.logger.debug({ userId }, 'Password hash verified successfully');

      // Step 6: Create account record with hashed password
      const accountId = crypto.randomUUID();

      app.logger.info(
        {
          userId,
          accountId,
          email,
          providerId: 'credential',
          hashedPasswordLength: hashedPassword.length,
          hashedPasswordPreview: hashedPassword.substring(0, 20) + '...',
        },
        'Creating account record for mother'
      );

      const createdAccount = await app.db.insert(authSchema.account).values({
        id: accountId,
        accountId: email,
        providerId: 'credential',
        userId: userId,
        password: hashedPassword,
      }).returning();

      app.logger.info(
        {
          accountId: createdAccount[0]?.id,
          accountAccountId: createdAccount[0]?.accountId,
          userId: createdAccount[0]?.userId,
          providerId: createdAccount[0]?.providerId,
          passwordStored: !!createdAccount[0]?.password,
        },
        'Account created successfully - verifying stored values'
      );

      // Verify the account was created with correct data
      const verifiedAccount = await app.db.query.account.findFirst({
        where: eq(authSchema.account.id, accountId),
      });

      if (!verifiedAccount) {
        app.logger.error(
          { accountId, userId },
          'CRITICAL: Account not found after insertion'
        );
        return reply.status(500).send({ error: 'Failed to create account' });
      }

      app.logger.info(
        {
          accountId: verifiedAccount.id,
          storedAccountId: verifiedAccount.accountId,
          storedUserId: verifiedAccount.userId,
          storedProviderId: verifiedAccount.providerId,
          passwordLength: verifiedAccount.password?.length || 0,
          accountIdMatches: verifiedAccount.accountId === email,
          providerIdMatches: verifiedAccount.providerId === 'credential',
          userIdMatches: verifiedAccount.userId === userId,
        },
        'Account verification complete'
      );

      // Step 7: Update baby with motherUserId and motherEmail
      app.logger.info(
        { babyId: baby.id, newMotherUserId: userId, newMotherEmail: email },
        'Updating baby with mother information'
      );

      app.logger.debug(
        {
          babyId: baby.id,
          userId,
          newMotherUserId: userId,
          invalidatingToken: true,
        },
        'Updating baby: setting motherUserId and invalidating token'
      );

      // FIRST UPDATE: Link baby to mother
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
          updatedMotherUserId: updatedBaby.motherUserId,
          expectedMotherUserId: userId,
          motherUserIdMatches: updatedBaby.motherUserId === userId,
          tokenInvalidated: updatedBaby.token === null,
          motherEmail: updatedBaby.motherEmail,
        },
        'Baby updated - checking if motherUserId was set correctly'
      );

      // CRITICAL: Verify motherUserId was actually set
      if (updatedBaby.motherUserId !== userId) {
        app.logger.error(
          {
            babyId: baby.id,
            expectedMotherUserId: userId,
            actualMotherUserId: updatedBaby.motherUserId,
            updateResult: updatedBaby,
          },
          'CRITICAL: Baby update returned wrong motherUserId'
        );
        return reply.status(500).send({ error: 'Failed to link baby - database error' });
      }

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

      app.logger.debug(
        {
          babyId: verifiedBaby.id,
          verifiedMotherUserId: verifiedBaby.motherUserId,
          expectedMotherUserId: userId,
          tokenIsNull: verifiedBaby.token === null,
        },
        'Baby re-queried after update - verifying motherUserId persistence'
      );

      if (verifiedBaby.motherUserId !== userId) {
        app.logger.error(
          {
            babyId: baby.id,
            expectedMotherUserId: userId,
            actualMotherUserId: verifiedBaby.motherUserId,
            returnedMotherUserId: updatedBaby.motherUserId,
            verifiedMotherUserId: verifiedBaby.motherUserId,
          },
          'CRITICAL: Baby motherUserId mismatch - update did not persist correctly'
        );
        return reply.status(500).send({ error: 'Failed to link baby to account - data verification failed' });
      }

      app.logger.info(
        {
          babyId: verifiedBaby.id,
          motherUserId: verifiedBaby.motherUserId,
          motherUserId_matches_userId: verifiedBaby.motherUserId === userId,
          tokenStillValid: verifiedBaby.token !== null, // Will be invalidated in SECOND UPDATE
          motherEmail: verifiedBaby.motherEmail,
          verified: true
        },
        'Baby association verified - baby correctly linked to mother (token invalidation pending)'
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

      const allCorrect =
        finalUser?.id === userId &&
        finalUser?.email === email &&
        finalBaby?.motherUserId === userId &&
        finalBaby?.motherEmail === email &&
        finalBaby?.token === null;

      app.logger.info(
        {
          userId,
          userEmail: finalUser?.email,
          babyId: baby.id,
          babyMotherUserId: finalBaby?.motherUserId,
          babyMotherEmail: finalBaby?.motherEmail,
          tokenNull: finalBaby?.token === null,
          allFieldsCorrect: allCorrect
        },
        'Final verification before returning - all data check'
      );

      if (!finalUser || finalUser.id !== userId) {
        app.logger.error(
          { userId, finalUserId: finalUser?.id },
          'CRITICAL: Final user verification failed - user not found'
        );
        return reply.status(500).send({ error: 'Final verification failed - user not found' });
      }

      if (!finalBaby || finalBaby.motherUserId !== userId) {
        app.logger.error(
          {
            babyId: baby.id,
            expectedMotherUserId: userId,
            actualMotherUserId: finalBaby?.motherUserId
          },
          'CRITICAL: Final baby verification failed - motherUserId not set'
        );
        return reply.status(500).send({ error: 'Final verification failed - baby not linked' });
      }

      // SECOND UPDATE: Invalidate token after all verifications pass
      // This is done in a separate update to ensure second attempts can find the baby
      // and return 409 instead of 404
      if (finalBaby.token !== null) {
        app.logger.info(
          { babyId: baby.id, currentToken: finalBaby.token.substring(0, 10) + '...' },
          'Invalidating baby code token after successful registration'
        );

        const tokenInvalidationResult = await app.db.update(schema.babies)
          .set({
            token: null, // Invalidate code after successful registration
          })
          .where(eq(schema.babies.id, baby.id))
          .returning();

        if (!tokenInvalidationResult || tokenInvalidationResult.length === 0) {
          app.logger.error(
            { babyId: baby.id },
            'CRITICAL: Token invalidation update failed - returned no rows'
          );
          return reply.status(500).send({ error: 'Failed to invalidate registration code' });
        }

        const tokenInvalidatedBaby = tokenInvalidationResult[0];
        if (tokenInvalidatedBaby.token !== null) {
          app.logger.error(
            { babyId: baby.id, tokenAfterUpdate: tokenInvalidatedBaby.token },
            'CRITICAL: Token was not actually invalidated after update'
          );
          return reply.status(500).send({ error: 'Failed to invalidate registration code' });
        }

        app.logger.info(
          { babyId: baby.id, tokenNowNull: true },
          'Baby token invalidated successfully'
        );
      } else {
        app.logger.warn(
          { babyId: baby.id },
          'WARNING: Baby token was already null - may have been invalidated by another process'
        );
      }

      // Step 9: Return success with user data
      app.logger.info(
        {
          userId,
          email,
          babyId: baby.id,
          sessionToken: sessionToken.substring(0, 20) + '...',
          readyForLogin: true,
        },
        'Mother registration successful - account created and ready for authentication'
      );

      return reply.status(201).send({
        token: sessionToken,
        user: {
          id: userId,
          email: email,
          name: baby.motherName,
        },
      });

    } catch (error) {
      app.logger.error(
        {
          err: error,
          email,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
        },
        'Error registering mother'
      );
      return reply.status(500).send({ error: 'Falha ao registrar conta' });
    }
  });

  // POST /api/mother/test-login - Debug endpoint to test mother authentication (TEMPORARY)
  app.fastify.post('/api/mother/test-login', {
    schema: {
      description: 'Test mother login by verifying account can be found and password verified',
      tags: ['mother', 'debug'],
      body: {
        type: 'object',
        required: ['email', 'senha'],
        properties: {
          email: { type: 'string', format: 'email' },
          senha: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            accountFound: { type: 'boolean' },
            userFound: { type: 'boolean' },
            passwordMatches: { type: 'boolean' },
            accountDetails: { type: 'object' },
          },
        },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { email: string; senha: string } }>, reply: FastifyReply) => {
    const { email: rawEmail, senha } = request.body;
    // Normalize email to lowercase for consistent lookups with Better Auth
    const email = rawEmail.toLowerCase().trim();

    app.logger.info({ email }, 'Testing mother login - finding account');

    try {
      // Try to find account by accountId (email) - the way Better Auth should find it
      const account = await app.db.query.account.findFirst({
        where: eq(authSchema.account.accountId, email),
      });

      app.logger.info(
        {
          email,
          accountFound: !!account,
          accountId: account?.id,
          providerId: account?.providerId,
          passwordStored: !!account?.password,
        },
        'Account lookup result'
      );

      if (!account) {
        app.logger.warn({ email }, 'No account found for email');
        return reply.status(404).send({
          message: 'Account not found',
          accountFound: false,
          userFound: false,
          passwordMatches: false,
        });
      }

      // Verify the user exists
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, account.userId),
      });

      app.logger.info(
        {
          email,
          userId: account.userId,
          userFound: !!user,
          userName: user?.name,
        },
        'User lookup result'
      );

      if (!user) {
        return reply.status(404).send({
          message: 'User not found for account',
          accountFound: true,
          userFound: false,
          passwordMatches: false,
        });
      }

      // Try to verify password
      const passwordMatches = await bcrypt.compare(senha, account.password || '');

      app.logger.info(
        {
          email,
          passwordMatches,
          storedPasswordLength: account.password?.length || 0,
          providedPasswordLength: senha.length,
          accountProviderId: account.providerId,
        },
        'Password verification result'
      );

      return reply.status(200).send({
        message: 'Test login debug result',
        accountFound: true,
        userFound: true,
        passwordMatches,
        accountDetails: {
          accountId: account.id,
          accountAccountId: account.accountId,
          providerId: account.providerId,
          userId: account.userId,
          userName: user.name,
          userEmail: user.email,
        },
      });

    } catch (error) {
      app.logger.error({ err: error, email }, 'Error testing mother login');
      return reply.status(500).send({ error: 'Test login failed' });
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
