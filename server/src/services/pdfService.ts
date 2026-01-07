import fs from "fs/promises";
import path from "path";
import puppeteer from "puppeteer";
import { config } from "../config";
import * as numberWords from "number-to-words-ru";

export type TicketPayload = {
  id?: string | number;
  customerName: string;
  phone?: string;
  vehicle?: string;
  govNumber?: string;
  vinNumber?: string;
  mileage?: number | null;
  reason?: string;
  status?: string;
  date?: string;
  services?: { title: string; qty: number; price: number }[];
  parts?: { title: string; qty: number; price: number }[];
  service?: string;
  totalCents: number;
  totalWithoutDiscountCents?: number;
  discountCents?: number;
  discountPercent?: number;
  notes?: string;
  issuedAt?: string;
};

const templatePath = path.resolve(__dirname, "..", "..", "templates", "ticket.html");

const replacePlaceholders = (template: string, replacements: Record<string, string>) =>
  template.replace(/{{\s*(\w+)\s*}}/g, (_match, key: string) => replacements[key] ?? "");

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 2 }).format(cents / 100);

export const generateTicketPdf = async (payload: TicketPayload) => {
  const issuedAt = payload.issuedAt ? new Date(payload.issuedAt) : new Date();
  const template = await fs.readFile(templatePath, "utf-8");
  const logoBuffer = await fs.readFile(path.resolve(__dirname, "..", "..", "templates", "volt_logo_pdf.png"));
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  const servicesCents = payload.services
    ? payload.services.reduce((acc, s) => acc + Math.round((Number(s.qty) || 0) * (Number(s.price) || 0) * 100), 0)
    : 0;
  const partsCents = payload.parts
    ? payload.parts.reduce((acc, p) => acc + Math.round((Number(p.qty) || 0) * (Number(p.price) || 0) * 100), 0)
    : 0;

  const totalWithoutDiscountCents =
    payload.totalWithoutDiscountCents ?? (servicesCents || partsCents ? servicesCents + partsCents : payload.totalCents);
  const explicitDiscountCents = payload.discountCents != null ? Math.round(Number(payload.discountCents) || 0) : 0;
  const derivedDiscountCents =
    explicitDiscountCents === 0 && payload.discountPercent
      ? Math.round(((Number(payload.discountPercent) || 0) / 100) * totalWithoutDiscountCents)
      : explicitDiscountCents;
  const discountCents = derivedDiscountCents;
  const totalNet = Math.max(totalWithoutDiscountCents - discountCents, 0);
  const discountPercent =
    payload.discountPercent != null && !Number.isNaN(Number(payload.discountPercent))
      ? Number(payload.discountPercent)
      : discountCents > 0 && totalWithoutDiscountCents > 0
      ? Math.round((discountCents / totalWithoutDiscountCents) * 100)
      : 0;
  const discountRow =
    discountCents > 0
      ? `<tr><td colspan="4" class="right"><strong>Скидка</strong></td><td class="right">${formatCurrency(discountCents)}</td></tr>`
      : "";
  const servicesRows =
    payload.services && payload.services.length
      ? payload.services
          .map((s, idx) => {
            const qty = Number.isFinite(s.qty) ? s.qty : 0;
            const price = Number.isFinite(s.price) ? s.price : 0;
            return `<tr><td class="right">${idx + 1}</td><td>${s.title}</td><td class="right">${qty}</td><td class="right">${price.toLocaleString(
              "ru-RU",
            )}</td><td class="right">${(qty * price).toLocaleString("ru-RU")}</td></tr>`;
          })
          .join("")
      : `<tr><td class="right">1</td><td>—</td><td class="right">0</td><td class="right">0</td><td class="right">0</td></tr>`;

  const partsVisible = partsCents > 0;
  const partsRows =
    partsVisible && payload.parts && payload.parts.length
      ? payload.parts
          .map((p, idx) => {
            const qty = Number.isFinite(p.qty) ? p.qty : 0;
            const price = Number.isFinite(p.price) ? p.price : 0;
            return `<tr><td class="right">${idx + 1}</td><td>${p.title}</td><td class="right">${qty}</td><td class="right">${price.toLocaleString(
              "ru-RU",
            )}</td><td class="right">${(qty * price).toLocaleString("ru-RU")}</td></tr>`;
          })
          .join("")
      : "";

  const totalWords = typeof (numberWords as any).convert === "function" ? (numberWords as any).convert(totalNet / 100) : `${(totalNet / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2 })} рублей`;

  const renderedHtml = replacePlaceholders(template, {
    ticketId: String(payload.id ?? Date.now()),
    customerName: payload.customerName,
    phone: payload.phone ?? "—",
    vehicle: payload.vehicle ?? "—",
    govNumber: payload.govNumber ?? "—",
    vinNumber: payload.vinNumber ?? "—",
    mileage: payload.mileage != null ? String(payload.mileage) : "—",
    status: payload.status ?? "—",
    reason: payload.reason ?? "—",
    date: payload.date ?? "",
    service: payload.service ?? "—",
    notes: payload.notes ?? "",
    total: formatCurrency(totalNet),
    totalGross: formatCurrency(totalWithoutDiscountCents),
    discount: formatCurrency(discountCents),
    servicesTotal: servicesCents ? formatCurrency(servicesCents) : formatCurrency(totalWithoutDiscountCents - partsCents),
    partsTotal: formatCurrency(partsCents),
    servicesRows,
    partsRows,
    showParts: partsVisible ? "" : 'style="display:none"',
    totalWords,
    discountRow,
    discountPercent: discountPercent ? String(discountPercent) : "0",
    discountAmount: discountCents > 0 ? formatCurrency(discountCents) : "",
    totalWithDiscount: formatCurrency(totalNet),
    showDiscount: discountCents > 0 ? "" : 'style="display:none"',
    issuedAt: issuedAt.toLocaleString(),
    logoSrc,
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(renderedHtml, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });

    const filename = `ticket-${payload.id ?? issuedAt.getTime()}.pdf`;
    const outputPath = path.join(config.uploadDir, filename);
    await fs.writeFile(outputPath, pdfBuffer);

    return { pdfBuffer, outputPath, filename };
  } finally {
    await browser.close();
  }
};
