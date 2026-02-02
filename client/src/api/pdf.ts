import { api } from "./api";

type UploadTicketPdfParams = {
  ticketId: string | number;
  blob: Blob;
  filename?: string;
};

export const uploadTicketPdf = async ({ ticketId, blob, filename }: UploadTicketPdfParams) => {
  const formData = new FormData();
  formData.append("file", blob, filename ?? `ticket-${ticketId}.pdf`);

  const res = await api.post(`/api/files/tickets/${encodeURIComponent(String(ticketId))}/pdf`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    withCredentials: true,
  });
  return res.data as { url: string; path?: string };
};
