import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  extractSessionToken,
  verifyBearerToken,
  verifyCsrfToken,
  verifySignedSessionToken,
} from './auth-session';
import { hashIpForRateLimit, type SlidingWindowRateLimiter } from './rate-limit';
import type { AuditStore } from '../storage/types';

export interface AuthContext {
  sessionSecret: string;
  revokedSessions: Set<string>;
  nodeEnv: string;
  ipPepper: string;
  rateLimiter: SlidingWindowRateLimiter;
  auditStore?: AuditStore;
}

export interface AuthenticatedPrincipal {
  userId: string;
  method: 'bearer' | 'cookie';
  sessionId?: string;
}

export async function recordSecurityAudit(
  request: FastifyRequest,
  ctx: AuthContext,
  entry: {
    actorUserId: string | null;
    action: string;
    targetId?: string | null;
    outcome: string;
    statusCode: number;
  }
): Promise<void> {
  const ipHash = hashIpForRateLimit(request.ip ?? 'unknown', ctx.ipPepper);
  request.log.info(
    {
      audit: true,
      actor_user_id: entry.actorUserId,
      action: entry.action,
      target_id: entry.targetId ?? null,
      outcome: entry.outcome,
      status_code: entry.statusCode,
      ip_hash: ipHash,
    },
    'security_audit_event'
  );
  if (ctx.auditStore) {
    try {
      await ctx.auditStore.recordAudit({
        actor_user_id: entry.actorUserId,
        action: entry.action,
        target_id: entry.targetId ?? null,
        outcome: entry.outcome,
        status_code: entry.statusCode,
        ip_hash: ipHash,
      });
    } catch {
      // keep audit logging non-fatal while structured stdout log persists
    }
  }
}

export async function requireAuthenticatedPrincipal(
  request: FastifyRequest,
  reply: FastifyReply,
  ctx: AuthContext,
  options?: { requireCsrfOnCookieMutation?: boolean }
): Promise<AuthenticatedPrincipal | null> {
  if (ctx.rateLimiter.isAuthBlocked(request.ip ?? 'unknown', ctx.ipPepper)) {
    await recordSecurityAudit(request, ctx, {
      actorUserId: null,
      action: 'auth_blocked',
      outcome: 'auth_rate_limited',
      statusCode: 429,
    });
    void reply.code(429).send({ error: 'auth_rate_limited' });
    return null;
  }

  const authHeader = request.headers.authorization;
  if (authHeader !== undefined) {
    if (!authHeader.startsWith('Bearer ')) {
      const blocked = ctx.rateLimiter.recordAuthFailure(request.ip ?? 'unknown', ctx.ipPepper);
      await recordSecurityAudit(request, ctx, {
        actorUserId: null,
        action: 'auth_check',
        outcome: blocked ? 'auth_rate_limited' : 'invalid_auth_header',
        statusCode: blocked ? 429 : 401,
      });
      void reply
        .code(blocked ? 429 : 401)
        .send({ error: blocked ? 'auth_rate_limited' : 'unauthorized' });
      return null;
    }

    const rawBearer = authHeader.slice(7);
    const verified = verifyBearerToken(rawBearer, ctx.sessionSecret, ctx.nodeEnv);
    if (!verified) {
      const blocked = ctx.rateLimiter.recordAuthFailure(request.ip ?? 'unknown', ctx.ipPepper);
      await recordSecurityAudit(request, ctx, {
        actorUserId: null,
        action: 'auth_check',
        outcome: blocked ? 'auth_rate_limited' : 'invalid_bearer_token',
        statusCode: blocked ? 429 : 401,
      });
      void reply
        .code(blocked ? 429 : 401)
        .send({ error: blocked ? 'auth_rate_limited' : 'unauthorized' });
      return null;
    }

    return {
      userId: verified.userId,
      method: 'bearer',
    };
  }

  const rawCookieToken = extractSessionToken(request.headers.cookie);
  if (!rawCookieToken) {
    const blocked = ctx.rateLimiter.recordAuthFailure(request.ip ?? 'unknown', ctx.ipPepper);
    await recordSecurityAudit(request, ctx, {
      actorUserId: null,
      action: 'auth_check',
      outcome: blocked ? 'auth_rate_limited' : 'missing_credentials',
      statusCode: blocked ? 429 : 401,
    });
    void reply
      .code(blocked ? 429 : 401)
      .send({ error: blocked ? 'auth_rate_limited' : 'unauthorized' });
    return null;
  }

  const verifiedCookie = verifySignedSessionToken(
    rawCookieToken,
    ctx.sessionSecret,
    ctx.revokedSessions
  );
  if (!verifiedCookie) {
    const blocked = ctx.rateLimiter.recordAuthFailure(request.ip ?? 'unknown', ctx.ipPepper);
    await recordSecurityAudit(request, ctx, {
      actorUserId: null,
      action: 'auth_check',
      outcome: blocked ? 'auth_rate_limited' : 'invalid_session_cookie',
      statusCode: blocked ? 429 : 401,
    });
    void reply
      .code(blocked ? 429 : 401)
      .send({ error: blocked ? 'auth_rate_limited' : 'unauthorized' });
    return null;
  }

  const isMutating = request.method !== 'GET' && request.method !== 'HEAD';
  if (isMutating && options?.requireCsrfOnCookieMutation !== false) {
    const csrfHeader = request.headers['x-requested-with'];
    const headerValue = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;
    if (
      !verifyCsrfToken(
        headerValue,
        verifiedCookie.sessionId,
        verifiedCookie.userId,
        ctx.sessionSecret
      )
    ) {
      await recordSecurityAudit(request, ctx, {
        actorUserId: verifiedCookie.userId,
        action: 'csrf_check',
        outcome: 'csrf_validation_failed',
        statusCode: 403,
      });
      void reply.code(403).send({ error: 'csrf_validation_failed' });
      return null;
    }
  }

  return {
    userId: verifiedCookie.userId,
    method: 'cookie',
    sessionId: verifiedCookie.sessionId,
  };
}
