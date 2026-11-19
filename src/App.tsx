import { useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  INITIAL_COMPATIBILITY_MATRIX,
  INITIAL_EDGES,
  INITIAL_INCIDENTS,
  INITIAL_NODES,
  INITIAL_POLICIES,
  INITIAL_ROADMAP,
  INITIAL_STREAM_EVENTS,
  PLATFORM_LAYERS,
} from './data/telemetryData';
import {
  AppProps,
  ClusterNode,
  DeviceCompatibilityEntry,
  ExternalDevice,
  ExternalIncident,
  IncidentStatus,
  PlatformLayerId,
  RoadmapMilestone,
  ScreenId,
  SecurityPolicy,
  StreamEvent,
  ThreatIncident,
  VerificationStatus,
} from './types/telemetry';
import {
  createApprovedShare,
  resolveApiOrigin,
  revokeApprovedShare,
  sendApprovedCommand,
} from './api/aegisApi';
import { useAegisData } from './hooks/useAegisData';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { IncidentInspectorDrawer } from './components/IncidentInspectorDrawer';
import { PolicyModal } from './components/PolicyModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { OverviewScreen } from './screens/OverviewScreen';
import { TopologyScreen } from './screens/TopologyScreen';
import { IncidentsScreen } from './screens/IncidentsScreen';
import { NodesScreen } from './screens/NodesScreen';
import { PoliciesScreen } from './screens/PoliciesScreen';
import { DiagnosticsScreen } from './screens/DiagnosticsScreen';
import { CommandsScreen } from './screens/CommandsScreen';
import { SharesScreen } from './screens/SharesScreen';
import { PromoScreen } from './screens/PromoScreen';
import { generateUuidV7 } from './utils/eventSchema';
import type { EventSourceMode } from './data/real-event-source';
import { isDemoModeEnabled, setDemoModeEnabled } from './data/demo-mode';
import { PageTransition } from './visual/PageTransition';

const LIVE_EVENT_TEMPLATES: Omit<StreamEvent, 'id' | 'timestamp'>[] = [
  {
    nodeHostname: 'win11-workstation',
    channel: 'biometry',
    summary: 'Oturum kilidi açıldı — MiniFASNetV2 canlılık 0.95 (allowed)',
    severity: 'nominal',
    hashShort: 'e3b0c442',
    latencyMs: 10.8,
  },
  {
    nodeHostname: 'macbook-pro-m3',
    channel: 'macos_es',
    summary: 'Endpoint Security yeni yürütülebilir imza doğrulaması tamamlandı (allowed)',
    severity: 'nominal',
    hashShort: '8f434346',
    latencyMs: 8.6,
  },
  {
    nodeHostname: 'pixel-9-nobet',
    channel: 'android_fgs',
    summary: 'Ön plan kamera servisi hareket sensörü kontrolü nominal',
    severity: 'nominal',
    hashShort: '2c26b46b',
    latencyMs: 15.1,
  },
  {
    nodeHostname: 'win11-workstation',
    channel: 'windows_etw',
    summary: 'WFP bildirim soketine dış bloklama girişimi — Kurcalama algılandı',
    severity: 'critical',
    hashShort: '9a271f2a',
    latencyMs: 11.2,
  },
];

function isClusterNode(item: ClusterNode | ExternalDevice): item is ClusterNode {
  return 'hostname' in item;
}

function isThreatIncident(item: ThreatIncident | ExternalIncident): item is ThreatIncident {
  return 'vector' in item && 'evidence_hash' in item;
}

function normalizePlatform(raw: ExternalDevice['platform']): PlatformLayerId {
  const lower = raw.toLowerCase();
  if (lower === 'windows' || lower === 'macos' || lower === 'android' || lower === 'ios' || lower === 'cloud') {
    return lower;
  }
  return 'cloud';
}

