import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export type ServiceRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

const defaultServices: string[] = [
  // Диагностика
  "Компьютерная диагностика",
  "Диагностика ЭЛ. оборудования",
  "Диагностика ЭЛ. проводки",
  "Диагностика впускного тракта",
  "Диагностика выпускного тракта",
  // Ремонт
  "Ремонт трапеции",
  "Ремонт фар",
  "Ремонт кондиционера",
  "Ремонт зажигания",
  "Ремонт щитка приборов",
  "Ремонт печки",
  "Ремонт стеклоподъемника",
  "Ремонт замка",
  // Замена
  "Замена свечей",
  "Замена форсунок",
  "Замена катушек",
  "Замена моторчика",
  "Замена трапеции",
  "Замена фар",
  "Замена ремня",
  "Замена вентилятора",
  "Замена радиатора",
  "Замена стеклоподъемника",
  "Замена щитка приборов",
  "Замена замка",
  // Установка
  "Установка магнитолы",
  "Установка камеры з/в",
];

const dataPath = path.resolve(__dirname, "..", "..", "data", "services.json");

const ensureFile = async () => {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  try {
    await fs.access(dataPath);
  } catch {
    const now = new Date().toISOString();
    const seeded: ServiceRecord[] = defaultServices.map((name) => ({
      id: crypto.randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
    }));
    await fs.writeFile(dataPath, JSON.stringify(seeded, null, 2), "utf8");
  }
};

const readAll = async (): Promise<ServiceRecord[]> => {
  await ensureFile();
  const raw = await fs.readFile(dataPath, "utf8");
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        id: String(item.id ?? ""),
        name: String(item.name ?? "").trim(),
        createdAt: item.createdAt ?? new Date().toISOString(),
        updatedAt: item.updatedAt ?? item.createdAt ?? new Date().toISOString(),
      }))
      .filter((item) => item.id && item.name);
  } catch {
    return [];
  }
};

const writeAll = async (items: ServiceRecord[]) => {
  await ensureFile();
  await fs.writeFile(dataPath, JSON.stringify(items, null, 2), "utf8");
};

const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ");

export const listServices = async (query?: string) => {
  const items = await readAll();
  const q = query?.trim().toLowerCase();
  const filtered = q ? items.filter((item) => item.name.toLowerCase().includes(q)) : items;
  return filtered;
};

export const listServiceNames = async (query?: string) => {
  const items = await listServices(query);
  return items.map((item) => item.name);
};

export const createService = async (name: string) => {
  const items = await readAll();
  const normalized = normalizeName(name);
  const exists = items.some((item) => item.name.toLowerCase() === normalized.toLowerCase());
  if (exists) {
    const err = new Error("Service already exists");
    (err as any).code = "DUPLICATE";
    throw err;
  }
  const now = new Date().toISOString();
  const record: ServiceRecord = {
    id: crypto.randomUUID(),
    name: normalized,
    createdAt: now,
    updatedAt: now,
  };
  items.push(record);
  await writeAll(items);
  return record;
};

export const updateService = async (id: string, name: string) => {
  const items = await readAll();
  const normalized = normalizeName(name);
  const idx = items.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  const exists = items.some((item, i) => i !== idx && item.name.toLowerCase() === normalized.toLowerCase());
  if (exists) {
    const err = new Error("Service already exists");
    (err as any).code = "DUPLICATE";
    throw err;
  }
  const updated: ServiceRecord = {
    ...items[idx]!,
    name: normalized,
    updatedAt: new Date().toISOString(),
  };
  items[idx] = updated;
  await writeAll(items);
  return updated;
};

export const deleteService = async (id: string) => {
  const items = await readAll();
  const idx = items.findIndex((item) => item.id === id);
  if (idx === -1) return false;
  items.splice(idx, 1);
  await writeAll(items);
  return true;
};
