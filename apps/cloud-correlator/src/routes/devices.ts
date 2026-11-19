import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  recordSecurityAudit,
  requireAuthenticatedPrincipal,
  type AuthContext,
} from '../security/auth-guard';
import {
  PAIRING_PROTOCOL_VERSION,
  deriveSessionKeyHkdf,
  verifyMutualPairingSignatures,
  verifyTimestampWithinWindow,
} from '../security/pairing-crypto';
import type { DeviceStore } from '../storage/types';

export interface DeviceRoutesOptions {
  deviceStore: DeviceStore;
  authContext: AuthContext;
}

const PairDeviceSchema = z
  .object({
    protocol_version: z.literal(PAIRING_PROTOCOL_VERSION),
    device_id: z.string().regex(/^(enc_)?dev(ice)?[-_a-zA-Z0-9]{3,48}$/),
    platform: z.enum(['windows', 'macos', 'android', 'ios', 'cloud']),
    hostname: z.string().min(1).max(128),
    owner_signing_public_key: z.string().min(32),
    device_signing_public_key: z.string().min(32),
    device_agreement_public_key: z.string().min(32),
    nonce: z.string().min(16).max(128),
    timestamp: z.string().datetime({ offset: true }),
    owner_signature: z.string().min(32),
    device_signature: z.string().min(32),
  })
  .strict();

export async function registerDeviceRoutes(
  app: FastifyInstance,
  options: DeviceRoutesOptions
): Promise<void> {
  app.get('/v1/devices', async (request, reply) => {
    const principal = await requireAuthenticatedPrincipal(
      request,
      reply,
      options.authContext
    );
    if (!principal) return;

    const stored = await options.deviceStore.listDevices(principal.userId);
    const devices = stored.map((device) => ({
      device_id: device.device_id,
      platform: device.platform,
      hostname: device.hostname,
      protocol_version: device.protocol_version,
      hkdf_session_key_id: device.hkdf_session_key_id,
      paired_at: device.paired_at,
      status: device.status,
    }));

    if (devices.length === 0) {
      return reply.code(200).send({
        mode: 'real',
        devices: [],
        empty_state: 'Eşleşmiş cihaz yok',
      });
    }

    return reply.code(200).send({
      mode: 'real',
      devices,
    });
  });

  app.post('/v1/devices/pair', async (request, reply) => {
    const principal = await requireAuthenticatedPrincipal(
      request,
      reply,
      options.authContext
    );
    if (!principal) return;

    const parsed = PairDeviceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'pairing_fields_required',
      });
    }

    const payload = parsed.data;

    if (!verifyTimestampWithinWindow(payload.timestamp)) {
      return reply.code(401).send({
        error: 'pairing_timestamp_out_of_window',
      });
    }

    const signatureCheck = verifyMutualPairingSignatures(payload);
    if (!signatureCheck.valid) {
      await recordSecurityAudit(request, options.authContext, {
        actorUserId: principal.userId,
        action: 'device_pair',
        targetId: payload.device_id,
        outcome: signatureCheck.reason ?? 'invalid_owner_signature',
        statusCode: 401,
      });
      return reply.code(401).send({
        error: signatureCheck.reason ?? 'invalid_owner_signature',
      });
    }

    const existingDevice = await options.deviceStore.findDevice(payload.device_id);
    if (
      existingDevice &&
      (existingDevice.owner_user_id ?? 'usr-owner-default') !== principal.userId
    ) {
      await recordSecurityAudit(request, options.authContext, {
        actorUserId: principal.userId,
        action: 'device_pair',
        targetId: payload.device_id,
        outcome: 'forbidden_device_access',
        statusCode: 403,
      });
      return reply.code(403).send({
        error: 'forbidden_device_access',
      });
    }

    const nonceAccepted = await options.deviceStore.consumePairingNonce(payload.nonce);
    if (!nonceAccepted) {
      return reply.code(409).send({
        error: 'pairing_nonce_replay',
      });
    }

    if (existingDevice) {
      return reply.code(409).send({
        error: 'device_already_paired',
      });
    }

    let derived: { serverAgreementPublicKey: string; hkdfSessionKeyId: string };
    try {
      derived = deriveSessionKeyHkdf(
        payload.device_agreement_public_key,
        payload.device_id,
        payload.nonce
      );
    } catch {
      return reply.code(401).send({
        error: 'invalid_x25519_agreement_key',
      });
    }

    await options.deviceStore.upsertDevice({
      device_id: payload.device_id,
      owner_user_id: principal.userId,
      platform: payload.platform,
      hostname: payload.hostname,
      owner_signing_public_key: payload.owner_signing_public_key,
      device_signing_public_key: payload.device_signing_public_key,
      device_agreement_public_key: payload.device_agreement_public_key,
      hkdf_session_key_id: derived.hkdfSessionKeyId,
      protocol_version: payload.protocol_version,
      paired_at: new Date().toISOString(),
      status: 'active',
    });

    await recordSecurityAudit(request, options.authContext, {
      actorUserId: principal.userId,
      action: 'device_pair',
      targetId: payload.device_id,
      outcome: 'paired',
      statusCode: 201,
    });

    return reply.code(201).send({
      paired: true,
      device_id: payload.device_id,
      protocol_version: payload.protocol_version,
      key_agreement: 'X25519',
      server_agreement_public_key: derived.serverAgreementPublicKey,
      hkdf_session_key_id: derived.hkdfSessionKeyId,
      status: 'active',
    });
  });
}
