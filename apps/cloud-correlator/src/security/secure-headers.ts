export interface SecureHeaderPolicy {
  cspNonce: string;
  allowedApiOrigin: string;
}

export function buildSecurityHeaders(policy: SecureHeaderPolicy): Record<string, string> {
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      `script-src 'nonce-${policy.cspNonce}' 'strict-dynamic'`,
      "style-src 'self'",
      "img-src 'self' data:",
      "media-src 'self'",
      `connect-src 'self' ${policy.allowedApiOrigin}`,
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      'upgrade-insecure-requests',
    ].join('; '),
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  };
}
