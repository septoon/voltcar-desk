import fs from "fs/promises";
import path from "path";
import { Router } from "express";

type WorkStatus = "NEW" | "IN_PROGRESS" | "PENDING_PAYMENT" | "PAYED";
type LineItem = { id: number; title: string; qty: number; price: number };
type Payment = { id: number; date: string; method: string; amount: number };
type Order = {
  id: string;
  date: string;
  company: string;
  customer: string;
  phone: string | null;
  car: string;
  govNumber: string | null;
  vinNumber: string | null;
  mileage: number | null;
  reason: string;
  status: WorkStatus;
  services: LineItem[];
  parts: LineItem[];
  payments: Payment[];
  discountPercent: number | null;
  discountAmount: number | null;
  pdfUrl: string | null;
  pdfPath: string | null;
};

const dataDir = path.join(process.cwd(), "data");
const ordersPath = path.join(dataDir, "orders.json");

const deriveStatus = (order: Order): WorkStatus => {
  // Статус, выставленный явно, не переписываем
  if (order.status === "PAYED") return "PAYED";
  if (order.status === "PENDING_PAYMENT") return "PENDING_PAYMENT";
  if (order.status === "IN_PROGRESS") return "IN_PROGRESS";
  if (order.status === "NEW") {
    const hasContent =
      Boolean(
        (order.company && order.company.trim()) ||
          (order.customer && order.customer.trim()) ||
          (order.phone && order.phone.trim()) ||
          (order.car && order.car.trim()) ||
          (order.govNumber && order.govNumber.trim()) ||
          (order.vinNumber && order.vinNumber.trim()) ||
          (order.reason && order.reason.trim()) ||
          (order.services && order.services.length) ||
          (order.parts && order.parts.length),
      );
    return hasContent ? "IN_PROGRESS" : "NEW";
  }

  // Если статус не указан, решаем по платежам/контенту
  if (order.payments && order.payments.length > 0) return "PAYED";
  const hasContent =
    Boolean(
      (order.company && order.company.trim()) ||
        (order.customer && order.customer.trim()) ||
        (order.phone && order.phone.trim()) ||
        (order.car && order.car.trim()) ||
        (order.govNumber && order.govNumber.trim()) ||
        (order.vinNumber && order.vinNumber.trim()) ||
        (order.reason && order.reason.trim()) ||
        (order.services && order.services.length) ||
        (order.parts && order.parts.length),
    );
  return hasContent ? "IN_PROGRESS" : "NEW";
};

const ensureData = async () => {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(ordersPath);
  } catch {
    await fs.writeFile(ordersPath, "[]", "utf-8");
  }
};

const readOrders = async (): Promise<Order[]> => {
  await ensureData();
  const raw = await fs.readFile(ordersPath, "utf-8");
  const parsed = JSON.parse(raw) as Order[];
  return parsed.map((o) => ({
    ...o,
    company: (o as any).company ?? "",
    status: deriveStatus(o),
    pdfUrl: (o as any).pdfUrl ?? null,
    pdfPath: (o as any).pdfPath ?? null,
  }));
};

const writeOrders = async (orders: Order[]) => {
  await ensureData();
  await fs.writeFile(ordersPath, JSON.stringify(orders, null, 2), "utf-8");
};

const nextId = (orders: Order[]) => {
  const max = orders.reduce((acc, o) => Math.max(acc, Number(o.id) || 0), 0);
  return String(max + 1).padStart(6, "0");
};

export const ordersRouter = Router();

ordersRouter.get("/", async (_req, res) => {
  const orders = await readOrders();
  return res.json(orders);
});

ordersRouter.get("/:id", async (req, res) => {
  const orders = await readOrders();
  const order = orders.find((item) => item.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: "Заказ не найден" });
  }
  return res.json(order);
});

ordersRouter.post("/", async (req, res) => {
  const orders = await readOrders();
  const id = nextId(orders);
  const now = new Date().toLocaleDateString("ru-RU");
  const payload = req.body as Partial<Order>;
  const order: Order = {
    id,
    date: payload.date ?? now,
    company: (payload as any).company ?? "",
    customer: payload.customer ?? "",
    phone: (payload as any).phone ?? null,
    car: payload.car ?? "",
    govNumber: payload.govNumber ?? null,
    vinNumber: payload.vinNumber ?? null,
    mileage: payload.mileage ?? null,
    reason: payload.reason ?? "",
    status: (payload.status as WorkStatus) ?? "NEW",
    services: payload.services ?? [],
    parts: payload.parts ?? [],
    payments: payload.payments ?? [],
    discountPercent: payload.discountPercent ?? null,
    discountAmount: payload.discountAmount ?? null,
    pdfUrl: payload.pdfUrl ?? null,
    pdfPath: (payload as any).pdfPath ?? null,
  };
  order.status = deriveStatus(order);
  orders.push(order);
  await writeOrders(orders);
  return res.status(201).json(order);
});

ordersRouter.put("/:id", async (req, res) => {
  const orders = await readOrders();
  const idx = orders.findIndex((item) => item.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: "Заказ не найден" });
  }
  const payload = req.body as Partial<Order>;
  const current = orders[idx]!;
  const updated: Order = {
    ...current,
    ...payload,
    id: current.id,
    date: payload.date ?? current.date,
    company: (payload as any).company ?? current.company ?? "",
    customer: payload.customer ?? current.customer,
    car: payload.car ?? current.car,
    phone: (payload as any).phone ?? current.phone ?? null,
    govNumber: payload.govNumber ?? current.govNumber ?? null,
    vinNumber: payload.vinNumber ?? current.vinNumber ?? null,
    mileage: payload.mileage ?? current.mileage ?? null,
    reason: payload.reason ?? current.reason,
    status: (payload.status as WorkStatus) ?? current.status,
    services: payload.services ?? current.services,
    parts: payload.parts ?? current.parts,
    payments: payload.payments ?? current.payments,
    discountPercent: payload.discountPercent ?? current.discountPercent ?? null,
    discountAmount: payload.discountAmount ?? current.discountAmount ?? null,
    pdfUrl: payload.pdfUrl ?? current.pdfUrl ?? null,
    pdfPath: (payload as any).pdfPath ?? current.pdfPath ?? null,
  };
  updated.status = deriveStatus(updated);
  orders[idx] = updated;
  await writeOrders(orders);
  return res.json(updated);
});

ordersRouter.delete("/:id", async (req, res) => {
  const orders = await readOrders();
  const filtered = orders.filter((o) => o.id !== req.params.id);
  if (filtered.length === orders.length) {
    return res.status(404).json({ error: "Заказ не найден" });
  }
  await writeOrders(filtered);
  return res.status(204).send();
});