function adaptExternalDevice(dev: ClusterNode | ExternalDevice, idx: number): ClusterNode {
  if (isClusterNode(dev)) return dev;
  const platform = normalizePlatform(dev.platform);
  const statusMap: Record<ExternalDevice['status'], ClusterNode['status']> = {
    active: 'Sağlıklı',
    locked: 'Kilitli',
    revoked: 'Kilitli',
    offline: 'Uyarı',
  };
  return {
    id: dev.id,
    platform,
    hostname: dev.name,
    osVersion: dev.platform,
    ip: 'Redacted (Zero-Trust)',
    role:
      platform === 'android' || platform === 'ios'
        ? 'Mobil'
        : platform === 'cloud'
          ? 'Bulut'
          : 'Masaüstü',
    status: statusMap[dev.status],
    cpuPercent: 0,
    batteryOrPower: dev.lastSeen ?? 'Gerçek cihaz telemetrisi',
    cameraMode: platform === 'android' ? 'Ön Plan Servisi (Kullanıcı Onaylı)' : 'Yok / Pasif',
    latencyMs: 0,
    events24h: 0,
    techStack: ['Ed25519', 'X25519+HKDF-SHA256', 'AES-256-GCM'],
    osConstraint: 'Gerçek cihaz sınırı aktif',
    approvalRisk: dev.status === 'revoked' ? 'İptal edildi' : 'Doğrulanmış eşleşme',
    cpuHistory: [0],
    x: dev.x ?? 20 + (idx % 4) * 20,
    y: dev.y ?? 30 + Math.floor(idx / 4) * 30,
  };
}

function adaptExternalIncident(inc: ThreatIncident | ExternalIncident, idx: number): ThreatIncident {
  if (isThreatIncident(inc)) return inc;
  const statusMap: Record<ExternalIncident['status'], IncidentStatus> = {
    new: 'Aktif',
    reviewing: 'İnceleniyor',
    resolved: 'Çözüldü',
  };
  const uiSeverity: ThreatIncident['uiSeverity'] =
    inc.status === 'resolved'
      ? 'resolved'
      : inc.severity === 'critical' || inc.severity === 'high'
        ? 'critical'
        : 'warning';
  const hash = inc.eventHash ?? '0000000000000000000000000000000000000000000000000000000000000000';
  return {
    schema_version: '1.0.0',
    event_id: inc.id,
    trace_id: `trc-${inc.id}`,
    correlation_id: `corr-${inc.id}`,
    device_id: inc.deviceId ?? 'unknown-device',
    timestamp: inc.timestamp,
    severity: inc.severity,
    source: 'cloud',
    decision: inc.severity === 'critical' ? 'flagged' : 'uncertain',
    confidence: 1,
    decision_threshold: 0.85,
    evidence_hash: hash,
    prev_event_hash: '0000000000000000000000000000000000000000000000000000000000000000',
    policy_version: 'pol-v1.0.0',
    policy_signature: 'ed25519:verified',
    retention_until: inc.timestamp,
    id: inc.id,
    vector: inc.title,
    category: 'Güvenlik Olayı',
    platform: 'cloud',
    uiSeverity,
    status: statusMap[inc.status],
    triggerSource: inc.deviceId ?? 'Aegis Gözcü',
    targetNodeId: inc.deviceId ?? `node-${idx}`,
    targetHostname: inc.deviceId ?? 'Eşleşmiş Cihaz',
    ruleId: 'KRL-REAL-01',
    relativeTime: inc.timestamp.slice(0, 19).replace('T', ' '),
    livenessScore: 1,
    embeddingSimilarity: 1,
    cameraIndicatorVisible: false,
    isTamper: inc.severity === 'critical',
    ephemeralShare: {
      share_id: `shr-${inc.id}`,
      active: false,
      expires_at: null,
      revoked_at: null,
      recipient_device_id: inc.deviceId ?? 'owner-device',
      access_count: 0,
      owner_key_fingerprint: 'fp-x25519',
    },
    payloadExcerpt: inc.description,
    timeline: [{ time: inc.timestamp.slice(11, 19) || '00:00:00', event: inc.description }],
  };
}

function toExternalIncident(inc: ThreatIncident): ExternalIncident {
  const statusMap: Record<IncidentStatus, ExternalIncident['status']> = {
    Aktif: 'new',
    İnceleniyor: 'reviewing',
    'Cihaz Kilitli': 'reviewing',
    Çözüldü: 'resolved',
  };
  const sev: ExternalIncident['severity'] =
    inc.severity === 'info' ? 'low' : inc.severity;
  return {
    id: inc.id,
    title: inc.vector,
    description: inc.payloadExcerpt,
    severity: sev,
    status: statusMap[inc.status],
    deviceId: inc.device_id,
    timestamp: inc.timestamp,
    eventHash: inc.evidence_hash,
  };
}

