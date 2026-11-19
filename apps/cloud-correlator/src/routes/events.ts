import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  recordSecurityAudit,
  requireAuthenticatedPrincipal,
  type AuthContext,
} from '../security/auth-guard';
import {
  computeEventHash,
  verifyDeviceEventSignature,
} from '../security/pairing-crypto';
import type { DeviceStore, EventStore } from '../storage/types';

export interface EventRoutesOptions {
  deviceStore: DeviceStore;
  eventStore: EventStore;
  authContext: AuthContext;
}

const EncryptedEnvelopeSchema = z
  .object({
    schema_version: z.literal('1.0.0'),
    event_id: z.string().uuid(),
    device_id: z.string().regex(/^(enc_)?dev(ice)?[-_a-zA-Z0-9]{3,48}$/),
    timestamp: z.string().datetime({ offset: true }),
    ciphertext: z.string().min(16),
    nonce: z.string().min(12),
    auth_tag: z.string().min(16),
    signature: z.string().min(32),
    prev_event_hash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    server_decrypted: z.literal(false).optional(),
  })
  .strict();

export async function registerEventRoutes(
  app: FastifyInstance,
  options: EventRoutesOptions
): Promise<void> {
  app.get('/v1/events', async (request, reply) => {
    const principal = await requireAuthenticatedPrincipal(
      request,
      reply,
      options.authContext
    );
    if (!principal) return;

    const query = request.query as Record<string, string | undefined>;
    const rawLimit = Number(query?.limit ?? 50);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(200, Math.trunc(rawLimit)))
      : 50;
    const deviceId =
      typeof query?.device_id === 'string' && query.device_id.length > 0
        ? query.device_id
        : undefined;

    if (deviceId) {
      const targetDevice = await options.deviceStore.findDevice(deviceId);
      if (
        targetDevice &&
        (targetDevice.owner_user_id ?? 'usr-owner-default') !== principal.userId
      ) {
        await recordSecurityAudit(request, options.authContext, {
          actorUserId: principal.userId,
          action: 'events_read',
          targetId: deviceId,
          outcome: 'forbidden_device_access',
          statusCode: 403,
        });
        return reply.code(403).send({ error: 'forbidden_device_access' });
      }
    }

    const storedEvents = await options.eventStore.listEvents({
      deviceId,
      ownerUserId: principal.userId,
      limit,
    });
    if (storedEvents.length === 0) {
      return reply.code(200).send({
        mode: 'real',
        events: [],
        empty_state: 'Gerçek olay kaydı yok',
        nextCursor: null,
      });
    }

    const sanitizedEvents = storedEvents.map((ev) => ({
      seq: ev.seq,
      schema_version: ev.schema_version,
      event_id: ev.event_id,
      device_id: ev.device_id,
      timestamp: ev.timestamp,
      prev_event_hash: ev.prev_event_hash,
      event_hash: ev.event_hash,
      server_decrypted: false,
    }));

    return reply.code(200).send({
      mode: 'real',
      events: sanitizedEvents,
      nextCursor: null,
    });
  });

  app.post('/v1/events/ingest', async (request, reply) => {
    const principal = await requireAuthenticatedPrincipal(
      request,
      reply,
      options.authContext
    );
    if (!principal) return;

    const parsed = EncryptedEnvelopeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_encrypted_envelope',
      });
    }

    const envelope = parsed.data;
    const device = await options.deviceStore.findDevice(envelope.device_id);
    if (!device || device.status !== 'active') {
      return reply.code(403).send({
        error: 'device_not_paired',
      });
    }

    if ((device.owner_user_id ?? 'usr-owner-default') !== principal.userId) {
      await recordSecurityAudit(request, options.authContext, {
        actorUserId: principal.userId,
        action: 'event_ingest',
        targetId: envelope.device_id,
        outcome: 'forbidden_device_access',
        statusCode: 403,
      });
      return reply.code(403).send({
        error: 'forbidden_device_access',
      });
    }

    const signatureValid = verifyDeviceEventSignature(
      device.device_signing_public_key,
      envelope
    );
    if (!signatureValid) {
      return reply.code(401).send({
        error: 'invalid_event_signature',
      });
    }

    const eventHash = computeEventHash(
      envelope.event_id,
      envelope.nonce,
      envelope.prev_event_hash
    );

    const appendResult = await options.eventStore.appendEvent({
      owner_user_id: principal.userId,
      schema_version: envelope.schema_version,
      event_id: envelope.event_id,
      device_id: envelope.device_id,
      timestamp: envelope.timestamp,
      ciphertext: envelope.ciphertext,
      nonce: envelope.nonce,
      auth_tag: envelope.auth_tag,
      signature: envelope.signature,
      prev_event_hash: envelope.prev_event_hash,
      event_hash: eventHash,
    });

    if (!appendResult.ok) {
      return reply.code(409).send({
        error: appendResult.reason,
        expected_prev_event_hash: appendResult.expected_prev_event_hash,
      });
    }

    return reply.code(202).send({
      accepted: true,
      event_id: appendResult.event.event_id,
      event_hash: appendResult.event.event_hash,
      seq: appendResult.event.seq,
      server_decrypted: false,
    });
  });
}
