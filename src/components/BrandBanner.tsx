import React from 'react';
import { AegisLogo } from './AegisLogo';
import { uiLabels } from '../uiLabels';

interface BrandBannerProps {
  modeLabel?: string;
  apiConnected?: boolean;
}

export const BrandBanner: React.FC<BrandBannerProps> = ({
  modeLabel,
  apiConnected = false,
}) => {
  return (
    <header className="brand-banner">
      <div className="brand-banner-mark">
        <AegisLogo size={48} />
      </div>

      <div className="brand-banner-copy">
        <p className="brand-eyebrow">{uiLabels.appSubtitle}</p>
        <h1 className="text-balance">{uiLabels.appName}</h1>
        <p className="brand-description">
          Cihazlarınızı, güvenlik olaylarını ve bağlantılarınızı tek merkezden takip edin.
        </p>
      </div>

      <div className="brand-banner-meta">
        <p
          className={`font-mono text-xs font-medium ${
            apiConnected ? 'text-[#6ED6C1]' : 'text-[#F6C86E]'
          }`}
        >
          {apiConnected ? uiLabels.realConnectionActive : uiLabels.awaitingConnection}
        </p>
        <p className="text-xs font-medium text-[#91E3D2] mt-1">
          Katmanlı koruma · Sürekli izleme · Kullanıcı kontrolü · Bilinen riskler
        </p>
        {modeLabel && (
          <p className="font-mono text-[11px] text-white/65 mt-1">{modeLabel}</p>
        )}
      </div>
    </header>
  );
};
