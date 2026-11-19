import crypto from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { buildSecurityHeaders } from './security/secure-headers';
import {
  buildLogoutHeaders,
  buildSessionCookie,
  deriveCsrfToken,
  extractSessionToken,
  issueSignedSessionToken,
  validateSessionSecret,
  verifySignedSessionToken,
} from './security/auth-session';
import {
  recordSecurityAudit,
  requireAuthenticatedPrincipal,
  type AuthContext,
} from './security/auth-guard';
import { buildCorsHeaders, resolveAllowedOrigins } from './security/cors';
import { createRedactedLoggerConfig } from './security/logger-redaction';
import {
  SlidingWindowRateLimiter,
  type RouteRateLimitRule,
} from './security/rate-limit';
import { registerHealthRoutes } from './routes/health';
import { registerDeviceRoutes } from './routes/devices';
import { registerEventRoutes } from './routes/events';
import { registerShareRoutes } from './routes/shares';
import { registerCommandRoutes } from './routes/commands';
import { createStoresFromEnv } from './storage/factory';
import type {
  AuditStore,
  CommandStore,
  DeviceStore,
  EventStore,
  ShareStore,
  SqlExecutor,
} from './storage/types';

export interface BuildAppOptions {
  deviceStore?: DeviceStore;
  eventStore?: EventStore;
  shareStore?: ShareStore;
  commandStore?: CommandStore;
  auditStore?: AuditStore;
  postgresExecutor?: SqlExecutor;
  ipPepper?: string;
  sessionSecret?: string;
  rateLimitRules?: RouteRateLimitRule[];
  allowedOrigins?: string[];
  requireExplicitCorsOrigins?: boolean;
}

