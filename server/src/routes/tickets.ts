import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { config } from "../config";

const sanitizeTicketId = (value: string | number | undefined) => String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
const ticketsRoot = path.join(config.uploadDir, "tickets");

const ensureTicketsRoot = async () => {
  await fs.mkdir(ticketsRoot, { recursive: true });
};

const listPdfFiles = async () => {
  await ensureTicketsRoot();
  const items: Array<{ name: string; ticketId?: string; size: number; mtime: string; url: string; downloadUrl: string }> = [];

  const entries = await fs.readdir(ticketsRoot);
  for (const entry of entries) {
    const dirPath = path.join(ticketsRoot, entry);
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) continue;
    const files = await fs.readdir(dirPath);
    for (const name of files.filter((n) => n.toLowerCase().endsWith(".pdf"))) {
      const full = path.join(dirPath, name);
      const fileStat = await fs.stat(full);
      const relative = path.join("tickets", entry, name).replace(/\\/g, "/");
      items.push({
        name,
        ticketId: entry,
        size: fileStat.size,
        mtime: fileStat.mtime.toISOString(),
        url: `/uploads/${relative}`,
        downloadUrl: `/uploads/${relative}`,
      });
    }
  }

  const legacyFiles = await fs.readdir(config.uploadDir);
  for (const name of legacyFiles.filter((n) => n.toLowerCase().endsWith(".pdf"))) {
    if (name === "tickets") continue;
    const full = path.join(config.uploadDir, name);
    const stat = await fs.stat(full);
    const relative = name.replace(/\\/g, "/");
    items.push({
      name,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
      url: `/uploads/${relative}`,
      downloadUrl: `/uploads/${relative}`,
    });
  }

  return items.sort((a, b) => (a.mtime > b.mtime ? -1 : 1));
};

const findExistingFile = async (candidates: string[]) => {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // keep searching
    }
  }
  return null;
};

const inferTicketId = (name: string) => {
  const match = name.match(/ticket-([a-zA-Z0-9_-]+)\.pdf/i);
  return match ? match[1] : null;
};

export const ticketsRouter = Router();

ticketsRouter.get("/", async (_req, res, next) => {
  try {
    const files = await listPdfFiles();
    res.json(files);
  } catch (error) {
    next(error);
  }
});

ticketsRouter.get("/:ticketId/pdf", async (req, res) => {
  try {
    await ensureTicketsRoot();
    const ticketId = sanitizeTicketId(req.params.ticketId);
    if (!ticketId) return res.status(400).json({ error: "Некорректный идентификатор" });
    const filename = req.query.filename ? path.basename(String(req.query.filename)) : `ticket-${ticketId}.pdf`;
    const filePath = path.resolve(ticketsRoot, ticketId, filename);
    const allowedRoot = path.resolve(config.uploadDir);
    if (!filePath.startsWith(allowedRoot)) {
      return res.status(400).json({ error: "Invalid path" });
    }
    await fs.access(filePath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    return res.sendFile(filePath);
  } catch (error) {
    return res.status(404).json({ error: "PDF не найден" });
  }
});

ticketsRouter.delete("/:ticketId/pdf", async (req, res) => {
  try {
    await ensureTicketsRoot();
    const ticketId = sanitizeTicketId(req.params.ticketId);
    if (!ticketId) return res.status(400).json({ error: "Некорректный идентификатор" });
    const filename = req.query.filename ? path.basename(String(req.query.filename)) : `ticket-${ticketId}.pdf`;
    const filePath = path.resolve(ticketsRoot, ticketId, filename);
    const allowedRoot = path.resolve(config.uploadDir);
    if (!filePath.startsWith(allowedRoot)) {
      return res.status(400).json({ error: "Invalid path" });
    }
    await fs.unlink(filePath);
    try {
      const dir = path.dirname(filePath);
      const rest = await fs.readdir(dir);
      if (rest.length === 0) {
        await fs.rmdir(dir);
      }
    } catch {
      // ignore cleanup errors
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(404).json({ error: "PDF не найден" });
  }
});

ticketsRouter.get("/file/:name", async (req, res, next) => {
  try {
    await ensureTicketsRoot();
    const safeName = path.basename(req.params.name);
    const allowedRoot = path.resolve(config.uploadDir);
    const inferredId = sanitizeTicketId((req.query.ticketId as string | undefined) ?? inferTicketId(safeName) ?? "");
    const candidates = [
      path.resolve(config.uploadDir, safeName),
      inferredId ? path.resolve(ticketsRoot, inferredId, safeName) : "",
    ].filter(Boolean);

    const existing = await findExistingFile(candidates);
    if (!existing) {
      return res.status(404).json({ error: "PDF не найден" });
    }
    if (!existing.startsWith(allowedRoot)) {
      return res.status(400).json({ error: "Invalid path" });
    }
    const download = req.query.download === "1";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${safeName}"`);
    return res.sendFile(existing);
  } catch (error) {
    return next(error);
  }
});

ticketsRouter.delete("/file/:name", async (req, res, next) => {
  try {
    await ensureTicketsRoot();
    const safeName = path.basename(req.params.name);
    const allowedRoot = path.resolve(config.uploadDir);
    const inferredId = sanitizeTicketId((req.query.ticketId as string | undefined) ?? inferTicketId(safeName) ?? "");
    const candidates = [
      path.resolve(config.uploadDir, safeName),
      inferredId ? path.resolve(ticketsRoot, inferredId, safeName) : "",
    ].filter(Boolean);

    const existing = await findExistingFile(candidates);
    if (!existing) {
      return res.status(404).json({ error: "PDF не найден" });
    }
    if (!existing.startsWith(allowedRoot)) {
      return res.status(400).json({ error: "Invalid path" });
    }

    await fs.unlink(existing);
    try {
      const dir = path.dirname(existing);
      if (dir.startsWith(ticketsRoot)) {
        const rest = await fs.readdir(dir);
        if (rest.length === 0) {
          await fs.rmdir(dir);
        }
      }
    } catch {
      // ignore cleanup errors
    }

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});
