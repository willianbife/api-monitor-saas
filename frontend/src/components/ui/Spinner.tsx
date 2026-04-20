import React from "react";

export const Spinner: React.FC<{ size?: "sm" | "md" }> = ({ size = "md" }) => {
  return <span className={`spinner spinner-${size}`} aria-hidden="true" />;
};
