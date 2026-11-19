import crypto from 'node:crypto';

export interface RouteRateLimitRule {
  prefix: string;
  limitPerMinute: number;
}

export const DEFAULT_WAF_RATE_LIMITS: RouteRateLimitRule[] = [
  { prefix: '/v1/auth/login', limitPerMinute: 5 },
  { prefix: '/v1/auth/session', limitPerMinute: 5 },
  { prefix: '/v1/devices/pair', limitPerMinute: 10 },
  { prefix: '/v1/events', limitPerMinute: 120 },
  { prefix: '/v1/shares', limitPerMinute: 15 },
  { prefix: '/v1/commands', limitPerMinute: 10 },
];

export function hashIpForRateLimit(rawIp: string, pepper: string): string {
  return crypto
    .createHash('sha256')
    .update(`${pepper}:${rawIp}`)
    .digest('hex');
}

export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAtMs: number }>();
  private readonly authFailures = new Map<string, { count: number; resetAtMs: number }>();

  constructor(
    private readonly rules: RouteRateLimitRule[] = DEFAULT_WAF_RATE_LIMITS,
    private readonly authFailureLimitPerMinute = 10
  ) {}

  check(
    routePath: string,
    rawIp: string,
    pepper: string,
    nowMs = Date.now()
  ): { allowed: boolean; limit: number; remaining: number } {
    const matched = this.rules.find((rule) =>
      routePath.startsWith(rule.prefix)
    );
    if (!matched) {
      return { allowed: true, limit: 0, remaining: 0 };
    }

    const ipDigest = hashIpForRateLimit(rawIp, pepper);
    const key = `${matched.prefix}:${ipDigest}`;
    const existing = this.buckets.get(key);

    if (!existing || nowMs >= existing.resetAtMs) {
      this.buckets.set(key, { count: 1, resetAtMs: nowMs + 60_000 });
      return {
        allowed: true,
        limit: matched.limitPerMinute,
        remaining: matched.limitPerMinute - 1,
      };
    }

    if (existing.count >= matched.limitPerMinute) {
      return {
        allowed: false,
        limit: matched.limitPerMinute,
        remaining: 0,
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      limit: matched.limitPerMinute,
      remaining: matched.limitPerMinute - existing.count,
    };
  }

  isAuthBlocked(rawIp: string, pepper: string, nowMs = Date.now()): boolean {
    const ipDigest = hashIpForRateLimit(rawIp, pepper);
    const entry = this.authFailures.get(ipDigest);
    if (!entry) return false;
    if (nowMs >= entry.resetAtMs) {
      this.authFailures.delete(ipDigest);
      return false;
    }
    return entry.count >= this.authFailureLimitPerMinute;
  }

  recordAuthFailure(rawIp: string, pepper: string, nowMs = Date.now()): boolean {
    const ipDigest = hashIpForRateLimit(rawIp, pepper);
    const entry = this.authFailures.get(ipDigest);
    if (!entry || nowMs >= entry.resetAtMs) {
      this.authFailures.set(ipDigest, { count: 1, resetAtMs: nowMs + 60_000 });
      return false;
    }
    entry.count += 1;
    return entry.count >= this.authFailureLimitPerMinute;
  }
}
