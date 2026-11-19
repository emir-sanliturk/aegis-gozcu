import React from 'react';
import { Menu, Search, Plus } from 'lucide-react';
import { ScreenId } from '../types/telemetry';
import { navigationItems } from '../navigation';
import type { EventSourceMode } from '../data/real-event-source';
import { uiLabels } from '../uiLabels';

interface TopBarProps {
  activeScreen: ScreenId;
  dataMode: EventSourceMode;
  onChangeDataMode: (mode: EventSourceMode) => void;
  onOpenMobileNav: () => void;
  onOpenCommandPalette: () => void;
  onPrimaryAction: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeScreen,
  dataMode,
  onChangeDataMode,
  onOpenMobileNav,
  onOpenCommandPalette,
  onPrimaryAction,
}) => {
  const currentNav =
    navigationItems.find((item) => item.id === activeScreen) ?? navigationItems[0];

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-[#D9E2EC] bg-white/92 backdrop-blur-md px-4 lg:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="lg:hidden rounded-lg p-2 text-[#627D98] hover:bg-[#F5F8FA] hover:text-[#102A43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2878A8]"
          aria-label="Menüyü aç"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav aria-label="Konum" className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-[#627D98] whitespace-nowrap hidden sm:inline">
            {uiLabels.appName}
          </span>
          <span className="text-[#BCCCDC] hidden sm:inline" aria-hidden="true">
            /
          </span>
          <span className="font-semibold text-[#102A43] whitespace-nowrap truncate">
            {currentNav.label}
          </span>
          {dataMode === 'demo' && (
            <span className="font-mono text-[11px] font-semibold text-[#D9822B] whitespace-nowrap hidden md:inline">
              · {uiLabels.demoMode} (Dışa Aktarım Kapalı)
            </span>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <div
          role="group"
          aria-label="Veri kaynağı modu"
          className="flex items-center gap-0.5 rounded-lg bg-[#F5F8FA] p-0.5 border border-[#D9E2EC]"
        >
          <button
            type="button"
            onClick={() => onChangeDataMode('real')}
            className={`px-2.5 py-1 rounded-md font-mono text-[11px] font-medium transition-colors whitespace-nowrap ${
              dataMode === 'real'
                ? 'bg-[#102A43] text-white'
                : 'text-[#627D98] hover:text-[#102A43]'
            }`}
          >
            {uiLabels.realData}
          </button>
          <button
            type="button"
            onClick={() => onChangeDataMode('demo')}
            className={`px-2.5 py-1 rounded-md font-mono text-[11px] font-medium transition-colors whitespace-nowrap ${
              dataMode === 'demo'
                ? 'bg-[#D9822B] text-white'
                : 'text-[#627D98] hover:text-[#102A43]'
            }`}
          >
            DEMO
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="input-cyber flex items-center justify-between gap-4 rounded-lg px-3 py-2 text-xs text-[#627D98] hover:text-[#102A43] hover:border-[#BCCCDC] w-36 sm:w-52 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2878A8]"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="h-3.5 w-3.5 text-[#627D98] shrink-0" />
            <span className="truncate">Ara...</span>
          </span>
          <kbd className="hidden sm:inline-block font-mono text-[11px] text-[#627D98]">⌘K</kbd>
        </button>

        <button
          type="button"
          onClick={onPrimaryAction}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#102A43] hover:bg-[#163B5C] text-white font-semibold text-xs px-3.5 py-2 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2878A8]"
        >
          <Plus className="h-3.5 w-3.5 text-[#6ED6C1]" />
          <span>Yeni Kural</span>
        </button>
      </div>
    </header>
  );
};
