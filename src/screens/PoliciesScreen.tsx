import React, { useState } from 'react';
import { Plus, Play, CheckCircle2, Circle } from 'lucide-react';
import { RoadmapMilestone, SecurityPolicy } from '../types/telemetry';
import { PageHeader } from '../components/PageHeader';
import { uiLabels } from '../uiLabels';

interface PoliciesScreenProps {
  policies: SecurityPolicy[];
  roadmap: RoadmapMilestone[];
  onTogglePolicy: (policyId: string) => void;
  onUpdateThreshold: (policyId: string, value: number) => void;
  onToggleMilestone: (milestoneId: string) => void;
  onOpenNewPolicy: () => void;
}

export const PoliciesScreen: React.FC<PoliciesScreenProps> = ({
  policies,
  roadmap,
  onTogglePolicy,
  onUpdateThreshold,
  onToggleMilestone,
  onOpenNewPolicy,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('Tümü');
  const [testPayload, setTestPayload] = useState(
    'MiniFASNetV2 liveness=0.22 | WTSRegisterSessionNotification Unlock'
  );
  const [simResult, setSimResult] = useState<{
    matchedPolicy: string;
    action: string;
    detail: string;
  } | null>(null);

  const [privacyGuards, setPrivacyGuards] = useState({
    noRawUpload: true,
    visibleIndicator: true,
    noHiddenKeylog: true,
    ownerConsentOnly: true,
  });

  const categories = ['Tümü', 'Biyometri', 'Anti-Tamper', 'Süreç / Dosya', 'Ağ Filtresi', 'Nöbet Modu', 'Gizlilik'];
  const filtered = policies.filter(
    (p) => categoryFilter === 'Tümü' || p.category === categoryFilter
  );

  const phases = [
    'Aşama 1 · 8–12 Hafta (MVP)',
    'Aşama 2 · 3–6 Ay',
    'Aşama 3 · 6–12 Ay',
  ] as const;

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    const lower = testPayload.toLowerCase();
    if (lower.includes('liveness') || lower.includes('replay') || lower.includes('0.2')) {
      const pol = policies.find((p) => p.id === 'KRL-BIO-01');
      setSimResult({
        matchedPolicy: pol ? `${pol.id} · ${pol.name}` : 'KRL-BIO-01',
        action: pol?.enabled ? pol.action : 'Devre Dışı',
        detail: 'Düşük canlılık skoru saptandı; ham görüntü cihazda tutularak şifreli kanıt üretildi.',
      });
      return;
    }
    if (lower.includes('auth_open') || lower.includes('şifreleme') || lower.includes('.sync-helper')) {
      const pol = policies.find((p) => p.id === 'KRL-EDR-03');
      setSimResult({
        matchedPolicy: pol ? `${pol.id} · ${pol.name}` : 'KRL-EDR-03',
        action: pol?.enabled ? pol.action : 'Devre Dışı',
        detail: 'Endpoint Security AUTH_OPEN aşamasında yazma hakları düşürüldü.',
      });
      return;
    }
    if (lower.includes('wfp') || lower.includes('outbound') || lower.includes('temp')) {
      const pol = policies.find((p) => p.id === 'KRL-NET-04');
      setSimResult({
        matchedPolicy: pol ? `${pol.id} · ${pol.name}` : 'KRL-NET-04',
        action: pol?.enabled ? pol.action : 'Devre Dışı',
        detail: 'Uygulama kimliği tabanlı ağ filtresi şüpheli çıkışı durdurdu (HTTPS içeriği okunmadı).',
      });
      return;
    }
    setSimResult({
      matchedPolicy: 'Eşleşme Yok',
      action: 'Sessiz Geçiş',
      detail: 'Olay yerel risk eşiklerinin altında kaldı; cihaz sahibi sessiz onay aldı.',
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        section="Ayarlar"
        title={uiLabels.settings}
        description="Uygulama ve güvenlik ayarları, gizlilik sınırları, yerel kurallar ve teslimat planı."
      />

      <div className="bento-tile p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold text-[#102A43]">
              Zorunlu Yasal, Etik & Mağaza Kontrolleri
            </h2>
            <p className="text-xs text-[#627D98] mt-0.5">
              KVKK / GDPR uyumu ve App Review / Google Play sınırları için açık onay mimarisi
            </p>
          </div>
          <span className="font-mono text-xs font-medium text-[#2E9B72]">Şeffaf Cihaz Sahipliği</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-1">
          {(
            [
              {
                key: 'noRawUpload',
                title: 'Ham Yüz Görüntüsü Çıkmaz',
                desc: 'Embedding yerel kalır; yalnızca şifreli, kullanıcı kontrollü kanıt aktarılır.',
              },
              {
                key: 'visibleIndicator',
                title: 'Görünür Kamera Göstergesi',
                desc: 'Kamera kullanımında kalıcı bildirim ve açık iptal edilebilirlik.',
              },
              {
                key: 'noHiddenKeylog',
                title: 'Gizli Tuş / Ekran Kaydı Yok',
                desc: 'Gizli keylogger veya varsayılan tam ekran görüntüsü tasarım dışıdır.',
              },
              {
                key: 'ownerConsentOnly',
                title: 'Yalnızca Cihaz Sahibi Onayı',
                desc: 'Üçüncü kişi izleme senaryolarında açık yasal uyarı ve politika zorunludur.',
              },
            ] as const
          ).map((item) => {
            const enabled = privacyGuards[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() =>
                  setPrivacyGuards((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                }
                className={`rounded-xl border p-3.5 text-left transition-colors ${
                  enabled
                    ? 'border-[#2E9B72]/45 bg-[#2E9B72]/5'
                    : 'border-[#C94A4A]/45 bg-[#C94A4A]/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-[#102A43]">{item.title}</span>
                  <span
                    className={`font-mono text-[10.5px] font-medium ${
                      enabled ? 'text-[#2E9B72]' : 'text-[#C94A4A]'
                    }`}
                  >
                    {enabled ? 'Etkin' : 'Devre Dışı'}
                  </span>
                </div>
                <p className="text-[11px] text-[#627D98] leading-relaxed">{item.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bento-tile p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-0.5 rounded-lg bg-[#F5F8FA] p-1 border border-[#D9E2EC]">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-md font-mono text-[11px] transition-colors whitespace-nowrap shrink-0 ${
                categoryFilter === cat
                  ? 'bg-[#102A43] text-white'
                  : 'text-[#627D98] hover:text-[#102A43]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenNewPolicy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#102A43] hover:bg-[#163B5C] text-white font-semibold text-xs px-3.5 py-2 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5 text-[#6ED6C1]" />
          <span>Yeni Kural Ekle</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((pol) => {
          const actionColor =
            pol.action === 'Engelle'
              ? 'text-[#C94A4A]'
              : pol.action === 'Kanıt + Uyarı'
                ? 'text-[#D9822B]'
                : 'text-[#2878A8]';

          return (
            <div key={pol.id} className="bento-tile p-5 flex flex-col justify-between gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="font-mono text-[11px] text-[#627D98]">
                    {pol.id} · {pol.category} · <span className={`${actionColor} font-medium`}>{pol.action}</span>
                  </div>
                  <h3 className="text-[15px] font-semibold text-[#102A43]">{pol.name}</h3>
                  <p className="text-xs text-[#627D98] leading-relaxed">{pol.description}</p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={pol.enabled}
                  aria-label={`${pol.name} kuralını aç/kapat`}
                  onClick={() => onTogglePolicy(pol.id)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2878A8] ${
                    pol.enabled
                      ? 'bg-[#2E9B72]/20 border-[#2E9B72]'
                      : 'bg-[#EAF0F4] border-[#D9E2EC]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 rounded-full transform transition-transform duration-150 mt-0.5 ${
                      pol.enabled
                        ? 'translate-x-5.5 bg-[#2E9B72]'
                        : 'translate-x-1 bg-[#627D98]'
                    }`}
                  />
                </button>
              </div>

              <div className="border-t border-[#D9E2EC] pt-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <label htmlFor={`thresh-${pol.id}`} className="text-[#627D98] whitespace-nowrap">
                    {pol.thresholdLabel}:
                  </label>
                  <input
                    id={`thresh-${pol.id}`}
                    type="number"
                    min={1}
                    value={pol.thresholdValue}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (Number.isFinite(val) && val > 0) {
                        onUpdateThreshold(pol.id, val);
                      }
                    }}
                    className="input-cyber tabular-mono w-20 rounded-md px-2 py-1 text-xs text-[#102A43]"
                  />
                  <span className="font-mono text-[11px] text-[#627D98]">
                    {pol.thresholdUnit}
                  </span>
                </div>

                <div className="font-mono text-[11px] text-[#627D98] tabular-nums">
                  {pol.scope} · {pol.hits24h} tetiklenme · {pol.lastTriggered}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bento-tile p-5 space-y-3">
        <div>
          <h3 className="text-[15px] font-semibold text-[#102A43]">
            Olay Kuralı Simülatörü
          </h3>
          <p className="text-xs text-[#627D98] mt-0.5">
            Örnek bir kilit açma, Endpoint Security AUTH_OPEN veya WFP çıkış olayını kurallara karşı test edin
          </p>
        </div>

        <form onSubmit={handleSimulate} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={testPayload}
            onChange={(e) => setTestPayload(e.target.value)}
            placeholder="Olay telemetri metni girin..."
            className="input-cyber font-mono flex-1 rounded-lg px-3.5 py-2 text-xs text-[#102A43]"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2E9B72] hover:bg-[#24825f] text-white font-semibold text-xs px-4 py-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="h-3.5 w-3.5" />
            <span>Olayı Test Et</span>
          </button>
        </form>

        {simResult && (
          <div className="border-t border-[#D9E2EC] pt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <p className="font-mono text-[#102A43]">
                Eşleşen Kural: <span className="text-[#2878A8] font-medium">{simResult.matchedPolicy}</span>
              </p>
              <p className="text-[#627D98]">{simResult.detail}</p>
            </div>
            <span className="font-mono font-semibold text-[#D9822B]">
              Karar: {simResult.action}
            </span>
          </div>
        )}
      </div>

      <div className="bento-tile p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[15px] font-semibold text-[#102A43]">
              3 Aşamalı Teslimat Yol Haritası
            </h3>
            <p className="text-xs text-[#627D98] mt-0.5">
              İlk sürümde çekirdek koruma ile başlayıp sürücü imzalama ve mağaza yetkilendirmesini sonraki fazlara ayıran plan
            </p>
          </div>
          <span className="tabular-mono text-xs text-[#627D98]">
            {roadmap.filter((m) => m.completed).length}/{roadmap.length} Tamamlandı
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {phases.map((phase) => {
            const items = roadmap.filter((m) => m.phase === phase);
            return (
              <div
                key={phase}
                className="rounded-xl border border-[#D9E2EC] bg-[#F5F8FA] p-4 space-y-3"
              >
                <p className="font-mono text-xs font-semibold text-[#2878A8]">{phase}</p>
                <div className="divide-y divide-[#D9E2EC]">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onToggleMilestone(item.id)}
                      className="w-full py-2.5 first:pt-1 last:pb-1 flex items-start gap-2.5 text-left hover:opacity-85 transition-opacity"
                    >
                      {item.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-[#2E9B72] shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-4 w-4 text-[#627D98] shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p
                          className={`text-xs leading-snug ${
                            item.completed ? 'text-[#102A43] font-medium' : 'text-[#627D98]'
                          }`}
                        >
                          {item.title}
                        </p>
                        <p className="font-mono text-[10.5px] text-[#627D98] mt-0.5">
                          {item.platform}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
