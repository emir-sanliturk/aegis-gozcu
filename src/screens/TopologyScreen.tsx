import React, { useState } from 'react';
import { Lock, RefreshCw, Play, Pause } from 'lucide-react';
import { ClusterNode, NodeEdge, NodeRole } from '../types/telemetry';
import { TopologyCanvas } from '../components/TopologyCanvas';
import { DeviceTopology3D, TopologyStatusBadge } from '../visual/DeviceTopology3D';
import { Sparkline } from '../components/charts/Sparkline';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { uiLabels } from '../uiLabels';

interface TopologyScreenProps {
  nodes: ClusterNode[];
  edges: NodeEdge[];
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  onToggleLockNode: (nodeId: string) => void;
  onTriggerUnlockCheck: (nodeId: string) => void;
}

export const TopologyScreen: React.FC<TopologyScreenProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onToggleLockNode,
  onTriggerUnlockCheck,
}) => {
  const [roleFilter, setRoleFilter] = useState<NodeRole | 'All'>('All');
  const [topoView, setTopoView] = useState<'3d' | '2d'>('3d');
  const [animateFlow, setAnimateFlow] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? nodes[0] ?? null;

  const handleTestTrigger = () => {
    if (!selectedNode) return;
    onTriggerUnlockCheck(selectedNode.id);
    setActionNotice(
      `${selectedNode.hostname} üzerinde olay tetiklemeli doğrulama simüle edildi.`
    );
    setTimeout(() => setActionNotice(null), 2800);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        section="Ağ"
        title={uiLabels.topology}
        description="Eşleştirilmiş cihazlar arasındaki doğrulanmış E2E bağlantılar ve rol sınırları."
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="bento-tile xl:col-span-8 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[#102A43]">
                Cihaz Bağlantıları & Cihaz Eşleştirme
              </h2>
              <p className="text-xs text-[#627D98] mt-0.5">
                Masaüstünde derin telemetri, mobilde şeffaf ve kullanıcı kontrollü nöbet/onay
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-lg bg-[#F5F8FA] p-1 border border-[#D9E2EC]">
                <button
                  type="button"
                  onClick={() => setTopoView('3d')}
                  className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors whitespace-nowrap shrink-0 ${
                    topoView === '3d'
                      ? 'bg-[#102A43] text-white'
                      : 'text-[#627D98] hover:text-[#102A43]'
                  }`}
                >
                  3D Görünüm
                </button>
                <button
                  type="button"
                  onClick={() => setTopoView('2d')}
                  className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors whitespace-nowrap shrink-0 ${
                    topoView === '2d'
                      ? 'bg-[#102A43] text-white'
                      : 'text-[#627D98] hover:text-[#102A43]'
                  }`}
                >
                  2D Şema
                </button>
              </div>

              {topoView === '2d' && (
                <>
                  <div className="flex items-center gap-0.5 rounded-lg bg-[#F5F8FA] p-1 border border-[#D9E2EC]">
                    {(
                      [
                        { id: 'All', label: 'Tümü' },
                        { id: 'Masaüstü', label: 'Masaüstü' },
                        { id: 'Bulut', label: 'Bulut' },
                        { id: 'Mobil', label: 'Mobil' },
                      ] as const
                    ).map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setRoleFilter(role.id)}
                        className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors whitespace-nowrap shrink-0 ${
                          roleFilter === role.id
                            ? 'bg-[#102A43] text-white'
                            : 'text-[#627D98] hover:text-[#102A43]'
                        }`}
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setAnimateFlow((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] px-3 py-1.5 text-xs font-medium text-[#102A43] transition-colors whitespace-nowrap"
                  >
                    {animateFlow ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    <span>{animateFlow ? 'Akışı Durdur' : 'Akışı Oynat'}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {selectedNode ? (
            topoView === '3d' ? (
              <DeviceTopology3D
                nodes={nodes}
                edges={edges}
                selectedNodeId={selectedNode.id}
                onSelectNode={onSelectNode}
              />
            ) : (
              <TopologyCanvas
                nodes={nodes}
                edges={edges}
                selectedNodeId={selectedNode.id}
                onSelectNode={onSelectNode}
                roleFilter={roleFilter}
                animateFlow={animateFlow}
              />
            )
          ) : (
            <EmptyState
              title={uiLabels.noPairedDevices}
              description="Henüz bu merkeze bağlanmış bir cihaz bulunmuyor."
            />
          )}
        </div>

        <div className="bento-tile xl:col-span-4 p-5 flex flex-col justify-between gap-4">
          {!selectedNode ? (
            <EmptyState
              title={uiLabels.noPairedDevices}
              description="Cihaz ayrıntılarını görmek için gerçek bir cihaz eşleştirin veya Deneme Moduna geçin."
            />
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-[#D9E2EC] pb-3.5">
                  <div>
                    <p className="font-mono text-[11px] text-[#627D98]">
                      {selectedNode.role} · {selectedNode.osVersion}
                    </p>
                    <h3 className="font-mono text-base font-semibold text-[#102A43] mt-0.5">
                      {selectedNode.hostname}
                    </h3>
                  </div>
                  <TopologyStatusBadge status={selectedNode.status} />
                </div>

                <dl className="grid grid-cols-2 gap-3.5 text-xs">
                  <div>
                    <dt className="text-[#627D98] mb-0.5">Kamera Davranışı</dt>
                    <dd className="text-[#102A43] leading-snug">{selectedNode.cameraMode}</dd>
                  </div>
                  <div>
                    <dt className="text-[#627D98] mb-0.5">Güç / Bağlantı</dt>
                    <dd className="tabular-mono text-[#102A43]">{selectedNode.batteryOrPower}</dd>
                  </div>
                  <div>
                    <dt className="text-[#627D98] mb-0.5">24s Olay Sayısı</dt>
                    <dd className="tabular-mono font-semibold text-[#2E9B72]">
                      {selectedNode.events24h.toLocaleString('tr-TR')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#627D98] mb-0.5">Senkron Gecikmesi</dt>
                    <dd className="tabular-mono text-[#102A43]">
                      {selectedNode.latencyMs.toFixed(1)} ms
                    </dd>
                  </div>
                </dl>

                <div className="border-t border-[#D9E2EC] pt-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[#627D98]">Ajan İşlemci Yükü</span>
                    <span className="tabular-mono text-[#102A43]">{selectedNode.cpuPercent}%</span>
                  </div>
                  <Sparkline
                    data={selectedNode.cpuHistory}
                    color={selectedNode.status === 'Kilitli' ? '#C94A4A' : '#2E9B72'}
                    height={36}
                  />
                </div>

                <div className="border-t border-[#D9E2EC] pt-3 space-y-1.5 text-xs">
                  <p className="text-[#627D98] font-medium">Temel Teknoloji Yığını</p>
                  <p className="font-mono text-[11px] text-[#2878A8] leading-relaxed">
                    {selectedNode.techStack.join(' · ')}
                  </p>
                </div>

                <div className="border-t border-[#D9E2EC] pt-3 space-y-1.5 text-xs">
                  <p className="text-[#627D98] font-medium">OS Kısıtı & Sertifikasyon Notu</p>
                  <p className="text-[#102A43] leading-relaxed">{selectedNode.osConstraint}</p>
                  <p className="font-mono text-[11px] text-[#D9822B] pt-0.5">
                    {selectedNode.approvalRisk}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 border-t border-[#D9E2EC] pt-4">
                {actionNotice && (
                  <p className="font-mono text-[11px] text-[#2E9B72]">{actionNotice}</p>
                )}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleTestTrigger}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] px-3 py-2 text-xs font-medium text-[#102A43] transition-colors whitespace-nowrap"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Olay Tetikle</span>
                  </button>
                  {selectedNode.platform !== 'cloud' && (
                    <button
                      type="button"
                      onClick={() => onToggleLockNode(selectedNode.id)}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                        selectedNode.status === 'Kilitli'
                          ? 'bg-[#2E9B72] hover:bg-[#24825f] text-white'
                          : 'bg-[#C94A4A] hover:bg-[#b53e3e] text-white'
                      }`}
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>
                        {selectedNode.status === 'Kilitli' ? 'Kilidi Aç' : 'Cihazı Kilitle'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
