import { api } from "./api";
import { getToken } from "../auth/token";

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

export const ticketUrl = (name: string, download = false) =>
  `/api/tickets/file/${encodeURIComponent(name)}${download ? "?download=1" : ""}${
    getToken() ? `${download ? "&" : "?"}token=${encodeURIComponent(getToken() as string)}` : ""
  }`;
