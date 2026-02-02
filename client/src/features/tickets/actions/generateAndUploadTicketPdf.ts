import { uploadTicketPdf } from "../../../api/pdf";
import { updateOrder } from "../../../api/orders";
import { OrderPayload } from "../../../types";
import { generateTicketPdfBlob } from "../../../pdf/generateTicketPdf";
import { Ticket, mapLineItems } from "../../../pdf/types";

type Params = {
  orderId: string;
  order: OrderPayload;
  issuedAt?: string;
};

export type GenerateAndUploadResult = {
  blob: Blob;
  uploadUrl?: string;
  uploadPath?: string;
  updatedOrder?: OrderPayload;
};

const mapOrderToTicket = (order: OrderPayload, issuedAt?: string): Ticket => ({
  id: order.id,
  number: order.id,
  issuedAt,
  customerName: order.customer ?? "",
  phone: order.phone ?? "",
  vehicle: order.car ?? "",
  govNumber: order.govNumber ?? "",
  vinNumber: order.vinNumber ?? "",
  mileage: order.mileage ?? null,
  service: order.reason ?? "",
  services: mapLineItems(order.services ?? []),
  parts: mapLineItems(order.parts ?? []),
  discountPercent: order.discountPercent ?? null,
  discountAmount: order.discountAmount ?? null,
});

export const generateAndUploadTicketPdf = async ({ orderId, order, issuedAt }: Params): Promise<GenerateAndUploadResult> => {
  const ticket = mapOrderToTicket({ ...order, id: orderId }, issuedAt);
  const blob = await generateTicketPdfBlob(ticket);
  const upload = await uploadTicketPdf({ ticketId: orderId, blob, filename: `ticket-${orderId}.pdf` });
  const updatedOrder = await updateOrder(orderId, {
    ...order,
    pdfUrl: upload.url,
    pdfPath: upload.path ?? upload.url,
  });

  return {
    blob,
    uploadUrl: upload.url,
    uploadPath: upload.path,
    updatedOrder,
  };
};
