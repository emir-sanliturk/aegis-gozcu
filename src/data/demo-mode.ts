import type { EventSourceMode } from './real-event-source';

export const DEMO_MODE_STORAGE_KEY = 'aegis.demo_mode.enabled';

export function isDemoModeEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const stored = window.localStorage.getItem(DEMO_MODE_STORAGE_KEY);
  return stored === 'true';
}

export function setDemoModeEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
}

export function canExportData(mode: EventSourceMode): boolean {
  return mode === 'real';
}
