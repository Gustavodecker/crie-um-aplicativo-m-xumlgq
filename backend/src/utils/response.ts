import type { FastifyReply } from 'fastify';

/**
 * Response utilities for ensuring proper token persistence
 *
 * These utilities ensure that:
 * 1. Session tokens are included in API responses
 * 2. Tokens are properly formatted for client-side storage
 * 3. Session information is available for persistence
 */

/**
 * Session response format with token included
 *
 * This ensures the session token is available in the response body
 * so clients can store and persist it.
 */
export interface SessionResponse {
  session: {
    id: string;
    token: string;
    expiresAt: string;
    createdAt: string;
    userId: string;
  };
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
    image?: string | null;
  };
}

/**
 * Format a session response with token included
 *
 * Extracts session and user data and formats it for client-side storage
 */
export function formatSessionResponse(sessionData: any): SessionResponse {
  return {
    session: {
      id: sessionData.session.id,
      token: sessionData.session.token,
      expiresAt: sessionData.session.expiresAt.toISOString(),
      createdAt: sessionData.session.createdAt.toISOString(),
      userId: sessionData.session.userId,
    },
    user: {
      id: sessionData.user.id,
      email: sessionData.user.email,
      name: sessionData.user.name,
      emailVerified: sessionData.user.emailVerified,
      createdAt: sessionData.user.createdAt.toISOString(),
      updatedAt: sessionData.user.updatedAt.toISOString(),
      image: sessionData.user.image || null,
    },
  };
}

/**
 * Set session token in response headers
 *
 * Ensures the session token is available in response headers
 * in addition to the response body for maximum compatibility
 */
export function setSessionToken(reply: FastifyReply, token: string) {
  reply.header('X-Session-Token', token);
  reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
}

/**
 * Response with token for storage
 *
 * Returns response in a format optimized for client-side token persistence
 */
export function responseWithToken<T extends Record<string, any>>(
  data: T,
  sessionToken?: string
): T & { sessionToken?: string } {
  return {
    ...data,
    ...(sessionToken && { sessionToken }),
  };
}

/**
 * Ensure response headers prevent caching of sensitive data
 *
 * Sets appropriate cache control headers for authenticated responses
 */
export function setSecureResponseHeaders(reply: FastifyReply) {
  reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  reply.header('Pragma', 'no-cache');
  reply.header('Expires', '0');
}
