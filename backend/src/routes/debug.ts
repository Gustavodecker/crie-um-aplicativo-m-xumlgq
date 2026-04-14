import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, and } from 'drizzle-orm';
import * as authSchema from '../db/schema/auth-schema.js';
import * as appSchema from '../db/schema/schema.js';

export function registerDebugRoutes(app: App) {
  // GET /admin/cleanup-report - Investigate and cleanup data for gustavo.miguel@msn.com
  app.fastify.get('/admin/cleanup-report', {
    schema: {
      description: 'Investigate and cleanup all data related to gustavo.miguel@msn.com user',
      tags: ['admin'],
      response: {
        200: {
          description: 'Cleanup report with findings and actions taken',
          type: 'object',
          properties: {
            targetEmail: { type: 'string' },
            status: { type: 'string' },
            findings: {
              type: 'object',
              properties: {
                userFound: { type: 'boolean' },
                userId: { type: ['string', 'null'] },
                consultantsLinked: { type: 'number' },
                babiesAsConsultant: { type: 'number' },
                babiesAsMother: { type: 'number' },
              },
            },
            actionsPerformed: {
              type: 'object',
              properties: {
                consultantsDeleted: { type: 'number' },
                consultantBabiesDeleted: { type: 'number' },
                motherBabiesCleared: { type: 'number' },
                consultantDataDeleted: { type: 'object' },
                userDeleted: { type: 'number' },
              },
            },
            summary: { type: 'string' },
          },
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const targetEmail = 'gustavo.miguel@msn.com';
    app.logger.warn({ targetEmail }, 'ADMIN_CLEANUP: Starting investigation and cleanup');

    try {
      const report: any = {
        targetEmail,
        status: 'completed',
        findings: {
          userFound: false,
          userId: null,
          consultantsLinked: 0,
          babiesAsConsultant: 0,
          babiesAsMother: 0,
        },
        actionsPerformed: {
          consultantsDeleted: 0,
          consultantBabiesDeleted: 0,
          motherBabiesCleared: 0,
          consultantDataDeleted: {
            night_wakings: 0,
            naps: 0,
            night_sleep: 0,
            daily_routines: 0,
            orientations: 0,
            contracts: 0,
            sleep_windows_config: 0,
          },
          userDeleted: 0,
        },
      };

      // STEP 1: Find user by email
      app.logger.debug({ email: targetEmail }, 'ADMIN_CLEANUP: Step 1 - Finding user');
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, targetEmail),
      });

      if (!user) {
        app.logger.info({ email: targetEmail }, 'ADMIN_CLEANUP: User not found');
        report.findings.userFound = false;
        report.summary = `No user found with email ${targetEmail}. No cleanup needed.`;
        return reply.status(200).send(report);
      }

      report.findings.userFound = true;
      report.findings.userId = user.id;
      app.logger.debug({ userId: user.id }, 'ADMIN_CLEANUP: User found');

      // STEP 2: Check for consultants linked to user
      app.logger.debug({ userId: user.id }, 'ADMIN_CLEANUP: Step 2 - Checking consultants');
      const consultants = await app.db.query.consultants.findMany({
        where: eq(appSchema.consultants.userId, user.id),
      });
      report.findings.consultantsLinked = consultants.length;
      app.logger.debug({ count: consultants.length }, 'ADMIN_CLEANUP: Found consultants');

      // STEP 3: Check for babies where mother_email or mother_user_id matches
      app.logger.debug({ userId: user.id }, 'ADMIN_CLEANUP: Step 3 - Checking babies');
      const motherBabies = await app.db.query.babies.findMany({
        where: eq(appSchema.babies.motherUserId, user.id),
      });
      report.findings.babiesAsMother = motherBabies.length;

      // Count babies under consultant
      let consultantBabiesCount = 0;
      for (const consultant of consultants) {
        const babies = await app.db.query.babies.findMany({
          where: eq(appSchema.babies.consultantId, consultant.id),
        });
        consultantBabiesCount += babies.length;
      }
      report.findings.babiesAsConsultant = consultantBabiesCount;
      app.logger.debug(
        { asConsultant: consultantBabiesCount, asMother: motherBabies.length },
        'ADMIN_CLEANUP: Found babies'
      );

      // STEP 4: Delete in correct order
      app.logger.warn({ userId: user.id }, 'ADMIN_CLEANUP: Step 4 - Starting deletion');

      // Delete all consultant-related data (cascading)
      for (const consultant of consultants) {
        app.logger.debug({ consultantId: consultant.id }, 'ADMIN_CLEANUP: Deleting consultant data');

        const consultantBabies = await app.db.query.babies.findMany({
          where: eq(appSchema.babies.consultantId, consultant.id),
        });

        // For each baby, delete nested data
        for (const baby of consultantBabies) {
          const routines = await app.db.query.dailyRoutines.findMany({
            where: eq(appSchema.dailyRoutines.babyId, baby.id),
          });

          for (const routine of routines) {
            // Delete night_wakings
            const nightSleeps = await app.db.query.nightSleep.findMany({
              where: eq(appSchema.nightSleep.routineId, routine.id),
            });

            for (const nightSleep of nightSleeps) {
              const result = await app.db.execute(
                `DELETE FROM night_wakings WHERE night_sleep_id = '${nightSleep.id}'`
              ) as any;
              report.actionsPerformed.consultantDataDeleted.night_wakings += result?.rowCount || 0;
            }

            const nsResult = await app.db.execute(
              `DELETE FROM night_sleep WHERE routine_id = '${routine.id}'`
            ) as any;
            report.actionsPerformed.consultantDataDeleted.night_sleep += nsResult?.rowCount || 0;

            const nResult = await app.db.execute(
              `DELETE FROM naps WHERE routine_id = '${routine.id}'`
            ) as any;
            report.actionsPerformed.consultantDataDeleted.naps += nResult?.rowCount || 0;
          }

          const drResult = await app.db.execute(
            `DELETE FROM daily_routines WHERE baby_id = '${baby.id}'`
          ) as any;
          report.actionsPerformed.consultantDataDeleted.daily_routines += drResult?.rowCount || 0;

          const oResult = await app.db.execute(
            `DELETE FROM orientations WHERE baby_id = '${baby.id}'`
          ) as any;
          report.actionsPerformed.consultantDataDeleted.orientations += oResult?.rowCount || 0;

          const cResult = await app.db.execute(
            `DELETE FROM contracts WHERE baby_id = '${baby.id}'`
          ) as any;
          report.actionsPerformed.consultantDataDeleted.contracts += cResult?.rowCount || 0;
        }

        // Delete babies
        const bResult = await app.db.execute(
          `DELETE FROM babies WHERE consultant_id = '${consultant.id}'`
        ) as any;
        report.actionsPerformed.consultantBabiesDeleted += bResult?.rowCount || 0;

        // Delete sleep_windows_config
        const swResult = await app.db.execute(
          `DELETE FROM sleep_windows_config WHERE consultant_id = '${consultant.id}'`
        ) as any;
        report.actionsPerformed.consultantDataDeleted.sleep_windows_config += swResult?.rowCount || 0;

        // Delete consultant
        const consResult = await app.db.execute(
          `DELETE FROM consultants WHERE id = '${consultant.id}'`
        ) as any;
        report.actionsPerformed.consultantsDeleted += consResult?.rowCount || 0;
      }

      // Clear mother_user_id from babies (don't delete, just clear the reference)
      for (const baby of motherBabies) {
        const cleared = await app.db.update(appSchema.babies)
          .set({ motherUserId: null })
          .where(eq(appSchema.babies.id, baby.id))
          .returning();
        if (cleared.length > 0) {
          report.actionsPerformed.motherBabiesCleared += 1;
        }
      }

      // Delete mother-linked babies data if any remain
      const finalMotherBabies = await app.db.query.babies.findMany({
        where: eq(appSchema.babies.motherUserId, user.id),
      });

      for (const baby of finalMotherBabies) {
        // Delete baby's nested data
        const routines = await app.db.query.dailyRoutines.findMany({
          where: eq(appSchema.dailyRoutines.babyId, baby.id),
        });

        for (const routine of routines) {
          const nightSleeps = await app.db.query.nightSleep.findMany({
            where: eq(appSchema.nightSleep.routineId, routine.id),
          });

          for (const nightSleep of nightSleeps) {
            await app.db.execute(
              `DELETE FROM night_wakings WHERE night_sleep_id = '${nightSleep.id}'`
            );
          }

          await app.db.execute(
            `DELETE FROM night_sleep WHERE routine_id = '${routine.id}'`
          );
          await app.db.execute(
            `DELETE FROM naps WHERE routine_id = '${routine.id}'`
          );
        }

        await app.db.execute(
          `DELETE FROM daily_routines WHERE baby_id = '${baby.id}'`
        );
        await app.db.execute(
          `DELETE FROM orientations WHERE baby_id = '${baby.id}'`
        );
        await app.db.execute(
          `DELETE FROM contracts WHERE baby_id = '${baby.id}'`
        );
      }

      // Delete user
      const userResult = await app.db.execute(
        `DELETE FROM "user" WHERE id = '${user.id}'`
      ) as any;
      report.actionsPerformed.userDeleted = userResult?.rowCount || 0;

      report.summary = `Successfully cleaned up ${targetEmail}: deleted ${report.actionsPerformed.consultantsDeleted} consultant(s), ${report.actionsPerformed.consultantBabiesDeleted} baby record(s), cleared ${report.actionsPerformed.motherBabiesCleared} mother reference(s), and the user record.`;

      app.logger.warn({ report }, 'ADMIN_CLEANUP: Cleanup completed');

      return reply.status(200).send(report);
    } catch (error) {
      app.logger.error({ err: error, targetEmail }, 'ADMIN_CLEANUP: Fatal error');
      return reply.status(500).send({
        error: 'Failed to perform cleanup',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // GET /api/debug/juju-diagnosis - Diagnostic endpoint for juju@teste.com user
  app.fastify.get('/api/debug/juju-diagnosis', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({}, 'Debug: Fetching juju diagnosis data');

    try {
      // Query 1: Get user with email juju@teste.com
      const users = await app.db.query.user.findMany({
        where: eq(authSchema.user.email, 'juju@teste.com'),
      });

      let accounts = [];

      // Query 2: Get account for that user (if user exists)
      if (users.length > 0) {
        const userId = users[0].id;
        accounts = await app.db.query.account.findMany({
          where: eq(authSchema.account.userId, userId),
        });
      }

      const response = {
        user: users.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          require_password_change: u.requirePasswordChange,
        })),
        account: accounts.map(a => ({
          id: a.id,
          user_id: a.userId,
          provider_id: a.providerId,
          account_id: a.accountId,
          pwd_length: a.password ? a.password.length : 0,
        })),
      };

      app.logger.info(
        { userCount: users.length, accountCount: accounts.length },
        'Debug: Returning juju diagnosis data'
      );

      return reply.status(200).send(response);
    } catch (error) {
      app.logger.error({ err: error }, 'Debug: Error fetching juju diagnosis data');
      return reply.status(500).send({ error: 'Failed to fetch diagnostics' });
    }
  });

  // GET /api/debug/mother-account - Returns diagnostic data about recently created mother accounts
  app.fastify.get('/api/debug/mother-account', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({}, 'Debug: Fetching mother account diagnostics');

    try {
      // Query 1: Most recently created mother users
      const recentUsers = await app.db.query.user.findMany({
        orderBy: desc(authSchema.user.createdAt),
        limit: 5,
      });

      app.logger.debug({ userCount: recentUsers.length }, 'Debug: Found recent users');

      // Query 2: Account rows for those users
      const recentAccounts = await app.db.query.account.findMany({
        orderBy: desc(authSchema.account.createdAt),
        limit: 10,
      });

      app.logger.debug({ accountCount: recentAccounts.length }, 'Debug: Found related accounts');

      // Transform account data for response
      const transformedAccounts = recentAccounts.map(a => ({
        id: a.id,
        user_id: a.userId,
        provider_id: a.providerId,
        account_id: a.accountId,
        password_status: a.password === null ? 'NULL' : a.password === '' ? 'EMPTY_STRING' : 'POPULATED',
        password_length: a.password ? a.password.length : 0,
        created_at: a.createdAt,
      }));

      const response = {
        users: recentUsers.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          require_password_change: u.requirePasswordChange,
          created_at: u.createdAt,
        })),
        accounts: transformedAccounts,
      };

      app.logger.info(
        { userCount: recentUsers.length, accountCount: recentAccounts.length },
        'Debug: Returning mother account diagnostics'
      );

      return reply.status(200).send(response);
    } catch (error) {
      app.logger.error({ err: error }, 'Debug: Error fetching mother account diagnostics');
      return reply.status(500).send({ error: 'Failed to fetch diagnostics' });
    }
  });

  // GET /api/debug/password-status-by-email?email=... - Inspect password hash for a specific user
  app.fastify.get<{ Querystring: { email?: string } }>('/api/debug/password-status-by-email', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.query as { email?: string };

    app.logger.info({ email }, 'Debug: Fetching password status for email');

    if (!email) {
      return reply.status(400).send({ error: 'email query parameter is required' });
    }

    try {
      // Look up user by email
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, email),
      });

      if (!user) {
        app.logger.info({ email }, 'Debug: User not found');
        return reply.status(404).send({ error: 'User not found' });
      }

      // Find credential account for this user
      const credentialAccount = await app.db.query.account.findFirst({
        where: and(
          eq(authSchema.account.userId, user.id),
          eq(authSchema.account.providerId, 'credential')
        ),
      });

      if (!credentialAccount) {
        app.logger.info({ email, userId: user.id }, 'Debug: Credential account not found');
        return reply.status(404).send({ error: 'Credential account not found' });
      }

      const passwordPrefix = credentialAccount.password ? credentialAccount.password.substring(0, 20) : null;
      const passwordLength = credentialAccount.password ? credentialAccount.password.length : 0;

      const response = {
        email: user.email,
        userId: user.id,
        hasPassword: !!credentialAccount.password,
        passwordPrefix: passwordPrefix,
        passwordLength: passwordLength,
        requirePasswordChange: user.requirePasswordChange,
      };

      app.logger.info(
        { email, userId: user.id, hasPassword: !!credentialAccount.password, passwordLength },
        'Debug: Returning password status for email'
      );

      return reply.status(200).send(response);
    } catch (error) {
      app.logger.error({ err: error, email }, 'Debug: Error fetching password status for email');
      return reply.status(500).send({ error: 'Failed to fetch password status' });
    }
  });

  // GET /api/debug/password-status?email=... - Inspect password hash for a specific user
  app.fastify.get<{ Querystring: { email?: string } }>('/api/debug/password-status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.query as { email?: string };

    app.logger.info({ email }, 'Debug: Fetching password status for email');

    if (!email) {
      return reply.status(400).send({ error: 'email query parameter is required', found: false });
    }

    try {
      // Query user joined with credential account
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, email),
      });

      if (!user) {
        app.logger.info({ email }, 'Debug: User not found');
        return reply.status(200).send({ found: false, email });
      }

      // Find credential account for this user
      const credentialAccount = await app.db.query.account.findFirst({
        where: and(
          eq(authSchema.account.userId, user.id),
          eq(authSchema.account.providerId, 'credential')
        ),
      });

      if (!credentialAccount) {
        app.logger.info({ email, userId: user.id }, 'Debug: Credential account not found');
        return reply.status(200).send({ found: false, email });
      }

      const passwordPrefix = credentialAccount.password ? credentialAccount.password.substring(0, 10) : null;
      const passwordLength = credentialAccount.password ? credentialAccount.password.length : 0;

      const response = {
        found: true,
        userId: user.id,
        accountId: credentialAccount.id,
        providerId: 'credential',
        passwordLength: passwordLength,
        passwordPrefix: passwordPrefix,
        rowCount: 1,
      };

      app.logger.info(
        { email, userId: user.id, accountId: credentialAccount.id, passwordLength },
        'Debug: Returning password status'
      );

      return reply.status(200).send(response);
    } catch (error) {
      app.logger.error({ err: error, email }, 'Debug: Error fetching password status');
      return reply.status(500).send({ error: 'Failed to fetch password status' });
    }
  });

  // GET /api/debug/schema-check - Diagnostic schema inspection (READ-ONLY)
  app.fastify.get('/api/debug/schema-check', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({}, 'Debug: Running schema check');

    try {
      // Query 1: Account table columns
      const accountColumnsResult = (await app.db.execute(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'account'
        ORDER BY ordinal_position
      `)) as Array<{ column_name: string; data_type: string }>;

      // Query 2: User table columns
      const userColumnsResult = (await app.db.execute(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'user'
        ORDER BY ordinal_position
      `)) as Array<{ column_name: string; data_type: string }>;

      // Query 3: Sample accounts with credential providers
      const sampleAccountsResult = (await app.db.execute(`
        SELECT id, user_id, provider_id, LEFT(password, 10) as password_prefix
        FROM account
        WHERE provider_id LIKE '%cred%' OR provider_id LIKE '%email%'
        LIMIT 5
      `)) as Array<{ id: string; user_id: string; provider_id: string; password_prefix: string | null }>;

      const response = {
        accountColumns: accountColumnsResult,
        userColumns: userColumnsResult,
        sampleAccounts: sampleAccountsResult,
        timestamp: new Date().toISOString(),
      };

      app.logger.info(
        {
          accountColumnCount: accountColumnsResult?.length || 0,
          userColumnCount: userColumnsResult?.length || 0,
          sampleAccountCount: sampleAccountsResult?.length || 0
        },
        'Debug: Schema check completed'
      );

      return reply.status(200).send(response);
    } catch (error) {
      app.logger.error({ err: error }, 'Debug: Error running schema check');
      return reply.status(500).send({ error: 'Failed to run schema check', message: error instanceof Error ? error.message : String(error) });
    }
  });

  // GET /api/auth-debug/check-hash?email=... - Inspect password hash details (protected)
  app.fastify.get<{ Querystring: { email?: string } }>('/api/auth-debug/check-hash', {
    schema: {
      description: 'Check password hash details for debugging (protected)',
      tags: ['auth-debug'],
      querystring: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'User email address' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            userId: { type: 'string' },
            accountId: { type: 'string' },
            hashPrefix: { type: ['string', 'null'] },
            hashLength: { type: 'number' },
            isValidBcrypt: { type: 'boolean' },
            accountUpdatedAt: { type: ['string', 'null'] },
            userMustChangePassword: { type: 'boolean' },
            requirePasswordChange: { type: 'boolean' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.query as { email?: string };

    // Require authentication for this endpoint - validate Bearer token
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      app.logger.warn({ email }, 'Check hash: Unauthorized access attempt - no Bearer token');
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const sessionToken = authHeader.slice(7);

    // Validate session token exists and is not expired
    try {
      const session = await app.db.query.session.findFirst({
        where: eq(authSchema.session.token, sessionToken),
      });

      if (!session || new Date() > new Date(session.expiresAt)) {
        app.logger.warn({ email, tokenPrefix: sessionToken.substring(0, 8) }, 'Check hash: Invalid or expired session token');
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    } catch (sessionError) {
      app.logger.error({ err: sessionError }, 'Check hash: Error validating session');
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    if (!email) {
      return reply.status(400).send({ error: 'email query parameter is required' });
    }

    try {
      app.logger.info({ email }, 'Check hash: Inspecting hash for email');

      // Look up user by email
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, email),
      });

      if (!user) {
        app.logger.warn({ email }, 'Check hash: User not found');
        return reply.status(404).send({ error: 'User not found' });
      }

      // Find credential account
      const credentialAccount = await app.db.query.account.findFirst({
        where: and(
          eq(authSchema.account.userId, user.id),
          eq(authSchema.account.providerId, 'credential')
        ),
      });

      if (!credentialAccount) {
        app.logger.warn({ email, userId: user.id }, 'Check hash: Credential account not found');
        return reply.status(404).send({ error: 'Credential account not found' });
      }

      const hashPrefix = credentialAccount.password ? credentialAccount.password.substring(0, 7) : null;
      const hashLength = credentialAccount.password ? credentialAccount.password.length : 0;
      const isValidBcrypt = credentialAccount.password ? (credentialAccount.password.startsWith('$2b$') || credentialAccount.password.startsWith('$2a$')) : false;

      const response = {
        email: user.email,
        userId: user.id,
        accountId: credentialAccount.id,
        hashPrefix,
        hashLength,
        isValidBcrypt,
        accountUpdatedAt: credentialAccount.updatedAt ? new Date(credentialAccount.updatedAt).toISOString() : null,
        userMustChangePassword: user.mustChangePassword ?? false,
        requirePasswordChange: user.requirePasswordChange ?? false,
      };

      app.logger.info(
        { email, userId: user.id, isValidBcrypt, hashPrefix },
        'Check hash: Returning hash details'
      );

      return reply.status(200).send(response);
    } catch (error) {
      app.logger.error({ err: error, email }, 'Check hash: Error inspecting hash');
      return reply.status(500).send({ error: 'Failed to check hash' });
    }
  });

  // POST /api/debug/cleanup-user - Delete all data for specific user (gustavo.miguel@msn.com)
  app.fastify.post('/api/debug/cleanup-user', {
    schema: {
      description: 'Delete all data for gustavo.miguel@msn.com user while respecting foreign key constraints',
      tags: ['debug'],
      response: {
        200: {
          description: 'User data deleted successfully',
          type: 'object',
          properties: {
            message: { type: 'string' },
            userId: { type: ['string', 'null'] },
            deletionDetails: {
              type: 'object',
              additionalProperties: { type: 'number' },
            },
          },
        },
        404: {
          description: 'User not found',
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const targetEmail = 'gustavo.miguel@msn.com';
    app.logger.warn({ targetEmail }, 'USER_CLEANUP: Starting cleanup for specific user');

    try {
      // Step 1: Find the user by email
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, targetEmail),
      });

      if (!user) {
        app.logger.info({ targetEmail }, 'USER_CLEANUP: User not found');
        return reply.status(404).send({ message: `User with email ${targetEmail} not found` });
      }

      app.logger.warn({ userId: user.id, email: targetEmail }, 'USER_CLEANUP: User found, starting cascade deletion');

      const deletionDetails: Record<string, number> = {
        night_wakings: 0,
        naps: 0,
        night_sleep: 0,
        daily_routines: 0,
        orientations: 0,
        contracts: 0,
        babies: 0,
        sleep_windows_config: 0,
        consultants: 0,
        verification: 0,
        account: 0,
        session: 0,
        user: 0,
      };

      // Step 2: Find and delete consultant-related data
      const consultant = await app.db.query.consultants.findFirst({
        where: eq(appSchema.consultants.userId, user.id),
      });

      if (consultant) {
        app.logger.debug({ consultantId: consultant.id }, 'USER_CLEANUP: Found consultant');

        // Get all babies for this consultant
        const consultantBabies = await app.db.query.babies.findMany({
          where: eq(appSchema.babies.consultantId, consultant.id),
        });

        // For each baby, delete all nested data
        for (const baby of consultantBabies) {
          const routines = await app.db.query.dailyRoutines.findMany({
            where: eq(appSchema.dailyRoutines.babyId, baby.id),
          });

          for (const routine of routines) {
            // Delete night_wakings
            const nightSleeps = await app.db.query.nightSleep.findMany({
              where: eq(appSchema.nightSleep.routineId, routine.id),
            });

            for (const nightSleep of nightSleeps) {
              const result = await app.db.execute(
                `DELETE FROM night_wakings WHERE night_sleep_id = '${nightSleep.id}'`
              ) as any;
              deletionDetails.night_wakings += result?.rowCount || 0;
            }

            // Delete night_sleep
            const nsResult = await app.db.execute(
              `DELETE FROM night_sleep WHERE routine_id = '${routine.id}'`
            ) as any;
            deletionDetails.night_sleep += nsResult?.rowCount || 0;

            // Delete naps
            const nResult = await app.db.execute(
              `DELETE FROM naps WHERE routine_id = '${routine.id}'`
            ) as any;
            deletionDetails.naps += nResult?.rowCount || 0;
          }

          // Delete daily_routines
          const drResult = await app.db.execute(
            `DELETE FROM daily_routines WHERE baby_id = '${baby.id}'`
          ) as any;
          deletionDetails.daily_routines += drResult?.rowCount || 0;

          // Delete orientations
          const oResult = await app.db.execute(
            `DELETE FROM orientations WHERE baby_id = '${baby.id}'`
          ) as any;
          deletionDetails.orientations += oResult?.rowCount || 0;

          // Delete contracts
          const cResult = await app.db.execute(
            `DELETE FROM contracts WHERE baby_id = '${baby.id}'`
          ) as any;
          deletionDetails.contracts += cResult?.rowCount || 0;
        }

        // Delete babies
        const bResult = await app.db.execute(
          `DELETE FROM babies WHERE consultant_id = '${consultant.id}'`
        ) as any;
        deletionDetails.babies += bResult?.rowCount || 0;

        // Delete sleep_windows_config
        const swResult = await app.db.execute(
          `DELETE FROM sleep_windows_config WHERE consultant_id = '${consultant.id}'`
        ) as any;
        deletionDetails.sleep_windows_config += swResult?.rowCount || 0;

        // Delete consultant
        const consResult = await app.db.execute(
          `DELETE FROM consultants WHERE id = '${consultant.id}'`
        ) as any;
        deletionDetails.consultants += consResult?.rowCount || 0;
      }

      // Step 3: Delete babies where user is the mother (linked to other consultants)
      const motherBabies = await app.db.query.babies.findMany({
        where: eq(appSchema.babies.motherUserId, user.id),
      });

      for (const baby of motherBabies) {
        const routines = await app.db.query.dailyRoutines.findMany({
          where: eq(appSchema.dailyRoutines.babyId, baby.id),
        });

        for (const routine of routines) {
          const nightSleeps = await app.db.query.nightSleep.findMany({
            where: eq(appSchema.nightSleep.routineId, routine.id),
          });

          for (const nightSleep of nightSleeps) {
            const result = await app.db.execute(
              `DELETE FROM night_wakings WHERE night_sleep_id = '${nightSleep.id}'`
            ) as any;
            deletionDetails.night_wakings += result?.rowCount || 0;
          }

          const nsResult = await app.db.execute(
            `DELETE FROM night_sleep WHERE routine_id = '${routine.id}'`
          ) as any;
          deletionDetails.night_sleep += nsResult?.rowCount || 0;

          const nResult = await app.db.execute(
            `DELETE FROM naps WHERE routine_id = '${routine.id}'`
          ) as any;
          deletionDetails.naps += nResult?.rowCount || 0;
        }

        const drResult = await app.db.execute(
          `DELETE FROM daily_routines WHERE baby_id = '${baby.id}'`
        ) as any;
        deletionDetails.daily_routines += drResult?.rowCount || 0;

        const oResult = await app.db.execute(
          `DELETE FROM orientations WHERE baby_id = '${baby.id}'`
        ) as any;
        deletionDetails.orientations += oResult?.rowCount || 0;

        const cResult = await app.db.execute(
          `DELETE FROM contracts WHERE baby_id = '${baby.id}'`
        ) as any;
        deletionDetails.contracts += cResult?.rowCount || 0;
      }

      // Delete babies where user is mother
      const mbResult = await app.db.execute(
        `DELETE FROM babies WHERE mother_user_id = '${user.id}'`
      ) as any;
      deletionDetails.babies += mbResult?.rowCount || 0;

      // Step 4: Delete verification entries
      const vResult = await app.db.execute(
        `DELETE FROM verification WHERE identifier = '${targetEmail}'`
      ) as any;
      deletionDetails.verification = vResult?.rowCount || 0;

      // Step 5: Delete auth sessions
      const sResult = await app.db.execute(
        `DELETE FROM session WHERE user_id = '${user.id}'`
      ) as any;
      deletionDetails.session = sResult?.rowCount || 0;

      // Step 6: Delete auth accounts
      const aResult = await app.db.execute(
        `DELETE FROM account WHERE user_id = '${user.id}'`
      ) as any;
      deletionDetails.account = aResult?.rowCount || 0;

      // Step 7: Delete the user
      const uResult = await app.db.execute(
        `DELETE FROM "user" WHERE id = '${user.id}'`
      ) as any;
      deletionDetails.user = uResult?.rowCount || 0;

      app.logger.warn(
        { userId: user.id, email: targetEmail, deletionDetails },
        'USER_CLEANUP: Deletion completed successfully'
      );

      return reply.status(200).send({
        message: `Successfully deleted all data for user ${targetEmail}`,
        userId: user.id,
        deletionDetails,
      });
    } catch (error) {
      app.logger.error({ err: error, targetEmail }, 'USER_CLEANUP: Fatal error');
      return reply.status(500).send({
        error: 'Failed to cleanup user data',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // POST /api/debug/cleanup-all-data - Delete all data from specified tables (preserves schema)
  app.fastify.post('/api/debug/cleanup-all-data', {
    schema: {
      description: 'Delete all data from specified tables while preserving schema (respects foreign key constraints)',
      tags: ['debug'],
      response: {
        200: {
          description: 'Data deleted successfully',
          type: 'object',
          properties: {
            message: { type: 'string' },
            deletedTables: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  table: { type: 'string' },
                  rowsDeleted: { type: 'number' },
                },
              },
            },
          },
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.warn({}, 'CLEANUP: Starting data deletion from all tables');

    try {
      const results: Array<{ table: string; rowsDeleted: number }> = [];

      // Delete in order respecting foreign key constraints (leaves to root)
      const deletionTables = [
        'night_wakings',
        'night_sleep',
        'naps',
        'daily_routines',
        'orientations',
        'contracts',
        'sleep_windows_config',
        'babies',
        'consultants',
      ];

      for (const tableName of deletionTables) {
        try {
          // Use raw SQL for reliable deletion and row count
          const result = await app.db.execute(`DELETE FROM ${tableName}`) as any;
          const rowsAffected = result?.rows?.length || 0;

          results.push({
            table: tableName,
            rowsDeleted: rowsAffected,
          });

          app.logger.info(
            { table: tableName, rowsDeleted: rowsAffected },
            `CLEANUP: Deleted ${rowsAffected} rows from ${tableName}`
          );
        } catch (tableError) {
          app.logger.error(
            { err: tableError, table: tableName },
            `CLEANUP: Error deleting from ${tableName}`
          );
          throw tableError;
        }
      }

      app.logger.warn(
        { tablesDeleted: results.length, totalRowsDeleted: results.reduce((sum, r) => sum + r.rowsDeleted, 0) },
        'CLEANUP: Data deletion completed successfully'
      );

      return reply.status(200).send({
        message: 'All data deleted successfully. Schema preserved.',
        deletedTables: results,
      });
    } catch (error) {
      app.logger.error({ err: error }, 'CLEANUP: Fatal error during data deletion');
      return reply.status(500).send({
        error: 'Failed to cleanup data',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
