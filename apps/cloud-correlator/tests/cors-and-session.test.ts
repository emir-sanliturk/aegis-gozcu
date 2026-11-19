import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import {
  buildSessionCookie,
  validateSessionSecret,
} from '../src/security/auth-session';
import {
  DEFAULT_DEV_ALLOWED_ORIGINS,
  parseAllowedOrigins,
  resolveAllowedOrigins,
} from '../src/security/cors';

describe('Cloud Correlator strict CORS & session secret enforcement', () => {
  it('forbids wildcard * origin, invalid URLs, and non-HTTPS origins in production', () => {
    expect([...DEFAULT_DEV_ALLOWED_ORIGINS]).toEqual(['http://localhost:5173']);
    expect(() => parseAllowedOrigins('*')).toThrow('wildcard_cors_origin_forbidden');
    expect(() => parseAllowedOrigins('https://aegis.example.com, *')).toThrow(
      'wildcard_cors_origin_forbidden'
    );
    expect(() => parseAllowedOrigins('not-a-valid-origin')).toThrow(
      'cors_origin_invalid:not-a-valid-origin'
    );
    expect(() =>
      resolveAllowedOrigins({
        rawOrigins: 'http://gozcu.example.com',
        nodeEnv: 'production',
      })
    ).toThrow('cors_origin_requires_https:http://gozcu.example.com');
    expect(() =>
      resolveAllowedOrigins({
        rawOrigins: '',
        fallbackOrigin: '',
        nodeEnv: 'production',
      })
    ).toThrow('AEGIS_ALLOWED_ORIGINS must contain at least one explicit origin.');
  });

  it('responds with explicit Access-Control-Allow-Origin + Allow-Credentials on allowed origin and rejects disallowed origins with 403 + Vary: Origin', async () => {
    const app = await buildApp({
      allowedOrigins: ['https://aegis.example.com'],
    });

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/v1/commands',
      headers: {
        origin: 'https://aegis.example.com',
        'access-control-request-method': 'POST',
      },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(
      'https://aegis.example.com'
    );
    expect(preflight.headers['access-control-allow-credentials']).toBe('true');
    expect(preflight.headers['access-control-allow-methods']).toBe(
      'GET, POST, DELETE, OPTIONS'
    );
    expect(preflight.headers['access-control-allow-headers']).toBe(
      'Accept, Content-Type, X-Requested-With'
    );
    expect(preflight.headers['access-control-max-age']).toBe('600');
    expect(preflight.headers['vary']).toBe('Origin');

    const allowedGet = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: {
        origin: 'https://aegis.example.com',
      },
    });
    expect(allowedGet.statusCode).toBe(200);
    expect(allowedGet.headers['access-control-allow-origin']).toBe(
      'https://aegis.example.com'
    );
    expect(allowedGet.headers['access-control-allow-credentials']).toBe('true');

    const disallowed = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: {
        origin: 'https://evil.example.net',
      },
    });
    expect(disallowed.statusCode).toBe(403);
    expect(disallowed.json()).toEqual({ error: 'cors_origin_not_allowed' });
    expect(disallowed.headers['vary']).toBe('Origin');
    expect(disallowed.headers['access-control-allow-origin']).toBeUndefined();

    await app.close();
  });

  it('validates session secret length (>=32) and builds strict or dev session cookies safely', () => {
    expect(() => validateSessionSecret(undefined)).toThrow(
      'AEGIS_SESSION_SECRET must be set and be at least 32 characters.'
    );
    expect(() => validateSessionSecret('short-secret')).toThrow(
      'AEGIS_SESSION_SECRET must be set and be at least 32 characters.'
    );
    const valid = validateSessionSecret('0123456789abcdef0123456789abcdef');
    expect(valid.length).toBe(32);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const prodCookie = buildSessionCookie('sess_token_123', expiresAt);
    expect(prodCookie).toContain('aegis_session=sess_token_123');
    expect(prodCookie).toContain('Secure');
    expect(prodCookie).toContain('HttpOnly');
    expect(prodCookie).toContain('SameSite=Strict');
    expect(prodCookie).toContain('Max-Age=');

    const devCookie = buildSessionCookie('sess_token_123', expiresAt, {
      cookieName: 'aegis_session',
      secure: false,
      sameSite: 'Lax',
      maxAgeSeconds: 900,
    });
    expect(devCookie).toContain('aegis_session=sess_token_123');
    expect(devCookie).not.toContain('Secure');
    expect(devCookie).toContain('HttpOnly');
    expect(devCookie).toContain('SameSite=Lax');
    expect(devCookie).toContain('Max-Age=900');
  });
});
