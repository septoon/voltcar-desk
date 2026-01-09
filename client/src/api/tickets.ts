import { api } from "./api";
import { getToken } from "../auth/token";

const API_BASE =
  ((process.env.REACT_APP_API_URL as string | undefined) || "https://api.crm.lumastack.ru").replace(/\/+$/, "") ||
  "https://api.crm.lumastack.ru";

export type TicketInfo = {
  name: string;
  size: number;
  mtime: string;
  url: string;
  downloadUrl: string;
};

export const fetchTickets = async (): Promise<TicketInfo[]> => {
  const res = await api.get("/api/tickets");
  return res.data;
};

export const ticketUrl = (name: string, download = false) => {
  const token = getToken();
  const qp = new URLSearchParams();
  if (download) qp.set("download", "1");
  if (token) qp.set("token", token);
  const qs = qp.toString();
  const base = API_BASE || "";
  return `${base}/api/tickets/file/${encodeURIComponent(name)}${qs ? `?${qs}` : ""}`;
};
