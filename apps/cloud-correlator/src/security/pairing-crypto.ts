import crypto from 'node:crypto';

export const PAIRING_PROTOCOL_VERSION = '1.0.0' as const;
export const MAX_PAIRING_SKEW_MS = 5 * 60 * 1000;

export interface PairingTranscriptInput {
  protocol_version: string;
  device_id: string;
  owner_signing_public_key: string;
  device_signing_public_key: string;
  device_agreement_public_key: string;
  nonce: string;
  timestamp: string;
}

export interface MutualPairingPayload extends PairingTranscriptInput {
  owner_signature: string;
  device_signature: string;
}

export interface EventSigningInput {
  schema_version: '1.0.0';
  event_id: string;
  device_id: string;
  timestamp: string;
  ciphertext: string;
  nonce: string;
  auth_tag: string;
  prev_event_hash: string | null;
}

export function importPublicKey(encodedKey: string): crypto.KeyObject {
  const trimmed = encodedKey.trim();
  if (trimmed.startsWith('-----BEGIN PUBLIC KEY-----')) {
    return crypto.createPublicKey(trimmed);
  }
  return crypto.createPublicKey({
    key: Buffer.from(trimmed, 'base64'),
    format: 'der',
    type: 'spki',
  });
}

export function verifyTimestampWithinWindow(
  timestampIso: string,
  nowMs = Date.now(),
  maxSkewMs = MAX_PAIRING_SKEW_MS
): boolean {
  const parsedMs = Date.parse(timestampIso);
  if (!Number.isFinite(parsedMs)) {
    return false;
  }
  return Math.abs(nowMs - parsedMs) <= maxSkewMs;
}

export function buildPairingTranscript(input: PairingTranscriptInput): Buffer {
  return Buffer.from(
    [
      input.protocol_version,
      input.device_id,
      input.owner_signing_public_key,
      input.device_signing_public_key,
      input.device_agreement_public_key,
      input.nonce,
      input.timestamp,
    ].join('.'),
    'utf8'
  );
}

export function verifyMutualPairingSignatures(
  payload: MutualPairingPayload
): { valid: boolean; reason?: string } {
  try {
    const transcript = buildPairingTranscript(payload);
    const ownerPublicKey = importPublicKey(payload.owner_signing_public_key);
    const devicePublicKey = importPublicKey(payload.device_signing_public_key);

    if (
      ownerPublicKey.asymmetricKeyType !== 'ed25519' ||
      devicePublicKey.asymmetricKeyType !== 'ed25519'
    ) {
      return { valid: false, reason: 'invalid_signing_key_type' };
    }

    const ownerValid = crypto.verify(
      null,
      transcript,
      ownerPublicKey,
      Buffer.from(payload.owner_signature, 'base64')
    );
    if (!ownerValid) {
      return { valid: false, reason: 'invalid_owner_signature' };
    }

    const deviceValid = crypto.verify(
      null,
      transcript,
      devicePublicKey,
      Buffer.from(payload.device_signature, 'base64')
    );
    if (!deviceValid) {
      return { valid: false, reason: 'invalid_device_signature' };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'signature_verification_error' };
  }
}

export function deriveSessionKeyHkdf(
  deviceAgreementPublicKeyEncoded: string,
  deviceId: string,
  nonce: string
): { serverAgreementPublicKey: string; hkdfSessionKeyId: string } {
  const peerPublicKey = importPublicKey(deviceAgreementPublicKeyEncoded);
  if (peerPublicKey.asymmetricKeyType !== 'x25519') {
    throw new Error('invalid_x25519_agreement_key');
  }

  const ephemeral = crypto.generateKeyPairSync('x25519');
  const sharedSecret = crypto.diffieHellman({
    privateKey: ephemeral.privateKey,
    publicKey: peerPublicKey,
  });

  if (sharedSecret.length !== 32) {
    sharedSecret.fill(0);
    throw new Error('invalid_shared_secret_length');
  }

  let derivedKey: Buffer | null = null;
  try {
    const salt = Buffer.from(nonce, 'utf8');
    const info = Buffer.from(`aegis-nobet:session:v1:${deviceId}`, 'utf8');
    derivedKey = Buffer.from(
      crypto.hkdfSync('sha256', sharedSecret, salt, info, 32)
    );

    const hkdfSessionKeyId = crypto
      .createHash('sha256')
      .update(derivedKey)
      .digest('hex')
      .slice(0, 16);

    const serverAgreementPublicKey = (
      ephemeral.publicKey.export({ format: 'der', type: 'spki' }) as Buffer
    ).toString('base64');

    return {
      serverAgreementPublicKey,
      hkdfSessionKeyId,
    };
  } finally {
    sharedSecret.fill(0);
    if (derivedKey) {
      derivedKey.fill(0);
    }
  }
}

export function buildEventSigningPayload(input: EventSigningInput): Buffer {
  return Buffer.from(
    [
      input.schema_version,
      input.event_id,
      input.device_id,
      input.timestamp,
      input.ciphertext,
      input.nonce,
      input.auth_tag,
      input.prev_event_hash ?? '',
    ].join('.'),
    'utf8'
  );
}

export function verifyDeviceEventSignature(
  deviceSigningPublicKeyEncoded: string,
  envelope: EventSigningInput & { signature: string }
): boolean {
  try {
    const publicKey = importPublicKey(deviceSigningPublicKeyEncoded);
    if (publicKey.asymmetricKeyType !== 'ed25519') {
      return false;
    }
    const payload = buildEventSigningPayload(envelope);
    return crypto.verify(
      null,
      payload,
      publicKey,
      Buffer.from(envelope.signature, 'base64')
    );
  } catch {
    return false;
  }
}

export function computeEventHash(
  eventId: string,
  nonce: string,
  prevEventHash: string | null
): string {
  return crypto
    .createHash('sha256')
    .update(`${eventId}:${nonce}:${prevEventHash ?? ''}`)
    .digest('hex');
}
