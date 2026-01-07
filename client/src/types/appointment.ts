export type AppointmentStatus = "new" | "confirmed" | "in_progress" | "done" | "no_show" | "canceled";

export type Appointment = {
  id: number;
  title: string;
  start: string;
  end: string;
  status: AppointmentStatus;
  customerName: string;
  phone?: string | null;
  vehicle?: string | null;
  govNumber?: string | null;
  vin?: string | null;
  masterId?: string | null;
  masterName?: string | null;
  orderId?: string | number | null;
  total?: number | null;
  paid?: boolean | null;
  note?: string | null;
};

export type AppointmentPayload = Omit<Appointment, "id"> & { id?: number };
