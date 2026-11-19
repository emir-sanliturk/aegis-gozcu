import { describe, expect, it } from 'vitest';
import { canExportData, isDemoModeEnabled } from '../src/data/demo-mode';

describe('Demo mode & export lock', () => {
  it('blocks CSV/JSON exports when in demo mode and allows only in real mode', () => {
    expect(canExportData('demo')).toBe(false);
    expect(canExportData('real')).toBe(true);
  });

  it('defaults to real data mode in non-browser or unset pre-release environments', () => {
    expect(isDemoModeEnabled()).toBe(false);
  });
});
