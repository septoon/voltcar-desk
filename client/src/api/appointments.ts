import { api } from "./api";
import { Appointment, AppointmentPayload, AppointmentStatus } from "../types/appointment";

export type AppointmentQuery = {
  from?: string;
  to?: string;
  masterId?: string;
  statuses?: AppointmentStatus[];
};

const buildQuery = (params: AppointmentQuery) => {
  const search = new URLSearchParams();
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.masterId) search.set("masterId", params.masterId);
  if (params.statuses?.length) search.set("statuses", params.statuses.join(","));
  return search.toString();
};

export const fetchAppointments = async (params: AppointmentQuery): Promise<Appointment[]> => {
  const qs = buildQuery(params);
  const res = await api.get(`/api/appointments${qs ? `?${qs}` : ""}`);
  return res.data;
};

export const createAppointment = async (payload: AppointmentPayload): Promise<Appointment> => {
  const res = await api.post("/api/appointments", payload);
  return res.data;
};

export const updateAppointment = async (id: number, payload: Partial<AppointmentPayload>): Promise<Appointment> => {
  const res = await api.put(`/api/appointments/${id}`, payload);
  return res.data;
};

export const deleteAppointment = async (id: number): Promise<void> => {
  await api.delete(`/api/appointments/${id}`);
};
