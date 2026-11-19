import React from 'react';
import {
  Activity,
  MonitorSmartphone,
  Network,
  ShieldAlert,
  Stethoscope,
  CheckSquare,
  Share2,
  Film,
  Settings,
  X,
} from 'lucide-react';
import { navigationItems, type NavigationId } from '../navigation';
import { ScreenId } from '../types/telemetry';
import { AegisLogo } from './AegisLogo';
import { uiLabels } from '../uiLabels';

interface SidebarProps {
  activeScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  activeIncidentCount: number;
  dutyModeActive: boolean;
  apiConnected?: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ICONS: Record<NavigationId, React.ComponentType<{ className?: string }>> = {
  overview: Activity,
  devices: MonitorSmartphone,
  network: Network,
  incidents: ShieldAlert,
  diagnostics: Stethoscope,
  commands: CheckSquare,
  shares: Share2,
  promo: Film,
  settings: Settings,
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeScreen,
  onSelectScreen,
  activeIncidentCount,
  dutyModeActive,
  apiConnected = false,
  mobileOpen,
  onCloseMobile,
}) => {
  const handleSelect = (screen: ScreenId) => {
    onSelectScreen(screen);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-[#071A2B] text-white border-r border-white/10">
      <div className="flex flex-col min-h-0 flex-1">
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <AegisLogo size={34} />
            <div className="min-w-0">
              <strong className="block text-[15px] font-semibold tracking-tight text-white whitespace-nowrap truncate">
                {uiLabels.appName}
              </strong>
              <span className="block text-[11px] text-white/60 whitespace-nowrap truncate">
                {uiLabels.appSubtitle}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6ED6C1]"
            aria-label="Menüyü kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="px-3 py-4 space-y-1 overflow-y-auto" aria-label="Ana menü">
          {navigationItems.map((item) => {
            const Icon = NAV_ICONS[item.id];
            const isActive = activeScreen === item.id;

            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-start justify-between gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6ED6C1] ${
                  isActive
                    ? 'bg-[#6ED6C1]/18 text-white'
                    : 'text-white/72 hover:text-white hover:bg-[#6ED6C1]/10'
                }`}
              >
                <span className="flex items-start gap-2.5 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 mt-0.5 ${
                      isActive ? 'text-[#6ED6C1]' : 'text-white/50'
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold leading-tight truncate">
                      {item.shortLabel}
                    </span>
                    <span className="block text-[11px] text-white/50 leading-snug mt-0.5 truncate">
                      {item.description}
                    </span>
                  </span>
                </span>
                {item.id === 'incidents' && activeIncidentCount > 0 && (
                  <span className="tabular-mono text-[11px] font-semibold text-[#F6C86E] shrink-0 mt-0.5">
                    {activeIncidentCount}
                  </span>
                )}
                {item.id === 'devices' && dutyModeActive && (
                  <span className="font-mono text-[10.5px] text-[#6ED6C1] shrink-0 mt-0.5">
                    Nöbet
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#163B5C] border border-white/15 font-mono text-xs font-medium text-[#6ED6C1]">
            AG
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-white truncate">Cihaz Sahibi</p>
            <p className="text-[11px] text-white/65 truncate">
              {apiConnected ? uiLabels.realConnectionActive : uiLabels.awaitingConnection}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[248px] shrink-0 h-screen sticky top-0 z-30">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#071A2B]/65 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[82vw] h-full z-10">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
};
