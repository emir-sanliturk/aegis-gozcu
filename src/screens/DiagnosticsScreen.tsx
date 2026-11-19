import React, { useState } from 'react';
import { Download, Terminal, Play, CheckCircle2 } from 'lucide-react';
import {
  DeviceCompatibilityEntry,
  DiagnosticCheckItem,
  ThreatIncident,
  VerificationStatus,
} from '../types/telemetry';
import { SCOPE_BOUNDARIES } from '../data/telemetryData';
import { runLiveDiagnostics } from '../utils/eventSchema';
import { canExportData } from '../data/demo-mode';
import type { EventSourceMode } from '../data/real-event-source';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { uiLabels } from '../uiLabels';

interface DiagnosticsScreenProps {
  dataMode: EventSourceMode;
  apiConnected: boolean;
  incidents: ThreatIncident[];
  compatibilityMatrix: DeviceCompatibilityEntry[];
  onUpdateCompatibilityStatus: (id: string, status: VerificationStatus) => void;
  onApplyDiagnosticResult: (
    platform: 'Windows' | 'macOS' | 'Android' | 'iOS',
    evidenceSummary: string,
    verifiedBy: string
  ) => void;
}

const VERIFICATION_OPTIONS: VerificationStatus[] = [
  'Tasarım Varsayımı',
  'Test Bekliyor',
  'Koşullu Doğrulandı',
  'Saha Doğrulandı',
  'Başarısız',
];

