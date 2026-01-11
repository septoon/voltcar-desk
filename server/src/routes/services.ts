import { Router } from "express";
import { createService, deleteService, listServiceNames, listServices, updateService } from "../services/serviceStore";

export const servicesRouter = Router();

const normalizeName = (value?: string) => value?.trim().replace(/\s+/g, " ") ?? "";

servicesRouter.get("/", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const query = (req.query.q as string | undefined) ?? "";
  const full = String(req.query.full ?? "").toLowerCase();
  const needFull = full === "1" || full === "true";
  try {
    if (needFull) {
      const items = await listServices(query);
      return res.json(items);
    }
    const names = await listServiceNames(query);
    return res.json(names);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Не удалось загрузить услуги" });
  }
});

servicesRouter.post("/", async (req, res) => {
  const name = normalizeName(req.body?.name);
  if (!name) return res.status(400).json({ error: "Название услуги обязательно" });
  if (name.length > 200) return res.status(400).json({ error: "Название слишком длинное" });
  try {
    const created = await createService(name);
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === "DUPLICATE") return res.status(409).json({ error: "Такая услуга уже существует" });
    console.error(err);
    return res.status(500).json({ error: "Не удалось сохранить услугу" });
  }
});

servicesRouter.put("/:id", async (req, res) => {
  const name = normalizeName(req.body?.name);
  if (!name) return res.status(400).json({ error: "Название услуги обязательно" });
  if (name.length > 200) return res.status(400).json({ error: "Название слишком длинное" });
  try {
    const updated = await updateService(req.params.id, name);
    if (!updated) return res.status(404).json({ error: "Услуга не найдена" });
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === "DUPLICATE") return res.status(409).json({ error: "Такая услуга уже существует" });
    console.error(err);
    return res.status(500).json({ error: "Не удалось сохранить услугу" });
  }
});

servicesRouter.delete("/:id", async (req, res) => {
  try {
    const ok = await deleteService(req.params.id);
    if (!ok) return res.status(404).json({ error: "Услуга не найдена" });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Не удалось удалить услугу" });
  }
});
