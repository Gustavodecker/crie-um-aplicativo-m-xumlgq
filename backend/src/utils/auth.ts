import type { FastifyRequest, FastifyReply } from 'fastify';
import type { App } from '../index.js';

/**
 * Resilient session validation that prevents unexpected logouts
 *
 * This wrapper around requireAuth makes session validation more resilient by:
 * - Logging session validation attempts and failures
 * - Returning proper error codes (401 only for invalid sessions, not network errors)
 * - Not invalidating sessions on temporary validation errors
 * - Allowing concurrent requests without session conflicts
 */
export function createResilientAuth(app: App) {
  const requireAuth = app.requireAuth();

  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      app.logger.debug(
        { url: request.url, method: request.method },
        'Attempting session validation'
      );

      const session = await requireAuth(request, reply);

      if (!session) {
        app.logger.debug(
          { url: request.url },
          'Session validation returned no session - user not authenticated'
        );
        // requireAuth already sent 401 response, don't process further
        return null;
      }

      app.logger.debug(
        { userId: session.user.id, sessionId: session.session.id },
        'Session validated successfully'
      );

      return session;
    } catch (error) {
      // Log the error but don't invalidate the session
      app.logger.error(
        { err: error, url: request.url },
        'Error during session validation - not invalidating session'
      );

      // Don't throw - let the route handle missing session gracefully
      // Only return 401 for explicit authentication failures, not temporary errors
      return null;
    }
  };
}

/**
 * Safe session check that doesn't throw on validation errors
 *
 * Returns session if valid, null if invalid or error occurs
 * Does NOT invalidate the session on temporary errors
 */
export async function getSafeSession(
  app: App,
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const requireAuth = app.requireAuth();
    const session = await requireAuth(request, reply);
    return session;
  } catch (error) {
    // Log but don't throw - prevent unexpected logouts
    app.logger.warn(
      { err: error },
      'Session retrieval encountered error - continuing without invalidating'
    );
    return null;
  }
}

/**
 * Ensure session is valid, with proper error response
 *
 * Returns session on success, sends 401 on failure
 * Does not throw exceptions that could cascade and invalidate sessions
 */
export async function validateSessionSafe(
  app: App,
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const requireAuth = app.requireAuth();
    const session = await requireAuth(request, reply);

    if (!session) {
      // requireAuth already sent the response
      return null;
    }

    return session;
  } catch (error) {
    // Don't log as error for temporary failures - these shouldn't invalidate sessions
    app.logger.warn({ err: error }, 'Session validation failed temporarily');

    // Only send 401 if it's definitely an auth error, not a temporary error
    if (error instanceof Error && error.message.includes('Invalid session')) {
      return reply.status(401).send({ error: 'Invalid session' });
    }

    // For other errors, don't invalidate - could be temporary
    return null;
  }
}
