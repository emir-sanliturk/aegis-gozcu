export const AEGIS_PINO_REDACT_CONFIG = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["x-forwarded-for"]',
    'req.headers["cf-connecting-ip"]',
    '*.ciphertext',
    '*.nonce',
    '*.iv',
    '*.auth_tag',
    '*.signature',
    '*.ip',
    '*.client_ip',
    '*.raw_ip',
    '*.private_key',
  ],
  censor: '[REDACTED]',
} as const;

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'x-forwarded-for',
  'cf-connecting-ip',
  'ciphertext',
  'nonce',
  'iv',
  'auth_tag',
  'signature',
  'ip',
  'client_ip',
  'raw_ip',
  'private_key',
]);

export function redactSensitiveTelemetry<T>(payload: T): T {
  if (payload === null || typeof payload !== 'object') {
    return payload;
  }
  if (Array.isArray(payload)) {
    return payload.map((item) => redactSensitiveTelemetry(item)) as unknown as T;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      output[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object') {
      output[key] = redactSensitiveTelemetry(value);
    } else {
      output[key] = value;
    }
  }
  return output as T;
}
