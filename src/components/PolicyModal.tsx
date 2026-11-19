import React, { useState } from 'react';
import { X } from 'lucide-react';
import { SecurityPolicy } from '../types/telemetry';
import { uiLabels } from '../uiLabels';

interface PolicyModalProps {
  open: boolean;
  onClose: () => void;
  onCreatePolicy: (policy: SecurityPolicy) => void;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({
  open,
  onClose,
  onCreatePolicy,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<SecurityPolicy['category']>('Biyometri');
  const [action, setAction] = useState<SecurityPolicy['action']>('Kanıt + Uyarı');
  const [thresholdValue, setThresholdValue] = useState('75');
  const [thresholdUnit, setThresholdUnit] = useState('%');
  const [scope, setScope] = useState('Windows + macOS Kilit Açma');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Kural adı zorunludur.');
      return;
    }
    const parsed = Number(thresholdValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Eşik değeri sıfırdan büyük bir sayı olmalıdır.');
      return;
    }

    const prefixMap: Record<SecurityPolicy['category'], string> = {
      Biyometri: 'BIO',
      'Anti-Tamper': 'TMP',
      'Süreç / Dosya': 'EDR',
      'Ağ Filtresi': 'NET',
      'Nöbet Modu': 'NBT',
      Gizlilik: 'GZL',
    };

    const newPolicy: SecurityPolicy = {
      id: `KRL-${prefixMap[category]}-${Math.floor(10 + Math.random() * 89)}`,
      name: name.trim(),
      category,
      action,
      enabled: true,
      thresholdLabel: 'Tetikleyici Eşik',
      thresholdValue: parsed,
      thresholdUnit: thresholdUnit.trim() || '%',
      scope: scope.trim() || 'Tüm Eşli Cihazlar',
      hits24h: 0,
      lastTriggered: 'Hazır',
      description:
        description.trim() ||
        'Kullanıcı onaylı, olay tetiklemeli yerel güvenlik ve bildirim kuralı.',
    };

    onCreatePolicy(newPolicy);
    setName('');
    setDescription('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-[#071A2B]/55 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl bento-tier-2 p-6 space-y-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="policy-modal-title"
      >
        <div className="flex items-center justify-between border-b border-[#D9E2EC] pb-3.5">
          <h2 id="policy-modal-title" className="text-base font-semibold text-[#102A43]">
            Yeni Koruma Kuralı Ekle
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#627D98] hover:bg-[#F5F8FA] hover:text-[#102A43]"
            aria-label={uiLabels.close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pol-name" className="block text-xs font-medium text-[#627D98] mb-1.5">
              Kural Adı
            </label>
            <input
              id="pol-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Örn. Android Kilit Açma Sonrası 3 sn Yüz Kontrolü"
              className="input-cyber w-full rounded-lg px-3 py-2 text-sm text-[#102A43] placeholder:text-[#627D98]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pol-cat" className="block text-xs font-medium text-[#627D98] mb-1.5">
                Katman / Kategori
              </label>
              <select
                id="pol-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as SecurityPolicy['category'])}
                className="input-cyber w-full rounded-lg px-3 py-2 text-sm text-[#102A43]"
              >
                <option value="Biyometri">Biyometri</option>
                <option value="Anti-Tamper">Kurcalama Koruması</option>
                <option value="Süreç / Dosya">Süreç / Dosya</option>
                <option value="Ağ Filtresi">Ağ Filtresi</option>
                <option value="Nöbet Modu">Nöbet Modu</option>
                <option value="Gizlilik">Gizlilik</option>
              </select>
            </div>

            <div>
              <label htmlFor="pol-act" className="block text-xs font-medium text-[#627D98] mb-1.5">
                Tepki Aksiyonu
              </label>
              <select
                id="pol-act"
                value={action}
                onChange={(e) => setAction(e.target.value as SecurityPolicy['action'])}
                className="input-cyber w-full rounded-lg px-3 py-2 text-sm text-[#102A43]"
              >
                <option value="Kanıt + Uyarı">Kanıt + Uyarı</option>
                <option value="İkinci Doğrulama">İkinci Doğrulama</option>
                <option value="Kısıtla">Kısıtla</option>
                <option value="Engelle">Engelle</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pol-thresh" className="block text-xs font-medium text-[#627D98] mb-1.5">
                Eşik Değeri
              </label>
              <input
                id="pol-thresh"
                type="number"
                min={1}
                value={thresholdValue}
                onChange={(e) => setThresholdValue(e.target.value)}
                className="input-cyber tabular-mono w-full rounded-lg px-3 py-2 text-sm text-[#102A43]"
              />
            </div>

            <div>
              <label htmlFor="pol-unit" className="block text-xs font-medium text-[#627D98] mb-1.5">
                Birim
              </label>
              <input
                id="pol-unit"
                type="text"
                value={thresholdUnit}
                onChange={(e) => setThresholdUnit(e.target.value)}
                className="input-cyber font-mono w-full rounded-lg px-3 py-2 text-sm text-[#102A43]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="pol-scope" className="block text-xs font-medium text-[#627D98] mb-1.5">
              Hedef Kapsam
            </label>
            <input
              id="pol-scope"
              type="text"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="input-cyber font-mono w-full rounded-lg px-3 py-2 text-sm text-[#102A43]"
            />
          </div>

          <div>
            <label htmlFor="pol-desc" className="block text-xs font-medium text-[#627D98] mb-1.5">
              Açıklama
            </label>
            <textarea
              id="pol-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Olay tetiklemeli kuralın çalışma koşulu..."
              className="input-cyber w-full rounded-lg px-3 py-2 text-sm text-[#102A43] placeholder:text-[#627D98]"
            />
          </div>

          {error && <p className="text-xs text-[#C94A4A]">{error}</p>}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#D9E2EC]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] px-4 py-2 text-xs font-medium text-[#102A43] transition-colors"
            >
              {uiLabels.cancel}
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#102A43] hover:bg-[#163B5C] px-4 py-2 text-xs font-semibold text-white transition-colors"
            >
              Kuralı Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
