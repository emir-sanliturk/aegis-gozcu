import type {
  ExternalDevice,
  ExternalIncident,
  ExternalShare,
} from '../types/telemetry';

export interface CommandRequestResult {
  accepted: boolean;
  status: string;
  command?: string;
  command_id?: string;
  target_device_id?: string;
}

let inMemoryCsrfToken: string | null = null;

export function setInMemoryCsrfToken(token: string | null): void {
  inMemoryCsrfToken = token;
}

export function clearInMemoryCsrfToken(): void {
  inMemoryCsrfToken = null;
}

function getDefaultApiOrigin(): string {
  const metaEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
  return (metaEnv?.VITE_AEGIS_API_ORIGIN ?? '').trim().replace(/\/+$/, '');
}

export function resolveApiOrigin(explicitOrigin?: string): string {
  if (explicitOrigin !== undefined) {
    return explicitOrigin.trim().replace(/\/+$/, '');
  }
  return getDefaultApiOrigin();
}

function normalizePlatform(raw: string | undefined): ExternalDevice['platform'] {
  const lower = (raw ?? '').toLowerCase();
  if (lower === 'windows') return 'Windows';
  if (lower === 'macos') return 'macOS';
  if (lower === 'android') return 'Android';
  if (lower === 'ios') return 'iOS';
  return 'Cloud';
}

function normalizeDeviceStatus(raw: string | undefined): ExternalDevice['status'] {
  if (raw === 'locked' || raw === 'revoked' || raw === 'offline') {
    return raw;
  }
  return 'active';
}

function normalizeSeverity(raw: string | undefined): ExternalIncident['severity'] {
  if (raw === 'critical' || raw === 'high' || raw === 'medium' || raw === 'low') {
    return raw;
  }
  return 'low';
}

function normalizeIncidentStatus(raw: string | undefined): ExternalIncident['status'] {
  if (raw === 'reviewing' || raw === 'resolved') {
    return raw;
  }
  return 'new';
}

function throwMappedApiError(response: Response, fallbackError: string): never {
  if (response.status === 401) {
    throw new Error('session_required');
  }
  if (response.status === 403) {
    throw new Error('cors_origin_not_allowed');
  }
  if (response.status === 428) {
    throw new Error('explicit_user_confirmation_required');
  }
  throw new Error(fallbackError);
}

function mutationHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Requested-With': inMemoryCsrfToken ?? 'aegis-gozcu-ui',
  };
}

