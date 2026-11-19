import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  recordSecurityAudit,
  requireAuthenticatedPrincipal,
  type AuthContext,
} from '../security/auth-guard';
import type { CommandStore, DeviceStore } from '../storage/types';

export interface CommandRoutesOptions {
  deviceStore: DeviceStore;
  commandStore: CommandStore;
  authContext: AuthContext;
}

const StructuredCommandSchema = z
  .object({
    target_device_id: z.string().regex(/^(enc_)?dev(ice)?[-_a-zA-Z0-9]{3,48}$/),
    action: z.literal('lock_session'),
    explicit_user_confirmation: z.literal(true),
    event_id: z.string().uuid(),
  })
  .strict();

const SimpleCommandSchema = z
  .object({
    command: z.literal('lock_session'),
    target_device_id: z.string().regex(/^(enc_)?dev(ice)?[-_a-zA-Z0-9]{3,48}$/),
    explicit_user_confirmation: z.literal(true),
  })
  .strict();

export async function registerCommandRoutes(
  app: FastifyInstance,
  options: CommandRoutesOptions
): Promise<void> {
  app.post('/v1/commands', async (request, reply) => {
    const principal = await requireAuthenticatedPrincipal(
      request,
      reply,
      options.authContext
    );
    if (!principal) return;

    const body = request.body as Record<string, unknown> | undefined;
    if (body?.explicit_user_confirmation !== true) {
      await recordSecurityAudit(request, options.authContext, {
        actorUserId: principal.userId,
        action: 'command_submit',
        outcome: 'explicit_user_confirmation_required',
        statusCode: 428,
      });
      return reply.code(428).send({ error: 'explicit_user_confirmation_required' });
    }

    const structured = StructuredCommandSchema.safeParse(body);
    const simple = SimpleCommandSchema.safeParse(body);

    if (!structured.success && !simple.success) {
      await recordSecurityAudit(request, options.authContext, {
        actorUserId: principal.userId,
        action: 'command_submit',
        outcome: 'invalid_command_payload',
        statusCode: 400,
      });
      return reply.code(400).send({ error: 'invalid_command_payload' });
    }

    const targetDeviceId = structured.success
      ? structured.data.target_device_id
      : simple.data!.target_device_id;

    const device = await options.deviceStore.findDevice(targetDeviceId);
    if (!device) {
      return reply.code(404).send({ error: 'device_not_found' });
    }
    if ((device.owner_user_id ?? 'usr-owner-default') !== principal.userId) {
      await recordSecurityAudit(request, options.authContext, {
        actorUserId: principal.userId,
        action: 'command_submit',
        targetId: targetDeviceId,
        outcome: 'forbidden_device_access',
        statusCode: 403,
      });
      return reply.code(403).send({ error: 'forbidden_device_access' });
    }

    const commandId = `cmd-${crypto.randomUUID().slice(0, 12)}`;
    const nowIso = new Date().toISOString();
    const stored = await options.commandStore.createCommand({
      command_id: commandId,
      owner_user_id: principal.userId,
      target_device_id: targetDeviceId,
      action: 'lock_session',
      event_id: structured.success ? structured.data.event_id : null,
      explicit_user_confirmation: true,
      status: 'queued_for_device',
      created_at: nowIso,
      updated_at: nowIso,
    });

    await recordSecurityAudit(request, options.authContext, {
      actorUserId: principal.userId,
      action: 'command_lock_session',
      targetId: targetDeviceId,
      outcome: 'queued_for_device',
      statusCode: 202,
    });

    if (structured.success) {
      return reply.code(202).send({
        command_id: stored.command_id,
        target_device_id: stored.target_device_id,
        action: stored.action,
        status: stored.status,
      });
    }

    return reply.code(202).send({
      accepted: true,
      command_id: stored.command_id,
      command: stored.action,
      target_device_id: stored.target_device_id,
      status: stored.status,
    });
  });
}
