import crypto from 'node:crypto';

export interface SessionPolicy {
  absoluteTimeoutMinutes: number;
  idleTimeoutMinutes: number;
  cookieName: string;
}

export const defaultSessionPolicy: SessionPolicy = {
  absoluteTimeoutMinutes: 720,
  idleTimeoutMinutes: 15,
  cookieName: 'aegis_session',
};

export interface SessionCookieOptions {
  cookieName?: string;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax';
  maxAgeSeconds?: number;
}

export interface VerifiedSessionToken {
  sessionId: string;
  userId: string;
  expiresAtMs: number;
}

export interface VerifiedBearerToken {
  userId: string;
  kind: 'signed' | 'dev';
}

const DEV_ONLY_BEARER_USERS: Record<string, string> = {
  'dev-test-token': 'usr-owner-default',
  'owner-test-token': 'usr-owner-default',
  'owner-load-token': 'usr-owner-default',
  'device-load-token': 'usr-owner-default',
  'rate-test-token': 'usr-owner-default',
  'other-user-test-token': 'usr-other-user',
};

export function validateSessionSecret(secret: string | undefined): string {
  if (!secret || secret.trim().length < 32) {
    throw new Error('AEGIS_SESSION_SECRET must be set and be at least 32 characters.');
  }
  return secret;
}

function hmacSign(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function issueSignedSessionToken(
  userId: string,
  secret: string,
  ttlMs = 15 * 60 * 1000
): { token: string; sessionId: string; expiresAt: Date } {
  const sessionId = crypto.randomBytes(24).toString('base64url');
  const expiresAtMs = Date.now() + ttlMs;
  const userB64 = Buffer.from(userId, 'utf8').toString('base64url');
  const body = `${sessionId}.${userB64}.${expiresAtMs}`;
  const sig = hmacSign(`sess:${body}`, secret);
  return {
    token: `${body}.${sig}`,
    sessionId,
    expiresAt: new Date(expiresAtMs),
  };
}

export function verifySignedSessionToken(
  token: string | null | undefined,
  secret: string,
  revokedSessions?: Set<string>,
  nowMs = Date.now()
): VerifiedSessionToken | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [sessionId, userB64, expRaw, sig] = parts;
  if (!sessionId || !userB64 || !expRaw || !sig) return null;

  const body = `${sessionId}.${userB64}.${expRaw}`;
  const expectedSig = hmacSign(`sess:${body}`, secret);
  if (!constantTimeEquals(sig, expectedSig)) return null;

  if (revokedSessions?.has(sessionId)) return null;

  const expiresAtMs = Number(expRaw);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) return null;

  let userId = '';
  try {
    userId = Buffer.from(userB64, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!userId) return null;

  return { sessionId, userId, expiresAtMs };
}

export function issueSignedBearerToken(
  userId: string,
  secret: string,
  ttlMs = 60 * 60 * 1000
): string {
  const expiresAtMs = Date.now() + ttlMs;
  const userB64 = Buffer.from(userId, 'utf8').toString('base64url');
  const body = `agbt.${userB64}.${expiresAtMs}`;
  const sig = hmacSign(`bearer:${body}`, secret);
  return `${body}.${sig}`;
}

export function verifyBearerToken(
  rawToken: string | null | undefined,
  secret: string,
  nodeEnv = process.env.NODE_ENV ?? 'development',
  nowMs = Date.now()
): VerifiedBearerToken | null {
  if (!rawToken) return null;
  const token = rawToken.trim();
  if (!token) return null;

  if (token.startsWith('agbt.')) {
    const parts = token.split('.');
    if (parts.length !== 4) return null;
    const [, userB64, expRaw, sig] = parts;
    if (!userB64 || !expRaw || !sig) return null;
    const body = `agbt.${userB64}.${expRaw}`;
    const expectedSig = hmacSign(`bearer:${body}`, secret);
    if (!constantTimeEquals(sig, expectedSig)) return null;
    const expiresAtMs = Number(expRaw);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) return null;
    try {
      const userId = Buffer.from(userB64, 'base64url').toString('utf8');
      if (!userId) return null;
      return { userId, kind: 'signed' };
    } catch {
      return null;
    }
  }

  if (nodeEnv !== 'production') {
    const devUser = DEV_ONLY_BEARER_USERS[token];
    if (devUser) {
      return { userId: devUser, kind: 'dev' };
    }
  }

  return null;
}

export function deriveCsrfToken(
  sessionId: string,
  userId: string,
  secret: string
): string {
  return hmacSign(`csrf:${sessionId}:${userId}`, secret);
}

export function verifyCsrfToken(
  candidate: string | undefined,
  sessionId: string,
  userId: string,
  secret: string
): boolean {
  if (!candidate) return false;
  const expected = deriveCsrfToken(sessionId, userId, secret);
  return constantTimeEquals(candidate.trim(), expected);
}

export function buildSessionCookie(
  sessionValue: string,
  expiresAt: Date,
  options?: SessionCookieOptions
): string {
  if (!sessionValue || /[\s;,]/.test(sessionValue)) {
    throw new Error('invalid_session_id');
  }
  const cookieName = options?.cookieName ?? defaultSessionPolicy.cookieName;
  const secure = options?.secure ?? true;
  const sameSite = options?.sameSite ?? 'Strict';
  const maxAgeSeconds =
    options?.maxAgeSeconds ??
    Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

  const parts = [`${cookieName}=${sessionValue}`, 'Path=/'];
  if (secure) {
    parts.push('Secure');
  }
  parts.push(
    'HttpOnly',
    `SameSite=${sameSite}`,
    `Max-Age=${maxAgeSeconds}`,
    `Expires=${expiresAt.toUTCString()}`
  );
  return parts.join('; ');
}

export function buildLogoutHeaders(options?: { secure?: boolean; sameSite?: 'Strict' | 'Lax' }): Record<string, string> {
  const secure = options?.secure ?? true;
  const sameSite = options?.sameSite ?? 'Strict';
  const clearParts = [`${defaultSessionPolicy.cookieName}=`, 'Path=/', 'Max-Age=0'];
  if (secure) {
    clearParts.push('Secure');
  }
  clearParts.push('HttpOnly', `SameSite=${sameSite}`, 'Expires=Thu, 01 Jan 1970 00:00:00 GMT');

  return {
    'Set-Cookie': clearParts.join('; '),
    'Clear-Site-Data': '"cache", "cookies", "storage"',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  };
}

export function extractSessionToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawName, ...rest] = part.trim().split('=');
    const trimmedName = rawName?.trim();
    if (
      (trimmedName === defaultSessionPolicy.cookieName ||
        trimmedName === '__Host-aegis_session') &&
      rest.length > 0
    ) {
      return rest.join('=').trim();
    }
  }
  return null;
}
