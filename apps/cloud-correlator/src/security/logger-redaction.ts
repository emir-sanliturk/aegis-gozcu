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
    '*.public_key',
    '*.shared_secret',
    '*.derived_key',
    '*.session_key',
    '*.hkdf_salt',
    '*.owner_signature',
    '*.device_signature',
    '*.owner_signing_private_key',
    '*.device_signing_private_key',
    '*.device_agreement_private_key',
    '*.owner_signing_public_key',
    '*.device_signing_public_key',
    '*.device_agreement_public_key',
    '*.server_agreement_public_key',
  ],
  censor: '[REDACTED]',
};

export function createRedactedLoggerConfig(level = process.env.LOG_LEVEL ?? 'info') {
  return {
    level,
    redact: AEGIS_PINO_REDACT_CONFIG,
  };
}
