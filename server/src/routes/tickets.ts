import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { generateTicketPdf, type TicketPayload } from "../services/pdfService";
import { config } from "../config";

export const ticketsRouter = Router();

ticketsRouter.get("/", async (_req, res, next) => {
  try {
    const files = await fs.readdir(config.uploadDir);
    const ticketFiles = await Promise.all(
      files
        .filter((name) => name.toLowerCase().endsWith(".pdf"))
        .map(async (name) => {
          const full = path.join(config.uploadDir, name);
          const stat = await fs.stat(full);
          return {
            name,
            size: stat.size,
            mtime: stat.mtime.toISOString(),
            url: `/api/tickets/file/${encodeURIComponent(name)}`,
            downloadUrl: `/api/tickets/file/${encodeURIComponent(name)}?download=1`,
          };
        }),
    );
    res.json(ticketFiles.sort((a, b) => (a.mtime > b.mtime ? -1 : 1)));
  } catch (error) {
    next(error);
  }
});

ticketsRouter.get("/file/:name", async (req, res, next) => {
  try {
    const name = req.params.name;
    const filePath = path.resolve(config.uploadDir, name);
    if (!filePath.startsWith(path.resolve(config.uploadDir))) {
      return res.status(400).json({ error: "Invalid path" });
    }
    await fs.access(filePath);
    const download = req.query.download === "1";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${name}"`);
    return res.sendFile(filePath);
  } catch (error) {
    return next(error);
  }
});

ticketsRouter.post("/pdf", async (req, res, next) => {
  try {
    const {
      customerName,
      vehicle,
      service,
      totalCents,
      notes,
      phone,
      govNumber,
      vinNumber,
      mileage,
      status,
      date,
      services,
      parts,
    } = req.body as Partial<TicketPayload>;

    const parsedTotal = Number(totalCents);
    if (!customerName || Number.isNaN(parsedTotal)) {
      return res.status(400).json({ error: "customerName and numeric totalCents are required" });
    }

    const payload: TicketPayload = {
      id: (req.body as any).id ?? Date.now(),
      customerName: customerName,
      totalCents: Math.round(parsedTotal),
      issuedAt: new Date().toISOString(),
      vehicle: vehicle ?? "",
      service: service ?? "",
      notes: notes ?? "",
      phone: phone ?? "",
      govNumber: govNumber ?? "",
      vinNumber: vinNumber ?? "",
      mileage: mileage ?? null,
      status: status ?? "",
      date: date ?? "",
      services: services ?? [],
      parts: parts ?? [],
    };

    const { filename, pdfBuffer } = await generateTicketPdf(payload);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    return next(error);
  }
});
