import type { ClusterNode } from '../types/telemetry';
import type { EventSourceMode } from './real-event-source';

export interface RealDeviceSnapshot {
  mode: EventSourceMode;
  devices: ClusterNode[];
}

export interface RealDeviceSource {
  listPairedDevices(): Promise<RealDeviceSnapshot>;
}

export class ApiRealDeviceSource implements RealDeviceSource {
  constructor(
    private readonly baseUrl: string,
    private readonly getAccessToken: () => Promise<string | null>
  ) {}

  async listPairedDevices(): Promise<RealDeviceSnapshot> {
    const token = await this.getAccessToken();
    if (!token) {
      return { mode: 'real', devices: [] };
    }

    const response = await fetch(`${this.baseUrl}/v1/devices`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`device_source_error_${response.status}`);
    }

    return (await response.json()) as RealDeviceSnapshot;
  }
}
