import fs from "fs";
import path from "path";
import multer from "multer";
import { Router } from "express";
import { config } from "../config";

const sanitizeTicketId = (value: string | number | undefined) => String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
const ticketsRoot = path.join(config.uploadDir, "tickets");
fs.mkdirSync(ticketsRoot, { recursive: true });

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    try {
      const ticketId = sanitizeTicketId(Array.isArray(req.params.ticketId) ? req.params.ticketId[0] : req.params.ticketId);
      if (!ticketId) return cb(new Error("Некорректный идентификатор заказа"), "");
      const dest = path.join(ticketsRoot, ticketId);
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    } catch (error) {
      cb(error as Error, "");
    }
  },
  filename(req, file, cb) {
    const ticketId = sanitizeTicketId(Array.isArray(req.params.ticketId) ? req.params.ticketId[0] : req.params.ticketId) || Date.now();
    const original = file.originalname?.toLowerCase().endsWith(".pdf") ? file.originalname : null;
    const safeName = original || `ticket-${ticketId}.pdf`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  fileFilter(_req, file, cb) {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Только PDF файлы разрешены"));
    }
  },
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

export const filesRouter = Router();

filesRouter.post("/tickets/:ticketId/pdf", upload.single("file"), (req, res) => {
  const ticketId = sanitizeTicketId(Array.isArray(req.params.ticketId) ? req.params.ticketId[0] : req.params.ticketId);
  if (!ticketId) {
    return res.status(400).json({ error: "Некорректный идентификатор заказа" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Файл не загружен" });
  }
  const relativePath = path.join("tickets", ticketId, req.file.filename).replace(/\\/g, "/");
  const url = `/api/tickets/${encodeURIComponent(ticketId)}/pdf?filename=${encodeURIComponent(req.file.filename)}`;

  return res.json({ url, path: relativePath });
});
