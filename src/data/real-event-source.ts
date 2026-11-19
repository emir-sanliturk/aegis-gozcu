import type { CanonicalEventFields } from '../types/telemetry';

export type EventSourceMode = 'real' | 'demo';

export interface RealEventQuery {
  deviceId?: string;
  correlationId?: string;
  severity?: CanonicalEventFields['severity'];
  fromIso?: string;
  toIso?: string;
  limit: number;
}

export interface RealEventPage {
  mode: EventSourceMode;
  events: CanonicalEventFields[];
  nextCursor: string | null;
}

export interface RealEventSource {
  listEvents(query: RealEventQuery): Promise<RealEventPage>;
}

export class ApiRealEventSource implements RealEventSource {
  constructor(
    private readonly baseUrl: string,
    private readonly getAccessToken: () => Promise<string | null>
  ) {}

  async listEvents(query: RealEventQuery): Promise<RealEventPage> {
    const token = await this.getAccessToken();
    if (!token) {
      return { mode: 'real', events: [], nextCursor: null };
    }

    const params = new URLSearchParams({
      limit: String(Math.min(query.limit, 200)),
    });
    if (query.deviceId) params.set('device_id', query.deviceId);
    if (query.correlationId) params.set('correlation_id', query.correlationId);
    if (query.severity) params.set('severity', query.severity);
    if (query.fromIso) params.set('from', query.fromIso);
    if (query.toIso) params.set('to', query.toIso);

    const response = await fetch(`${this.baseUrl}/v1/events?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`event_source_error_${response.status}`);
    }

    return (await response.json()) as RealEventPage;
  }
}
