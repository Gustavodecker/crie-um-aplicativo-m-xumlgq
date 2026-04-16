import type { FastifyInstance } from 'fastify';
import type { App } from '../index.js';

export function registerHealthRoutes(app: App, fastify: FastifyInstance) {
  app.logger.info('Registering health check endpoint at /api/health');

  fastify.get('/api/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['health'],
      response: {
        200: {
          description: 'Service is healthy',
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
    app.logger.debug('Health check requested');
    return { status: 'ok' };
  });
}
