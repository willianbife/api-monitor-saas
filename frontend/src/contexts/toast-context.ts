import { createContext } from "react";
import type { ToastPayload } from "../lib/app-events";

export interface ToastContextValue {
  pushToast: (payload: ToastPayload) => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);
