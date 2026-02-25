import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';

export function registerUploadRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // POST /api/upload/contract - Accepts multipart form data with 'file' field (PDF)
  app.fastify.post('/api/upload/contract', {
    schema: {
      description: 'Upload a contract PDF file',
      tags: ['upload'],
      response: {
        200: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            filename: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        413: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply): Promise<{ url: string; filename: string } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Uploading contract PDF');

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (!consultant) {
      app.logger.warn({ userId: session.user.id }, 'Not a consultant');
      return reply.status(401).send({ error: 'Not a consultant' });
    }

    const data = await request.file({ limits: { fileSize: 10 * 1024 * 1024 } });
    if (!data) {
      app.logger.warn({ userId: session.user.id }, 'No file provided');
      return reply.status(400).send({ error: 'No file provided' });
    }

    if (!data.mimetype.startsWith('application/pdf')) {
      app.logger.warn({ userId: session.user.id, mimetype: data.mimetype }, 'Invalid file type');
      return reply.status(400).send({ error: 'Only PDF files are allowed' });
    }

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch (err) {
      app.logger.error({ err, userId: session.user.id }, 'File too large');
      return reply.status(413).send({ error: 'File too large' });
    }

    const filename = `contracts/${consultant.id}/${Date.now()}-${data.filename}`;

    try {
      const key = await app.storage.upload(filename, buffer);
      const { url } = await app.storage.getSignedUrl(key);

      app.logger.info({ userId: session.user.id, filename: data.filename, key }, 'Contract PDF uploaded successfully');
      return { url, filename: data.filename };
    } catch (err) {
      app.logger.error({ err, userId: session.user.id }, 'Failed to upload file');
      return reply.status(500).send({ error: 'Failed to upload file' });
    }
  });

  // POST /api/upload/profile-photo - Accepts multipart form data with 'photo' field (image)
  app.fastify.post('/api/upload/profile-photo', {
    schema: {
      description: 'Upload a profile photo',
      tags: ['upload'],
      response: {
        200: {
          type: 'object',
          properties: {
            url: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        413: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply): Promise<{ url: string } | void> => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Uploading profile photo');

    const consultant = await app.db.query.consultants.findFirst({
      where: eq(schema.consultants.userId, session.user.id),
    });

    if (!consultant) {
      app.logger.warn({ userId: session.user.id }, 'Not a consultant');
      return reply.status(401).send({ error: 'Not a consultant' });
    }

    const data = await request.file({ limits: { fileSize: 5 * 1024 * 1024 } });
    if (!data) {
      app.logger.warn({ userId: session.user.id }, 'No file provided');
      return reply.status(400).send({ error: 'No file provided' });
    }

    if (!data.mimetype.startsWith('image/')) {
      app.logger.warn({ userId: session.user.id, mimetype: data.mimetype }, 'Invalid file type');
      return reply.status(400).send({ error: 'Only image files are allowed' });
    }

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch (err) {
      app.logger.error({ err, userId: session.user.id }, 'File too large');
      return reply.status(413).send({ error: 'File too large' });
    }

    const filename = `profile-photos/${consultant.id}/${Date.now()}-${data.filename}`;

    try {
      const key = await app.storage.upload(filename, buffer);
      const { url } = await app.storage.getSignedUrl(key);

      app.logger.info({ userId: session.user.id, filename: data.filename, key }, 'Profile photo uploaded successfully');
      return { url };
    } catch (err) {
      app.logger.error({ err, userId: session.user.id }, 'Failed to upload file');
      return reply.status(500).send({ error: 'Failed to upload file' });
    }
  });
}