async function apiFetch<T>(
  apiOrigin: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const normalizedOrigin = resolveApiOrigin(apiOrigin);
  if (!normalizedOrigin) {
    throw new Error('api_origin_not_configured');
  }

  const response = await fetch(`${normalizedOrigin}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    throwMappedApiError(response, `api_request_failed_${response.status}`);
  }

  return (await response.json()) as T;
}

export async function establishSession(
  apiOrigin?: string,
  signal?: AbortSignal
): Promise<{ authenticated: boolean; csrfToken: string | null }> {
  const normalizedOrigin = resolveApiOrigin(apiOrigin);
  if (!normalizedOrigin) {
    throw new Error('api_origin_not_configured');
  }

  const response = await fetch(`${normalizedOrigin}/v1/auth/session`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'aegis-gozcu-ui',
    },
    signal,
  });

  if (!response.ok) {
    throwMappedApiError(response, `session_init_failed_${response.status}`);
  }

  const payload = (await response.json()) as {
    authenticated?: boolean;
    csrf_token?: string | null;
  };
  const csrfToken = payload.csrf_token ?? null;
  setInMemoryCsrfToken(csrfToken);
  return {
    authenticated: Boolean(payload.authenticated),
    csrfToken,
  };
}

export async function checkApiHealth(
  apiOrigin?: string,
  signal?: AbortSignal
): Promise<boolean> {
  const normalizedOrigin = resolveApiOrigin(apiOrigin);
  if (!normalizedOrigin) {
    return false;
  }

  try {
    const response = await fetch(`${normalizedOrigin}/healthz`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal,
    });
    return response.ok;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    return false;
  }
}

export async function checkApiReadiness(
  apiOrigin?: string,
  signal?: AbortSignal
): Promise<{ available: boolean; ready: boolean }> {
  const normalizedOrigin = resolveApiOrigin(apiOrigin);
  if (!normalizedOrigin) {
    return { available: false, ready: false };
  }

  try {
    const response = await fetch(`${normalizedOrigin}/readyz`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (response.status === 404) {
      return { available: false, ready: true };
    }
    return { available: true, ready: response.ok };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    return { available: true, ready: false };
  }
}

export async function fetchDevices(
  apiOrigin?: string,
  signal?: AbortSignal
): Promise<ExternalDevice[]> {
  const origin = resolveApiOrigin(apiOrigin);
  const payload = await apiFetch<{
    devices?: Array<{
      id?: string;
      device_id?: string;
      name?: string;
      hostname?: string;
      platform?: string;
      status?: string;
      paired_at?: string;
      pairedAt?: string;
      x?: number;
      y?: number;
    }>;
  }>(origin, '/v1/devices', { signal });

  return (payload.devices ?? []).map((item) => ({
    id: item.id ?? item.device_id ?? 'unknown-device',
    name: item.name ?? item.hostname ?? item.device_id ?? 'Cihaz',
    platform: normalizePlatform(item.platform),
    status: normalizeDeviceStatus(item.status),
    x: item.x,
    y: item.y,
    lastSeen: item.pairedAt ?? item.paired_at,
  }));
}

export async function fetchIncidents(
  apiOrigin?: string,
  signal?: AbortSignal
): Promise<ExternalIncident[]> {
  const origin = resolveApiOrigin(apiOrigin);
  const payload = await apiFetch<{
    incidents?: Array<{
      id?: string;
      title?: string;
      description?: string;
      severity?: string;
      status?: string;
      deviceId?: string;
      timestamp: string;
      eventHash?: string;
    }>;
    events?: Array<{
      event_id: string;
      device_id: string;
      timestamp: string;
      event_hash?: string;
      severity?: string;
      title?: string;
      description?: string;
      status?: string;
    }>;
  }>(origin, '/v1/events', { signal });

  if (Array.isArray(payload.incidents)) {
    return payload.incidents.map((inc, idx) => ({
      id: inc.id ?? `inc-${idx}`,
      title: inc.title ?? 'Doğrulanmış Güvenlik Olayı',
      description: inc.description ?? 'Şifreli olay kaydı doğrulandı.',
      severity: normalizeSeverity(inc.severity),
      status: normalizeIncidentStatus(inc.status),
      deviceId: inc.deviceId,
      timestamp: inc.timestamp,
      eventHash: inc.eventHash,
    }));
  }

  return (payload.events ?? []).map((ev) => ({
    id: ev.event_id,
    title: ev.title ?? 'Şifreli Olay Zarfı Doğrulandı',
    description:
      ev.description ?? 'İmzalı olay zincire eklendi (sunucu plaintext içerik çözmez).',
    severity: normalizeSeverity(ev.severity),
    status: normalizeIncidentStatus(ev.status),
    deviceId: ev.device_id,
    timestamp: ev.timestamp,
    eventHash: ev.event_hash,
  }));
}

export async function fetchShares(
  apiOrigin?: string,
  signal?: AbortSignal
): Promise<ExternalShare[]> {
  const origin = resolveApiOrigin(apiOrigin);
  if (!origin) return [];

  const response = await fetch(`${origin}/v1/shares`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throwMappedApiError(response, `api_request_failed_${response.status}`);
  }

  const payload = (await response.json()) as {
    shares?: Array<{
      share_id?: string;
      shareId?: string;
      device_id?: string;
      deviceId?: string;
      active?: boolean;
      expires_at?: string | null;
      expiresAt?: string | null;
      revoked_at?: string | null;
      revokedAt?: string | null;
      access_count?: number;
      accessCount?: number;
    }>;
  };

  return (payload.shares ?? []).map((s, idx) => ({
    shareId: s.shareId ?? s.share_id ?? `share-${idx}`,
    deviceId: s.deviceId ?? s.device_id ?? 'unknown-device',
    active: s.active ?? true,
    expiresAt: s.expiresAt ?? s.expires_at ?? null,
    revokedAt: s.revokedAt ?? s.revoked_at ?? null,
    accessCount: s.accessCount ?? s.access_count ?? 0,
  }));
}

export async function sendApprovedCommand(
  apiOrigin: string,
  input: {
    command: 'lock_session';
    targetDeviceId: string;
    explicitUserConfirmation?: boolean;
  }
): Promise<CommandRequestResult> {
  if (input.explicitUserConfirmation !== true) {
    throw new Error('explicit_user_confirmation_required');
  }
  if (input.command !== 'lock_session') {
    throw new Error('unsupported_command');
  }

  const normalizedOrigin = resolveApiOrigin(apiOrigin);
  if (!normalizedOrigin) {
    throw new Error('api_origin_not_configured');
  }

  const response = await fetch(`${normalizedOrigin}/v1/commands`, {
    method: 'POST',
    credentials: 'include',
    headers: mutationHeaders(),
    body: JSON.stringify({
      command: input.command,
      target_device_id: input.targetDeviceId,
      explicit_user_confirmation: true,
    }),
  });

  if (!response.ok) {
    throwMappedApiError(response, 'command_request_failed');
  }

  return (await response.json()) as CommandRequestResult;
}

export async function createApprovedShare(
  apiOrigin: string,
  input: {
    deviceId: string;
    expiresAt: string;
    explicitUserConfirmation?: boolean;
  }
): Promise<ExternalShare> {
  if (input.explicitUserConfirmation !== true) {
    throw new Error('explicit_user_confirmation_required');
  }

  const normalizedOrigin = resolveApiOrigin(apiOrigin);
  if (!normalizedOrigin) {
    throw new Error('api_origin_not_configured');
  }

  const response = await fetch(`${normalizedOrigin}/v1/shares`, {
    method: 'POST',
    credentials: 'include',
    headers: mutationHeaders(),
    body: JSON.stringify({
      device_id: input.deviceId,
      expires_at: input.expiresAt,
      explicit_user_confirmation: true,
    }),
  });

  if (!response.ok) {
    throwMappedApiError(response, 'share_create_failed');
  }

  const created = (await response.json()) as {
    share_id?: string;
    shareId?: string;
    device_id?: string;
    deviceId?: string;
    active?: boolean;
    expires_at?: string | null;
    revoked_at?: string | null;
    access_count?: number;
  };

  return {
    shareId: created.shareId ?? created.share_id ?? 'share-created',
    deviceId: created.deviceId ?? created.device_id ?? input.deviceId,
    active: created.active ?? true,
    expiresAt: created.expires_at ?? input.expiresAt,
    revokedAt: created.revoked_at ?? null,
    accessCount: created.access_count ?? 0,
  };
}

export async function revokeApprovedShare(
  apiOrigin: string,
  input: {
    shareId: string;
    explicitUserConfirmation?: boolean;
  }
): Promise<{ shareId: string; active: false; revokedAt: string }> {
  if (input.explicitUserConfirmation !== true) {
    throw new Error('explicit_user_confirmation_required');
  }

  const normalizedOrigin = resolveApiOrigin(apiOrigin);
  if (!normalizedOrigin) {
    throw new Error('api_origin_not_configured');
  }

  const response = await fetch(
    `${normalizedOrigin}/v1/shares/${encodeURIComponent(input.shareId)}`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: mutationHeaders(),
      body: JSON.stringify({
        explicit_user_confirmation: true,
      }),
    }
  );

  if (!response.ok) {
    throwMappedApiError(response, 'share_revoke_failed');
  }

  const result = (await response.json()) as {
    share_id?: string;
    revoked_at?: string;
  };

  return {
    shareId: result.share_id ?? input.shareId,
    active: false,
    revokedAt: result.revoked_at ?? new Date().toISOString(),
  };
}
