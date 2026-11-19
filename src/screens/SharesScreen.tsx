import React, { useState } from 'react';
import { Share2, Trash2, Eye, Plus } from 'lucide-react';
import { ClusterNode, ExternalShare, ThreatIncident } from '../types/telemetry';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { ConfirmCommandDialog } from '../components/ConfirmActionDialog';
import { uiLabels } from '../uiLabels';
import type { EventSourceMode } from '../data/real-event-source';

interface SharesScreenProps {
  dataMode: EventSourceMode;
  apiConnected: boolean;
  devices: ClusterNode[];
  shares: ExternalShare[];
  incidents: ThreatIncident[];
  onCreateShare?: (deviceId: string) => Promise<void>;
  onRevokeShare?: (shareId: string) => Promise<void>;
  onToggleEphemeralShare: (incidentId: string) => void;
  onPurgeEvidence: (incidentId: string) => void;
  onInspectIncident: (incident: ThreatIncident) => void;
}

export const SharesScreen: React.FC<SharesScreenProps> = ({
  dataMode,
  apiConnected,
  devices,
  shares,
  incidents,
  onCreateShare,
  onRevokeShare,
  onToggleEphemeralShare,
  onPurgeEvidence,
  onInspectIncident,
}) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [pendingRevokeShareId, setPendingRevokeShareId] = useState<string | null>(null);
  const [pendingCreateDeviceId, setPendingCreateDeviceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const activeShares = shares.filter((s) => s.active);
  const effectiveDeviceId = selectedDeviceId || devices[0]?.id || '';

  const handleConfirmCreate = async () => {
    if (!pendingCreateDeviceId || !onCreateShare) {
      setPendingCreateDeviceId(null);
      return;
    }
    setBusy(true);
    try {
      await onCreateShare(pendingCreateDeviceId);
      setShareFeedback({
        ok: true,
        message: 'Güvenli paylaşım kullanıcı onayıyla oluşturuldu.',
      });
    } catch {
      setShareFeedback({
        ok: false,
        message: uiLabels.commandFailed,
      });
    } finally {
      setBusy(false);
      setPendingCreateDeviceId(null);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!pendingRevokeShareId || !onRevokeShare) {
      setPendingRevokeShareId(null);
      return;
    }
    setBusy(true);
    try {
      await onRevokeShare(pendingRevokeShareId);
      setShareFeedback({
        ok: true,
        message: 'Paylaşım iptal edildi',
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '';
      const msg =
        errMsg === 'explicit_user_confirmation_required'
          ? uiLabels.confirmationRequired
          : errMsg === 'cors_origin_not_allowed'
            ? 'Origin izinli değil'
            : errMsg === 'session_required'
              ? 'Oturum doğrulaması gerekli'
              : 'Paylaşım iptal edilemedi';
      setShareFeedback({
        ok: false,
        message: msg,
      });
    } finally {
      setBusy(false);
      setPendingRevokeShareId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        section="Paylaşımlar"
        title={uiLabels.shares}
        description="Süreli ve kontrollü erişimler; anahtarlar cihaz sahibinde kalır, sunucu plaintext içerik veya paylaşım anahtarı görmez."
      />

      {shareFeedback && (
        <div
          role="status"
          className={`bento-tile p-4 flex items-center justify-between gap-2 text-xs border ${
            shareFeedback.ok
              ? 'border-[#2E9B72]/45 bg-[#2E9B72]/8 text-[#2E9B72]'
              : 'border-[#C94A4A]/45 bg-[#C94A4A]/8 text-[#C94A4A]'
          }`}
        >
          <span className="font-semibold">{shareFeedback.message}</span>
          <button
            type="button"
            onClick={() => setShareFeedback(null)}
            className="font-mono text-[11px] text-[#627D98] hover:text-[#102A43]"
          >
            {uiLabels.close}
          </button>
        </div>
      )}

      {dataMode === 'real' && apiConnected && devices.length > 0 && onCreateShare && (
        <div className="bento-tile p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold text-[#102A43]">Yeni Süreli Paylaşım</h2>
            <p className="text-[11px] text-[#627D98] mt-0.5">
              Paylaşım anahtarı ve şifreli içerik arayüzde gösterilmez; oluşturma açık onay gerektirir.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Paylaşım yapılacak cihazı seç"
              value={effectiveDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="input-cyber rounded-lg px-3 py-1.5 text-xs text-[#102A43]"
            >
              {devices.map((dev) => (
                <option key={dev.id} value={dev.id}>
                  {dev.hostname}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setPendingCreateDeviceId(effectiveDeviceId)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#102A43] hover:bg-[#163B5C] text-white font-semibold text-xs px-3.5 py-2 transition-colors whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5 text-[#6ED6C1]" />
              <span>Paylaşım Oluştur</span>
            </button>
          </div>
        </div>
      )}

      {dataMode === 'real' ? (
        activeShares.length === 0 ? (
          <EmptyState
            title={uiLabels.noActiveShares}
            description={
              apiConnected
                ? 'Şu anda aktif güvenli paylaşım bulunmuyor.'
                : uiLabels.awaitingConnection
            }
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeShares.map((share) => (
              <div key={share.shareId} className="bento-tile p-5 flex flex-col justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-[#627D98]">
                    <span>{share.shareId}</span>
                    <span className="text-[#2E9B72] font-semibold">Aktif</span>
                  </div>
                  <h2 className="text-[15px] font-semibold text-[#102A43]">
                    Cihaz: {share.deviceId}
                  </h2>
                  <p className="font-mono text-[11px] text-[#627D98]">
                    Bitiş: {share.expiresAt ? share.expiresAt.slice(0, 19).replace('T', ' ') : '—'} · Erişim: {share.accessCount}
                  </p>
                </div>

                <div className="flex justify-end border-t border-[#D9E2EC] pt-3">
                  <button
                    type="button"
                    onClick={() => setPendingRevokeShareId(share.shareId)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#C94A4A]/40 bg-[#C94A4A]/10 hover:bg-[#C94A4A]/18 px-3 py-1.5 text-xs font-medium text-[#C94A4A] transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Paylaşımı İptal Et</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : incidents.length === 0 ? (
        <EmptyState
          title={uiLabels.noActiveShares}
          description="Paylaşılabilir olay kaydı bulunmuyor."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {incidents.map((inc) => {
            const share = inc.ephemeralShare;
            return (
              <div key={inc.id} className="bento-tile p-5 flex flex-col justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-[#627D98]">
                    <span>
                      {share.share_id} · {inc.targetHostname}
                    </span>
                    <span className={share.active ? 'text-[#2E9B72] font-semibold' : 'text-[#627D98]'}>
                      {share.active ? 'Aktif (E2E)' : uiLabels.revoked}
                    </span>
                  </div>
                  <h2 className="text-[15px] font-semibold text-[#102A43] leading-snug">
                    {inc.vector}
                  </h2>
                  <p className="font-mono text-[11px] text-[#627D98]">
                    alıcı: {share.recipient_device_id} · erişim: {share.access_count}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-b border-[#D9E2EC] py-2.5 font-mono text-[11px] text-[#627D98]">
                  <span>
                    Bitiş: {share.expires_at ? share.expires_at.slice(11, 19) + 'Z' : '—'}
                  </span>
                  <span>
                    İptal: {share.revoked_at ? share.revoked_at.slice(11, 19) + 'Z' : '—'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onInspectIncident(inc)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] px-3 py-1.5 text-xs font-medium text-[#102A43] transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>{uiLabels.viewDetails}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleEphemeralShare(inc.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        share.active
                          ? 'border border-[#D9822B]/40 bg-[#D9822B]/12 text-[#D9822B]'
                          : 'bg-[#102A43] hover:bg-[#163B5C] text-white'
                      }`}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      <span>{share.active ? 'Erişimi İptal Et' : '15 dk E2E Aç'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onPurgeEvidence(inc.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#C94A4A]/40 bg-[#C94A4A]/10 hover:bg-[#C94A4A]/18 px-3 py-1.5 text-xs font-medium text-[#C94A4A] transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Sil</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmCommandDialog
        open={pendingCreateDeviceId !== null}
        title={uiLabels.confirmationTitle}
        message={`${pendingCreateDeviceId ?? ''} cihazı için 15 dakikalık süreli paylaşım oluşturulacak.`}
        busy={busy}
        onConfirm={() => void handleConfirmCreate()}
        onCancel={() => setPendingCreateDeviceId(null)}
      />

      <ConfirmCommandDialog
        open={pendingRevokeShareId !== null}
        title="Paylaşım iptali"
        message="Bu güvenli paylaşım iptal edilecek."
        secondaryMessage="İptal edilen paylaşım tekrar kullanılamaz."
        confirmLabel="Paylaşımı iptal et"
        cancelLabel={uiLabels.cancel}
        danger
        busy={busy}
        onConfirm={() => void handleConfirmRevoke()}
        onCancel={() => setPendingRevokeShareId(null)}
      />
    </div>
  );
};
