import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { onToast, type ToastKind, type ToastPayload } from "../lib/app-events";
import { ToastContext } from "./toast-context";

interface ToastItem extends Required<ToastPayload> {
  id: string;
}

const TOAST_TIMEOUT = 4200;

const iconMap: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 size={18} aria-hidden="true" />,
  error: <AlertCircle size={18} aria-hidden="true" />,
  warning: <AlertTriangle size={18} aria-hidden="true" />,
  info: <Info size={18} aria-hidden="true" />,
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const pushToast = useCallback((payload: ToastPayload) => {
    const id = crypto.randomUUID();
    const toast: ToastItem = {
      id,
      kind: payload.kind || "info",
      title: payload.title,
      description: payload.description || "",
    };

    setToasts((current) => [...current, toast]);
    window.setTimeout(() => removeToast(id), TOAST_TIMEOUT);
  }, []);

  useEffect(() => onToast(pushToast), [pushToast]);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.kind}`} role="status">
            <div className="toast-icon">{iconMap[toast.kind]}</div>
            <div className="toast-copy">
              <strong>{toast.title}</strong>
              {toast.description ? <span>{toast.description}</span> : null}
            </div>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss notification"
              onClick={() => removeToast(toast.id)}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
