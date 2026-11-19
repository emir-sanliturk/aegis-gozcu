import React from 'react';

type PageHeaderProps = {
  section: string;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export const PageHeader: React.FC<PageHeaderProps> = ({
  section,
  title,
  description,
  action,
}) => {
  return (
    <header className="page-header flex flex-wrap items-end justify-between gap-4 border-b border-[#D9E2EC] pb-4">
      <div className="space-y-1 min-w-0">
        <div className="text-xs font-medium text-[#627D98] flex items-center gap-1.5">
          <span>Aegis Gözcü</span>
          <span aria-hidden="true">/</span>
          <span className="text-[#102A43]">{section}</span>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#102A43]">
          {title}
        </h1>
        <p className="text-sm text-[#627D98]">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
};
