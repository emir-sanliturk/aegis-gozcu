import React, { useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { ClusterNode } from '../types/telemetry';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { ConfirmCommandDialog } from '../components/ConfirmActionDialog';
import { uiLabels } from '../uiLabels';
import type { EventSourceMode } from '../data/real-event-source';

export type ApprovedCommandType = 'lock_session';

interface CommandsScreenProps {
  dataMode: EventSourceMode;
  apiConnected: boolean;
  nodes: ClusterNode[];
  onToggleLockNode: (nodeId: string) => void;
  onTriggerUnlockCheck: (nodeId: string) => void;
  onSubmitApprovedCommand?: (
    node: ClusterNode,
    command: ApprovedCommandType
  ) => Promise<{ accepted: boolean; statusText: string }>;
}

interface ApprovedActionRecord {
  id: string;
  target: string;
  action: string;
  timestamp: string;
  status: string;
  detail: string;
}

export const CommandsScreen: React.FC<CommandsScreenProps> = ({
  dataMode,
  apiConnected,
  nodes,
  onToggleLockNode,
  onSubmitApprovedCommand,
}) => {
  const [pendingAction, setPendingAction] = useState<{
    node: ClusterNode;
    command: ApprovedCommandType;
    label: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    ok: boolean;
    headline: string;
    detail: string;
  } | null>(null);
  const [actionHistory, setActionHistory] = useState<ApprovedActionRecord[]>([]);

  const manageableNodes = nodes.filter((n) => n.platform !== 'cloud');

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    const { node, command, label } = pendingAction;

    if (dataMode === 'demo') {
      onToggleLockNode(node.id);
      setActionHistory((prev) => [
        {
          id: `cmd-${Date.now()}`,
          target: node.hostname,
          action: `${label} (${uiLabels.demoMode})`,
          timestamp: new Date().toTimeString().slice(0, 8),
          status: uiLabels.commandApproved,
          detail: uiLabels.demoMode,
        },
        ...prev.slice(0, 14),
      ]);
      setStatusFeedback({
        ok: true,
        headline: uiLabels.commandApproved,
        detail: `${node.hostname} · Deneme Modu simülasyonu güncellendi.`,
      });
      setPendingAction(null);
      return;
    }

    if (!apiConnected || !onSubmitApprovedCommand) {
      setStatusFeedback({
        ok: false,
        headline: uiLabels.commandFailed,
        detail: uiLabels.awaitingConnection,
      });
      setPendingAction(null);
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSubmitApprovedCommand(node, command);
      if (result.accepted) {
        onToggleLockNode(node.id);
        setStatusFeedback({
          ok: true,
          headline: uiLabels.commandApproved,
          detail: uiLabels.commandQueued,
        });
        setActionHistory((prev) => [
          {
            id: `cmd-${Date.now()}`,
            target: node.hostname,
            action: label,
            timestamp: new Date().toTimeString().slice(0, 8),
            status: uiLabels.commandApproved,
            detail: uiLabels.commandQueued,
          },
          ...prev.slice(0, 14),
        ]);
      } else {
        setStatusFeedback({
          ok: false,
          headline: uiLabels.commandFailed,
          detail: result.statusText,
        });
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '';
      const msg =
        errMsg === 'explicit_user_confirmation_required'
          ? uiLabels.confirmationRequired
          : errMsg === 'cors_origin_not_allowed'
            ? 'Origin izinli değil'
            : errMsg === 'session_required'
              ? 'Oturum doğrulaması gerekli'
              : uiLabels.commandFailed;
      setStatusFeedback({
        ok: false,
        headline: uiLabels.commandFailed,
        detail: msg,
      });
    } finally {
      setSubmitting(false);
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        section="İşlemler"
        title={uiLabels.commands}
        description="Kullanıcı onayı gerektiren kontrollü oturum kilitleme işlemleri; onaysız veya izin listesi dışındaki uzaktan işlemler yürütülmez."
      />

      {statusFeedback && (
        <div
          role="status"
          className={`bento-tile p-4 flex flex-wrap items-center justify-between gap-2 text-xs border ${
            statusFeedback.ok
              ? 'border-[#2E9B72]/45 bg-[#2E9B72]/8'
              : 'border-[#C94A4A]/45 bg-[#C94A4A]/8'
          }`}
        >
          <div className="space-y-0.5">
            <p
              className={`font-semibold ${
                statusFeedback.ok ? 'text-[#2E9B72]' : 'text-[#C94A4A]'
              }`}
            >
              {statusFeedback.headline}
            </p>
            <p className="text-[#102A43]">{statusFeedback.detail}</p>
          </div>
          <button
            type="button"
            onClick={() => setStatusFeedback(null)}
            className="font-mono text-[11px] text-[#627D98] hover:text-[#102A43]"
          >
            {uiLabels.close}
          </button>
        </div>
      )}

      {manageableNodes.length === 0 ? (
        <EmptyState
          title={uiLabels.noPairedDevices}
          description={
            apiConnected
              ? 'Onaylı işlem gönderebilmek için önce Aegis Gözcü ile en az bir cihaz eşleştirin.'
              : uiLabels.awaitingConnection
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {manageableNodes.map((node) => {
            const isLocked = node.status === 'Kilitli';

            return (
              <div key={node.id} className="bento-tile p-5 flex flex-col justify-between gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] text-[#627D98]">
                      {node.role} · {node.osVersion}
                    </p>
                    <h2 className="font-mono text-base font-semibold text-[#102A43] mt-0.5">
                      {node.hostname}
                    </h2>
                    <p className="text-xs text-[#627D98] mt-1">{node.cameraMode}</p>
                  </div>
                  <span
                    className={`font-mono text-xs font-medium ${
                      isLocked ? 'text-[#C94A4A]' : 'text-[#2E9B72]'
                    }`}
                  >
                    {node.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#D9E2EC] pt-3.5">
                  <span className="font-mono text-[11px] text-[#627D98]">
                    İzinli komut: lock_session
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingAction({
                        node,
                        command: 'lock_session',
                        label: isLocked ? 'Oturumu Kilitle (Yenile)' : 'Oturumu Kilitle',
                      })
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      isLocked
                        ? 'bg-[#2E9B72] hover:bg-[#24825f] text-white'
                        : 'bg-[#102A43] hover:bg-[#163B5C] text-white'
                    }`}
                  >
                    {isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    <span>{isLocked ? 'Oturum Kilidini Yenile' : 'Cihazı Kilitle'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bento-tile p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[#102A43]">
            Onaylanan İşlem Geçmişi (Bu Oturum)
          </h2>
          <span className="font-mono text-xs text-[#627D98] tabular-nums">{actionHistory.length} kayıt</span>
        </div>

        {actionHistory.length === 0 ? (
          <EmptyState
            title={uiLabels.noData}
            description="Kullanıcı tarafından onaylanan işlemler burada zaman sırasıyla listelenir."
          />
        ) : (
          <div className="divide-y divide-[#D9E2EC] text-xs">
            {actionHistory.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <span className="font-mono font-semibold text-[#102A43]">{item.target}</span>
                  <span className="text-[#627D98] ml-2">{item.action}</span>
                  <span className="text-[#627D98] ml-2">· {item.detail}</span>
                </div>
                <div className="font-mono text-[11px] text-[#2E9B72] whitespace-nowrap tabular-nums">
                  {item.status} · {item.timestamp}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmCommandDialog
        open={pendingAction !== null}
        deviceName={pendingAction?.node.hostname}
        message={`${pendingAction?.node.hostname ?? ''} cihazı için oturumu kilitleme isteği gönderilecek.`}
        busy={submitting}
        onConfirm={() => void handleConfirmAction()}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};
