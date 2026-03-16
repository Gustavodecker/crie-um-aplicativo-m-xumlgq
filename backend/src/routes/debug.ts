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
}