export default function App({
  devices: devicesProp,
  incidents: incidentsProp,
  shares: sharesProp,
  apiConnected: apiConnectedProp,
  onNavigate,
  onIncidentSelect,
}: AppProps = {}) {
  const hasExternalProps =
    devicesProp !== undefined ||
    incidentsProp !== undefined ||
    sharesProp !== undefined ||
    apiConnectedProp !== undefined;

  const [dataMode, setDataMode] = useState<EventSourceMode>(() =>
    !hasExternalProps && isDemoModeEnabled() ? 'demo' : 'real'
  );
  const [activeScreen, setActiveScreen] = useState<ScreenId>('overview');
  const [nodes, setNodes] = useState<ClusterNode[]>(INITIAL_NODES);
  const [incidents, setIncidents] = useState<ThreatIncident[]>(INITIAL_INCIDENTS);
  const [policies, setPolicies] = useState<SecurityPolicy[]>(INITIAL_POLICIES);
  const [roadmap, setRoadmap] = useState<RoadmapMilestone[]>(INITIAL_ROADMAP);
  const [compatibilityMatrix, setCompatibilityMatrix] = useState<DeviceCompatibilityEntry[]>(
    INITIAL_COMPATIBILITY_MATRIX
  );
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>(INITIAL_STREAM_EVENTS);
  const [isStreaming, setIsStreaming] = useState(true);
  const [dutyModeActive, setDutyModeActive] = useState(true);

  const apiOrigin = resolveApiOrigin();
  const liveSync = useAegisData({
    enabled: dataMode === 'real' && !hasExternalProps,
    apiOrigin,
  });

  const navigateToScreen = (screen: ScreenId) => {
    setActiveScreen(screen);
    onNavigate?.(screen);
  };

  const handleChangeDataMode = (mode: EventSourceMode) => {
    setDataMode(mode);
    setDemoModeEnabled(mode === 'demo');
    setInspectedIncidentId(null);
  };

  const effectiveApiConnected =
    dataMode === 'real' ? (apiConnectedProp ?? liveSync.apiConnected) : false;

  const adaptedPropNodes =
    devicesProp !== undefined ? devicesProp.map(adaptExternalDevice) : null;
  const adaptedPropIncidents =
    incidentsProp !== undefined ? incidentsProp.map(adaptExternalIncident) : null;

  const visibleNodes =
    dataMode === 'demo'
      ? nodes
      : (adaptedPropNodes ?? liveSync.devices.map(adaptExternalDevice));
  const visibleIncidents =
    dataMode === 'demo'
      ? incidents
      : (adaptedPropIncidents ?? liveSync.incidents.map(adaptExternalIncident));
  const visibleShares =
    dataMode === 'demo'
      ? []
      : (sharesProp ?? liveSync.shares);
  const visibleStreamEvents =
    dataMode === 'demo'
      ? streamEvents
      : visibleIncidents.map((inc) => ({
          id: inc.id,
          timestamp: inc.timestamp.slice(11, 19) || '00:00:00',
          nodeHostname: inc.targetHostname,
          channel: inc.source,
          summary: inc.vector,
          severity: (
            inc.uiSeverity === 'critical'
              ? 'critical'
              : inc.uiSeverity === 'warning'
                ? 'warning'
                : 'nominal'
          ) as StreamEvent['severity'],
          hashShort: inc.evidence_hash.slice(0, 8),
          latencyMs: 0,
        }));
  const visibleMatrix = dataMode === 'demo' ? compatibilityMatrix : [];
  const effectiveDutyActive =
    dataMode === 'demo'
      ? dutyModeActive
      : visibleNodes.some((n) => n.platform === 'android' && n.status === 'Nöbet Aktif');

  const handleInspectIncident = (inc: ThreatIncident) => {
    setInspectedIncidentId(inc.id);
    onIncidentSelect?.(toExternalIncident(inc));
  };

  const handleSubmitApprovedCommand = async (
    node: ClusterNode,
    command: 'lock_session'
  ) => {
    const res = await sendApprovedCommand(apiOrigin, {
      command,
      targetDeviceId: node.id,
      explicitUserConfirmation: true,
    });
    return {
      accepted: Boolean(res.accepted || res.status === 'queued_for_device'),
      statusText: res.status ?? 'queued_for_device',
    };
  };

  const handleCreateRealShare = async (deviceId: string) => {
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    const created = await createApprovedShare(apiOrigin, {
      deviceId,
      expiresAt,
      explicitUserConfirmation: true,
    });
    liveSync.setShares((prev) => [created, ...prev]);
  };

  const handleRevokeRealShare = async (shareId: string) => {
    await revokeApprovedShare(apiOrigin, {
      shareId,
      explicitUserConfirmation: true,
    });
    liveSync.setShares((prev) => prev.filter((s) => s.shareId !== shareId));
  };

  const [selectedNodeId, setSelectedNodeId] = useState<string>(INITIAL_NODES[0].id);
  const [inspectedIncidentId, setInspectedIncidentId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((open) => !open);
      } else if (e.key === 'Escape') {
        setCommandOpen(false);
        setPolicyModalOpen(false);
        setInspectedIncidentId(null);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (dataMode !== 'demo' || !isStreaming) return;
    let tick = 0;
    const interval = setInterval(() => {
      const template = LIVE_EVENT_TEMPLATES[tick % LIVE_EVENT_TEMPLATES.length];
      tick += 1;
      const now = new Date();
      const timestamp = now.toTimeString().slice(0, 8);
      const nextEvent: StreamEvent = {
        ...template,
        id: `ev-${Date.now()}-${tick}`,
        timestamp,
      };
      setStreamEvents((prev) => [nextEvent, ...prev.slice(0, 17)]);
    }, 4500);

    return () => clearInterval(interval);
  }, [dataMode, isStreaming]);

  const inspectedIncident =
    visibleIncidents.find((inc) => inc.id === inspectedIncidentId) ?? null;

  const activeIncidentCount = visibleIncidents.filter((i) => i.status !== 'Çözüldü').length;

  const handleUpdateIncidentStatus = (incidentId: string, status: IncidentStatus) => {
    const nowTime = new Date().toISOString().slice(11, 23);
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id !== incidentId) return inc;
        return {
          ...inc,
          status,
          uiSeverity: status === 'Çözüldü' ? 'resolved' : inc.uiSeverity,
          timeline: [
            ...inc.timeline,
            {
              time: nowTime,
              event: `Cihaz sahibi olay durumunu "${status}" olarak güncelledi.`,
            },
          ],
        };
      })
    );
  };

  const handleToggleEphemeralShare = (incidentId: string) => {
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id !== incidentId) return inc;
        const nowIso = new Date().toISOString();
        const nextActive = !inc.ephemeralShare.active;
        const expiresIso = new Date(Date.now() + 15 * 60000).toISOString();
        return {
          ...inc,
          ephemeralShare: {
            ...inc.ephemeralShare,
            active: nextActive,
            expires_at: nextActive ? expiresIso : inc.ephemeralShare.expires_at,
            revoked_at: nextActive ? null : nowIso,
            access_count: nextActive
              ? inc.ephemeralShare.access_count + 1
              : inc.ephemeralShare.access_count,
          },
        };
      })
    );
  };

  const handlePurgeEvidence = (incidentId: string) => {
    setIncidents((prev) => prev.filter((inc) => inc.id !== incidentId));
    setInspectedIncidentId(null);
  };

  const handleSimulateTamper = (platform: 'windows' | 'macos' | 'android') => {
    const nowIso = new Date().toISOString();
    const retentionIso = new Date(Date.now() + 7 * 86400000).toISOString();
    const shortId = Math.floor(4110 + Math.random() * 880);
    const nowTime = nowIso.slice(11, 23);
    const prevHash = incidents[0]?.evidence_hash ?? '0000000000000000000000000000000000000000000000000000000000000000';

    const configMap = {
      windows: {
        device_id: 'enc_dev_9f4a21c8',
        hostname: 'win11-workstation',
        nodeId: 'node-win-01',
        source: 'windows_etw' as const,
        vector: 'Kurcalama Algılandı: WFP Üzerinden Bildirim Kanalı Bloklandı',
        trigger: 'WFP Outbound Self-Protection Heartbeat',
        hash: 'f2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2',
        excerpt: 'Harici firewall kuralı aegis-agent çıkış soketini kesti -> Yedek kanal tamper_detected üretti.',
        lifecycle: {
          detection: 'WFP ALE katmanında aegis-agent bildirim soketine bloklama kuralı eklendi.',
          evidence: 'WFP olay günlüğü, süreç PID ve UTC milisaniye damgası SHA-256 ile mühürlendi.',
          response: 'Son bilinen iyi durum korundu; ikincil kanaldan buluta "koruma kesildi" gönderildi.',
          resilience: 'Watchdog servisi yeniden başlattı ve imzalı yapılandırmayı doğruladı.',
        },
      },
      macos: {
        device_id: 'enc_dev_4b81e302',
        hostname: 'macbook-pro-m3',
        nodeId: 'node-mac-01',
        source: 'macos_es' as const,
        vector: 'Kurcalama Algılandı: Endpoint Security Uzantısı Kapatma Girişimi',
        trigger: 'systemextensionsctl / ES Guard',
        hash: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
        excerpt: 'Sistem uzantısı devre dışı bırakma girişimi algılandı -> tamper_detected üretildi.',
        lifecycle: {
          detection: 'systemextensionsctl komutuyla ES sistem uzantısı kapatılmak istendi.',
          evidence: 'Süreç ağacı, kullanıcı oturumu ve yapılandırma özeti mühürlendi.',
          response: 'Menü çubuğu uyarısı ve iOS onay ucuna bildirim iletildi.',
          resilience: 'Notarized imzalı profil korundu ve onarım rehberi açıldı.',
        },
      },
      android: {
        device_id: 'enc_dev_a310c9d4',
        hostname: 'pixel-9-nobet',
        nodeId: 'node-and-01',
        source: 'android_fgs' as const,
        vector: 'Kurcalama Algılandı: Nöbet Ön Plan Servisi Zorla Sonlandırıldı',
        trigger: 'ForegroundService.onTaskRemoved',
        hash: 'b5bb9d8014a0f9b1d61e21e796d78dccdf1352f23cd32812f4850b878ae4944c',
        excerpt: 'Nöbet Modu kullanıcı onayı olmadan sonlandırıldı -> Bulut heartbeat kaybı tamper_detected.',
        lifecycle: {
          detection: 'Kullanıcı "Nöbeti Bitir" demeden ön plan servisi kesildi.',
          evidence: 'Son kalp atışı damgası ve pil optimizasyon durumu kaydedildi.',
          response: 'Buluta imzalı "koruma kesildi" olayı ve iPhone push uyarısı gönderildi.',
          resilience: 'Kullanıcıya pil muafiyeti ve servisi yeniden başlatma yönlendirmesi sunuldu.',
        },
      },
    }[platform];

    const newIncident: ThreatIncident = {
      schema_version: '1.0.0',
      event_id: generateUuidV7(),
      trace_id: `trc-sim-${platform}-${shortId}`,
      correlation_id: `corr-tamper-${shortId}`,
      device_id: configMap.device_id,
      timestamp: nowIso,
      severity: 'critical',
      source: configMap.source,
      decision: 'tamper_detected',
      confidence: 0.98,
      decision_threshold: 0.85,
      evidence_hash: configMap.hash,
      prev_event_hash: prevHash,
      policy_version: 'pol-v2.4.1',
      policy_signature: 'ed25519:7c4f91e0a82b',
      retention_until: retentionIso,
      id: `TMPR-${shortId}`,
      vector: configMap.vector,
      category: 'Anti-Tamper',
      platform,
      uiSeverity: 'critical',
      status: 'Aktif',
      triggerSource: configMap.trigger,
      targetNodeId: configMap.nodeId,
      targetHostname: configMap.hostname,
      ruleId: 'KRL-TMP-01',
      relativeTime: 'Az önce',
      livenessScore: 0.95,
      embeddingSimilarity: 0.92,
      cameraIndicatorVisible: false,
      isTamper: true,
      tamperLifecycle: configMap.lifecycle,
      ephemeralShare: {
        share_id: `shr-${shortId}`,
        active: false,
        expires_at: null,
        revoked_at: null,
        recipient_device_id: 'enc_dev_ios16_01',
        access_count: 0,
        owner_key_fingerprint: 'fp-x25519-48b2d1',
      },
      payloadExcerpt: configMap.excerpt,
      timeline: [
        { time: nowTime, event: `${configMap.hostname} üzerinde simüle edilmiş tamper_detected olayı kaydedildi.` },
      ],
    };

    setIncidents((prev) => [newIncident, ...prev]);
    setStreamEvents((prev) => [
      {
        id: `ev-tamper-${Date.now()}`,
        timestamp: nowIso.slice(11, 19),
        nodeHostname: configMap.hostname,
        channel: configMap.source,
        summary: `${configMap.vector} (simülasyon)`,
        severity: 'critical',
        hashShort: configMap.hash.slice(0, 8),
        latencyMs: 12.0,
      },
      ...prev.slice(0, 17),
    ]);
    setInspectedIncidentId(newIncident.id);
  };

  const handleSimulateChainBreak = () => {
    const nowIso = new Date().toISOString();
    const retentionIso = new Date(Date.now() + 7 * 86400000).toISOString();
    const shortId = Math.floor(5100 + Math.random() * 800);
    const brokenIncident: ThreatIncident = {
      schema_version: '1.0.0',
      event_id: generateUuidV7(),
      trace_id: `trc-chain-break-${shortId}`,
      correlation_id: `corr-chain-${shortId}`,
      device_id: 'enc_dev_9f4a21c8',
      timestamp: nowIso,
      severity: 'critical',
      source: 'cloud',
      decision: 'tamper_detected',
      confidence: 1.0,
      decision_threshold: 1.0,
      evidence_hash: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
      prev_event_hash: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      policy_version: 'pol-v2.4.1',
      policy_signature: 'ed25519:7c4f91e0a82b',
      retention_until: retentionIso,
      id: `TMPR-${shortId}`,
      vector: 'Olay Zinciri Kopması: prev_event_hash Uyumsuzluğu (Kurcalama algılandı)',
      category: 'Anti-Tamper',
      platform: 'cloud',
      uiSeverity: 'critical',
      status: 'Aktif',
      triggerSource: 'Append-Only Hash Chain Verifier',
      targetNodeId: 'node-cloud-01',
      targetHostname: 'aegis-e2e-relay',
      ruleId: 'KRL-TMP-01',
      relativeTime: 'Az önce',
      livenessScore: 1.0,
      embeddingSimilarity: 1.0,
      cameraIndicatorVisible: false,
      isTamper: true,
      tamperLifecycle: {
        detection: 'Yeni olayın prev_event_hash değeri önceki olayın evidence_hash değeriyle eşleşmedi.',
        evidence: 'Kopma noktası SHA-256 özeti, event_id ve milisaniye UTC damgası mühürlendi.',
        response: 'Olay otomatik tamper_detected olarak işaretlendi; iOS onay ucuna uyarı gönderildi.',
        resilience: 'Etkilenen zaman aralığı karantinaya alındı; yeni olay zinciri son doğrulanmış kökten başlatıldı.',
      },
      ephemeralShare: {
        share_id: `shr-${shortId}`,
        active: false,
        expires_at: null,
        revoked_at: null,
        recipient_device_id: 'enc_dev_ios16_01',
        access_count: 0,
        owner_key_fingerprint: 'fp-x25519-48b2d1',
      },
      payloadExcerpt:
        'Beklenen prev_event_hash != gelen prev_event_hash -> Append-only bütünlük ihlali tamper_detected olarak mühürlendi.',
      timeline: [
        { time: nowIso.slice(11, 23), event: 'Zincir doğrulayıcı prev_event_hash uyumsuzluğu saptadı ve tamper_detected üretti.' },
      ],
    };

    setIncidents((prev) => [brokenIncident, ...prev]);
    setInspectedIncidentId(brokenIncident.id);
  };

  const handleToggleLockNode = (nodeId: string) => {
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== nodeId) return node;
        const isLocked = node.status === 'Kilitli';
        const nextStatus = isLocked
          ? node.platform === 'android' && dutyModeActive
            ? 'Nöbet Aktif'
            : 'Sağlıklı'
          : 'Kilitli';
        return {
          ...node,
          status: nextStatus,
        };
      })
    );
  };

  const handleTriggerUnlockCheck = (nodeId: string) => {
    const target = nodes.find((n) => n.id === nodeId);
    if (!target) return;
    const now = new Date().toTimeString().slice(0, 8);
    setStreamEvents((prev) => [
      {
        id: `ev-sim-${Date.now()}`,
        timestamp: now,
        nodeHostname: target.hostname,
        channel: target.platform === 'android' ? 'android_fgs' : 'biometry',
        summary: `${target.hostname} üzerinde manuel tetikleme doğrulaması tamamlandı (allowed)`,
        severity: 'nominal',
        hashShort: 'e3b0c442',
        latencyMs: target.latencyMs,
      },
      ...prev.slice(0, 17),
    ]);
  };

  const handleToggleDutyMode = () => {
    const next = !dutyModeActive;
    setDutyModeActive(next);
    setNodes((prev) =>
      prev.map((n) =>
        n.platform === 'android'
          ? {
              ...n,
              status: next ? 'Nöbet Aktif' : 'Sağlıklı',
              cameraMode: next
                ? 'Ön Plan Servisi · Görünür Bildirim'
                : 'Beklemede (Kullanıcı Başlatması Gerekli)',
            }
          : n
      )
    );
  };

  const handleTogglePolicy = (policyId: string) => {
    setPolicies((prev) =>
      prev.map((pol) =>
        pol.id === policyId
          ? {
              ...pol,
              enabled: !pol.enabled,
              lastTriggered: !pol.enabled ? 'Hazır' : 'Devre Dışı',
            }
          : pol
      )
    );
  };

  const handleUpdatePolicyThreshold = (policyId: string, value: number) => {
    setPolicies((prev) =>
      prev.map((pol) =>
        pol.id === policyId ? { ...pol, thresholdValue: value } : pol
      )
    );
  };

  const handleCreatePolicy = (newPolicy: SecurityPolicy) => {
    setPolicies((prev) => [newPolicy, ...prev]);
    navigateToScreen('settings');
  };

  const handleToggleMilestone = (milestoneId: string) => {
    setRoadmap((prev) =>
      prev.map((m) => (m.id === milestoneId ? { ...m, completed: !m.completed } : m))
    );
  };

  const handleUpdateCompatibilityStatus = (id: string, status: VerificationStatus) => {
    setCompatibilityMatrix((prev) =>
      prev.map((r) => (r.id === id ? { ...r, verificationStatus: status } : r))
    );
  };

  const handleApplyDiagnosticResult = (
    platform: 'Windows' | 'macOS' | 'Android' | 'iOS',
    evidenceSummary: string,
    verifiedBy: string
  ) => {
    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    setCompatibilityMatrix((prev) =>
      prev.map((r) =>
        r.platform === platform
          ? {
              ...r,
              evidence: evidenceSummary,
              verified_by: verifiedBy,
              last_verified_at: nowIso,
              verificationStatus: 'Saha Doğrulandı',
            }
          : r
      )
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F8FA] text-[#102A43] flex relative">
      <Sidebar
        activeScreen={activeScreen}
        onSelectScreen={navigateToScreen}
        activeIncidentCount={activeIncidentCount}
        dutyModeActive={effectiveDutyActive}
        apiConnected={effectiveApiConnected}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col relative z-10">
        <TopBar
          activeScreen={activeScreen}
          dataMode={dataMode}
          onChangeDataMode={handleChangeDataMode}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onOpenCommandPalette={() => setCommandOpen(true)}
          onPrimaryAction={() => setPolicyModalOpen(true)}
        />

        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <PageTransition key={`${activeScreen}-${dataMode}`}>
              {activeScreen === 'overview' && (
                <OverviewScreen
                  dataMode={dataMode}
                  apiConnected={effectiveApiConnected}
                  nodes={visibleNodes}
                  edges={dataMode === 'demo' ? INITIAL_EDGES : []}
                  layers={PLATFORM_LAYERS}
                  incidents={visibleIncidents}
                  shares={visibleShares}
                  streamEvents={visibleStreamEvents}
                  isStreaming={dataMode === 'demo' && isStreaming}
                  dutyModeActive={effectiveDutyActive}
                  onToggleStream={() => setIsStreaming((s) => !s)}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                  onNavigate={navigateToScreen}
                  onInspectIncident={handleInspectIncident}
                />
              )}

              {activeScreen === 'devices' && (
                <NodesScreen
                  dataMode={dataMode}
                  nodes={visibleNodes}
                  dutyModeActive={effectiveDutyActive}
                  onToggleDutyMode={handleToggleDutyMode}
                  onToggleLockNode={handleToggleLockNode}
                />
              )}

              {activeScreen === 'network' && (
                <TopologyScreen
                  nodes={visibleNodes}
                  edges={dataMode === 'demo' ? INITIAL_EDGES : []}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                  onToggleLockNode={handleToggleLockNode}
                  onTriggerUnlockCheck={handleTriggerUnlockCheck}
                />
              )}

              {activeScreen === 'incidents' && (
                <IncidentsScreen
                  dataMode={dataMode}
                  incidents={visibleIncidents}
                  onInspectIncident={handleInspectIncident}
                  onUpdateStatus={handleUpdateIncidentStatus}
                  onSimulateTamper={handleSimulateTamper}
                  onSimulateChainBreak={handleSimulateChainBreak}
                />
              )}

              {activeScreen === 'diagnostics' && (
                <DiagnosticsScreen
                  dataMode={dataMode}
                  apiConnected={effectiveApiConnected}
                  incidents={visibleIncidents}
                  compatibilityMatrix={visibleMatrix}
                  onUpdateCompatibilityStatus={handleUpdateCompatibilityStatus}
                  onApplyDiagnosticResult={handleApplyDiagnosticResult}
                />
              )}

              {activeScreen === 'commands' && (
                <CommandsScreen
                  dataMode={dataMode}
                  apiConnected={effectiveApiConnected}
                  nodes={visibleNodes}
                  onToggleLockNode={handleToggleLockNode}
                  onTriggerUnlockCheck={handleTriggerUnlockCheck}
                  onSubmitApprovedCommand={apiOrigin ? handleSubmitApprovedCommand : undefined}
                />
              )}

              {activeScreen === 'shares' && (
                <SharesScreen
                  dataMode={dataMode}
                  apiConnected={effectiveApiConnected}
                  devices={visibleNodes}
                  shares={visibleShares}
                  incidents={visibleIncidents}
                  onCreateShare={apiOrigin ? handleCreateRealShare : undefined}
                  onRevokeShare={apiOrigin ? handleRevokeRealShare : undefined}
                  onToggleEphemeralShare={handleToggleEphemeralShare}
                  onPurgeEvidence={handlePurgeEvidence}
                  onInspectIncident={handleInspectIncident}
                />
              )}

              {activeScreen === 'promo' && <PromoScreen />}

              {activeScreen === 'settings' && (
                <PoliciesScreen
                  policies={policies}
                  roadmap={roadmap}
                  onTogglePolicy={handleTogglePolicy}
                  onUpdateThreshold={handleUpdatePolicyThreshold}
                  onToggleMilestone={handleToggleMilestone}
                  onOpenNewPolicy={() => setPolicyModalOpen(true)}
                />
              )}
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>

      <IncidentInspectorDrawer
        dataMode={dataMode}
        incident={inspectedIncident}
        onClose={() => setInspectedIncidentId(null)}
        onUpdateStatus={handleUpdateIncidentStatus}
        onToggleEphemeralShare={handleToggleEphemeralShare}
        onPurgeEvidence={handlePurgeEvidence}
      />

      <PolicyModal
        open={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        onCreatePolicy={handleCreatePolicy}
      />

      <CommandPaletteModal
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        nodes={visibleNodes}
        incidents={visibleIncidents}
        policies={policies}
        onNavigate={navigateToScreen}
        onSelectIncident={handleInspectIncident}
        onSelectNode={setSelectedNodeId}
      />
    </div>
  );
}
