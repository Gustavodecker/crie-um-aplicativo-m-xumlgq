import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import * as authSchema from '../db/schema/auth-schema.js';

export function registerDebugRoutes(app: App) {
  // GET /api/debug/password-status - Returns password verification diagnostic data
  app.fastify.get('/api/debug/password-status', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({}, 'Debug: Fetching password status diagnostics');

    try {
      // Query 1: Last 5 users
      const recentUsers = await app.db.query.user.findMany({
        orderBy: desc(authSchema.user.createdAt),
        limit: 5,
      });

      app.logger.debug({ userCount: recentUsers.length }, 'Debug: Found recent users');

      // Query 2: Credential accounts for those users
      const accountData = [];
      for (const user of recentUsers) {
        const accounts = await app.db.query.account.findMany({
          where: eq(authSchema.account.userId, user.id),
        });

        for (const acc of accounts) {
          const passwordHashPrefix = acc.password ? acc.password.substring(0, 7) : null;
          const isValidBcryptHash = acc.password ? acc.password.startsWith('$2') : false;
          accountData.push({
            userId: acc.userId,
            accountId: acc.id,
            providerId: acc.providerId,
            passwordStatus: acc.password === null ? 'NULL' : acc.password === '' ? 'EMPTY_STRING' : 'POPULATED',
            passwordHashPrefix: passwordHashPrefix,
            isValidBcryptHash: isValidBcryptHash,
            createdAt: acc.createdAt,
          });
        }
      }

      const response = {
        users: recentUsers.map(u => ({
          id: u.id,
          email: u.email,
          createdAt: u.createdAt,
        })),
        accounts: accountData,
        diagnostics: {
          totalUsersChecked: recentUsers.length,
          totalAccountsChecked: accountData.length,
          validBcryptHashes: accountData.filter(a => a.isValidBcryptHash).length,
          invalidPasswordHashes: accountData.filter(a => a.passwordStatus === 'POPULATED' && !a.isValidBcryptHash).length,
        },
      };

      app.logger.info(
        { userCount: recentUsers.length, accountCount: accountData.length },
        'Debug: Returning password status diagnostics'
      );

      return reply.status(200).send(response);
    } catch (error) {
      app.logger.error({ err: error }, 'Debug: Error fetching password status diagnostics');
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
}
