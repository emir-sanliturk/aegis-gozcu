import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { AEGIS_PINO_REDACT_CONFIG } from '../src/security/logger-redaction';
import { hashIpForRateLimit } from '../src/security/rate-limit';

describe('Cloud Correlator security headers, session cookies, rate limits & redaction', () => {
  it('attaches strict CSP and OWASP headers on every Fastify response', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });

    const csp = String(res.headers['content-security-policy']);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).toContain("media-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain('upgrade-insecure-requests');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['permissions-policy']).toBe(
      'camera=(), microphone=(), geolocation=()'
    );
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(res.headers['cache-control']).toContain('no-store');
    await app.close();
  });

  it('sets aegis_session Secure/HttpOnly/SameSite/Max-Age cookie, returns csrf_token in JSON only, and clears on logout', async () => {
    const app = await buildApp();
    const loginRes = await app.inject({ method: 'POST', url: '/v1/auth/session' });
    expect(loginRes.statusCode).toBe(201);
    const setCookie = String(loginRes.headers['set-cookie']);
    expect(setCookie).toContain('aegis_session=');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Max-Age=900');

    const body = loginRes.json() as { authenticated: boolean; csrf_token?: string };
    expect(body.authenticated).toBe(true);
    expect(typeof body.csrf_token).toBe('string');
    expect(setCookie).not.toContain(String(body.csrf_token));

    const logoutRes = await app.inject({ method: 'POST', url: '/v1/auth/logout' });
    expect(logoutRes.statusCode).toBe(204);
    expect(String(logoutRes.headers['clear-site-data'])).toContain('cookies');
    expect(String(logoutRes.headers['set-cookie'])).toContain('Max-Age=0');
    await app.close();
  });

  it('configures Pino log redaction and hashes IP for rate limiting without storing raw IP', async () => {
    expect(AEGIS_PINO_REDACT_CONFIG.censor).toBe('[REDACTED]');
    expect(AEGIS_PINO_REDACT_CONFIG.paths).toContain('*.ciphertext');
    expect(AEGIS_PINO_REDACT_CONFIG.paths).toContain('*.nonce');
    expect(AEGIS_PINO_REDACT_CONFIG.paths).toContain('*.auth_tag');
    expect(AEGIS_PINO_REDACT_CONFIG.paths).toContain('*.signature');
    expect(AEGIS_PINO_REDACT_CONFIG.paths).toContain('req.headers.authorization');
    expect(AEGIS_PINO_REDACT_CONFIG.paths).toContain('*.raw_ip');

    const ipHash = hashIpForRateLimit('203.0.113.10', 'pepper');
    expect(ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(ipHash).not.toContain('203.0.113.10');
  });
});
