import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  recordSecurityAudit,
  requireAuthenticatedPrincipal,
  type AuthContext,
} from '../security/auth-guard';
import type { DeviceStore, ShareStore } from '../storage/types';

export interface ShareRoutesOptions {
  deviceStore: DeviceStore;
  shareStore: ShareStore;
  authContext: AuthContext;
}

const StructuredShareSchema = z
  .object({
    event_id: z.string().uuid(),
    recipient_device_id: z.string().regex(/^(enc_)?dev(ice)?[-_a-zA-Z0-9]{3,48}$/),
    ttl_seconds: z.union([z.literal(900), z.literal(1800), z.literal(3600)]),
    owner_key_fingerprint: z.string().min(8).max(128),
    explicit_user_confirmation: z.literal(true),
  })
  .strict();

const DeviceShareSchema = z
  .object({
    device_id: z.string().regex(/^(enc_)?dev(ice)?[-_a-zA-Z0-9]{3,48}$/),
    expires_at: z.string().datetime({ offset: true }),
    explicit_user_confirmation: z.literal(true),
  })
  .strict();

const RevokeShareSchema = z
  .object({
    explicit_user_confirmation: z.literal(true),
  })
  .strict();

export async function registerShareRoutes(
  app: FastifyInstance,
  options: ShareRoutesOptions
): Promise<void> {
  app.get('/v1/shares', async (request, reply) => {
    const principal = await requireAuthenticatedPrincipal(
      request,
      reply,
      options.authContext
    );
    if (!principal) return;

    const activeShares = await options.shareStore.listActiveShares(principal.userId);
    if (activeShares.length === 0) {
      return reply.code(200).send({
        mode: 'real',
        shares: [],
        empty_state: 'Aktif paylaşım yok',
      });
    }

    return reply.code(200).send({
      mode: 'real',
      shares: activeShares.map((s) => ({
        share_id: s.share_id,
        device_id: s.device_id,
        active: s.active,
        expires_at: s.expires_at,
        revoked_at: s.revoked_at,
        access_count: s.access_count,
      })),
    });
  });

  app.post('/v1/shares', async (request, reply) => {
    const principal = await requireAuthenticatedPrincipal(
      request,
      reply,
      options.authContext
    );
    if (!principal) return;

    const rawBody = request.body as Record<string, unknown> | undefined;
    if (rawBody?.explicit_user_confirmation !== true) {
      await recordSecurityAudit(request, options.authContext, {
        actorUserId: principal.userId,
        action: 'share_create',
        outcome: 'explicit_user_confirmation_required',
        statusCode: 428,
      });
      return reply.code(428).send({ error: 'explicit_user_confirmation_required' });
    }

    const structured = StructuredShareSchema.safeParse(rawBody);
    const deviceShare = DeviceShareSchema.safeParse(rawBody);
    if (!structured.success && !deviceShare.success) {
      return reply.code(400).send({ error: 'invalid_share_request' });
    }

    const targetDeviceId = structured.success
      ? structured.data.recipient_device_id
      : deviceShare.data!.device_id;

    const device = await options.deviceStore.findDevice(targetDeviceId);
    if (!device) {
      return reply.code(404).send({ error: 'device_not_found' });
    }
    if ((device.owner_user_id ?? 'usr-owner-default') !== principal.userId) {
      await recordSecurityAudit(request, options.authContext, {
        actorUserId: principal.userId,
        action: 'share_create',
        targetId: targetDeviceId,
        outcome: 'forbidden_device_access',
        statusCode: 403,
      });
      return reply.code(403).send({ error: 'forbidden_device_access' });
    }

    const expiresAt = structured.success
      ? new Date(Date.now() + structured.data.ttl_seconds * 1000).toISOString()
      : deviceShare.data!.expires_at;

    const nowIso = new Date().toISOString();
    const record = await options.shareStore.createShare({
      share_id: `shr-${crypto.randomUUID().slice(0, 12)}`,
      owner_user_id: principal.userId,
      device_id: targetDeviceId,
      active: true,
      status: 'active',
      expires_at: expiresAt,
      revoked_at: null,
      access_count: 0,
      created_at: nowIso,
      updated_at: nowIso,
    });

    await recordSecurityAudit(request, options.authContext, {
      actorUserId: principal.userId,
      action: 'share_create',
      targetId: record.share_id,
      outcome: 'created',
      statusCode: 201,
    });

    return reply.code(201).send({
      share_id: record.share_id,
      device_id: record.device_id,
      active: record.active,
      expires_at: record.expires_at,
      revoked_at: record.revoked_at,
      access_count: record.access_count,
    });
  });

  app.delete('/v1/shares/:shareId', async (request, reply) => {
    const principal = await requireAuthenticatedPrincipal(
      request,
      reply,
      options.authContext
    );
    if (!principal) return;

    const rawBody = request.body as Record<string, unknown> | undefined;
    if (rawBody?.explicit_user_confirmation !== true) {
      await recordSecurityAudit(request, options.authContext, {
        actorUserId: principal.userId,
        action: 'share_revoke',
        targetId: (request.params as { shareId: string }).shareId,
        outcome: 'explicit_user_confirmation_required',
        statusCode: 428,
      });
      return reply.code(428).send({ error: 'explicit_user_confirmation_required' });
    }

    const parsedBody = RevokeShareSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return reply.code(400).send({ error: 'invalid_share_revoke_request' });
    }

    const { shareId } = request.params as { shareId: string };
    const revokedAt = new Date().toISOString();
    const revokeResult = await options.shareStore.revokeShare(
      shareId,
      principal.userId,
      revokedAt
    );

    if (!revokeResult.ok) {
      const statusMap = {
        not_found: 404,
        forbidden: 403,
        already_revoked: 409,
      } as const;
      const errorMap = {
        not_found: 'share_not_found',
        forbidden: 'forbidden_share_access',
        already_revoked: 'share_already_revoked',
      } as const;
      const code = statusMap[revokeResult.reason];
      await recordSecurityAudit(request, options.authContext, {
        actorUserId: principal.userId,
        action: 'share_revoke',
        targetId: shareId,
        outcome: errorMap[revokeResult.reason],
        statusCode: code,
      });
      return reply.code(code).send({ error: errorMap[revokeResult.reason] });
    }

    await recordSecurityAudit(request, options.authContext, {
      actorUserId: principal.userId,
      action: 'share_revoke',
      targetId: shareId,
      outcome: 'revoked',
      statusCode: 200,
    });

    return reply.code(200).send({
      share_id: revokeResult.share.share_id,
      active: false,
      revoked_at: revokeResult.share.revoked_at ?? revokedAt,
    });
  });
}
