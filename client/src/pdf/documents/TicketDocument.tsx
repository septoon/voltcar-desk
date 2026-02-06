import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { Ticket, TicketLine } from "../types";
import { registerFonts } from "../fonts/registerFonts";

registerFonts();

/* ===================== STYLES ===================== */
const styles = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingHorizontal: 52,
    paddingBottom: 54,
    fontSize: 9,
    lineHeight: 1.15,
    fontFamily: "DejaVu",
    color: "#000",
  },

  /* ===== Header ===== */
  header: {
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 34,
  },
  companyBlock: {
    alignSelf: "flex-start",
  },
  company: {
    fontWeight: 700,
    fontSize: 10,
    marginBottom: 12,
  },
  muted: {
    fontSize: 9.5,
    marginBottom: 5,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 9.5,
    marginTop: 8,
    marginBottom: 10,
  },

  /* ===== Info table (narrow & stable) ===== */
  infoTable: {
    width: "100%",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 22,
  },
  infoRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoCell: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRightWidth: 1,
    borderColor: "#000",
  },
  infoCellLast: {
    borderRightWidth: 0,
  },
  infoCellFull: {
    width: "100%",
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRightWidth: 0,
    borderColor: "#000",
  },

  /* top inline row (single Text, no breaks) */
  infoInlineText: {
    fontSize: 9,
    flexDirection: "row",
  },
  infoInlineLabel: {
    fontWeight: 700,
  },

  /* block rows */
  infoLabel: {
    fontWeight: 700,
    fontSize: 9,
    lineHeight: 1.0,
  },
  infoValue: {
    marginTop: 1,
    fontSize: 9.5,
    lineHeight: 1.05,
  },

  /* ===== Section title ===== */
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    textAlign: "center",
    marginTop: 22,
    marginBottom: 18,
  },

  /* ===== Tables ===== */
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  tableRowLast: {
    flexDirection: "row",
    borderBottomWidth: 0,
    borderColor: "#000",
  },
  cell: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRightWidth: 1,
    borderColor: "#000",
    fontSize: 9.5,
  },
  cellLast: {
    borderRightWidth: 0,
  },
  th: {
    fontWeight: 700,
    textAlign: "center",
    fontSize: 9.5,
  },

  /* ===== Totals ===== */
  totalsRightLine: {
    marginTop: 14,
    alignSelf: "flex-end",
    flexDirection: "row",
    gap: 6,
  },
  totalsRightLabel: {
    fontWeight: 700,
    fontSize: 10,
  },
  totalsRightValue: {
    fontWeight: 700,
    fontSize: 10,
  },
  amountWords: {
    marginTop: 14,
    fontSize: 9.5,
    fontWeight: 700,
  },

  /* ===== Signature ===== */
  signature: {
    marginTop: 32,
  },
  signatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});

/* ===================== HELPERS ===================== */
const currency = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
  }).format(value);

const formatIssuedAt = (value?: string) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return value || "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(
    2,
    "0"
  )} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const norm = (v: unknown) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

const nb = (v: unknown) => {
  const s = norm(v) ?? "—";
  // Replace regular spaces with NBSP so react-pdf doesn't break the line
  return s.replace(/\s+/g, "\u00A0");
};

const INFO_COL_1 = "38%";
const INFO_COL_2 = "30%";
const INFO_COL_3 = "32%";

const InfoInline = ({ label, value }: { label: string; value?: string | number | null }) => (
  <Text style={styles.infoInlineText}>
    <Text style={styles.infoInlineLabel}>{nb(label)}:{"\u00A0"}</Text>
    {nb(value)}
  </Text>
);

type TableColumn = { width: string | number };
const columns: TableColumn[] = [
  { width: 36 },
  { width: "46%" },
  { width: 80 },
  { width: 80 },
  { width: 80 },
];

const TableHeader = ({ title }: { title: string }) => (
  <View style={styles.tableHeader}>
    <Text style={[styles.cell, styles.th, { width: columns[0].width }]}>№</Text>
    <Text style={[styles.cell, styles.th, { width: columns[1].width }]}>{title}</Text>
    <Text style={[styles.cell, styles.th, { width: columns[2].width }]}>Кол-во</Text>
    <Text style={[styles.cell, styles.th, { width: columns[3].width }]}>Цена</Text>
    <Text style={[styles.cell, styles.cellLast, styles.th, { width: columns[4].width }]}>Сумма</Text>
  </View>
);

const TableRow = ({ item, index, total }: { item: TicketLine; index: number; total: number }) => {
  const sum = item.qty * item.price;
  const isLast = index === total - 1;

  return (
    <View style={isLast ? styles.tableRowLast : styles.tableRow}>
      <Text style={[styles.cell, { width: columns[0].width, textAlign: "right" }]}>{index + 1}</Text>
      <Text style={[styles.cell, { width: columns[1].width }]}>{item.title}</Text>
      <Text style={[styles.cell, { width: columns[2].width, textAlign: "right" }]}>{item.qty}</Text>
      <Text style={[styles.cell, { width: columns[3].width, textAlign: "right" }]}>{item.price}</Text>
      <Text style={[styles.cell, styles.cellLast, { width: columns[4].width, textAlign: "right" }]}>{sum}</Text>
    </View>
  );
};

