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

export function buildSessionCookie(
  sessionId: string,
  expiresAt: Date,
  options?: { secure?: boolean; sameSite?: 'Strict' | 'Lax'; maxAgeSeconds?: number }
): string {
  if (!sessionId || /[\s;,]/.test(sessionId)) {
    throw new Error('invalid_session_id');
  }
  const secure = options?.secure ?? true;
  const sameSite = options?.sameSite ?? 'Strict';
  const maxAgeSeconds =
    options?.maxAgeSeconds ??
    Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

  const parts = [`${defaultSessionPolicy.cookieName}=${sessionId}`, 'Path=/'];
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

export function buildLogoutHeaders(): Record<string, string> {
  return {
    'Clear-Site-Data': '"cache", "cookies", "storage"',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  };
}
