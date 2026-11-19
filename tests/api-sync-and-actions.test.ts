import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createApprovedShare,
  resolveApiOrigin,
  revokeApprovedShare,
  sendApprovedCommand,
} from '../src/api/aegisApi';
import App from '../src/App';
import {
  fetchAegisSnapshot,
  startAegisPolling,
  type AegisDataSnapshot,
} from '../src/hooks/useAegisData';
import { ConfirmCommandDialog } from '../src/components/ConfirmActionDialog';
import { CommandsScreen } from '../src/screens/CommandsScreen';
import { SharesScreen } from '../src/screens/SharesScreen';
import type { AppProps } from '../src/types/telemetry';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Aegis API synchronization, command confirmation, share actions & polling cleanup', () => {
  it('makes 0 fetch calls and keeps honest empty snapshot when apiOrigin is not configured', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    expect(resolveApiOrigin()).toBe('');
    const unconfiguredSnapshot = await fetchAegisSnapshot('');
    expect(unconfiguredSnapshot).toEqual({
      devices: [],
      incidents: [],
      shares: [],
      apiConnected: false,
      apiReady: false,
      lastError: 'api_origin_not_configured',
    });

    const updates: AegisDataSnapshot[] = [];
    const controller = startAegisPolling({
      apiOrigin: '',
      onUpdate: (snap) => updates.push(snap),
    });

    await Promise.resolve();
    controller.stop();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({
      devices: [],
      incidents: [],
      shares: [],
      apiConnected: false,
      apiReady: false,
      loading: false,
      lastError: null,
    });
  });

  it('synchronizes real data with credentials: include when /healthz and /readyz succeed', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith('/healthz')) return jsonResponse({ status: 'ok' }, 200);
      if (url.endsWith('/readyz')) return jsonResponse({ status: 'ready' }, 200);
      if (url.endsWith('/v1/devices')) {
        return jsonResponse({
          mode: 'real',
          devices: [
            {
              device_id: 'enc_dev_1',
              name: 'ofis-dizustu',
              platform: 'Windows',
              status: 'active',
            },
          ],
        });
      }
      if (url.endsWith('/v1/events')) {
        return jsonResponse({
          mode: 'real',
          events: [
            {
              event_id: 'evt-1',
              device_id: 'enc_dev_1',
              timestamp: '2026-11-17T21:00:00Z',
              severity: 'high',
              title: 'WFP Çıkış Engeli',
              description: 'Doğrulanmış olay zarfı',
              status: 'new',
            },
          ],
        });
      }
      if (url.endsWith('/v1/shares')) {
        return jsonResponse({
          mode: 'real',
          shares: [
            {
              share_id: 'shr-100',
              device_id: 'enc_dev_1',
              active: true,
              expires_at: '2026-11-17T21:15:00Z',
              revoked_at: null,
              access_count: 1,
            },
          ],
        });
      }
      return jsonResponse({ error: 'not_found' }, 404);
    }) as unknown as typeof fetch;

    const snapshot = await fetchAegisSnapshot('https://api.aegis.example');

    expect(snapshot.apiConnected).toBe(true);
    expect(snapshot.apiReady).toBe(true);
    expect(snapshot.devices).toHaveLength(1);
    expect(snapshot.devices[0]?.name).toBe('ofis-dizustu');
    expect(snapshot.incidents).toHaveLength(1);
    expect(snapshot.incidents[0]?.title).toBe('WFP Çıkış Engeli');
    expect(snapshot.shares).toHaveLength(1);
    expect(snapshot.shares[0]?.shareId).toBe('shr-100');

    for (const c of calls) {
      expect(c.init?.credentials).toBe('include');
      expect((c.init?.headers as Record<string, string>)?.Accept).toBe('application/json');
    }
  });

  it('drops devices and incidents and marks apiConnected=false when /healthz fails, /readyz returns 503, or /v1/events fails', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ status: 'down' }, 503)) as unknown as typeof fetch;
    const unhealthySnapshot = await fetchAegisSnapshot('https://api.aegis.example');
    expect(unhealthySnapshot).toEqual({
      devices: [],
      incidents: [],
      shares: [],
      apiConnected: false,
      apiReady: false,
      lastError: 'health_check_failed',
    });

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/healthz')) return jsonResponse({ status: 'ok' }, 200);
      if (url.endsWith('/readyz')) return jsonResponse({ status: 'not_ready' }, 503);
      return jsonResponse({ error: 'unexpected' }, 500);
    }) as unknown as typeof fetch;

    const notReadySnapshot = await fetchAegisSnapshot('https://api.aegis.example');
    expect(notReadySnapshot).toEqual({
      devices: [],
      incidents: [],
      shares: [],
      apiConnected: false,
      apiReady: false,
      lastError: 'api_not_ready',
    });

    const readyFailHtml = renderToStaticMarkup(
      React.createElement(App as React.ComponentType<AppProps>, {
        apiConnected: notReadySnapshot.apiConnected,
        devices: notReadySnapshot.devices,
        incidents: notReadySnapshot.incidents,
        shares: notReadySnapshot.shares,
      })
    );
    expect(readyFailHtml).toContain('Bağlantı bekleniyor');
    expect(readyFailHtml).toContain('Eşleşmiş cihaz yok');

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/healthz')) return jsonResponse({ status: 'ok' }, 200);
      if (url.endsWith('/readyz')) return jsonResponse({ status: 'ready' }, 200);
      if (url.endsWith('/v1/devices')) return jsonResponse({ devices: [] }, 200);
      if (url.endsWith('/v1/events')) return jsonResponse({ error: 'db_down' }, 500);
      return jsonResponse({ shares: [] }, 200);
    }) as unknown as typeof fetch;

    const failedEventsSnapshot = await fetchAegisSnapshot('https://api.aegis.example');
    expect(failedEventsSnapshot).toEqual({
      devices: [],
      incidents: [],
      shares: [],
      apiConnected: false,
      apiReady: false,
      lastError: 'api_request_failed_500',
    });

    const commandsHtml = renderToStaticMarkup(
      React.createElement(CommandsScreen, {
        dataMode: 'real',
        apiConnected: false,
        nodes: [],
        onToggleLockNode: () => undefined,
        onTriggerUnlockCheck: () => undefined,
      })
    );
    expect(commandsHtml).toContain('Eşleşmiş cihaz yok');
    expect(commandsHtml).toContain('Bağlantı bekleniyor');
    expect(commandsHtml).toContain('Veri yok');
  });

  it('enforces explicit user confirmation before POST /v1/commands and handles 428 / 202', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await expect(
      sendApprovedCommand('https://api.aegis.example', {
        command: 'lock_session',
        targetDeviceId: 'enc_dev_1',
        explicitUserConfirmation: false,
      })
    ).rejects.toThrow('explicit_user_confirmation_required');
    expect(fetchSpy).not.toHaveBeenCalled();

    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: 'explicit_user_confirmation_required' }, 428)
    ) as unknown as typeof fetch;

    await expect(
      sendApprovedCommand('https://api.aegis.example', {
        command: 'lock_session',
        targetDeviceId: 'enc_dev_1',
        explicitUserConfirmation: true,
      })
    ).rejects.toThrow('explicit_user_confirmation_required');

    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: 'cors_origin_not_allowed' }, 403)
    ) as unknown as typeof fetch;

    await expect(
      sendApprovedCommand('https://api.aegis.example', {
        command: 'lock_session',
        targetDeviceId: 'enc_dev_1',
        explicitUserConfirmation: true,
      })
    ).rejects.toThrow('cors_origin_not_allowed');

    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: 'session_required' }, 401)
    ) as unknown as typeof fetch;

    await expect(
      sendApprovedCommand('https://api.aegis.example', {
        command: 'lock_session',
        targetDeviceId: 'enc_dev_1',
        explicitUserConfirmation: true,
      })
    ).rejects.toThrow('session_required');

    const sentBodies: unknown[] = [];
    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentBodies.push(JSON.parse(String(init?.body)));
      return jsonResponse(
        {
          accepted: true,
          command: 'lock_session',
          status: 'queued_for_device',
        },
        202
      );
    }) as unknown as typeof fetch;

    const accepted = await sendApprovedCommand('https://api.aegis.example', {
      command: 'lock_session',
      targetDeviceId: 'enc_dev_1',
      explicitUserConfirmation: true,
    });
    expect(accepted.status).toBe('queued_for_device');
    expect(sentBodies[0]).toEqual({
      command: 'lock_session',
      target_device_id: 'enc_dev_1',
      explicit_user_confirmation: true,
    });
  });

  it('enforces confirmation for share creation/revocation and never renders secret tokens in SharesScreen', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await expect(
      createApprovedShare('https://api.aegis.example', {
        deviceId: 'enc_dev_1',
        expiresAt: '2026-11-17T22:00:00Z',
        explicitUserConfirmation: false,
      })
    ).rejects.toThrow('explicit_user_confirmation_required');

    await expect(
      revokeApprovedShare('https://api.aegis.example', {
        shareId: 'shr-100',
        explicitUserConfirmation: false,
      })
    ).rejects.toThrow('explicit_user_confirmation_required');
    expect(fetchSpy).not.toHaveBeenCalled();

    const shareCalls: Array<{ method?: string; url: string; body?: unknown; xrw?: string }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      shareCalls.push({
        method: init?.method,
        url,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        xrw: headers['X-Requested-With'],
      });
      if (init?.method === 'POST') {
        return jsonResponse(
          {
            share_id: 'shr-real-1',
            device_id: 'enc_dev_1',
            active: true,
            expires_at: '2026-11-17T22:00:00Z',
            revoked_at: null,
            access_count: 0,
          },
          201
        );
      }
      return jsonResponse(
        {
          share_id: 'shr-real-1',
          active: false,
          revoked_at: '2026-11-17T21:30:00Z',
        },
        200
      );
    }) as unknown as typeof fetch;

    const created = await createApprovedShare('https://api.aegis.example', {
      deviceId: 'enc_dev_1',
      expiresAt: '2026-11-17T22:00:00Z',
      explicitUserConfirmation: true,
    });
    expect(created.shareId).toBe('shr-real-1');

    const revoked = await revokeApprovedShare('https://api.aegis.example', {
      shareId: 'shr-real-1',
      explicitUserConfirmation: true,
    });
    expect(revoked.active).toBe(false);
    expect(shareCalls).toHaveLength(2);
    expect(shareCalls[0]?.method).toBe('POST');
    expect(shareCalls[0]?.url).toBe('https://api.aegis.example/v1/shares');
    expect(shareCalls[0]?.xrw).toBeTruthy();
    expect(shareCalls[1]?.method).toBe('DELETE');
    expect(shareCalls[1]?.url).toBe('https://api.aegis.example/v1/shares/shr-real-1');
    expect(shareCalls[1]?.body).toEqual({ explicit_user_confirmation: true });
    expect(shareCalls[1]?.xrw).toBeTruthy();

    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: 'explicit_user_confirmation_required' }, 428)
    ) as unknown as typeof fetch;

    await expect(
      revokeApprovedShare('https://api.aegis.example', {
        shareId: 'shr-real-1',
        explicitUserConfirmation: true,
      })
    ).rejects.toThrow('explicit_user_confirmation_required');

    const revokeDialogHtml = renderToStaticMarkup(
      React.createElement(ConfirmCommandDialog, {
        open: true,
        title: 'Paylaşım iptali',
        message: 'Bu güvenli paylaşım iptal edilecek.',
        secondaryMessage: 'İptal edilen paylaşım tekrar kullanılamaz.',
        confirmLabel: 'Paylaşımı iptal et',
        cancelLabel: 'Vazgeç',
        danger: true,
        onConfirm: () => undefined,
        onCancel: () => undefined,
      })
    );
    expect(revokeDialogHtml).toContain('Paylaşım iptali');
    expect(revokeDialogHtml).toContain('Bu güvenli paylaşım iptal edilecek.');
    expect(revokeDialogHtml).toContain('İptal edilen paylaşım tekrar kullanılamaz.');
    expect(revokeDialogHtml).toContain('Paylaşımı iptal et');

    const activeShareHtml = renderToStaticMarkup(
      React.createElement(SharesScreen, {
        dataMode: 'real',
        apiConnected: true,
        devices: [],
        shares: [
          {
            shareId: 'shr-real-1',
            deviceId: 'enc_dev_1',
            active: true,
            expiresAt: '2026-11-17T22:00:00Z',
            revokedAt: null,
            accessCount: 0,
          },
        ],
        incidents: [],
        onToggleEphemeralShare: () => undefined,
        onPurgeEvidence: () => undefined,
        onInspectIncident: () => undefined,
      })
    );
    expect(activeShareHtml).toContain('Paylaşımı İptal Et');
    expect(activeShareHtml).not.toContain('ciphertext');
    expect(activeShareHtml).not.toContain('private_key');
    expect(activeShareHtml).not.toContain('auth_tag');
  });

  it('polls on a 30_000ms interval and aborts/clears timer cleanly on stop()', async () => {
    vi.useFakeTimers();

    const signals: AbortSignal[] = [];
    let fetchCount = 0;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCount += 1;
      if (init?.signal) {
        signals.push(init.signal);
      }
      const url = String(input);
      if (url.endsWith('/healthz')) return jsonResponse({ status: 'ok' }, 200);
      if (url.endsWith('/readyz')) return jsonResponse({ status: 'ready' }, 200);
      if (url.endsWith('/v1/devices')) return jsonResponse({ devices: [] }, 200);
      if (url.endsWith('/v1/events')) return jsonResponse({ events: [] }, 200);
      return jsonResponse({ shares: [] }, 200);
    }) as unknown as typeof fetch;

    const snapshots: AegisDataSnapshot[] = [];
    const polling = startAegisPolling({
      apiOrigin: 'https://api.aegis.example',
      pollIntervalMs: 30_000,
      onUpdate: (s) => snapshots.push(s),
    });

    await vi.advanceTimersByTimeAsync(10);
    const countAfterInitial = fetchCount;
    expect(countAfterInitial).toBe(5);
    expect(snapshots).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(30_000);
    const countAfterSecondPoll = fetchCount;
    expect(countAfterSecondPoll).toBe(10);
    expect(snapshots).toHaveLength(2);

    polling.stop();
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((sig) => sig.aborted)).toBe(true);

    await vi.advanceTimersByTimeAsync(90_000);
    expect(fetchCount).toBe(countAfterSecondPoll);
  });
});
