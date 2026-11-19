import React, { useState } from 'react';
import { Bell, Power, ShieldCheck, Smartphone } from 'lucide-react';
import { BiometricDatasetResult, ClusterNode } from '../types/telemetry';
import { BIOMETRIC_DATASET_SUITES } from '../data/telemetryData';
import { Sparkline } from '../components/charts/Sparkline';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { uiLabels } from '../uiLabels';
import type { EventSourceMode } from '../data/real-event-source';

interface NodesScreenProps {
  dataMode: EventSourceMode;
  nodes: ClusterNode[];
  dutyModeActive: boolean;
  onToggleDutyMode: () => void;
  onToggleLockNode: (nodeId: string) => void;
}

export const NodesScreen: React.FC<NodesScreenProps> = ({
  dataMode,
  nodes,
  dutyModeActive,
  onToggleDutyMode,
  onToggleLockNode,
}) => {
  const [highRiskThreshold, setHighRiskThreshold] = useState(55);
  const [infoThreshold, setInfoThreshold] = useState(74);
  const [triggers, setTriggers] = useState({
    screenOn: true,
    unlock: true,
    motion: true,
    appSwitch: false,
  });
  const [datasets, setDatasets] = useState<BiometricDatasetResult[]>(BIOMETRIC_DATASET_SUITES);
  const [calibrationNote, setCalibrationNote] = useState<string | null>(null);

  const androidNode = nodes.find((n) => n.platform === 'android') ?? null;
  const iosNode = nodes.find((n) => n.platform === 'ios') ?? null;

  const estimatedFar = Math.max(0.2, ((100 - infoThreshold) * 0.08).toFixed(1) as unknown as number);
  const estimatedFrr = Math.max(0.8, ((infoThreshold - 55) * 0.14).toFixed(1) as unknown as number);
  const eerValue = (((Number(estimatedFar) + Number(estimatedFrr)) / 2) * 0.85).toFixed(1);

  const handleSaveCalibration = () => {
    setCalibrationNote(
      `Tasarım simülasyonu uygulandı: Canlılık >= %${highRiskThreshold}, Benzerlik >= %${infoThreshold}`
    );
    setTimeout(() => setCalibrationNote(null), 3200);
  };

  const cycleDatasetStatus = (id: string) => {
    const order: BiometricDatasetResult['calibrationStatus'][] = [
      'Saha Veri Seti Bekliyor',
      'Ön Kalibrasyon',
      'Doğrulandı',
    ];
    setDatasets((prev) =>
      prev.map((ds) => {
        if (ds.id !== id) return ds;
        const idx = order.indexOf(ds.calibrationStatus);
        return { ...ds, calibrationStatus: order[(idx + 1) % order.length] };
      })
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        section="Cihazlar"
        title={uiLabels.devices}
        description="Aegis Gözcü ile eşleştirilmiş cihazların durumu, Android Nöbet Modu ve yerel biyometrik eşik ayarları."
      />

      {/* Row 1: Android Duty Mode + iOS Foreground Command */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="bento-tile xl:col-span-7 p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] text-[#627D98]">
                Android 14/15/16 · FOREGROUND_SERVICE_CAMERA
              </div>
              <h2 className="text-[15px] font-semibold text-[#102A43] mt-0.5">
                Android Nöbet Modu Kontrolü
              </h2>
              <p className="text-xs text-[#627D98] mt-0.5">
                7/24 gizli video değil; kullanıcı tarafından açıkça başlatılan, görünür bildirimli ve olay tetiklemeli koruma
              </p>
            </div>

            <button
              type="button"
              onClick={onToggleDutyMode}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                dutyModeActive
                  ? 'bg-[#C94A4A] hover:bg-[#b53e3e] text-white'
                  : 'bg-[#2E9B72] hover:bg-[#24825f] text-white'
              }`}
            >
              <Power className="h-3.5 w-3.5" />
              <span>{dutyModeActive ? 'Nöbeti Bitir' : 'Nöbet Modunu Başlat'}</span>
            </button>
          </div>

          <div className="rounded-xl border border-[#D9E2EC] bg-[#F5F8FA] p-3.5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                  dutyModeActive
                    ? 'bg-[#2E9B72]/15 border-[#2E9B72]/40 text-[#2E9B72]'
                    : 'bg-[#EAF0F4] border-[#D9E2EC] text-[#627D98]'
                }`}
              >
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#102A43]">
                  {!androidNode
                    ? uiLabels.noPairedDevices
                    : dutyModeActive
                      ? 'Aegis Gözcü — Android Nöbet Modu aktif (kamera tetikleyicisi görünür)'
                      : 'Android Nöbet Modu kapalı — Ön plan kamera servisi beklemede'}
                </p>
                <p className="font-mono text-[11px] text-[#627D98] mt-0.5">
                  {androidNode ? androidNode.hostname : 'Gerçek cihaz bekleniyor'} · onTimeout() dayanıklılığı · Beklenmedik sonlandırma = Kurcalama algılandı
                </p>
              </div>
            </div>
            <span
              className={`font-mono text-[11px] font-medium shrink-0 ${
                dutyModeActive ? 'text-[#2E9B72]' : 'text-[#627D98]'
              }`}
            >
              {dutyModeActive ? 'Ön Plan Açık' : 'Pasif'}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-[#627D98]">
              Olay Tetikleyicileri (Periyodik Sürekli Tarama Yerine)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { key: 'screenOn', label: 'Ekran Açılma' },
                  { key: 'unlock', label: 'Kilit Açma' },
                  { key: 'motion', label: 'Cihaz Hareketi' },
                  { key: 'appSwitch', label: 'Uygulama Geçişi' },
                ] as const
              ).map((t) => {
                const active = triggers[t.key];
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() =>
                      setTriggers((prev) => ({ ...prev, [t.key]: !prev[t.key] }))
                    }
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      active
                        ? 'border-[#2E9B72]/50 bg-[#2E9B72]/10 text-[#102A43]'
                        : 'border-[#D9E2EC] bg-[#F5F8FA] text-[#627D98] hover:text-[#102A43]'
                    }`}
                  >
                    <span className="block font-semibold">{t.label}</span>
                    <span className="font-mono text-[10.5px]">
                      {active ? 'Etkin' : 'Kapalı'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bento-tile xl:col-span-5 p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[11px] text-[#627D98]">
                  iOS 18 · AVCaptureSession
                </div>
                <h2 className="text-[15px] font-semibold text-[#102A43] mt-0.5">
                  iPhone Ön Plan & Onay Sınırı
                </h2>
              </div>
              <Smartphone className="h-4 w-4 text-[#2878A8] shrink-0" />
            </div>

            <p className="text-xs text-[#627D98] leading-relaxed">
              iOS arka plana geçtiğinde <span className="font-mono text-[#102A43]">videoDeviceNotAvailableInBackground</span> nedeniyle kamera oturumu sonlanır. Bu nedenle iPhone, gizli tarama yerine masaüstü uyarılarını ve onaylı işlemleri yöneten güvenli uçtur.
            </p>

            <dl className="grid grid-cols-2 gap-3 border-t border-[#D9E2EC] pt-3 text-xs">
              <div>
                <dt className="text-[#627D98]">Cihaz</dt>
                <dd className="font-mono text-[#102A43] mt-0.5">
                  {iosNode ? iosNode.hostname : uiLabels.noPairedDevices}
                </dd>
              </div>
              <div>
                <dt className="text-[#627D98]">Kamera Durumu</dt>
                <dd className="text-[#2E9B72] font-medium mt-0.5">Yalnızca Ön Plan</dd>
              </div>
              <div>
                <dt className="text-[#627D98]">Bildirim & Kanıt</dt>
                <dd className="text-[#102A43] mt-0.5">APNs + E2E Şifreli</dd>
              </div>
              <div>
                <dt className="text-[#627D98]">iPad Çoklu Görev</dt>
                <dd className="text-[#627D98] mt-0.5">Stage Manager / Split View</dd>
              </div>
            </dl>
          </div>

          <div className="border-t border-[#D9E2EC] pt-3 flex items-center justify-between text-xs">
            <span className="text-[#627D98]">App Store Gizlilik Uyumu</span>
            <span className="inline-flex items-center gap-1 font-mono text-[#2E9B72] font-medium">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Şeffaf Ön Plan</span>
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Biometric Calibration + Labeled Test Datasets */}
      <div className="bento-tile p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-[#102A43]">
                Biyometrik Hat Kalibrasyonu (MiniFASNetV2 + MobileFaceNet)
              </h2>
              <span className="font-mono text-[11px] text-[#D9822B] font-medium">
                Tasarım Simülasyonu
              </span>
            </div>
            <p className="text-xs text-[#627D98] mt-0.5">
              Arayüzdeki eşikler tasarım simülasyonudur; üretim eşiği gerçek kamera koşullarında toplanan etiketli test kümeleriyle belirlenmelidir
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveCalibration}
            className="rounded-lg bg-[#102A43] hover:bg-[#163B5C] text-white font-semibold text-xs px-3.5 py-2 transition-colors whitespace-nowrap"
          >
            Simülasyonu Uygula
          </button>
        </div>

        {calibrationNote && (
          <p className="font-mono text-xs text-[#2E9B72]">{calibrationNote}</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 border-t border-[#D9E2EC] pt-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="range-liveness" className="text-[#102A43] font-medium">
                Yüksek Risk Canlılık Eşiği
              </label>
              <span className="tabular-mono font-semibold text-[#C94A4A]">%{highRiskThreshold}</span>
            </div>
            <input
              id="range-liveness"
              type="range"
              min={35}
              max={80}
              value={highRiskThreshold}
              onChange={(e) => setHighRiskThreshold(Number(e.target.value))}
              className="w-full accent-[#C94A4A]"
            />
            <p className="text-[11px] text-[#627D98]">
              Bu değerin altında ekran replay / basılı fotoğraf şüphesi ile şifreli kanıt üretilir.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="range-cosine" className="text-[#102A43] font-medium">
                Sessiz Geçiş Benzerlik Eşiği
              </label>
              <span className="tabular-mono font-semibold text-[#2E9B72]">%{infoThreshold}</span>
            </div>
            <input
              id="range-cosine"
              type="range"
              min={60}
              max={92}
              value={infoThreshold}
              onChange={(e) => setInfoThreshold(Number(e.target.value))}
              className="w-full accent-[#2E9B72]"
            />
            <p className="text-[11px] text-[#627D98]">
              Arada kalan skorlar düşük ışık / açı nedeniyle ikinci kare veya kullanıcı onayı ister.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-3 rounded-xl border border-[#D9E2EC] bg-[#F5F8FA] p-3.5 text-xs">
            <div>
              <dt className="text-[#627D98]">Model FAR</dt>
              <dd className="tabular-mono text-base font-semibold text-[#2E9B72] mt-1">
                {dataMode === 'real' ? uiLabels.noData : `%${estimatedFar}`}
              </dd>
            </div>
            <div>
              <dt className="text-[#627D98]">Model FRR</dt>
              <dd className="tabular-mono text-base font-semibold text-[#D9822B] mt-1">
                {dataMode === 'real' ? uiLabels.noData : `%${estimatedFrr}`}
              </dd>
            </div>
            <div>
              <dt className="text-[#627D98]">EER Dengesi</dt>
              <dd className="tabular-mono text-base font-semibold text-[#2878A8] mt-1">
                {dataMode === 'real' ? uiLabels.noData : `%${eerValue}`}
              </dd>
            </div>
          </dl>
        </div>

        <div className="border-t border-[#D9E2EC] pt-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#102A43]">
              Etiketli Kamera Test Kümeleri (Işık · Açı · Maske · Replay · Baskı · Benzer Yüz)
            </span>
            <span className="font-mono text-[11px] text-[#627D98]">
              Durumu değiştirmek için satıra tıklayın
            </span>
          </div>

          {dataMode === 'real' ? (
            <EmptyState
              title={uiLabels.noData}
              description="Gerçek Veri modunda kendi cihazınızda etiketli kamera testi çalıştırılana kadar FAR/FRR tablosu boş kalır."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D9E2EC] font-mono text-[11px] text-[#627D98]">
                    <th className="py-2 pr-4 font-medium">Test Kümesi</th>
                    <th className="py-2 pr-4 font-medium">Amaç</th>
                    <th className="py-2 pr-4 font-medium">Ölçülecek Metrik</th>
                    <th className="py-2 pr-4 font-medium text-right">Örnek</th>
                    <th className="py-2 pr-4 font-medium text-right">FAR / FRR</th>
                    <th className="py-2 font-medium">Kalibrasyon Durumu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E2EC] text-xs">
                  {datasets.map((ds) => {
                    const statusColor =
                      ds.calibrationStatus === 'Doğrulandı'
                        ? 'text-[#2E9B72]'
                        : ds.calibrationStatus === 'Ön Kalibrasyon'
                          ? 'text-[#2878A8]'
                          : 'text-[#D9822B]';
                    return (
                      <tr
                        key={ds.id}
                        onClick={() => cycleDatasetStatus(ds.id)}
                        className="cursor-pointer hover:bg-[#F5F8FA] transition-colors"
                      >
                        <td className="py-2.5 pr-4 font-semibold text-[#102A43] whitespace-nowrap">
                          {ds.datasetName}
                        </td>
                        <td className="py-2.5 pr-4 text-[#102A43]">{ds.purpose}</td>
                        <td className="py-2.5 pr-4 font-mono text-[11px] text-[#2878A8]">
                          {ds.measuredMetrics}
                        </td>
                        <td className="py-2.5 pr-4 tabular-mono text-right text-[#627D98]">
                          {ds.sampleCount}
                        </td>
                        <td className="py-2.5 pr-4 tabular-mono text-right whitespace-nowrap">
                          <span className="text-[#2E9B72]">%{ds.farPercent}</span>
                          <span className="text-[#627D98]"> / </span>
                          <span className="text-[#D9822B]">%{ds.frrPercent}</span>
                        </td>
                        <td className={`py-2.5 font-mono font-medium whitespace-nowrap ${statusColor}`}>
                          {ds.calibrationStatus}
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

      {/* Row 3: Paired Devices */}
      {nodes.length === 0 ? (
        <EmptyState
          title={uiLabels.noPairedDevices}
          description="Henüz bu merkeze bağlanmış bir cihaz bulunmuyor."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {nodes.map((node) => {
            const statusColor =
              node.status === 'Sağlıklı' || node.status === 'Nöbet Aktif'
                ? 'text-[#2E9B72]'
                : node.status === 'Uyarı'
                  ? 'text-[#D9822B]'
                  : 'text-[#C94A4A]';

            return (
              <div key={node.id} className="bento-tile p-4 flex flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[11px] text-[#627D98]">{node.osVersion}</p>
                    <h3 className="font-mono text-sm font-semibold text-[#102A43] mt-0.5">
                      {node.hostname}
                    </h3>
                  </div>
                  <span className={`font-mono text-xs font-medium ${statusColor}`}>{node.status}</span>
                </div>

                <Sparkline
                  data={node.cpuHistory}
                  color={node.status === 'Kilitli' ? '#C94A4A' : '#2E9B72'}
                  height={32}
                />

                <div className="flex items-center justify-between gap-2 border-t border-[#D9E2EC] pt-2.5 text-xs">
                  <span className="text-[#627D98] truncate">{node.cameraMode}</span>
                  {node.platform !== 'cloud' && (
                    <button
                      type="button"
                      onClick={() => onToggleLockNode(node.id)}
                      className="shrink-0 font-mono text-[11px] font-medium text-[#2878A8] hover:text-[#102A43]"
                    >
                      {node.status === 'Kilitli' ? 'Kilidi Aç' : 'Cihazı Kilitle'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
