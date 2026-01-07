import { Router } from "express";
import fs from "fs/promises";
import path from "path";

type AppointmentStatus = "new" | "confirmed" | "in_progress" | "done" | "no_show" | "canceled";

type AppointmentRecord = {
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

const DATA_PATH = path.resolve(__dirname, "../../data/appointments.json");

const ensureFile = async () => {
  try {
    await fs.access(DATA_PATH);
  } catch {
    const seedStart = new Date();
    seedStart.setHours(10, 0, 0, 0);
    const seedEnd = new Date(seedStart.getTime() + 60 * 60 * 1000);
    const seed: AppointmentRecord[] = [
      {
        id: Date.now(),
        title: "Диагностика",
        customerName: "Иванов Иван",
        phone: "+7 (999) 111-22-33",
        vehicle: "Kia Rio",
        govNumber: "А123ВС",
        status: "confirmed",
        start: seedStart.toISOString(),
        end: seedEnd.toISOString(),
        total: 2500,
        paid: false,
        note: "Первичная запись",
      },
    ];
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(seed, null, 2), "utf8");
  }
};

const readAll = async (): Promise<AppointmentRecord[]> => {
  await ensureFile();
  const raw = await fs.readFile(DATA_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAll = async (items: AppointmentRecord[]) => {
  await fs.writeFile(DATA_PATH, JSON.stringify(items, null, 2), "utf8");
};

const parseStatuses = (value?: string | string[]) => {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value : value.split(",");
  const cleaned = raw
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase()) as AppointmentStatus[];
  return cleaned.length ? cleaned : undefined;
};

export const appointmentsRouter = Router();

appointmentsRouter.get("/", async (req, res) => {
  const { from, to, masterId } = req.query as Record<string, string | undefined>;
  const statuses = parseStatuses(req.query.statuses as string | undefined);

  const items = await readAll();
  const filtered = items
    .filter((item) => {
      if (from && new Date(item.start) < new Date(from)) return false;
      if (to && new Date(item.start) > new Date(to)) return false;
      if (masterId && item.masterId !== masterId) return false;
      if (statuses && !statuses.includes(item.status)) return false;
      return true;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  res.json(filtered);
});

appointmentsRouter.post("/", async (req, res) => {
  const payload = req.body as Partial<AppointmentRecord>;
  try {
    const items = await readAll();
    const start = payload.start ? new Date(payload.start).toISOString() : new Date().toISOString();
    const end = payload.end ? new Date(payload.end).toISOString() : new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
    const record: AppointmentRecord = {
      id: Date.now(),
      title: payload.title ?? "Запись",
      customerName: payload.customerName ?? "",
      start,
      end,
      status: (payload.status as AppointmentStatus) ?? "confirmed",
      phone: payload.phone ?? null,
      vehicle: payload.vehicle ?? null,
      govNumber: payload.govNumber ?? null,
      vin: payload.vin ?? null,
      masterId: payload.masterId ?? null,
      masterName: payload.masterName ?? null,
      orderId: payload.orderId ? String(payload.orderId) : null,
      total: payload.total ?? null,
      paid: payload.paid ?? false,
      note: payload.note ?? null,
    };
    items.push(record);
    await writeAll(items);
    res.status(201).json(record);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: "Не удалось создать запись" });
  }
});

appointmentsRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Неверный id" });
  const payload = req.body as Partial<AppointmentRecord>;
  try {
    const items = await readAll();
    const idx = items.findIndex((a) => a.id === id);
    if (idx === -1) return res.status(404).json({ error: "Не найдено" });
    const existing = items[idx]!;
    const updated: AppointmentRecord = {
      ...existing,
      ...payload,
      id: existing.id,
      start: payload.start ? new Date(payload.start).toISOString() : existing.start,
      end: payload.end ? new Date(payload.end).toISOString() : existing.end,
    };
    items[idx] = updated;
    await writeAll(items);
    res.json(updated);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: "Не удалось обновить запись" });
  }
});

appointmentsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Неверный id" });
  try {
    const items = await readAll();
    const filtered = items.filter((a) => a.id !== id);
    await writeAll(filtered);
    res.status(204).send();
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: "Не удалось удалить запись" });
  }
});
