import type { NavigationId } from '../navigation';

export type ScreenId = NavigationId;

export type TimeWindow = '1S' | '6S' | '24S' | '7G';

export type IncidentStatus = 'Aktif' | 'İnceleniyor' | 'Cihaz Kilitli' | 'Çözüldü';

export type PlatformLayerId = 'windows' | 'macos' | 'android' | 'ios' | 'cloud';

export type ExternalDeviceStatus = 'active' | 'locked' | 'revoked' | 'offline';

export type ExternalDevicePlatform =
  | 'Windows'
  | 'macOS'
  | 'Android'
  | 'iOS'
  | 'Cloud'
  | PlatformLayerId;

export interface ExternalDevice {
  id: string;
  name: string;
  platform: ExternalDevicePlatform;
  status: ExternalDeviceStatus;
  x?: number;
  y?: number;
  lastSeen?: string;
}

export interface ExternalIncident {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'new' | 'reviewing' | 'resolved';
  deviceId?: string;
  timestamp: string;
  eventHash?: string;
}

export interface ExternalShare {
  shareId: string;
  deviceId: string;
  active: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  accessCount: number;
}

export interface AppProps {
  devices?: Array<ClusterNode | ExternalDevice>;
  incidents?: Array<ThreatIncident | ExternalIncident>;
  shares?: ExternalShare[];
  apiConnected?: boolean;
  onNavigate?: (screen: ScreenId) => void;
  onIncidentSelect?: (incident: ExternalIncident) => void;
}

export interface TrafficPoint {
  timestamp: string;
  desktopEvents: number;
  biometricChecks: number;
  flaggedEvents: number;
  latencyMs: number;
}

export interface PlatformLayerSummary {
  id: PlatformLayerId;
  name: string;
  role: string;
  status: 'Aktif' | 'Nöbet Hazır' | 'Ön Plan' | 'Kısıtlı';
  coveragePercent: number;
  techStack: string;
  constraintNote: string;
  accent: 'emerald' | 'cobalt' | 'amber';
}

export type NodeRole = 'Masaüstü' | 'Mobil' | 'Bulut';

export interface ClusterNode {
  id: string;
  platform: PlatformLayerId;
  hostname: string;
  osVersion: string;
  ip: string;
  role: NodeRole;
  status: 'Sağlıklı' | 'Nöbet Aktif' | 'Uyarı' | 'Kilitli';
  cpuPercent: number;
  batteryOrPower: string;
  cameraMode: string;
  latencyMs: number;
  events24h: number;
  techStack: string[];
  osConstraint: string;
  approvalRisk: string;
  cpuHistory: number[];
  x: number;
  y: number;
}

export interface NodeEdge {
  id: string;
  source: string;
  target: string;
  protocol: string;
  utilizationPercent: number;
  latencyMs: number;
  encrypted: boolean;
}

export type CanonicalSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type CanonicalSource = 'windows_etw' | 'macos_es' | 'android_fgs' | 'biometry' | 'cloud';
export type CanonicalDecision = 'allowed' | 'flagged' | 'uncertain' | 'blocked' | 'tamper_detected';

/**
 * OWASP-aligned semantic versioned event & evidence schema (1.0.0)
 * Uses UUIDv7-style sortable event_id, encrypted device_id, trace/correlation IDs,
 * millisecond ISO-8601 UTC timestamps, and append-only hash chaining.
 */
export interface CanonicalEventFields {
  schema_version: '1.0.0';
  event_id: string;
  trace_id: string;
  correlation_id: string;
  device_id: string;
  timestamp: string;
  severity: CanonicalSeverity;
  source: CanonicalSource;
  decision: CanonicalDecision;
  confidence: number;
  decision_threshold: number;
  evidence_hash: string;
  prev_event_hash: string;
  policy_version: string;
  policy_signature: string;
  retention_until: string;
}

export interface EphemeralShareRecord {
  share_id: string;
  active: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  recipient_device_id: string;
  access_count: number;
  owner_key_fingerprint: string;
}

export interface TamperLifecycle {
  detection: string;
  evidence: string;
  response: string;
  resilience: string;
}

export interface ThreatIncident extends CanonicalEventFields {
  id: string;
  vector: string;
  category: string;
  platform: PlatformLayerId;
  uiSeverity: 'critical' | 'warning' | 'resolved';
  status: IncidentStatus;
  triggerSource: string;
  targetNodeId: string;
  targetHostname: string;
  ruleId: string;
  relativeTime: string;
  livenessScore: number;
  embeddingSimilarity: number;
  cameraIndicatorVisible: boolean;
  isTamper: boolean;
  tamperLifecycle?: TamperLifecycle;
  ephemeralShare: EphemeralShareRecord;
  payloadExcerpt: string;
  timeline: {
    time: string;
    event: string;
  }[];
}

export interface SecurityPolicy {
  id: string;
  name: string;
  category: 'Biyometri' | 'Süreç / Dosya' | 'Ağ Filtresi' | 'Nöbet Modu' | 'Gizlilik' | 'Anti-Tamper';
  action: 'Engelle' | 'Kanıt + Uyarı' | 'İkinci Doğrulama' | 'Kısıtla';
  enabled: boolean;
  thresholdLabel: string;
  thresholdValue: number;
  thresholdUnit: string;
  scope: string;
  hits24h: number;
  lastTriggered: string;
  description: string;
}

export interface StreamEvent {
  id: string;
  timestamp: string;
  nodeHostname: string;
  channel: string;
  summary: string;
  severity: 'critical' | 'warning' | 'nominal';
  hashShort: string;
  latencyMs: number;
}

export interface BiometricScenario {
  id: string;
  label: string;
  condition: string;
  livenessScore: number;
  cosineSimilarity: number;
  riskOutcome: 'Tanındı' | 'Belirsiz' | 'Şüpheli';
  actionTaken: string;
  farImpact: string;
}

export interface BiometricDatasetResult {
  id: string;
  datasetName: string;
  purpose: string;
  measuredMetrics: string;
  sampleCount: number;
  farPercent: number;
  frrPercent: number;
  calibrationStatus: 'Saha Veri Seti Bekliyor' | 'Ön Kalibrasyon' | 'Doğrulandı';
}

export type VerificationStatus =
  | 'Tasarım Varsayımı'
  | 'Test Bekliyor'
  | 'Koşullu Doğrulandı'
  | 'Saha Doğrulandı'
  | 'Başarısız';

export interface DeviceCompatibilityEntry {
  id: string;
  platform: 'Windows' | 'macOS' | 'Android' | 'iOS';
  os_build: string;
  device_profile: string;
  permission_flow: string;
  camera_state: string;
  notification_state: string;
  blocking_capability: string;
  failure_mode: string;
  tamper_test: 'Simülasyon' | 'Gerçek Saldırı Testi';
  evidence: string;
  verified_by: string;
  last_verified_at: string;
  verificationStatus: VerificationStatus;
}

export interface DiagnosticCheckItem {
  id: string;
  label: string;
  status: 'PASS' | 'WARN' | 'LIMITED' | 'FAIL';
  detail: string;
}

export interface ScopeBoundaryItem {
  feature: string;
  realisticEquivalent: string;
  boundary: string;
}

export interface RoadmapMilestone {
  id: string;
  phase: 'Aşama 1 · 8–12 Hafta (MVP)' | 'Aşama 2 · 3–6 Ay' | 'Aşama 3 · 6–12 Ay';
  title: string;
  platform: string;
  completed: boolean;
}
