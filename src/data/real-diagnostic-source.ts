import type { DeviceCompatibilityEntry, DiagnosticCheckItem } from '../types/telemetry';

export interface DeviceDiagnosticRunResult {
  deviceId: string;
  platform: DeviceCompatibilityEntry['platform'];
  traceId: string;
  executedAtIso: string;
  verifiedBy: string;
  checks: DiagnosticCheckItem[];
  allTenStagesCompleted: boolean;
}

export interface RealDiagnosticSource {
  runOnDevice(
    deviceId: string,
    platform: DeviceCompatibilityEntry['platform']
  ): Promise<DeviceDiagnosticRunResult | null>;
}

export class ApiRealDiagnosticSource implements RealDiagnosticSource {
  constructor(
    private readonly baseUrl: string,
    private readonly getAccessToken: () => Promise<string | null>
  ) {}

  async runOnDevice(
    deviceId: string,
    platform: DeviceCompatibilityEntry['platform']
  ): Promise<DeviceDiagnosticRunResult | null> {
    const token = await this.getAccessToken();
    if (!token) {
      return null;
    }

    const response = await fetch(`${this.baseUrl}/v1/devices/${encodeURIComponent(deviceId)}/diagnostics`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ platform }),
    });

    if (!response.ok) {
      throw new Error(`diagnostic_source_error_${response.status}`);
    }

    return (await response.json()) as DeviceDiagnosticRunResult;
  }
}
