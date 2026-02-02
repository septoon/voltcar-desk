import { pdf } from "@react-pdf/renderer";
import TicketDocument from "./documents/TicketDocument";
import { Ticket } from "./types";
import { registerFonts } from "./fonts/registerFonts";

export const generateTicketPdfBlob = async (ticket: Ticket): Promise<Blob> => {
  registerFonts();
  const instance = pdf(<TicketDocument ticket={ticket} />);
  return instance.toBlob();
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
