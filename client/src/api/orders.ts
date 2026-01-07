import { api } from "./api";
import { OrderPayload } from "../types";

export const fetchOrder = async (id: string) => {
  const res = await api.get(`/api/orders/${id}`);
  return res.data;
};

export const fetchOrders = async () => {
  const res = await api.get("/api/orders");
  return res.data;
};

export const createOrder = async (payload: OrderPayload) => {
  const res = await api.post("/api/orders", payload);
  return res.data;
};

export const updateOrder = async (id: string, payload: OrderPayload) => {
  const res = await api.put(`/api/orders/${id}`, payload);
  return res.data;
};

export const deleteOrder = async (id: string) => {
  const res = await api.delete(`/api/orders/${id}`);
  return res.status === 204 || res.status === 200;
};
