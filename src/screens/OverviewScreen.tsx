import React, { useState } from 'react';
import { Play, Pause, ArrowUpRight } from 'lucide-react';
import {
  BiometricScenario,
  ClusterNode,
  ExternalShare,
  NodeEdge,
  PlatformLayerSummary,
  ScreenId,
  StreamEvent,
  ThreatIncident,
  TimeWindow,
} from '../types/telemetry';
import { BIOMETRIC_SCENARIOS, TRAFFIC_SERIES } from '../data/telemetryData';
import { Sparkline } from '../components/charts/Sparkline';
import {
  TelemetryAreaChart,
  TelemetryMetricKey,
} from '../components/charts/TelemetryAreaChart';
import { TopologyCanvas } from '../components/TopologyCanvas';
import { DeviceTopology3D } from '../visual/DeviceTopology3D';
import { EventPulse } from '../visual/EventPulse';
import { BrandBanner } from '../components/BrandBanner';
import { HeroVideoShowcase } from '../components/HeroVideoShowcase';
import { EmptyState } from '../components/EmptyState';
import { uiLabels } from '../uiLabels';
import type { EventSourceMode } from '../data/real-event-source';

interface OverviewScreenProps {
  dataMode: EventSourceMode;
  apiConnected: boolean;
  nodes: ClusterNode[];
  edges: NodeEdge[];
  layers: PlatformLayerSummary[];
  incidents: ThreatIncident[];
  shares?: ExternalShare[];
  streamEvents: StreamEvent[];
  isStreaming: boolean;
  dutyModeActive: boolean;
  onToggleStream: () => void;
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  onNavigate: (screen: ScreenId) => void;
  onInspectIncident: (incident: ThreatIncident) => void;
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({
  dataMode,
  apiConnected,
  nodes,
  edges,
  layers,
  incidents,
  shares = [],
  streamEvents,
  isStreaming,
  dutyModeActive,
  onToggleStream,
  selectedNodeId,
  onSelectNode,
  onNavigate,
  onInspectIncident,
}) => {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('1S');
  const [activeSeries, setActiveSeries] = useState<Record<TelemetryMetricKey, boolean>>({
    desktopEvents: true,
    biometricChecks: true,
    flaggedEvents: true,
  });
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [streamFilter, setStreamFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [activeScenario, setActiveScenario] = useState<BiometricScenario>(BIOMETRIC_SCENARIOS[0]);
  const [topoView, setTopoView] = useState<'3d' | '2d'>('3d');

  const toggleSeries = (key: TelemetryMetricKey) => {
    setActiveSeries((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.desktopEvents && !next.biometricChecks && !next.flaggedEvents) {
        return prev;
      }
      return next;
    });
  };

  const activeIncidents = incidents.filter((i) => i.status !== 'Çözüldü').length;
  const criticalIncidents = incidents.filter(
    (i) => i.severity === 'critical' && i.status !== 'Çözüldü'
  ).length;
  const totalEvents24h = nodes.reduce((sum, n) => sum + n.events24h, 0);

  const filteredStream = streamEvents.filter((ev) => {
    if (streamFilter === 'all') return true;
    return ev.severity === streamFilter;
  });

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? nodes[0] ?? null;

  const activeShares = shares.filter((s) => s.active);

  return (
    <div className="space-y-4">
      <BrandBanner
        apiConnected={apiConnected}
        modeLabel={
          dataMode === 'real'
            ? `${uiLabels.realData} · ${apiConnected ? uiLabels.ready : uiLabels.awaitingConnection}`
            : `${uiLabels.demoMode} · Örnek Simülasyon`
        }
      />

      <HeroVideoShowcase apiConnected={apiConnected} onNavigate={onNavigate} />

      {dataMode === 'demo' && (
        <div className="rounded-xl border border-[#D9822B]/35 bg-[#D9822B]/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[#102A43]">
            <strong className="font-mono text-[#D9822B]">DENEME MODU:</strong> Bu ekrandaki cihaz ve olay verileri örnek simülasyondur; gerçek cihaz olayı değildir.
          </span>
          <span className="font-mono text-[11px] text-[#D9822B]">Dışa Aktarım Devre Dışı</span>
        </div>
      )}

      {/* Row 1: 4 KPI Bento Cards */}
      <section aria-label="Durum özeti" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bento-tile p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#627D98]">{uiLabels.devices}</span>
            <span className="tabular-mono text-[11px] font-medium text-[#2E9B72]">
              {nodes.length === 0 ? uiLabels.noPairedDevices : `${nodes.length}/${nodes.length} ${uiLabels.secure}`}
            </span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="tabular-mono text-2xl font-semibold text-[#102A43] tracking-tight">
                {nodes.length}
              </p>
              <p className="text-xs text-[#627D98] mt-0.5">
                {nodes.length === 0
                  ? 'Gerçek test cihazı bekleniyor'
                  : dataMode === 'real' && apiConnected
                    ? 'Gerçek cihazlar'
                    : 'Win · Mac · Android · iOS'}
              </p>
            </div>
            {nodes.length > 0 && (
              <div className="w-24 shrink-0">
                <Sparkline data={nodes.map((n) => n.events24h)} color="#2E9B72" height={34} />
              </div>
            )}
          </div>
        </div>

        <div className="bento-tile p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#627D98]">Olay Akışı</span>
            <span className="tabular-mono text-[11px] font-medium text-[#2878A8]">
              {dataMode === 'real' ? uiLabels.realData : '24s Toplam'}
            </span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="tabular-mono text-2xl font-semibold text-[#102A43] tracking-tight">
                {(dataMode === 'real'
                  ? Math.max(incidents.length, streamEvents.length)
                  : totalEvents24h
                ).toLocaleString('tr-TR')}
              </p>
              <p className="text-xs text-[#627D98] mt-0.5">
                {dataMode === 'real' && incidents.length === 0 && streamEvents.length === 0
                  ? uiLabels.noRealEvents
                  : dataMode === 'real' && apiConnected
                    ? 'Gerçek olay kayıtları'
                    : 'ETW · ES · WFP · Nöbet'}
              </p>
            </div>
            {dataMode === 'demo' && totalEvents24h > 0 && (
              <div className="w-24 shrink-0">
                <Sparkline
                  data={TRAFFIC_SERIES[timeWindow].map((pt) => pt.desktopEvents)}
                  color="#2878A8"
                  height={34}
                />
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('devices')}
          className="bento-tile p-4 flex flex-col justify-between gap-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2878A8]"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-xs font-medium text-[#627D98]">Android Nöbet & Biyometri</span>
            <span className={`tabular-mono text-[11px] font-medium ${dutyModeActive ? 'text-[#2E9B72]' : 'text-[#627D98]'}`}>
              {dataMode === 'real'
                ? apiConnected
                  ? uiLabels.ready
                  : uiLabels.noData
                : dutyModeActive
                  ? uiLabels.monitoring
                  : 'Hazırda'}
            </span>
          </div>
          <div className="flex items-end justify-between gap-4 w-full">
            <div>
              <p className="tabular-mono text-2xl font-semibold text-[#102A43] tracking-tight">
                {dataMode === 'real' ? (nodes.length > 0 ? uiLabels.ready : uiLabels.noData) : '%98.8'}
              </p>
              <p className="text-xs text-[#627D98] mt-0.5">
                {dataMode === 'real'
                  ? apiConnected
                    ? uiLabels.realConnectionActive
                    : uiLabels.awaitingConnection
                  : 'Yerel MiniFASNetV2 · Ön Plan'}
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 text-[#627D98]" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('incidents')}
          className={`bento-tile p-4 flex flex-col justify-between gap-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2878A8] ${
            criticalIncidents > 0 ? 'glow-rose' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-xs font-medium text-[#627D98]">{uiLabels.incidents}</span>
            <span
              className={`tabular-mono text-[11px] font-medium ${
                criticalIncidents > 0 ? 'text-[#C94A4A]' : 'text-[#627D98]'
              }`}
            >
              {criticalIncidents} Yüksek Risk
            </span>
          </div>
          <div className="flex items-end justify-between gap-4 w-full">
            <div>
              <p className="tabular-mono text-2xl font-semibold text-[#102A43] tracking-tight">
                {activeIncidents}
              </p>
              <p className="text-xs text-[#627D98] mt-0.5">
                {activeIncidents === 0 ? uiLabels.noRealEvents : `${uiLabels.waitingApproval}`}
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 text-[#627D98]" />
          </div>
        </button>
      </section>

      <section aria-label="Güvenli paylaşımlar özeti" className="bento-tile px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-medium text-[#627D98]">{uiLabels.shares}:</span>
          <span className="font-mono text-xs font-semibold text-[#102A43]">
            {activeShares.length === 0
              ? uiLabels.noActiveShares
              : `${activeShares.length} Aktif Paylaşım`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('shares')}
          className="inline-flex items-center gap-1 font-mono text-xs text-[#2878A8] hover:text-[#102A43] whitespace-nowrap"
        >
          <span>{uiLabels.viewDetails}</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </section>

      {/* Row 2: 8-col Event Correlation Chart + 4-col Asymmetric Layer Summary */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="bento-tile xl:col-span-8 p-5 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[#102A43]">
                Olay Korelasyonu ve Biyometrik Doğrulama
              </h2>
              <p className="text-xs text-[#627D98] mt-0.5">
                7/24 kamera yerine kilit açma, süreç ve hareket tetiklemeli sinyal akışı
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg bg-[#F5F8FA] p-1 border border-[#D9E2EC]">
                <button
                  type="button"
                  onClick={() => toggleSeries('desktopEvents')}
                  className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors whitespace-nowrap shrink-0 ${
                    activeSeries.desktopEvents
                      ? 'bg-[#2E9B72] text-white'
                      : 'text-[#627D98] hover:text-[#102A43]'
                  }`}
                >
                  ETW/ES
                </button>
                <button
                  type="button"
                  onClick={() => toggleSeries('biometricChecks')}
                  className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors whitespace-nowrap shrink-0 ${
                    activeSeries.biometricChecks
                      ? 'bg-[#2878A8] text-white'
                      : 'text-[#627D98] hover:text-[#102A43]'
                  }`}
                >
                  Biyometri
                </button>
                <button
                  type="button"
                  onClick={() => toggleSeries('flaggedEvents')}
                  className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors whitespace-nowrap shrink-0 ${
                    activeSeries.flaggedEvents
                      ? 'bg-[#C94A4A] text-white'
                      : 'text-[#627D98] hover:text-[#102A43]'
                  }`}
                >
                  Şüpheli
                </button>
              </div>

              <div className="flex items-center gap-0.5 rounded-lg bg-[#F5F8FA] p-1 border border-[#D9E2EC]">
                {(['1S', '6S', '24S', '7G'] as TimeWindow[]).map((win) => (
                  <button
                    key={win}
                    type="button"
                    onClick={() => setTimeWindow(win)}
                    className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors whitespace-nowrap shrink-0 ${
                      timeWindow === win
                        ? 'bg-[#102A43] text-white'
                        : 'text-[#627D98] hover:text-[#102A43]'
                    }`}
                  >
                    {win}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {dataMode === 'real' ? (
            incidents.length === 0 ? (
              <EmptyState
                title={uiLabels.noRealEvents}
                description="Henüz alınmış doğrulanmış bir güvenlik olayı bulunmuyor. Veri yok iken sahte zaman serisi grafiği üretilmez."
              />
            ) : (
              <div className="divide-y divide-[#D9E2EC]">
                {incidents.slice(0, 4).map((inc) => (
                  <button
                    key={inc.id}
                    type="button"
                    onClick={() => onInspectIncident(inc)}
                    className="w-full py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3 text-left hover:bg-[#F5F8FA] rounded-lg px-2 transition-colors"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-semibold text-[#102A43] truncate">
                        {inc.vector}
                      </p>
                      <p className="text-[11px] text-[#627D98] truncate">
                        {inc.payloadExcerpt}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] text-[#2878A8] shrink-0">
                      {inc.status}
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : (
            <TelemetryAreaChart
              data={TRAFFIC_SERIES[timeWindow]}
              activeSeries={activeSeries}
              height={235}
            />
          )}
        </div>

        <div className="bento-tile xl:col-span-4 p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold text-[#102A43]">
                Platform Rolleri ve Sınırlar
              </h2>
              <p className="text-xs text-[#627D98] mt-0.5">
                Cihaz bazlı yetki ve gizlilik dengesi
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('network')}
              className="font-mono text-xs text-[#2878A8] hover:text-[#102A43] whitespace-nowrap"
            >
              {uiLabels.viewDetails}
            </button>
          </div>

          <div className="divide-y divide-[#D9E2EC]">
            {layers.map((layer) => {
              const isSelected = selectedLayerId === layer.id;
              const barColor =
                layer.accent === 'emerald'
                  ? 'bg-[#2E9B72]'
                  : layer.accent === 'cobalt'
                    ? 'bg-[#2878A8]'
                    : 'bg-[#D9822B]';

              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setSelectedLayerId(isSelected ? null : layer.id)}
                  className={`w-full py-2.5 first:pt-1 last:pb-1 text-left transition-opacity ${
                    selectedLayerId && !isSelected ? 'opacity-50' : 'opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[13px] font-semibold text-[#102A43]">
                      {layer.name}
                    </span>
                    <span className="tabular-mono text-[11px] text-[#627D98]">
                      {layer.status}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#EAF0F4] overflow-hidden mb-1">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${layer.coveragePercent}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[#627D98] truncate">{layer.role}</p>
                  <p className="font-mono text-[10.5px] text-[#627D98] truncate mt-0.5">
                    {layer.constraintNote}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Row 3: Biometric Pipeline + Device Network Preview & Live Event Stream */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="bento-tile xl:col-span-7 p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[#102A43]">
                Yerel Biyometrik Karar Hattı
              </h2>
              <p className="text-xs text-[#627D98] mt-0.5">
                MiniFASNetV2 canlılık + MobileFaceNet embedding · Tek eşik yerine katmanlı karar
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('devices')}
              className="inline-flex items-center gap-1 rounded-lg border border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] px-3 py-1.5 text-xs font-medium text-[#102A43] transition-colors whitespace-nowrap shrink-0"
            >
              <span>Eşikleri Kalibre Et</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {BIOMETRIC_SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => setActiveScenario(sc)}
                className={`px-3 py-1.5 rounded-lg font-mono text-[11px] border transition-colors whitespace-nowrap ${
                  activeScenario.id === sc.id
                    ? 'bg-[#102A43] border-[#102A43] text-white'
                    : 'bg-[#F5F8FA] border-[#D9E2EC] text-[#627D98] hover:text-[#102A43]'
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-b border-[#D9E2EC] py-3.5 text-xs">
            <div>
              <p className="text-[#627D98]">1. Koşul</p>
              <p className="text-[#102A43] mt-1 leading-snug">{activeScenario.condition}</p>
            </div>
            <div>
              <p className="text-[#627D98]">2. Canlılık (MiniFASNetV2)</p>
              <p
                className={`tabular-mono text-base font-semibold mt-1 ${
                  activeScenario.livenessScore >= 0.55 ? 'text-[#2E9B72]' : 'text-[#C94A4A]'
                }`}
              >
                {(activeScenario.livenessScore * 100).toFixed(0)}%
              </p>
            </div>
            <div>
              <p className="text-[#627D98]">3. Embedding (MobileFaceNet)</p>
              <p
                className={`tabular-mono text-base font-semibold mt-1 ${
                  activeScenario.cosineSimilarity >= 0.74
                    ? 'text-[#2E9B72]'
                    : activeScenario.cosineSimilarity >= 0.6
                      ? 'text-[#D9822B]'
                      : 'text-[#C94A4A]'
                }`}
              >
                cos {activeScenario.cosineSimilarity.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[#627D98]">4. Yerel Karar</p>
              <p
                className={`font-mono text-base font-semibold mt-1 ${
                  activeScenario.riskOutcome === 'Tanındı'
                    ? 'text-[#2E9B72]'
                    : activeScenario.riskOutcome === 'Belirsiz'
                      ? 'text-[#D9822B]'
                      : 'text-[#C94A4A]'
                }`}
              >
                {activeScenario.riskOutcome}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[#102A43]">{activeScenario.actionTaken}</span>
            <span className="font-mono text-[11px] text-[#627D98]">{activeScenario.farImpact}</span>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="font-mono text-[11px] text-[#627D98]">
              {uiLabels.topology} ({nodes.length} cihaz)
            </span>
            <div className="flex items-center gap-0.5 rounded-lg bg-[#F5F8FA] p-0.5 border border-[#D9E2EC]">
              <button
                type="button"
                onClick={() => setTopoView('3d')}
                className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors whitespace-nowrap ${
                  topoView === '3d' ? 'bg-[#102A43] text-white' : 'text-[#627D98] hover:text-[#102A43]'
                }`}
              >
                3D Görünüm
              </button>
              <button
                type="button"
                onClick={() => setTopoView('2d')}
                className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors whitespace-nowrap ${
                  topoView === '2d' ? 'bg-[#102A43] text-white' : 'text-[#627D98] hover:text-[#102A43]'
                }`}
              >
                2D Şema
              </button>
            </div>
          </div>

          {selectedNode ? (
            topoView === '3d' ? (
              <DeviceTopology3D
                nodes={nodes}
                edges={edges}
                selectedNodeId={selectedNode.id}
                onSelectNode={onSelectNode}
                compact
              />
            ) : (
              <TopologyCanvas
                nodes={nodes}
                edges={edges}
                selectedNodeId={selectedNode.id}
                onSelectNode={onSelectNode}
                animateFlow={isStreaming}
                compact
              />
            )
          ) : (
            <EmptyState
              title={uiLabels.noPairedDevices}
              description="Henüz bu merkeze bağlanmış bir cihaz bulunmuyor."
            />
          )}
        </div>

        <div className="bento-tile xl:col-span-5 p-5 flex flex-col justify-between gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[15px] font-semibold text-[#102A43]">Olay Akışı</h2>
              <span className="font-mono text-[11px] text-[#627D98]">
                {dataMode === 'real' ? uiLabels.realData : isStreaming ? 'DEMO Canlı' : 'Duraklatıldı'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-lg bg-[#F5F8FA] p-0.5 border border-[#D9E2EC]">
                {(
                  [
                    { id: 'all', label: 'Tümü' },
                    { id: 'critical', label: 'Kritik' },
                    { id: 'warning', label: 'Uyarı' },
                  ] as const
                ).map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setStreamFilter(lvl.id)}
                    className={`px-2 py-0.5 rounded-md font-mono text-[10.5px] transition-colors whitespace-nowrap ${
                      streamFilter === lvl.id
                        ? 'bg-[#102A43] text-white'
                        : 'text-[#627D98] hover:text-[#102A43]'
                    }`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={onToggleStream}
                className="inline-flex items-center gap-1 rounded-lg border border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] px-2.5 py-1 text-[11px] font-medium text-[#102A43] transition-colors whitespace-nowrap"
              >
                {isStreaming ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                <span>{isStreaming ? 'Durdur' : 'Sürdür'}</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-[#D9E2EC] max-h-[380px] overflow-y-auto pr-1">
            {filteredStream.length === 0 ? (
              <EmptyState
                title={uiLabels.noRealEvents}
                description="Henüz alınmış doğrulanmış bir güvenlik olayı bulunmuyor."
              />
            ) : (
              filteredStream.map((ev) => {
                const sevColor =
                  ev.severity === 'critical'
                    ? 'text-[#C94A4A]'
                    : ev.severity === 'warning'
                      ? 'text-[#D9822B]'
                      : 'text-[#2E9B72]';

                const sevLabel =
                  ev.severity === 'critical'
                    ? 'kritik'
                    : ev.severity === 'warning'
                      ? 'uyarı'
                      : 'normal';

                const matchingIncident = incidents.find((i) =>
                  i.evidence_hash.startsWith(ev.hashShort)
                );

                return (
                  <EventPulse key={ev.id} itemKey={ev.id}>
                    <div className="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 font-mono text-[11px] text-[#627D98]">
                          <span className="tabular-nums text-[#102A43]">{ev.timestamp}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#2878A8] truncate">{ev.nodeHostname}</span>
                          <span aria-hidden="true">·</span>
                          <span className={sevColor}>{sevLabel}</span>
                        </div>
                        <p className="text-xs text-[#102A43] leading-snug">{ev.summary}</p>
                        <p className="font-mono text-[10.5px] text-[#627D98]">
                          {ev.channel} · kanıt:{ev.hashShort} · {ev.latencyMs.toFixed(1)}ms
                        </p>
                      </div>

                      {matchingIncident && (
                        <button
                          type="button"
                          onClick={() => onInspectIncident(matchingIncident)}
                          className="shrink-0 rounded-md border border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] px-2.5 py-1 font-mono text-[10.5px] text-[#102A43] transition-colors whitespace-nowrap"
                        >
                          İncele
                        </button>
                      )}
                    </div>
                  </EventPulse>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
