import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkApiHealth,
  checkApiReadiness,
  fetchDevices,
  fetchIncidents,
  fetchShares,
  resolveApiOrigin,
} from '../api/aegisApi';
import type {
  ExternalDevice,
  ExternalIncident,
  ExternalShare,
} from '../types/telemetry';

export interface AegisDataSnapshot {
  devices: ExternalDevice[];
  incidents: ExternalIncident[];
  shares: ExternalShare[];
  apiConnected: boolean;
  apiReady: boolean;
  loading: boolean;
  lastError: string | null;
}

export interface AegisSyncControllerOptions {
  apiOrigin?: string;
  enabled?: boolean;
  pollIntervalMs?: number;
  onUpdate: (snapshot: AegisDataSnapshot) => void;
}

export async function fetchAegisSnapshot(
  apiOrigin: string,
  signal?: AbortSignal
): Promise<Omit<AegisDataSnapshot, 'loading'>> {
  const normalizedOrigin = resolveApiOrigin(apiOrigin);
  if (!normalizedOrigin) {
    return {
      devices: [],
      incidents: [],
      shares: [],
      apiConnected: false,
      apiReady: false,
      lastError: 'api_origin_not_configured',
    };
  }

  try {
    const healthy = await checkApiHealth(normalizedOrigin, signal);
    if (!healthy) {
      throw new Error('health_check_failed');
    }

    const readiness = await checkApiReadiness(normalizedOrigin, signal);
    if (readiness.available && !readiness.ready) {
      return {
        devices: [],
        incidents: [],
        shares: [],
        apiConnected: false,
        apiReady: false,
        lastError: 'api_not_ready',
      };
    }

    const [devices, incidents, shares] = await Promise.all([
      fetchDevices(normalizedOrigin, signal),
      fetchIncidents(normalizedOrigin, signal),
      fetchShares(normalizedOrigin, signal),
    ]);

    return {
      devices,
      incidents,
      shares,
      apiConnected: true,
      apiReady: true,
      lastError: null,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    return {
      devices: [],
      incidents: [],
      shares: [],
      apiConnected: false,
      apiReady: false,
      lastError: error instanceof Error ? error.message : 'api_sync_failed',
    };
  }
}

export function startAegisPolling(
  options: AegisSyncControllerOptions
): {
  refresh: () => Promise<void>;
  stop: () => void;
} {
  const normalizedOrigin = resolveApiOrigin(options.apiOrigin);
  const enabled = options.enabled ?? true;
  const pollIntervalMs = options.pollIntervalMs ?? 30_000;

  if (!enabled || !normalizedOrigin) {
    options.onUpdate({
      devices: [],
      incidents: [],
      shares: [],
      apiConnected: false,
      apiReady: false,
      loading: false,
      lastError: null,
    });
    return {
      refresh: async () => undefined,
      stop: () => undefined,
    };
  }

  const controller = new AbortController();
  let stopped = false;

  const refresh = async (): Promise<void> => {
    if (stopped) return;
    try {
      const next = await fetchAegisSnapshot(normalizedOrigin, controller.signal);
      if (!stopped) {
        options.onUpdate({ ...next, loading: false });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      if (!stopped) {
        options.onUpdate({
          devices: [],
          incidents: [],
          shares: [],
          apiConnected: false,
          apiReady: false,
          loading: false,
          lastError: error instanceof Error ? error.message : 'api_sync_failed',
        });
      }
    }
  };

  void refresh();

  const timer = globalThis.setInterval(() => {
    void refresh();
  }, pollIntervalMs);

  return {
    refresh,
    stop: () => {
      stopped = true;
      controller.abort();
      globalThis.clearInterval(timer);
    },
  };
}

export function useAegisData(options?: {
  enabled?: boolean;
  apiOrigin?: string;
  pollIntervalMs?: number;
}) {
  const [devices, setDevices] = useState<ExternalDevice[]>([]);
  const [incidents, setIncidents] = useState<ExternalIncident[]>([]);
  const [shares, setShares] = useState<ExternalShare[]>([]);
  const [apiConnected, setApiConnected] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  const refreshRef = useRef<() => Promise<void>>(async () => undefined);

  const resolvedOrigin = resolveApiOrigin(options?.apiOrigin);
  const enabled = options?.enabled ?? true;
  const pollIntervalMs = options?.pollIntervalMs ?? 30_000;

  useEffect(() => {
    const polling = startAegisPolling({
      apiOrigin: resolvedOrigin,
      enabled,
      pollIntervalMs,
      onUpdate: (snapshot) => {
        setDevices(snapshot.devices);
        setIncidents(snapshot.incidents);
        setShares(snapshot.shares);
        setApiConnected(snapshot.apiConnected);
        setApiReady(snapshot.apiReady);
        setLoading(snapshot.loading);
        setLastError(snapshot.lastError);
      },
    });

    refreshRef.current = polling.refresh;

    return () => {
      polling.stop();
    };
  }, [resolvedOrigin, enabled, pollIntervalMs]);

  const refresh = useCallback(async () => {
    await refreshRef.current();
  }, []);

  return {
    apiOrigin: resolvedOrigin,
    devices,
    incidents,
    shares,
    apiConnected,
    apiReady,
    loading,
    lastError,
    refresh,
    setShares,
  };
}
