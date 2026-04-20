import axios from "axios";

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

export default api;
