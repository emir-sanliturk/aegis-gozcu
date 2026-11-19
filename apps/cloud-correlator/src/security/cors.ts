export interface CorsResolutionOptions {
  rawOrigins?: string;
  fallbackOrigin?: string;
  nodeEnv?: string;
  requireExplicit?: boolean;
}

export const DEFAULT_DEV_ALLOWED_ORIGINS = [
  'http://localhost:5173',
] as const;

export const ALLOWED_CORS_METHODS = ['GET', 'POST', 'DELETE', 'OPTIONS'] as const;
export const ALLOWED_CORS_HEADERS = ['Accept', 'Content-Type', 'X-Requested-With'] as const;

export function parseAllowedOrigins(
  raw: string | undefined,
  options?: { requireHttps?: boolean }
): string[] {
  if (!raw) return [];
  const parsed = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (parsed.includes('*')) {
    throw new Error('wildcard_cors_origin_forbidden');
  }

  for (const origin of parsed) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`cors_origin_invalid:${origin}`);
    }

    if (options?.requireHttps && url.protocol !== 'https:') {
      throw new Error(`cors_origin_requires_https:${origin}`);
    }
  }

  return Array.from(new Set(parsed));
}

export function resolveAllowedOrigins(options?: CorsResolutionOptions): string[] {
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const requireHttps = nodeEnv === 'production';
  const raw = options?.rawOrigins ?? process.env.AEGIS_ALLOWED_ORIGINS;
  const fallback = options?.fallbackOrigin ?? process.env.ALLOWED_API_ORIGIN;

  const explicit = parseAllowedOrigins(raw, { requireHttps });
  if (explicit.length > 0) {
    return explicit;
  }

  const fromFallback = parseAllowedOrigins(fallback, { requireHttps });
  if (fromFallback.length > 0) {
    return fromFallback;
  }

  if (options?.requireExplicit || nodeEnv === 'production') {
    throw new Error('AEGIS_ALLOWED_ORIGINS must contain at least one explicit origin.');
  }

  return [...DEFAULT_DEV_ALLOWED_ORIGINS];
}

export function buildCorsHeaders(
  requestOrigin: string | undefined,
  allowedOrigins: readonly string[]
): { allowed: boolean; headers: Record<string, string> } {
  if (!requestOrigin) {
    return { allowed: true, headers: {} };
  }

  if (requestOrigin === '*' || !allowedOrigins.includes(requestOrigin)) {
    return {
      allowed: false,
      headers: {
        Vary: 'Origin',
      },
    };
  }

  return {
    allowed: true,
    headers: {
      'Access-Control-Allow-Origin': requestOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': ALLOWED_CORS_METHODS.join(', '),
      'Access-Control-Allow-Headers': ALLOWED_CORS_HEADERS.join(', '),
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    },
  };
}
