import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
}) => {
  return (
    <section className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        <span>—</span>
      </div>

      <h2>{title}</h2>
      <p>{description}</p>

      <small>Gerçek veri oluştuğunda bu alan güncellenecektir.</small>
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
};
