import axios from "axios";

const readCookie = (name: string) => {
  const cookies = document.cookie.split(";").map((part) => part.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

let csrfBootstrapPromise: Promise<string> | null = null;

export const initializeCsrf = async () => {
  const existingToken = readCookie("api_monitor_csrf");
  if (existingToken) {
    return existingToken;
  }

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = api
      .get("/auth/csrf")
      .then((response) => response.data.csrfToken as string)
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }

  return csrfBootstrapPromise;
};

api.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toUpperCase();

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrfToken = readCookie("api_monitor_csrf") || (await initializeCsrf());
    config.headers["X-CSRF-Token"] = csrfToken;
  }

  return config;
});

export default api;
