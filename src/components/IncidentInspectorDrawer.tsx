import React, { useState } from 'react';
import { X, Copy, Check, Lock, CheckCircle2, Eye, Share2, Trash2 } from 'lucide-react';
import { IncidentStatus, ThreatIncident } from '../types/telemetry';
import type { EventSourceMode } from '../data/real-event-source';
import { canExportData } from '../data/demo-mode';
import { uiLabels } from '../uiLabels';

interface IncidentInspectorDrawerProps {
  dataMode: EventSourceMode;
  incident: ThreatIncident | null;
  onClose: () => void;
  onUpdateStatus: (incidentId: string, status: IncidentStatus) => void;
  onToggleEphemeralShare: (incidentId: string) => void;
  onPurgeEvidence: (incidentId: string) => void;
}

export const IncidentInspectorDrawer: React.FC<IncidentInspectorDrawerProps> = ({
  dataMode,
  incident,
  onClose,
  onUpdateStatus,
  onToggleEphemeralShare,
  onPurgeEvidence,
}) => {
  const [copied, setCopied] = useState(false);
  const exportAllowed = canExportData(dataMode);

  if (!incident) return null;

  const canonicalPayload = {
    schema_version: incident.schema_version,
    event_id: incident.event_id,
    trace_id: incident.trace_id,
    correlation_id: incident.correlation_id,
    device_id: incident.device_id,
    timestamp: incident.timestamp,
    severity: incident.severity,
    source: incident.source,
    decision: incident.decision,
    confidence: incident.confidence,
    decision_threshold: incident.decision_threshold,
    evidence_hash: incident.evidence_hash,
    prev_event_hash: incident.prev_event_hash,
    policy_version: incident.policy_version,
    policy_signature: incident.policy_signature,
    retention_until: incident.retention_until,
    ephemeral_share: incident.ephemeralShare,
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(canonicalPayload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const severityColor =
    incident.uiSeverity === 'critical'
      ? 'text-[#C94A4A]'
      : incident.uiSeverity === 'warning'
        ? 'text-[#D9822B]'
        : 'text-[#2E9B72]';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-[#071A2B]/55 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="relative z-10 w-full max-w-2xl h-full bento-tier-2 border-y-0 border-r-0 overflow-y-auto p-6 flex flex-col justify-between gap-6"
        aria-label={`${incident.id} şifreli kanıt ayrıntıları`}
      >
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-[#D9E2EC] pb-4">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[#627D98]">
                <span>{incident.id}</span>
                <span aria-hidden="true">·</span>
                <span className={severityColor}>{incident.severity}</span>
                <span aria-hidden="true">·</span>
                <span>{incident.decision}</span>
                <span aria-hidden="true">·</span>
                <span>{incident.status}</span>
              </div>
              <h2 className="text-lg font-semibold text-[#102A43] leading-snug">
                {incident.vector}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#627D98] hover:bg-[#F5F8FA] hover:text-[#102A43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2878A8]"
              aria-label={uiLabels.close}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-xl border border-[#D9E2EC] bg-[#F5F8FA] p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
              <span className="text-[#2878A8] font-medium">
                OWASP Olay Şeması (schema_version: {incident.schema_version})
              </span>
              <span className="text-[#627D98]">
                {incident.policy_version}
              </span>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[11px] font-mono">
              <div>
                <dt className="text-[#627D98]">event_id (UUIDv7)</dt>
                <dd className="text-[#102A43] break-all">{incident.event_id}</dd>
              </div>
              <div>
                <dt className="text-[#627D98]">device_id (Şifreli Kimlik)</dt>
                <dd className="text-[#102A43]">{incident.device_id}</dd>
              </div>
              <div>
                <dt className="text-[#627D98]">trace_id</dt>
                <dd className="text-[#627D98] break-all">{incident.trace_id}</dd>
              </div>
              <div>
                <dt className="text-[#627D98]">correlation_id</dt>
                <dd className="text-[#2878A8] break-all">{incident.correlation_id}</dd>
              </div>
              <div>
                <dt className="text-[#627D98]">source · decision</dt>
                <dd className="text-[#102A43]">
                  {incident.source} · {incident.decision}
                </dd>
              </div>
              <div>
                <dt className="text-[#627D98]">confidence / threshold</dt>
                <dd className="text-[#2E9B72] font-semibold">
                  {incident.confidence.toFixed(2)} / {incident.decision_threshold.toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-[#627D98]">timestamp (UTC ISO-8601)</dt>
                <dd className="text-[#627D98]">{incident.timestamp}</dd>
              </div>
              <div>
                <dt className="text-[#627D98]">retention_until</dt>
                <dd className="text-[#D9822B]">{incident.retention_until}</dd>
              </div>
            </dl>
          </div>

          {incident.isTamper && incident.tamperLifecycle && (
            <div className="rounded-xl border border-[#C94A4A]/35 bg-[#C94A4A]/5 p-4 space-y-2.5">
              <p className="font-mono text-[11px] font-semibold text-[#C94A4A]">
                Kurcalama Algılandı Yaşam Döngüsü (Tespit · Kanıt · Tepki · Dayanıklılık)
              </p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="font-mono text-[10.5px] text-[#627D98]">1. Tespit</dt>
                  <dd className="text-[#102A43] mt-0.5 leading-relaxed">
                    {incident.tamperLifecycle.detection}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10.5px] text-[#627D98]">2. Kanıt</dt>
                  <dd className="text-[#102A43] mt-0.5 leading-relaxed">
                    {incident.tamperLifecycle.evidence}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10.5px] text-[#627D98]">3. Tepki</dt>
                  <dd className="text-[#102A43] mt-0.5 leading-relaxed">
                    {incident.tamperLifecycle.response}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10.5px] text-[#627D98]">4. Dayanıklılık</dt>
                  <dd className="text-[#102A43] mt-0.5 leading-relaxed">
                    {incident.tamperLifecycle.resilience}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <div className="border-t border-[#D9E2EC] pt-4 space-y-2.5">
            <div>
              <p className="text-xs text-[#627D98] mb-1">
                evidence_hash (SHA-256 · Ham Görüntü Cihazda Kalır)
              </p>
              <p className="font-mono text-[11px] text-[#102A43] break-all bg-[#F5F8FA] border border-[#D9E2EC] rounded-lg px-3 py-1.5">
                {incident.evidence_hash}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#627D98] mb-1">
                prev_event_hash (Append-Only Bütünlük Zinciri)
              </p>
              <p className="font-mono text-[11px] text-[#627D98] break-all bg-[#F5F8FA] border border-[#D9E2EC] rounded-lg px-3 py-1.5">
                {incident.prev_event_hash}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#D9E2EC] bg-[#F5F8FA] p-3.5 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-[#102A43]">
                  Güvenli Paylaşım (Anahtar Cihaz Sahibinde Üretilir)
                </p>
                <p className="font-mono text-[11px] text-[#627D98] mt-0.5">
                  share_id: {incident.ephemeralShare.share_id} · alıcı: {incident.ephemeralShare.recipient_device_id} · erişim: {incident.ephemeralShare.access_count}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleEphemeralShare(incident.id)}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                    incident.ephemeralShare.active
                      ? 'border border-[#D9822B]/45 bg-[#D9822B]/12 text-[#D9822B]'
                      : 'border border-[#2878A8]/40 bg-[#2878A8]/10 text-[#2878A8]'
                  }`}
                >
                  <Share2 className="h-3 w-3" />
                  <span>{incident.ephemeralShare.active ? 'Paylaşımı İptal Et' : '15 dk E2E Aç'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPurgeEvidence(incident.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-[#C94A4A]/40 bg-[#C94A4A]/10 hover:bg-[#C94A4A]/18 px-2.5 py-1.5 text-[11px] font-medium text-[#C94A4A] transition-colors whitespace-nowrap"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Tam Sil (Yerel + Bulut)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-[#D9E2EC] pt-2 font-mono text-[10.5px] text-[#627D98]">
              <span>
                Durum: {incident.ephemeralShare.active ? 'Aktif (Sunucu çözemez)' : uiLabels.revoked}
              </span>
              <span>
                expires_at: {incident.ephemeralShare.expires_at ? incident.ephemeralShare.expires_at.slice(11, 19) + 'Z' : '—'}
              </span>
              <span>
                revoked_at: {incident.ephemeralShare.revoked_at ? incident.ephemeralShare.revoked_at.slice(11, 19) + 'Z' : '—'}
              </span>
            </div>
            <p className="text-[11px] text-[#627D98]">
              Silme kapsamı: yerel kopya, bulut meta verisi ve aktif paylaşım bağlantısı anında geçersiz kılınır; CDN önbelleği kullanılmaz.
            </p>
          </div>

          <div>
            <p className="text-xs text-[#627D98] mb-1.5">Sanitize Edilmiş Telemetri Özeti</p>
            <pre className="font-mono text-[11.5px] leading-relaxed text-[#102A43] whitespace-pre-wrap break-all bg-[#F5F8FA] border border-[#D9E2EC] rounded-lg p-3">
              {incident.payloadExcerpt}
            </pre>
          </div>

          <div className="border-t border-[#D9E2EC] pt-4">
            <p className="text-xs font-semibold text-[#102A43] mb-3">Olay Zaman Çizelgesi</p>
            <ol className="space-y-2.5">
              {incident.timeline.map((entry, idx) => (
                <li key={idx} className="flex items-start gap-3 text-xs">
                  <span className="tabular-mono text-[11px] text-[#627D98] shrink-0 pt-0.5">
                    {entry.time}
                  </span>
                  <span className="text-[#102A43] leading-relaxed">{entry.event}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="border-t border-[#D9E2EC] pt-4 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            disabled={!exportAllowed}
            onClick={handleCopyJson}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              exportAllowed
                ? 'border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] text-[#102A43]'
                : 'border-[#D9E2EC] bg-[#F5F8FA]/60 text-[#627D98] cursor-not-allowed'
            }`}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[#2E9B72]" /> : <Copy className="h-3.5 w-3.5" />}
            <span>
              {!exportAllowed
                ? 'Deneme Modunda Dışa Aktarım Kapalı'
                : copied
                  ? 'v1.0.0 JSON Kopyalandı'
                  : 'v1.0.0 Şema JSON'}
            </span>
          </button>

          <div className="flex items-center gap-2">
            {incident.status !== 'Cihaz Kilitli' && incident.status !== 'Çözüldü' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(incident.id, 'Cihaz Kilitli')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#C94A4A] hover:bg-[#b53e3e] text-white font-semibold px-3.5 py-2 text-xs transition-colors whitespace-nowrap"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Cihazı Kilitle</span>
              </button>
            )}
            {incident.status === 'Aktif' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(incident.id, 'İnceleniyor')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] px-3.5 py-2 text-xs font-medium text-[#102A43] transition-colors whitespace-nowrap"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>İncele</span>
              </button>
            )}
            {incident.status !== 'Çözüldü' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(incident.id, 'Çözüldü')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E9B72] hover:bg-[#24825f] text-white font-semibold px-3.5 py-2 text-xs transition-colors whitespace-nowrap"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Çözüldü İşaretle</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};
