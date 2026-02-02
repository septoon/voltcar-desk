import { LineItem } from "../types";

export type TicketLine = {
  title: string;
  qty: number;
  price: number;
};

export type Ticket = {
  id?: string | number;
  number?: string | number;
  issuedAt?: string;
  customerName: string;
  phone?: string | null;
  vehicle?: string;
  govNumber?: string | null;
  vinNumber?: string | null;
  mileage?: number | null;
  service?: string;
  services?: TicketLine[];
  parts?: TicketLine[];
  discountPercent?: number | null;
  discountAmount?: number | null;
  notes?: string;
};

export const mapLineItems = (items: LineItem[] = []): TicketLine[] =>
  items.map((item) => ({
    title: item.title ?? "",
    qty: Number.isFinite(item.qty) ? Number(item.qty) : 0,
    price: Number.isFinite(item.price) ? Number(item.price) : 0,
  }));
