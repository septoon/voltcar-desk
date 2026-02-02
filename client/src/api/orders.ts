import { api } from "./api";
import { OrderPayload } from "../types";
import { AxiosRequestConfig } from "axios";

type Config = Pick<AxiosRequestConfig, "signal">;

export const fetchOrder = async (id: string, config?: Config) => {
  const res = await api.get(`/api/orders/${id}`, { signal: config?.signal });
  return res.data;
};

export const fetchOrders = async (config?: Config) => {
  const res = await api.get("/api/orders", { signal: config?.signal });
  return res.data;
};

export const createOrder = async (payload: OrderPayload, config?: Config) => {
  const res = await api.post("/api/orders", payload, { signal: config?.signal });
  return res.data;
};

export const updateOrder = async (id: string, payload: OrderPayload, config?: Config) => {
  const res = await api.put(`/api/orders/${id}`, payload, { signal: config?.signal });
  return res.data;
};

export const deleteOrder = async (id: string, config?: Config) => {
  const res = await api.delete(`/api/orders/${id}`, { signal: config?.signal });
  return res.status === 204 || res.status === 200;
};
