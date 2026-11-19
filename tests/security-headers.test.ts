import { describe, expect, it } from 'vitest';
import { buildSecurityHeaders } from '../src/security/secure-headers';
import { buildLogoutHeaders, buildSessionCookie } from '../src/security/auth-session';
import { AEGIS_PINO_REDACT_CONFIG, redactSensitiveTelemetry } from '../src/security/log-redaction';

describe('Security headers, session cookies & log redaction', () => {
  it('generates strict CSP and OWASP security headers', () => {
    const headers = buildSecurityHeaders({
      cspNonce: 'nonce123abc',
      allowedApiOrigin: 'https://correlator.aegis.example',
    });

    const csp = headers['Content-Security-Policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'nonce-nonce123abc' 'strict-dynamic'");
    expect(csp).toContain("connect-src 'self' https://correlator.aegis.example");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain('upgrade-insecure-requests');

    expect(headers['Strict-Transport-Security']).toContain('max-age=63072000');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
    expect(headers['Cache-Control']).toContain('no-store');
  });

  it('issues Secure, HttpOnly, SameSite=Strict aegis_session cookie with Max-Age and logout Clear-Site-Data', () => {
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    const cookie = buildSessionCookie('sess_random_entropy_token', expires);
    expect(cookie).toContain('aegis_session=sess_random_entropy_token');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Max-Age=');

    const logout = buildLogoutHeaders();
    expect(logout['Clear-Site-Data']).toContain('cookies');
    expect(logout['Cache-Control']).toContain('no-store');
  });

  it('redacts ciphertext, nonce, auth_tag, signature, authorization, and raw IP from logs', () => {
    expect(AEGIS_PINO_REDACT_CONFIG.censor).toBe('[REDACTED]');
    const sanitized = redactSensitiveTelemetry({
      event_id: '019339a2-7b40-7f12-9a10-8e4c1b204108',
      authorization: 'Bearer secret-jwt',
      envelope: {
        ciphertext: 'abc123',
        nonce: 'iv12bytes',
        auth_tag: 'tag16bytes',
        signature: 'ed25519sig',
      },
      raw_ip: '198.51.100.14',
    });

    expect(sanitized.authorization).toBe('[REDACTED]');
    expect(sanitized.raw_ip).toBe('[REDACTED]');
    expect(sanitized.envelope.ciphertext).toBe('[REDACTED]');
    expect(sanitized.envelope.nonce).toBe('[REDACTED]');
    expect(sanitized.envelope.auth_tag).toBe('[REDACTED]');
    expect(sanitized.envelope.signature).toBe('[REDACTED]');
    expect(sanitized.event_id).toBe('019339a2-7b40-7f12-9a10-8e4c1b204108');
  });
});
