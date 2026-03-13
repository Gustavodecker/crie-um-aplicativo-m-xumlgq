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

    const data = await request.file({ limits: { fileSize: 5 * 1024 * 1024 } });
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

  // POST /api/upload/profile-photo - Accepts multipart form data with 'file' field (image)
  app.fastify.post('/api/upload/profile-photo', {
    schema: {
      description: 'Upload a profile photo',
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
    try {
      const session = await requireAuth(request, reply);
      if (!session) {
        app.logger.warn({ url: request.url }, 'Profile photo upload: authentication failed');
        return;
      }

      const userId = session.user.id;
      app.logger.info({ userId }, 'Starting profile photo upload');

      const consultant = await app.db.query.consultants.findFirst({
        where: eq(schema.consultants.userId, userId),
      });

      if (!consultant) {
        app.logger.warn({ userId }, 'Profile photo upload: user is not a consultant');
        return reply.status(401).send({ error: 'Only consultants can upload profile photos' });
      }

      app.logger.debug({ userId, consultantId: consultant.id }, 'Profile photo upload: consultant found');

      let data;
      try {
        data = await request.file({ limits: { fileSize: 5 * 1024 * 1024 } });
      } catch (err) {
        app.logger.warn({ err, userId }, 'Profile photo upload: error reading file');
        return reply.status(400).send({ error: 'Error reading file. File may be too large.' });
      }

      if (!data) {
        app.logger.warn({ userId }, 'Profile photo upload: no file provided');
        return reply.status(400).send({ error: 'No file provided' });
      }

      if (!data.mimetype.startsWith('image/')) {
        app.logger.warn({ userId, mimetype: data.mimetype }, 'Profile photo upload: invalid file type');
        return reply.status(400).send({ error: 'Only image files are allowed' });
      }

      app.logger.debug(
        { userId, filename: data.filename, mimetype: data.mimetype },
        'Profile photo upload: file validation passed'
      );

      let buffer: Buffer;
      try {
        buffer = await data.toBuffer();
      } catch (err) {
        app.logger.error({ err, userId }, 'Profile photo upload: file buffer conversion failed');
        return reply.status(413).send({ error: 'File too large' });
      }

      const filename = `profile-photos/${consultant.id}/${Date.now()}-${data.filename}`;

      app.logger.debug({ userId, s3Key: filename }, 'Profile photo upload: uploading to storage');

      try {
        const key = await app.storage.upload(filename, buffer);
        const { url } = await app.storage.getSignedUrl(key);

        app.logger.info(
          { userId, filename: data.filename, key, url: url.substring(0, 100) + '...' },
          'Profile photo uploaded successfully'
        );

        return { url, filename: data.filename };
      } catch (err) {
        app.logger.error({ err, userId, s3Key: filename }, 'Profile photo upload: storage upload failed');
        return reply.status(500).send({ error: 'Failed to upload file to storage' });
      }
    } catch (err) {
      app.logger.error({ err, url: request.url }, 'Profile photo upload: unexpected error');
      return reply.status(500).send({ error: 'An unexpected error occurred during upload' });
    }
  });
}