/* ===================== DOCUMENT ===================== */
export const TicketDocument = ({ ticket }: { ticket: Ticket }) => {
  const services = ticket.services ?? [];
  const servicesTotal = services.reduce((a, i) => a + i.qty * i.price, 0);
  const parts = ticket.parts ?? [];
  const partsTotal = parts.reduce((a, i) => a + i.qty * i.price, 0);
  const discountBase = servicesTotal;

  const discountPercentRaw = ticket.discountPercent ?? 0;
  const discountPercent = Number.isFinite(Number(discountPercentRaw)) ? Number(discountPercentRaw) : 0;
  const discountAmountRaw = ticket.discountAmount ?? 0;
  const discountAmountNum = Number(discountAmountRaw);
  const hasAmount = Number.isFinite(discountAmountNum) && discountAmountNum > 0;
  const discountAmount = hasAmount ? discountAmountNum : 0;
  const discountFromPercent = discountPercent ? (discountBase * discountPercent) / 100 : 0;
  const discountValue = Math.min(hasAmount ? discountAmount : discountFromPercent, discountBase);
  const grandTotal = Math.max(discountBase - discountValue, 0) + partsTotal;

  const issuedAt = formatIssuedAt(ticket.issuedAt);
  const number = ticket.number ?? ticket.id ?? "";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Заказ-наряд № {number}</Text>

          <View style={styles.companyBlock}>
            <Text style={styles.company}>Авто Электрик Симферополь</Text>
            <Text style={styles.muted}>
              Адрес: 295000, Республика Крым, г. Симферополь, п. Айкаван, ул. Айвазовского, д. 21
            </Text>
            <Text style={styles.muted}>Телефон: +7 (978) 831-31-06</Text>
          </View>

          <Text style={styles.subtitle}>от {issuedAt}</Text>
        </View>

        {/* Info table */}
        <View style={styles.infoTable} wrap={false}>
          <View style={styles.infoRow}>
            <View style={[styles.infoCell, { width: INFO_COL_1, flexGrow: 0, flexShrink: 0 }]}>
              <InfoInline label="Заказчик" value={ticket.customerName} />
            </View>
            <View style={[styles.infoCell, { width: INFO_COL_2, flexGrow: 0, flexShrink: 0 }]}>
              <InfoInline label="Гос. номер" value={ticket.govNumber} />
            </View>
            <View style={[styles.infoCell, styles.infoCellLast, { width: INFO_COL_3, flexGrow: 0, flexShrink: 0 }]}>
              <InfoInline label="Пробег" value={ticket.mileage ? `${ticket.mileage} км` : null} />
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={[styles.infoCell, { width: INFO_COL_1, flexGrow: 0, flexShrink: 0 }]}>
              <InfoInline label="Телефон" value={ticket.phone} />
            </View>
            <View style={[styles.infoCell, { width: INFO_COL_2, flexGrow: 0, flexShrink: 0 }]}>
              <InfoInline label="Авто" value={ticket.vehicle} />
            </View>
            <View style={[styles.infoCell, styles.infoCellLast, { width: INFO_COL_3, flexGrow: 0, flexShrink: 0 }]}>
              <InfoInline label="VIN" value={ticket.vinNumber} />
            </View>
          </View>

          <View style={[styles.infoRow, styles.infoRowLast]}>
            <View style={styles.infoCellFull}>
              <InfoInline label="Вид ремонта" value={ticket.service} />
            </View>
          </View>
        </View>

        {/* Section */}
        <Text style={styles.sectionTitle}>
          Выполненные работы по заказ-наряду № {number} от {issuedAt}
        </Text>

        {/* Table */}
        <View style={styles.table}>
          <TableHeader title="Наименование" />
          {services.map((item, i) => (
            <TableRow key={`svc-${i}`} item={item} index={i} total={services.length} />
          ))}
          {services.length === 0 ? (
            <View style={styles.tableRowLast}>
              <Text style={[styles.cell, styles.cellLast, { width: "100%", textAlign: "center" }]}>
                Работы отсутствуют
              </Text>
            </View>
          ) : null}
        </View>

        {/* Parts */}
        {parts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Запчасти по заказ-наряду № {number} от {issuedAt}</Text>
            <View style={styles.table}>
              <TableHeader title="Наименование" />
              {parts.map((item, i) => (
                <TableRow key={`part-${i}`} item={item} index={i} total={parts.length} />
              ))}
            </View>
          </>
        )}

        {/* Totals */}
        <View style={[styles.totalsRightLine, { flexDirection: "column", alignItems: "flex-end", gap: 4 }]}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Text style={styles.totalsRightLabel}>Работы:</Text>
            <Text style={styles.totalsRightValue}>{currency(servicesTotal)}</Text>
          </View>
          {parts.length > 0 && (
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Text style={styles.totalsRightLabel}>Запчасти:</Text>
              <Text style={styles.totalsRightValue}>{currency(partsTotal)}</Text>
            </View>
          )}
          {discountValue > 0 && (
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Text style={styles.totalsRightLabel}>
                {discountPercent > 0 ? `Скидка ${discountPercent}%:` : "Скидка:"}
              </Text>
              <Text style={styles.totalsRightValue}>- {currency(discountValue)}</Text>
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Text style={styles.totalsRightLabel}>Итого по заказ-наряду:</Text>
            <Text style={styles.totalsRightValue}>{currency(grandTotal)}</Text>
          </View>
        </View>

        {/* Signature */}
        <View style={styles.signature}>
          <View style={styles.signatureRow}>
            <Text>Мастер:</Text>
            <Text>____________</Text>
            <Text>/ Заргарян А. Д.</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default TicketDocument;
