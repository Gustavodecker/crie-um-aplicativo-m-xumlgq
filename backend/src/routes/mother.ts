import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

/**
 * Mother Routes
 *
 * GET /api/mother/baby - Get baby linked to authenticated mother
 *   - Requires authentication (session token)
 *   - Returns baby object with age and active contract info
 */

export function registerMotherRoutes(app: App) {
  const requireAuth = app.requireAuth();

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
