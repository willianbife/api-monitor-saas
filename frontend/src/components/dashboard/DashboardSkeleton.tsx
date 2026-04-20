import React from "react";
import { Skeleton } from "../ui/Skeleton";

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="dashboard-grid">
      <div className="summary-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card">
            <Skeleton className="skeleton-title" />
            <Skeleton className="skeleton-value" />
            <Skeleton className="skeleton-subtitle" />
          </div>
        ))}
      </div>

      <div className="chart-grid">
        <div className="card">
          <Skeleton className="skeleton-title" />
          <Skeleton className="skeleton-chart" />
        </div>
        <div className="card">
          <Skeleton className="skeleton-title" />
          <Skeleton className="skeleton-chart" />
        </div>
      </div>

      <div className="card">
        <Skeleton className="skeleton-title" />
        <Skeleton className="skeleton-table-row" />
        <Skeleton className="skeleton-table-row" />
        <Skeleton className="skeleton-table-row" />
      </div>
    </div>
  );
};
