import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, and } from 'drizzle-orm';
import * as authSchema from '../db/schema/auth-schema.js';

export function registerDebugRoutes(app: App) {
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
            isValidBcrypt: { type: 'boolean' },
            accountUpdatedAt: { type: ['string', 'null'] },
            userMustChangePassword: { type: 'boolean' },
            userRequirePasswordChange: { type: 'boolean' },
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

      const hashPrefix = credentialAccount.password ? credentialAccount.password.substring(0, 20) : null;
      const isValidBcrypt = credentialAccount.password ? credentialAccount.password.startsWith('$2') : false;

      const response = {
        email: user.email,
        userId: user.id,
        accountId: credentialAccount.id,
        hashPrefix,
        isValidBcrypt,
        accountUpdatedAt: credentialAccount.updatedAt ? new Date(credentialAccount.updatedAt).toISOString() : null,
        userMustChangePassword: user.mustChangePassword ?? false,
        userRequirePasswordChange: user.requirePasswordChange ?? false,
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
}
