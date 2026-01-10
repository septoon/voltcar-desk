import { api } from "./api";

export const fetchServices = async (query?: string): Promise<string[]> => {
  const path =
    query && query.trim().length > 0 ? `/api/services?q=${encodeURIComponent(query.trim())}` : "/api/services";
  const res = await api.get(path);
  return res.data;
};
