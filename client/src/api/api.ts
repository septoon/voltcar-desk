import axios from "axios";
import { getToken } from "../auth/token";

const API_BASE = process.env.REACT_APP_API_URL || "/";

export const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
