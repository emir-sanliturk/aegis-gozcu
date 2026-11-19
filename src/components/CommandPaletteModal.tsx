import React, { useEffect, useState } from 'react';
import { Search, ArrowRight, Server, ShieldAlert, Scale, Activity } from 'lucide-react';
import { ClusterNode, ScreenId, SecurityPolicy, ThreatIncident } from '../types/telemetry';
import { navigationItems } from '../navigation';

interface CommandPaletteModalProps {
  open: boolean;
  onClose: () => void;
  nodes: ClusterNode[];
  incidents: ThreatIncident[];
  policies: SecurityPolicy[];
  onNavigate: (screen: ScreenId) => void;
  onSelectIncident: (incident: ThreatIncident) => void;
  onSelectNode: (nodeId: string) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  open,
  onClose,
  nodes,
  incidents,
  policies,
  onNavigate,
  onSelectIncident,
  onSelectNode,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  if (!open) return null;

  const q = query.trim().toLowerCase();

  const screenItems = navigationItems.filter(
    (s) =>
      !q ||
      s.label.toLowerCase().includes(q) ||
      s.shortLabel.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
  );

  const matchedNodes = nodes
    .filter(
      (n) =>
        !q ||
        n.hostname.toLowerCase().includes(q) ||
        n.osVersion.toLowerCase().includes(q) ||
        n.ip.includes(q)
    )
    .slice(0, 4);

  const matchedIncidents = incidents
    .filter(
      (inc) =>
        !q ||
        inc.id.toLowerCase().includes(q) ||
        inc.event_id.toLowerCase().includes(q) ||
        inc.vector.toLowerCase().includes(q) ||
        inc.targetHostname.toLowerCase().includes(q) ||
        inc.evidence_hash.toLowerCase().includes(q)
    )
    .slice(0, 4);

  const matchedPolicies = policies
    .filter(
      (p) =>
        !q ||
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    )
    .slice(0, 3);

  const hasResults =
    screenItems.length > 0 ||
    matchedNodes.length > 0 ||
    matchedIncidents.length > 0 ||
    matchedPolicies.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div
        className="fixed inset-0 bg-[#071A2B]/55 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-xl rounded-2xl bento-tier-2 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Hızlı arama"
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#D9E2EC]">
          <Search className="h-4 w-4 text-[#2878A8] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Bölüm, cihaz, olay kodu veya kural ara..."
            className="w-full bg-transparent text-sm text-[#102A43] placeholder:text-[#627D98] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[11px] text-[#627D98] hover:text-[#102A43] px-1.5 py-0.5 rounded border border-[#D9E2EC]"
          >
            ESC
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 space-y-3">
          {!hasResults && (
            <div className="py-10 text-center text-xs text-[#627D98]">
              "{query}" için eşleşen cihaz, olay veya kural bulunamadı.
            </div>
          )}

          {screenItems.length > 0 && (
            <div>
              <p className="px-3 py-1 font-mono text-[10.5px] text-[#627D98]">Bölümler</p>
              {screenItems.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onNavigate(s.id);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left hover:bg-[#F5F8FA] transition-colors"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Activity className="h-3.5 w-3.5 text-[#2E9B72] shrink-0" />
                    <span className="text-xs font-semibold text-[#102A43] shrink-0">
                      {s.label}
                    </span>
                    <span className="text-xs text-[#627D98] truncate">{s.description}</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#627D98] shrink-0" />
                </button>
              ))}
            </div>
          )}

          {matchedIncidents.length > 0 && (
            <div>
              <p className="px-3 py-1 font-mono text-[10.5px] text-[#627D98]">Güvenlik Olayları</p>
              {matchedIncidents.map((inc) => (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => {
                    onSelectIncident(inc);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left hover:bg-[#F5F8FA] transition-colors"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <ShieldAlert className="h-3.5 w-3.5 text-[#C94A4A] shrink-0" />
                    <span className="font-mono text-xs text-[#627D98] shrink-0">{inc.id}</span>
                    <span className="text-xs font-medium text-[#102A43] truncate">{inc.vector}</span>
                  </span>
                  <span className="font-mono text-[11px] text-[#627D98] shrink-0 ml-2">
                    {inc.targetHostname}
                  </span>
                </button>
              ))}
            </div>
          )}

          {matchedNodes.length > 0 && (
            <div>
              <p className="px-3 py-1 font-mono text-[10.5px] text-[#627D98]">Bağlı Cihazlar</p>
              {matchedNodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => {
                    onSelectNode(node.id);
                    onNavigate('network');
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left hover:bg-[#F5F8FA] transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Server className="h-3.5 w-3.5 text-[#2878A8]" />
                    <span className="font-mono text-xs font-medium text-[#102A43]">
                      {node.hostname}
                    </span>
                    <span className="font-mono text-[11px] text-[#627D98]">{node.osVersion}</span>
                  </span>
                  <span className="font-mono text-[11px] text-[#627D98]">{node.status}</span>
                </button>
              ))}
            </div>
          )}

          {matchedPolicies.length > 0 && (
            <div>
              <p className="px-3 py-1 font-mono text-[10.5px] text-[#627D98]">Ayarlar & Kurallar</p>
              {matchedPolicies.map((pol) => (
                <button
                  key={pol.id}
                  type="button"
                  onClick={() => {
                    onNavigate('settings');
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left hover:bg-[#F5F8FA] transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <Scale className="h-3.5 w-3.5 text-[#2878A8]" />
                    <span className="font-mono text-xs text-[#627D98]">{pol.id}</span>
                    <span className="text-xs font-medium text-[#102A43]">{pol.name}</span>
                  </span>
                  <span className="font-mono text-[11px] text-[#627D98]">{pol.action}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
