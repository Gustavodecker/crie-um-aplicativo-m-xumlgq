import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lte } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function calculateSleepDuration(startTime: string | null, endTime: string | null): number | null {
  if (!startTime || !endTime) return null;
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (end < start) {
    return (24 * 60) - start + end;
  }
  return end - start;
}

export function registerReportsRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/reports/baby/:babyId - Returns aggregated sleep data
  app.fastify.get('/api/reports/baby/:babyId', {
    schema: {
      description: 'Get sleep report for baby',
      tags: ['reports'],
      params: {
        type: 'object',
        required: ['babyId'],
        properties: {
          babyId: { type: 'string', format: 'uuid' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            babyId: { type: 'string', format: 'uuid' },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            totalNaps: { type: 'integer' },
            totalNapDuration: { type: 'integer' },
            totalDaytimeSleep: { type: 'integer' },
            totalNighttimeSleep: { type: 'integer' },
            totalNetNighttimeSleep: { type: 'integer' },
            totalSleepIn24h: { type: 'integer' },
            weeklyAverage: { type: 'number' },
            dailyEvolution: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', format: 'date' },
                  daytimeSleep: { type: 'integer' },
                  nighttimeSleep: { type: 'integer' },
                  netNighttimeSleep: { type: 'integer' },
                  total24h: { type: 'integer' },
                  indicator: { type: 'string', enum: ['green', 'yellow', 'red'] },
                },
              },
            },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { babyId: string }; Querystring: { startDate?: string; endDate?: string } }>, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, babyId: request.params.babyId, query: request.query }, 'Fetching sleep report');

    const baby = await app.db.query.babies.findFirst({
      where: eq(schema.babies.id, request.params.babyId),
    });

    if (!baby) {
      return reply.status(401).send({ error: 'Not authorized' });
    }

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    const isConsultant = consultant && baby.consultantId === consultant.id;
    const isMother = baby.motherUserId === session.user.id;

    if (!isConsultant && !isMother) {
      app.logger.warn({ userId: session.user.id, babyId: request.params.babyId }, 'Not authorized');
      return reply.status(401).send({ error: 'Not authorized' });
    }

    const startDate = request.query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = request.query.endDate || new Date().toISOString().split('T')[0];

    const routines = await app.db.query.dailyRoutines.findMany({
      where: and(
        eq(schema.dailyRoutines.babyId, request.params.babyId),
        gte(schema.dailyRoutines.date, startDate),
        lte(schema.dailyRoutines.date, endDate)
      ),
      with: {
        naps: true,
        nightSleep: {
          with: { wakings: true },
        },
      },
    });

    let totalNaps = 0;
    let totalNapDuration = 0;
    let totalDaytimeSleep = 0;
    let totalNighttimeSleep = 0;
    let totalNightWakingsDuration = 0;
    const dailyEvolution: any[] = [];

    for (const routine of routines) {
      let daytimeSleep = 0;
      let nighttimeSleep = 0;
      let nightWakingsDuration = 0;

      for (const nap of routine.naps) {
        const napDuration = calculateSleepDuration(nap.fellAsleepTime, nap.wakeUpTime);
        if (napDuration !== null) {
          totalNaps++;
          daytimeSleep += napDuration;
          totalNapDuration += napDuration;
        }
      }

      totalDaytimeSleep += daytimeSleep;

      if (routine.nightSleep && routine.nightSleep.length > 0) {
        const night = routine.nightSleep[0];
        const nightDuration = calculateSleepDuration(night.fellAsleepTime, night.finalWakeTime);
        if (nightDuration !== null) {
          nighttimeSleep = nightDuration;
          totalNighttimeSleep += nightDuration;
        }

        for (const waking of night.wakings) {
          const wakingDuration = calculateSleepDuration(waking.startTime, waking.endTime);
          if (wakingDuration !== null) {
            nightWakingsDuration += wakingDuration;
            totalNightWakingsDuration += wakingDuration;
          }
        }
      }

      const netNighttimeSleep = nighttimeSleep - nightWakingsDuration;
      const total24h = daytimeSleep + netNighttimeSleep;

      let indicator = 'green';
      if (total24h < 600) indicator = 'red';
      else if (total24h < 900) indicator = 'yellow';

      dailyEvolution.push({
        date: routine.date,
        daytimeSleep,
        nighttimeSleep,
        netNighttimeSleep: Math.max(0, netNighttimeSleep),
        total24h: Math.max(0, total24h),
        indicator,
      });
    }

    const totalNetNighttimeSleep = totalNighttimeSleep - totalNightWakingsDuration;
    const totalSleepIn24h = totalDaytimeSleep + totalNetNighttimeSleep;
    const weeklyAverage = dailyEvolution.length > 0 ? totalSleepIn24h / dailyEvolution.length : 0;

    return {
      babyId: request.params.babyId,
      startDate,
      endDate,
      totalNaps,
      totalNapDuration,
      totalDaytimeSleep,
      totalNighttimeSleep,
      totalNetNighttimeSleep: Math.max(0, totalNetNighttimeSleep),
      totalSleepIn24h: Math.max(0, totalSleepIn24h),
      weeklyAverage: Math.round(weeklyAverage * 100) / 100,
      dailyEvolution,
    };
  });
}
