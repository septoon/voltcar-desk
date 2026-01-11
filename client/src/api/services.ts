import { api } from "./api";

export type ServiceItem = {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};

export const fetchServices = async (query?: string): Promise<string[]> => {
  const path =
    query && query.trim().length > 0 ? `/api/services?q=${encodeURIComponent(query.trim())}` : "/api/services";
  const res = await api.get(path);
  return res.data;
};

export const fetchServiceList = async (): Promise<ServiceItem[]> => {
  const res = await api.get("/api/services?full=1");
  return res.data;
};

export const createService = async (name: string): Promise<ServiceItem> => {
  const res = await api.post("/api/services", { name });
  return res.data;
};

export const updateService = async (id: string, name: string): Promise<ServiceItem> => {
  const res = await api.put(`/api/services/${id}`, { name });
  return res.data;
};

export const deleteService = async (id: string): Promise<void> => {
  await api.delete(`/api/services/${id}`);
};
