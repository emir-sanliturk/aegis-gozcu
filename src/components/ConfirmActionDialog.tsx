import React from 'react';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';
import { uiLabels } from '../uiLabels';

interface ConfirmCommandDialogProps {
  open: boolean;
  title?: string;
  deviceName?: string;
  message?: string;
  secondaryMessage?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmCommandDialog: React.FC<ConfirmCommandDialogProps> = ({
  open,
  title = uiLabels.confirmationTitle,
  deviceName,
  message,
  secondaryMessage = 'Bu işlem yalnızca sizin açık onayınızla başlatılır.',
  confirmLabel = uiLabels.confirmAction,
  cancelLabel = uiLabels.cancel,
  busy = false,
  danger = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const resolvedMessage =
    message ??
    `${deviceName ?? 'Seçili cihaz'} cihazı için oturumu kilitleme isteği gönderilecek.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-[#071A2B]/55 backdrop-blur-xs"
        onClick={busy ? undefined : onCancel}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-command-title"
        className="confirm-dialog relative z-10 w-full max-w-md rounded-2xl bento-tier-2 p-6 space-y-4"
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
              danger
                ? 'border-[#C94A4A]/35 bg-[#C94A4A]/10 text-[#C94A4A]'
                : 'border-[#D9822B]/35 bg-[#D9822B]/10 text-[#D9822B]'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div className="space-y-1.5">
            <h2
              id="confirm-command-title"
              className="text-base font-semibold text-[#102A43]"
            >
              {title}
            </h2>
            <p className="text-xs text-[#102A43] leading-relaxed">{resolvedMessage}</p>
            <p className="text-xs text-[#627D98] leading-relaxed">{secondaryMessage}</p>
          </div>
        </div>

        <div className="dialog-actions flex items-center justify-end gap-2 border-t border-[#D9E2EC] pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-[#D9E2EC] bg-[#F5F8FA] hover:bg-[#EAF0F4] px-4 py-2 text-xs font-medium text-[#102A43] transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
              danger
                ? 'bg-[#C94A4A] hover:bg-[#b53e3e]'
                : 'bg-[#102A43] hover:bg-[#163B5C]'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-[#6ED6C1]" />
            <span>{busy ? 'Gönderiliyor...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
