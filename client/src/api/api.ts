import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { clearToken, getToken, setToken } from "../auth/token";

const API_BASE =
  (process.env.REACT_APP_API_URL || "https://api.crm.lumastack.ru").replace(/\/+$/, "") || "https://api.crm.lumastack.ru";

export const api = axios.create({
  baseURL: API_BASE || "/",
  withCredentials: true,
});

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
const queue: Array<(token: string | null) => void> = [];

const runQueue = (token: string | null) => {
  queue.splice(0).forEach((cb) => cb(token));
};

const requestRefresh = async (): Promise<string | null> => {
  try {
    const res = await api.post("/api/auth/refresh", {}, { withCredentials: true, headers: { Authorization: undefined } });
    const newToken = res.data?.accessToken as string;
    if (newToken) setToken(newToken);
    return newToken ?? null;
  } catch {
    clearToken();
    return null;
  }
};

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const isRefreshCall = original?.url?.includes("/api/auth/refresh");

    if (status === 401 && !original?._retry && !isRefreshCall) {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = requestRefresh();
        const newToken = await refreshPromise;
        isRefreshing = false;
        refreshPromise = null;
        runQueue(newToken);
        if (!newToken) {
          if (window.location.pathname !== "/login") window.location.href = "/login";
          return Promise.reject(error);
        }
      } else if (refreshPromise) {
        await refreshPromise;
      }

      return new Promise((resolve, reject) => {
        queue.push((token) => {
          if (!token) {
            reject(error);
            return;
          }
          original._retry = true;
          original.headers = original.headers ?? {};
          (original.headers as any).Authorization = `Bearer ${token}`;
          api
            .request(original)
            .then((resp: AxiosResponse) => resolve(resp))
            .catch(reject);
        });
      });
    }

    if (status === 401 && isRefreshCall) {
      clearToken();
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);
