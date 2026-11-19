import React, { useMemo, useState } from 'react';
import { Search, ArrowUpDown, Download, ShieldAlert } from 'lucide-react';
import { IncidentStatus, ThreatIncident } from '../types/telemetry';
import { verifyEventChain } from '../utils/eventSchema';
import type { EventSourceMode } from '../data/real-event-source';
import { canExportData } from '../data/demo-mode';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { uiLabels } from '../uiLabels';

interface IncidentsScreenProps {
  dataMode: EventSourceMode;
  incidents: ThreatIncident[];
  onInspectIncident: (incident: ThreatIncident) => void;
  onUpdateStatus: (incidentId: string, status: IncidentStatus) => void;
  onSimulateTamper: (platform: 'windows' | 'macos' | 'android') => void;
  onSimulateChainBreak: () => void;
}

export const IncidentsScreen: React.FC<IncidentsScreenProps> = ({
  dataMode,
  incidents,
  onInspectIncident,
  onUpdateStatus,
  onSimulateTamper,
  onSimulateChainBreak,
}) => {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<
    'all' | 'critical' | 'warning' | 'tamper' | 'resolved'
  >('all');
  const [sortBy, setSortBy] = useState<'recent' | 'liveness'>('recent');
  const chainStatus = useMemo(() => verifyEventChain(incidents), [incidents]);
  const exportAllowed = canExportData(dataMode);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = incidents.filter((inc) => {
      if (filterMode === 'tamper' && !inc.isTamper) return false;
      if (filterMode === 'critical' && inc.uiSeverity !== 'critical') return false;
      if (filterMode === 'warning' && inc.uiSeverity !== 'warning') return false;
      if (filterMode === 'resolved' && inc.uiSeverity !== 'resolved') return false;
      if (!q) return true;
      return (
        inc.id.toLowerCase().includes(q) ||
        inc.event_id.toLowerCase().includes(q) ||
        inc.trace_id.toLowerCase().includes(q) ||
        inc.correlation_id.toLowerCase().includes(q) ||
        inc.vector.toLowerCase().includes(q) ||
        inc.source.toLowerCase().includes(q) ||
        inc.targetHostname.toLowerCase().includes(q) ||
        inc.evidence_hash.toLowerCase().includes(q)
      );
    });

    if (sortBy === 'liveness') {
      return [...list].sort((a, b) => a.livenessScore - b.livenessScore);
    }
    return list;
  }, [incidents, search, filterMode, sortBy]);

  const handleExportCsv = () => {
    const headers = [
      'schema_version',
      'event_id',
      'trace_id',
      'correlation_id',
      'device_id',
      'timestamp',
      'severity',
      'source',
      'decision',
      'confidence',
      'decision_threshold',
      'evidence_hash',
      'prev_event_hash',
      'policy_version',
      'policy_signature',
      'retention_until',
    ];
    const rows = filtered.map((i) =>
      [
        i.schema_version,
        i.event_id,
        i.trace_id,
        i.correlation_id,
        i.device_id,
        i.timestamp,
        i.severity,
        i.source,
        i.decision,
        i.confidence,
        i.decision_threshold,
        i.evidence_hash,
        i.prev_event_hash,
        i.policy_version,
        i.policy_signature,
        i.retention_until,
      ].join(',')
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'aegis-gozcu-events-v1.0.0.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        section="Olaylar"
        title={uiLabels.incidents}
        description="Doğrulanmış olayların zaman sıralı görünümü, hash zinciri doğrulaması ve şifreli kanıt inceleme."
      />

      <div className="bento-tile p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[240px]">
          <div className="input-cyber flex items-center gap-2 rounded-lg px-3 py-2 w-full sm:w-72">
            <Search className="h-3.5 w-3.5 text-[#627D98] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="event_id, trace_id, correlation_id, source..."
              className="w-full bg-transparent text-xs text-[#102A43] placeholder:text-[#627D98] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-0.5 rounded-lg bg-[#F5F8FA] p-1 border border-[#D9E2EC]">
            {(
              [
                { id: 'all', label: 'Tümü' },
                { id: 'critical', label: 'Kritik' },
                { id: 'warning', label: 'Uyarı' },
                { id: 'tamper', label: 'Kurcalama' },
                { id: 'resolved', label: 'Çözüldü' },
              ] as const
            ).map((sev) => (
              <button
                key={sev.id}
                type="button"
                onClick={() => setFilterMode(sev.id)}
                className={`px-3 py-1 rounded-md font-mono text-[11px] transition-colors whitespace-nowrap shrink-0 ${
                  filterMode === sev.id
                    ? 'bg-[#102A43] text-white'
                    : 'text-[#627D98] hover:text-[#102A43]'
                }`}
              >
                {sev.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSortBy((s) => (s === 'recent' ? 'liveness' : 'recent'))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] px-3 py-2 text-xs font-medium text-[#102A43] transition-colors whitespace-nowrap"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-[#627D98]" />
            <span>Sırala: {sortBy === 'recent' ? 'En Yeni' : 'En Düşük Canlılık'}</span>
          </button>

          <button
            type="button"
            disabled={!exportAllowed}
            onClick={handleExportCsv}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              exportAllowed
                ? 'border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] text-[#102A43]'
                : 'border-[#D9E2EC] bg-[#F5F8FA]/60 text-[#627D98] cursor-not-allowed'
            }`}
          >
            <Download className="h-3.5 w-3.5 text-[#627D98]" />
            <span>
              {exportAllowed ? 'v1.0.0 Şema CSV' : 'Deneme Modu: CSV Kapalı'}
            </span>
          </button>
        </div>
      </div>

      <div className="bento-tile p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldAlert
            className={`h-4 w-4 shrink-0 ${
              chainStatus.valid ? 'text-[#D9822B]' : 'text-[#C94A4A]'
            }`}
          />
          <div className="text-xs text-[#102A43]">
            <p>
              <span className="font-semibold">Kurcalama Simülasyonu (Tespit · Kanıt · Tepki · Dayanıklılık):</span>{' '}
              <span className="text-[#627D98]">
                Arayüz simülasyonları yalnızca Deneme Modunda çalışır; saha doğrulaması Sistem Durumu bölümünde izlenir.
              </span>
            </p>
            <p className="font-mono text-[11px] mt-1">
              <span className={chainStatus.valid ? 'text-[#2E9B72]' : 'text-[#C94A4A]'}>
                {chainStatus.valid
                  ? `prev_event_hash Zinciri Sağlam (${chainStatus.checkedCount} olay)`
                  : `Zincir Kopması (Kurcalama algılandı): ${chainStatus.brokenEventIds.join(', ')}`}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={dataMode === 'real'}
            onClick={() => onSimulateTamper('windows')}
            className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors whitespace-nowrap ${
              dataMode === 'real'
                ? 'border-[#D9E2EC] bg-[#F5F8FA] text-[#627D98] cursor-not-allowed'
                : 'border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] text-[#102A43]'
            }`}
          >
            + Windows WFP Bloklama
          </button>
          <button
            type="button"
            disabled={dataMode === 'real'}
            onClick={() => onSimulateTamper('macos')}
            className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors whitespace-nowrap ${
              dataMode === 'real'
                ? 'border-[#D9E2EC] bg-[#F5F8FA] text-[#627D98] cursor-not-allowed'
                : 'border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] text-[#102A43]'
            }`}
          >
            + macOS ES Devre Dışı
          </button>
          <button
            type="button"
            disabled={dataMode === 'real'}
            onClick={() => onSimulateTamper('android')}
            className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors whitespace-nowrap ${
              dataMode === 'real'
                ? 'border-[#D9E2EC] bg-[#F5F8FA] text-[#627D98] cursor-not-allowed'
                : 'border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] text-[#102A43]'
            }`}
          >
            + Android Nöbet Kill
          </button>
          <button
            type="button"
            disabled={dataMode === 'real'}
            onClick={onSimulateChainBreak}
            className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors whitespace-nowrap ${
              dataMode === 'real'
                ? 'border-[#D9E2EC] bg-[#F5F8FA] text-[#627D98] cursor-not-allowed'
                : 'border-[#C94A4A]/40 bg-[#C94A4A]/10 hover:bg-[#C94A4A]/18 text-[#C94A4A]'
            }`}
          >
            + Zincir Kopması Testi
          </button>
        </div>
      </div>

      <div className="bento-tile p-5">
        {filtered.length === 0 ? (
          <EmptyState
            title={dataMode === 'real' ? uiLabels.noRealEvents : 'Eşleşen olay kaydı yok'}
            description={
              dataMode === 'real'
                ? 'Henüz alınmış doğrulanmış bir güvenlik olayı bulunmuyor.'
                : 'Diğer cihaz ve tetikleyici kayıtlarını görmek için arama filtresini temizleyin.'
            }
            action={
              dataMode === 'demo' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setFilterMode('all');
                  }}
                  className="rounded-lg border border-[#D9E2EC] bg-[#F5F8FA] px-3.5 py-2 text-xs font-medium text-[#102A43] hover:bg-[#EAF0F4] transition-colors"
                >
                  Filtreleri Sıfırla
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D9E2EC] font-mono text-[11px] text-[#627D98]">
                  <th className="py-2.5 pr-4 font-medium">event_id · trace</th>
                  <th className="py-2.5 pr-4 font-medium">Olay · source · correlation_id</th>
                  <th className="py-2.5 pr-4 font-medium">device_id</th>
                  <th className="py-2.5 pr-4 font-medium">decision · confidence</th>
                  <th className="py-2.5 pr-4 font-medium">policy · retention</th>
                  <th className="py-2.5 pr-4 font-medium">Durum</th>
                  <th className="py-2.5 font-medium text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E2EC] text-xs">
                {filtered.map((inc) => {
                  const statusText =
                    inc.status === 'Aktif'
                      ? 'text-[#C94A4A]'
                      : inc.status === 'İnceleniyor'
                        ? 'text-[#2878A8]'
                        : inc.status === 'Cihaz Kilitli'
                          ? 'text-[#D9822B]'
                          : 'text-[#2E9B72]';

                  return (
                    <tr
                      key={inc.id}
                      onClick={() => onInspectIncident(inc)}
                      className="cursor-pointer hover:bg-[#F5F8FA] transition-colors"
                    >
                      <td className="py-3 pr-4 font-mono text-[#627D98] whitespace-nowrap">
                        {inc.event_id.slice(0, 18)}…
                        <span className="block text-[10.5px] text-[#627D98]">
                          {inc.relativeTime} · v{inc.schema_version}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-semibold text-[#102A43] block">
                          {inc.vector}
                        </span>
                        <span className="font-mono text-[10.5px] text-[#627D98]">
                          {inc.source} · {inc.correlation_id}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-mono text-[#2878A8] whitespace-nowrap">
                        {inc.device_id}
                        <span className="block text-[10.5px] text-[#627D98]">
                          {inc.targetHostname}
                        </span>
                      </td>
                      <td className="py-3 pr-4 tabular-mono whitespace-nowrap">
                        <span
                          className={
                            inc.decision === 'tamper_detected' || inc.decision === 'flagged'
                              ? 'text-[#C94A4A] font-medium'
                              : inc.decision === 'uncertain'
                                ? 'text-[#D9822B] font-medium'
                                : 'text-[#2E9B72] font-medium'
                          }
                        >
                          {inc.decision}
                        </span>
                        <span className="block text-[10.5px] text-[#627D98]">
                          conf {inc.confidence.toFixed(2)} (eşik {inc.decision_threshold.toFixed(2)})
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-mono text-[11px] text-[#627D98] whitespace-nowrap">
                        {inc.policy_version}
                        <span className="block text-[10.5px] text-[#627D98]">
                          {inc.retention_until.slice(0, 10)}
                        </span>
                      </td>
                      <td className={`py-3 pr-4 font-mono font-medium whitespace-nowrap ${statusText}`}>
                        {inc.status}
                      </td>
                      <td
                        className="py-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onInspectIncident(inc)}
                            className="rounded-md border border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] px-2.5 py-1 text-[11px] font-medium text-[#102A43] transition-colors"
                          >
                            {uiLabels.viewDetails}
                          </button>
                          {inc.status !== 'Çözüldü' && (
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(inc.id, 'Çözüldü')}
                              className="rounded-md border border-[#2E9B72]/35 bg-[#2E9B72]/10 hover:bg-[#2E9B72]/20 px-2.5 py-1 text-[11px] font-medium text-[#2E9B72] transition-colors"
                            >
                              Çöz
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