export async function buildApp(
  options?: BuildAppOptions
): Promise<FastifyInstance> {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  const bundle =
    options?.deviceStore && options?.eventStore
      ? {
          ...createStoresFromEnv({ postgresExecutor: options?.postgresExecutor }),
          deviceStore: options.deviceStore,
          eventStore: options.eventStore,
          shareStore: options.shareStore ?? createStoresFromEnv().shareStore,
          commandStore: options.commandStore ?? createStoresFromEnv().commandStore,
          auditStore: options.auditStore ?? createStoresFromEnv().auditStore,
        }
      : createStoresFromEnv({ postgresExecutor: options?.postgresExecutor });

  const { deviceStore, eventStore, shareStore, commandStore, auditStore } = bundle;

  const sessionSecret = isProduction
    ? validateSessionSecret(options?.sessionSecret ?? process.env.AEGIS_SESSION_SECRET)
    : options?.sessionSecret ??
      (process.env.AEGIS_SESSION_SECRET && process.env.AEGIS_SESSION_SECRET.trim().length >= 32
        ? process.env.AEGIS_SESSION_SECRET
        : crypto.randomBytes(32).toString('hex'));

  const app = Fastify({
    logger: createRedactedLoggerConfig(),
    bodyLimit: 256 * 1024,
    trustProxy: true,
  });

  app.addHook('onClose', async () => {
    await deviceStore.close();
    await eventStore.close();
    await shareStore.close();
    await commandStore.close();
    await auditStore.close();
  });

  const allowedOrigins = options?.allowedOrigins
    ? options.allowedOrigins
    : resolveAllowedOrigins({ requireExplicit: options?.requireExplicitCorsOrigins });

  const rateLimiter = new SlidingWindowRateLimiter(options?.rateLimitRules);
  const ipPepper =
    options?.ipPepper ??
    process.env.AEGIS_IP_PEPPER ??
    crypto.randomBytes(32).toString('hex');
  const revokedSessions = new Set<string>();

  const authContext: AuthContext = {
    sessionSecret,
    revokedSessions,
    nodeEnv,
    ipPepper,
    rateLimiter,
    auditStore,
  };

  app.addHook('onRequest', async (request, reply) => {
    const corsDecision = buildCorsHeaders(request.headers.origin, allowedOrigins);
    for (const [key, value] of Object.entries(corsDecision.headers)) {
      reply.header(key, value);
    }

    if (!corsDecision.allowed) {
      return reply.code(403).send({ error: 'cors_origin_not_allowed' });
    }

    if (request.method === 'OPTIONS') {
      return reply.code(204).send();
    }

    const rawUrl = request.url ?? '';
    if (/(?:[?&])csrf_token=/i.test(rawUrl)) {
      return reply.code(400).send({ error: 'csrf_token_in_query_forbidden' });
    }

    const result = rateLimiter.check(rawUrl, request.ip, ipPepper);
    if (!result.allowed) {
      await recordSecurityAudit(request, authContext, {
        actorUserId: null,
        action: 'rate_limit_exceeded',
        targetId: rawUrl.split('?')[0],
        outcome: 'rate_limited',
        statusCode: 429,
      });
      return reply.code(429).send({
        error: 'rate_limited',
        limit_per_minute: result.limit,
      });
    }
  });

  app.addHook('onSend', async (_request, reply) => {
    const headers = buildSecurityHeaders({
      cspNonce: crypto.randomBytes(16).toString('base64'),
      allowedApiOrigin:
        allowedOrigins[0] ??
        process.env.ALLOWED_API_ORIGIN ??
        'https://console.aegis.example',
    });

    for (const [key, value] of Object.entries(headers)) {
      reply.header(key, value);
    }
  });

  app.post('/v1/auth/session', async (request, reply) => {
    const ttlMs = 15 * 60 * 1000;
    const body = (request.body as { user_id?: unknown } | undefined) ?? undefined;
    const userId =
      !isProduction &&
      typeof body?.user_id === 'string' &&
      /^[a-zA-Z0-9_-]{3,48}$/.test(body.user_id)
        ? body.user_id
        : 'usr-owner-default';

    const issued = issueSignedSessionToken(userId, sessionSecret, ttlMs);
    const csrfToken = deriveCsrfToken(issued.sessionId, userId, sessionSecret);
    const strictCookie =
      isProduction ||
      request.protocol === 'https' ||
      nodeEnv === 'test' ||
      Boolean(process.env.VITEST);

    reply.header(
      'Set-Cookie',
      buildSessionCookie(issued.token, issued.expiresAt, {
        cookieName: 'aegis_session',
        secure: strictCookie,
        sameSite: strictCookie ? 'Strict' : 'Lax',
        maxAgeSeconds: Math.floor(ttlMs / 1000),
      })
    );
    return reply.code(201).send({
      authenticated: true,
      csrf_token: csrfToken,
    });
  });

  app.get('/v1/auth/csrf', async (request, reply) => {
    const principal = await requireAuthenticatedPrincipal(request, reply, authContext, {
      requireCsrfOnCookieMutation: false,
    });
    if (!principal) return;
    if (!principal.sessionId) {
      return reply.code(200).send({ csrf_token: null });
    }
    return reply.code(200).send({
      csrf_token: deriveCsrfToken(principal.sessionId, principal.userId, sessionSecret),
    });
  });

  app.post('/v1/auth/logout', async (request, reply) => {
    const cookieToken = extractSessionToken(request.headers.cookie);
    const verified = verifySignedSessionToken(cookieToken, sessionSecret, revokedSessions);
    if (verified) {
      revokedSessions.add(verified.sessionId);
    }

    const strictCookie =
      isProduction ||
      request.protocol === 'https' ||
      nodeEnv === 'test' ||
      Boolean(process.env.VITEST);

    const logoutHeaders = buildLogoutHeaders({
      secure: strictCookie,
      sameSite: strictCookie ? 'Strict' : 'Lax',
    });
    for (const [key, value] of Object.entries(logoutHeaders)) {
      reply.header(key, value);
    }
    return reply.code(204).send();
  });

  await app.register(registerHealthRoutes);
  await app.register(registerDeviceRoutes, { deviceStore, authContext });
  await app.register(registerEventRoutes, { deviceStore, eventStore, authContext });
  await app.register(registerShareRoutes, { deviceStore, shareStore, authContext });
  await app.register(registerCommandRoutes, { deviceStore, commandStore, authContext });

  return app;
}
