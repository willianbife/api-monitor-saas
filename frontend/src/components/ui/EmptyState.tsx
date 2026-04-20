import React from "react";

export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
  illustration?: React.ReactNode;
}> = ({ title, description, action, illustration }) => {
  return (
    <div className="empty-state card">
      <div className="empty-state-illustration" aria-hidden="true">
        {illustration}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
};
