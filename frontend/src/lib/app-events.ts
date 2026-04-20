export type ToastKind = "success" | "error" | "warning" | "info";

export interface ToastPayload {
  title: string;
  description?: string;
  kind?: ToastKind;
}

export interface ApiErrorPayload {
  message: string;
  status?: number;
  technical?: boolean;
}

const TOAST_EVENT = "app:toast";
const API_ERROR_EVENT = "app:api-error";

export const emitToast = (payload: ToastPayload) => {
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
};

export const onToast = (handler: (payload: ToastPayload) => void) => {
  const listener = (event: Event) => handler((event as CustomEvent<ToastPayload>).detail);
  window.addEventListener(TOAST_EVENT, listener);
  return () => window.removeEventListener(TOAST_EVENT, listener);
};

export const emitApiError = (payload: ApiErrorPayload) => {
  window.dispatchEvent(new CustomEvent<ApiErrorPayload>(API_ERROR_EVENT, { detail: payload }));
};

export const onApiError = (handler: (payload: ApiErrorPayload) => void) => {
  const listener = (event: Event) => handler((event as CustomEvent<ApiErrorPayload>).detail);
  window.addEventListener(API_ERROR_EVENT, listener);
  return () => window.removeEventListener(API_ERROR_EVENT, listener);
};
