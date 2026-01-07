export type WorkStatus = "NEW" | "IN_PROGRESS" | "PAYED";

export type LineItem = {
  id: number;
  title: string;
  qty: number;
  price: number;
};

export type Payment = {
  id: number;
  date: string;
  method: string;
  amount: number;
};

export type OrderPayload = {
  id?: string;
  date?: string;
  customer: string;
  car: string;
  mileage?: number | null;
  reason?: string;
  status: WorkStatus;
  services: LineItem[];
  parts: LineItem[];
  payments: Payment[];
  govNumber?: string;
  vinNumber?: string;
  phone?: string | null;
  discountPercent?: number | null;
  discountAmount?: number | null;
};
