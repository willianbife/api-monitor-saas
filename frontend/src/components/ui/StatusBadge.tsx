import React from "react";

export type MonitoringStatus = "HEALTHY" | "DEGRADED" | "DOWN";

export const StatusBadge: React.FC<{ status: MonitoringStatus }> = ({ status }) => {
  return <span className={`badge badge-status badge-${status.toLowerCase()}`}>{status}</span>;
};
