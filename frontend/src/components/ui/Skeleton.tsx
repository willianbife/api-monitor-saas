import React from "react";

export const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => {
  return <div className={`skeleton ${className}`.trim()} aria-hidden="true" />;
};
