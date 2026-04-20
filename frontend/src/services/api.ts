import axios from "axios";
import { emitApiError, emitToast } from "../lib/app-events";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

let csrfBootstrapPromise: Promise<string> | null = null;
let csrfTokenCache = "";

export const initializeCsrf = async () => {
  if (csrfTokenCache) {
    return csrfTokenCache;
  }

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = api
      .get("/auth/csrf")
      .then((response) => {
        csrfTokenCache = response.data.csrfToken as string;
        return csrfTokenCache;
      })
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }

  return csrfBootstrapPromise;
};

api.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toUpperCase();

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrfToken = csrfTokenCache || (await initializeCsrf());
    config.headers["X-CSRF-Token"] = csrfToken;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status as number | undefined;
    const message =
      error.response?.data?.error || error.response?.data?.message || error.message || "Request failed";

    if (status === 401) {
      emitToast({
        kind: "warning",
        title: "Session required",
        description: "Please sign in again to continue.",
      });
    } else if (status && status >= 500) {
      emitToast({
        kind: "error",
        title: "Server unavailable",
        description: "The API is having trouble responding right now.",
      });
    }

    emitApiError({
      message,
      status,
      technical: !!status && status >= 500,
    });

    return Promise.reject(error);
  }
);

export default api;