export const DiagnosticsScreen: React.FC<DiagnosticsScreenProps> = ({
  dataMode,
  apiConnected,
  incidents,
  compatibilityMatrix,
  onUpdateCompatibilityStatus,
  onApplyDiagnosticResult,
}) => {
  const [matrixPlatformFilter, setMatrixPlatformFilter] = useState<
    'Tümü' | 'Windows' | 'macOS' | 'Android' | 'iOS'
  >('Tümü');
  const [diagPlatform, setDiagPlatform] = useState<'Windows' | 'macOS' | 'Android' | 'iOS'>('Windows');
  const [diagResults, setDiagResults] = useState<DiagnosticCheckItem[] | null>(null);
  const [diagTraceId, setDiagTraceId] = useState<string>('');
  const [diagVerifiedBy, setDiagVerifiedBy] = useState('Saha Test Mühendisi');
  const [diagAppliedNotice, setDiagAppliedNotice] = useState<string | null>(null);
  const [completedPlatforms, setCompletedPlatforms] = useState<Record<string, boolean>>({});
  const [matrixGateNotice, setMatrixGateNotice] = useState<string | null>(null);

  const exportAllowed = canExportData(dataMode);

  const handleRunDiagnostic = () => {
    const trace = `trc-diag-${diagPlatform.toLowerCase()}-${Date.now().toString(36)}`;
    const matrixEntry = compatibilityMatrix.find((m) => m.platform === diagPlatform);
    const liveChecks = runLiveDiagnostics(diagPlatform, incidents, matrixEntry);
    const allCompletedNoFail =
      liveChecks.length === 10 && liveChecks.every((c) => c.status !== 'FAIL');
    setDiagTraceId(trace);
    setDiagResults(liveChecks);
    setCompletedPlatforms((prev) => ({ ...prev, [diagPlatform]: allCompletedNoFail }));
    setDiagAppliedNotice(null);
  };

  const canBindDiagnostic =
    Boolean(diagResults) &&
    diagResults!.length === 10 &&
    diagResults!.every((c) => c.status !== 'FAIL');

  const handleBindDiagnosticToMatrix = () => {
    if (!canBindDiagnostic) {
      setDiagAppliedNotice(
        `${diagPlatform} için 10 aşamanın tamamı FAIL olmadan geçmeden "Saha Doğrulandı" atanamaz.`
      );
      return;
    }
    const summary = `${diagPlatform.toLowerCase()}_diag_${diagTraceId.slice(-6)}.json · 10/10 kontrol çalıştı`;
    onApplyDiagnosticResult(diagPlatform, summary, diagVerifiedBy.trim() || 'Saha Mühendisi');
    setDiagAppliedNotice(`${diagPlatform} satırı saha doğrulama kanıtıyla güncellendi.`);
    setTimeout(() => setDiagAppliedNotice(null), 3500);
  };

  const filteredMatrix = compatibilityMatrix.filter(
    (row) => matrixPlatformFilter === 'Tümü' || row.platform === matrixPlatformFilter
  );

  const verifiedCount = compatibilityMatrix.filter(
    (r) => r.verificationStatus === 'Saha Doğrulandı'
  ).length;

  const handleExportMatrixCsv = () => {
    const headers = [
      'platform',
      'os_build',
      'device_profile',
      'permission_flow',
      'camera_state',
      'notification_state',
      'blocking_capability',
      'failure_mode',
      'tamper_test',
      'evidence',
      'verified_by',
      'last_verified_at',
      'verification_status',
    ];
    const rows = compatibilityMatrix.map((r) =>
      [
        r.platform,
        `"${r.os_build}"`,
        `"${r.device_profile}"`,
        `"${r.permission_flow}"`,
        `"${r.camera_state}"`,
        `"${r.notification_state}"`,
        `"${r.blocking_capability}"`,
        `"${r.failure_mode}"`,
        `"${r.tamper_test}"`,
        `"${r.evidence}"`,
        `"${r.verified_by}"`,
        r.last_verified_at,
        `"${r.verificationStatus}"`,
      ].join(',')
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'aegis-gozcu-diagnostics-matrix.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const getVerificationTextColor = (s: VerificationStatus) => {
    if (s === 'Saha Doğrulandı') return 'text-[#2E9B72]';
    if (s === 'Koşullu Doğrulandı') return 'text-[#2878A8]';
    if (s === 'Başarısız') return 'text-[#C94A4A]';
    if (s === 'Test Bekliyor') return 'text-[#D9822B]';
    return 'text-[#627D98]';
  };

  return (
    <div className="space-y-4">
      <PageHeader
        section="Tanılama"
        title={uiLabels.diagnostics}
        description="Tanılama ve bağlantı ayrıntıları: depolama, şema bütünlüğü, platform izinleri ve teknik sınırlar."
      />

      <section aria-label="Bağlantı ve sistem durumu" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bento-tile p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xs font-semibold text-[#102A43]">API bağlantısı</h2>
            <p className="text-[11px] text-[#627D98] mt-0.5">
              {apiConnected
                ? "Gerçek veri API'si yanıt veriyor."
                : uiLabels.awaitingConnection}
            </p>
          </div>
          <span
            className={`font-mono text-xs font-semibold shrink-0 ${
              apiConnected ? 'text-[#2E9B72]' : 'text-[#627D98]'
            }`}
          >
            {apiConnected ? uiLabels.ready : uiLabels.noData}
          </span>
        </div>

        <div className="bento-tile p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xs font-semibold text-[#102A43]">Veri modu</h2>
            <p className="text-[11px] text-[#627D98] mt-0.5">Bu ekran sahte veri üretmez.</p>
          </div>
          <span className="font-mono text-xs font-semibold text-[#2E9B72] shrink-0">
            {dataMode === 'real' ? uiLabels.realData : uiLabels.demoMode}
          </span>
        </div>

        <div className="bento-tile p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xs font-semibold text-[#102A43]">Kullanıcı kontrolü</h2>
            <p className="text-[11px] text-[#627D98] mt-0.5">Uzaktan işlemler açık onay gerektirir.</p>
          </div>
          <span className="font-mono text-xs font-semibold text-[#2E9B72] shrink-0">
            Etkin
          </span>
        </div>
      </section>

      <div className="bento-tile p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[#2E9B72]" />
              <h2 className="text-[15px] font-semibold text-[#102A43]">
                Sistem Durumu Verileri & Tanılama Paketi
              </h2>
            </div>
            <p className="text-xs text-[#627D98] mt-0.5">
              10 maddelik saha kontrolünü çalıştırıp OWASP v1.0.0 şemalı çıktıyı uyumluluk matrisine bağlayın
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Tanılama platformu seç"
              value={diagPlatform}
              onChange={(e) => {
                setDiagPlatform(e.target.value as 'Windows' | 'macOS' | 'Android' | 'iOS');
                setDiagResults(null);
              }}
              className="input-cyber rounded-lg px-3 py-1.5 font-mono text-xs text-[#102A43]"
            >
              <option value="Windows">Windows 11</option>
              <option value="macOS">macOS Sequoia</option>
              <option value="Android">Android 15</option>
              <option value="iOS">iOS 18</option>
            </select>

            <input
              type="text"
              value={diagVerifiedBy}
              onChange={(e) => setDiagVerifiedBy(e.target.value)}
              placeholder="Test eden kişi"
              aria-label="Test eden kişi"
              className="input-cyber rounded-lg px-3 py-1.5 text-xs text-[#102A43] w-40"
            />

            <button
              type="button"
              onClick={handleRunDiagnostic}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#102A43] hover:bg-[#163B5C] text-white font-semibold text-xs px-3.5 py-2 transition-colors whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5 text-[#6ED6C1]" />
              <span>{uiLabels.requestDiagnostics}</span>
            </button>
          </div>
        </div>

        {diagResults ? (
          <div className="border-t border-[#D9E2EC] pt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-mono text-[#2878A8]">
                trace_id: {diagTraceId} · schema_version: 1.0.0
              </span>
              <button
                type="button"
                onClick={handleBindDiagnosticToMatrix}
                disabled={!canBindDiagnostic}
                className={`inline-flex items-center gap-1.5 rounded-lg font-semibold text-xs px-3 py-1.5 transition-colors whitespace-nowrap ${
                  canBindDiagnostic
                    ? 'bg-[#2E9B72] hover:bg-[#24825f] text-white'
                    : 'bg-[#EAF0F4] text-[#627D98] cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  {canBindDiagnostic
                    ? 'Sonucu Matrise Bağla (Saha Doğrulandı)'
                    : '10/10 Geçmeden Saha Doğrulandı Kilitli'}
                </span>
              </button>
            </div>

            {diagAppliedNotice && (
              <p className="font-mono text-xs text-[#2E9B72]">{diagAppliedNotice}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {diagResults.map((item) => {
                const badgeColor =
                  item.status === 'PASS'
                    ? 'text-[#2E9B72]'
                    : item.status === 'FAIL'
                      ? 'text-[#C94A4A]'
                      : item.status === 'WARN'
                        ? 'text-[#D9822B]'
                        : 'text-[#2878A8]';
                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-[#D9E2EC] bg-[#F5F8FA] px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#102A43]">{item.label}</p>
                      <p className="text-[11px] text-[#627D98] mt-0.5">{item.detail}</p>
                    </div>
                    <span className={`font-mono text-[11px] font-semibold shrink-0 ${badgeColor}`}>
                      {item.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState
            title={uiLabels.noDiagnostics}
            description="Platform seçip Tanılama iste düğmesine bastığınızda sistem durumu verileri burada listelenir."
          />
        )}
      </div>

      <div className="bento-tile p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#102A43]">
              Cihaz Uyumluluk & Saha Doğrulama Matrisi
            </h2>
            <p className="text-xs text-[#627D98] mt-0.5">
              os_build · device_profile · permission_flow · camera_state · notification_state · failure_mode · tamper_test · evidence
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular-mono text-xs text-[#627D98] mr-1">
              {verifiedCount}/{compatibilityMatrix.length} Saha Doğrulandı
            </span>
            <div className="flex items-center gap-0.5 rounded-lg bg-[#F5F8FA] p-1 border border-[#D9E2EC]">
              {(['Tümü', 'Windows', 'macOS', 'Android', 'iOS'] as const).map((plat) => (
                <button
                  key={plat}
                  type="button"
                  onClick={() => setMatrixPlatformFilter(plat)}
                  className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition-colors whitespace-nowrap shrink-0 ${
                    matrixPlatformFilter === plat
                      ? 'bg-[#102A43] text-white'
                      : 'text-[#627D98] hover:text-[#102A43]'
                  }`}
                >
                  {plat}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!exportAllowed}
              onClick={handleExportMatrixCsv}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                exportAllowed
                  ? 'border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] text-[#102A43]'
                  : 'border-[#D9E2EC] bg-[#F5F8FA]/60 text-[#627D98] cursor-not-allowed'
              }`}
            >
              <Download className="h-3.5 w-3.5 text-[#627D98]" />
              <span>{exportAllowed ? 'Matris CSV' : 'Deneme Modu: CSV Kapalı'}</span>
            </button>
          </div>
        </div>

        {matrixGateNotice && (
          <p className="font-mono text-xs text-[#D9822B]">{matrixGateNotice}</p>
        )}

        <div className="overflow-x-auto">
          {filteredMatrix.length === 0 ? (
            <EmptyState
              title={uiLabels.noDiagnostics}
              description="Gerçek Veri modunda kendi test cihazınız eşleştirilip tanılama çalıştırılana kadar saha matrisi boş kalır."
            />
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D9E2EC] font-mono text-[11px] text-[#627D98]">
                  <th className="py-2.5 pr-4 font-medium">os_build · device_profile</th>
                  <th className="py-2.5 pr-4 font-medium">permission_flow · camera_state</th>
                  <th className="py-2.5 pr-4 font-medium">notification_state · blocking</th>
                  <th className="py-2.5 pr-4 font-medium">failure_mode · tamper_test</th>
                  <th className="py-2.5 pr-4 font-medium">evidence · verified_by</th>
                  <th className="py-2.5 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9E2EC] text-xs align-top">
                {filteredMatrix.map((row) => (
                  <tr key={row.id} className="hover:bg-[#F5F8FA] transition-colors">
                    <td className="py-3 pr-4 min-w-[180px]">
                      <span className="font-semibold text-[#102A43] block">{row.os_build}</span>
                      <span className="font-mono text-[11px] text-[#627D98] block mt-0.5">
                        {row.device_profile}
                      </span>
                    </td>
                    <td className="py-3 pr-4 min-w-[220px]">
                      <span className="text-[#102A43] block">{row.permission_flow}</span>
                      <span className="text-[#627D98] block mt-1">{row.camera_state}</span>
                    </td>
                    <td className="py-3 pr-4 min-w-[210px]">
                      <span className="text-[#102A43] block">{row.notification_state}</span>
                      <span className="text-[#627D98] block mt-1">{row.blocking_capability}</span>
                    </td>
                    <td className="py-3 pr-4 min-w-[190px]">
                      <span className="text-[#D9822B] block">{row.failure_mode}</span>
                      <span className="font-mono text-[11px] text-[#2878A8] block mt-1">
                        tamper_test: {row.tamper_test}
                      </span>
                    </td>
                    <td className="py-3 pr-4 min-w-[180px] font-mono text-[11px]">
                      <span className="text-[#102A43] block">{row.evidence}</span>
                      <span className="text-[#627D98] block mt-1">
                        {row.verified_by} · {row.last_verified_at.slice(0, 10)}
                      </span>
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      <select
                        aria-label={`${row.platform} saha doğrulama durumu`}
                        value={row.verificationStatus}
                        onChange={(e) => {
                          const nextVal = e.target.value as VerificationStatus;
                          if (nextVal === 'Saha Doğrulandı' && !completedPlatforms[row.platform]) {
                            setMatrixGateNotice(
                              `${row.platform} için önce tanılama paketinde 10 aşamalı doğrulama tamamlanmalıdır.`
                            );
                            setTimeout(() => setMatrixGateNotice(null), 3500);
                            return;
                          }
                          onUpdateCompatibilityStatus(row.id, nextVal);
                        }}
                        className={`input-cyber rounded-md px-2 py-1 font-mono text-[11px] font-medium ${getVerificationTextColor(
                          row.verificationStatus
                        )}`}
                      >
                        {VERIFICATION_OPTIONS.map((opt) => (
                          <option key={opt} value={opt} className="bg-white text-[#102A43]">
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bento-tile p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#102A43]">
              Gerçekçi Kapsam & Teknik Sınırlar
            </h2>
            <p className="text-xs text-[#627D98] mt-0.5">
              Gizli kayıt yerine şeffaf, işletim sistemi onaylı veri sınırları
            </p>
          </div>
          <span className="font-mono text-xs text-[#2E9B72] font-medium">Store & TCC Uyumlu</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#D9E2EC] font-mono text-[11px] text-[#627D98]">
                <th className="py-2.5 pr-4 font-medium">Özellik Alanı</th>
                <th className="py-2.5 pr-4 font-medium">Gerçekçi Karşılığı</th>
                <th className="py-2.5 font-medium">Teknik & Gizlilik Sınırı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9E2EC] text-xs">
              {SCOPE_BOUNDARIES.map((item) => (
                <tr key={item.feature} className="hover:bg-[#F5F8FA] transition-colors">
                  <td className="py-3 pr-4 font-semibold text-[#102A43] whitespace-nowrap">
                    {item.feature}
                  </td>
                  <td className="py-3 pr-4 text-[#102A43]">{item.realisticEquivalent}</td>
                  <td className="py-3 text-[#627D98]">{item.boundary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
