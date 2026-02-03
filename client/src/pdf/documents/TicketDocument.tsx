import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { Ticket, TicketLine } from "../types";
import { registerFonts } from "../fonts/registerFonts";

registerFonts();

const styles = StyleSheet.create({
  page: {
    paddingTop: 42, // ~15mm
    paddingHorizontal: 42,
    paddingBottom: 32,
    fontSize: 12,
    lineHeight: 1.3,
    fontFamily: "DejaVu",
    color: "#000",
  },
  header: {
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 4,
    textAlign: "center",
  },
  company: {
    textAlign: "center",
    fontWeight: 700,
    marginTop: 16,
    marginBottom: 2,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 11,
    color: "#444",
  },
  muted: {
    color: "#444",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginTop: 12,
    marginBottom: 6,
  },
  infoTable: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000",
    borderBottomWidth: 0,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  infoCell: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderColor: "#000",
  },
  infoWide: {
    flex: 1.4,
  },
  infoLabel: {
    fontWeight: 700,
    marginRight: 4,
  },
  infoValue: {
    flex: 1,
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000",
    borderBottomWidth: 0,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  cell: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderColor: "#000",
  },
  noBorder: {
    borderRightWidth: 0,
  },
  totals: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontWeight: 700,
  },
  amountWords: {
    marginTop: 4,
  },
  signature: {
    marginTop: 28,
    alignItems: "flex-end",
  },
  signatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderColor: "#000",
    minWidth: 100,
  },
});

const currency = (value: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 2 }).format(value);

const formatIssuedAt = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return value || "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
};

const onesMale = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const onesFemale = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const tens = ["", "десять", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

type Unit = { one: string; few: string; many: string; female?: boolean };
const rubUnit: Unit = { one: "рубль", few: "рубля", many: "рублей" };
const kopUnit: Unit = { one: "копейка", few: "копейки", many: "копеек", female: true };
const thousandUnit: Unit = { one: "тысяча", few: "тысячи", many: "тысяч", female: true };
const millionUnit: Unit = { one: "миллион", few: "миллиона", many: "миллионов" };
const billionUnit: Unit = { one: "миллиард", few: "миллиарда", many: "миллиардов" };

const getUnit = (n: number, unit: Unit) => {
  const nAbs = Math.abs(n) % 100;
  const last = nAbs % 10;
  if (nAbs > 10 && nAbs < 20) return unit.many;
  if (last > 1 && last < 5) return unit.few;
  if (last === 1) return unit.one;
  return unit.many;
};

const triadToWords = (num: number, female: boolean) => {
  const words: string[] = [];
  const h = Math.floor(num / 100);
  const t = Math.floor((num % 100) / 10);
  const o = num % 10;
  if (h) words.push(hundreds[h]);
  if (t > 1) {
    words.push(tens[t]);
    if (o) words.push(female ? onesFemale[o] : onesMale[o]);
  } else if (t === 1) {
    words.push(teens[o]);
  } else if (o) {
    words.push(female ? onesFemale[o] : onesMale[o]);
  }
  return words.filter(Boolean).join(" ");
};

const amountToWords = (amount: number) => {
  const rubles = Math.floor(amount);
  const kopeks = Math.round((amount - rubles) * 100);

  const parts: string[] = [];
  const triads = [
    { value: rubles % 1000, unit: rubUnit, female: false },
    { value: Math.floor(rubles / 1000) % 1000, unit: thousandUnit, female: true },
    { value: Math.floor(rubles / 1_000_000) % 1000, unit: millionUnit, female: false },
    { value: Math.floor(rubles / 1_000_000_000) % 1000, unit: billionUnit, female: false },
  ];

  triads.forEach((triad, idx) => {
    if (triad.value === 0) return;
    const words = triadToWords(triad.value, triad.female ?? false);
    const unitLabel = getUnit(triad.value, triad.unit);
    parts.push(`${words} ${unitLabel}`.trim());
  });

  const rublesLabel = getUnit(rubles, rubUnit);
  if (!parts.length) {
    parts.push(`ноль ${rublesLabel}`);
  }

  const kopLabel = getUnit(kopeks, kopUnit);
  const kopString = `${kopeks.toString().padStart(2, "0")} ${kopLabel}`;

  return `${parts.reverse().join(" ")} ${kopString}`;
};

type TableColumn = { width: string | number; align?: "left" | "right" | "center" };
const columns: TableColumn[] = [
  { width: 40, align: "right" },
  { width: "46%", align: "left" },
  { width: 90, align: "right" },
  { width: 90, align: "right" },
  { width: 90, align: "right" },
];

const TableHeader = ({ title }: { title: string }) => (
  <View style={[styles.tableHeader]}>
    <Text style={[styles.cell, { width: columns[0].width, fontWeight: 700, textAlign: "center" }]}>№</Text>
    <Text style={[styles.cell, { width: columns[1].width, fontWeight: 700 }]}>{title}</Text>
    <Text style={[styles.cell, { width: columns[2].width, fontWeight: 700, textAlign: "center" }]}>Кол-во</Text>
    <Text style={[styles.cell, { width: columns[3].width, fontWeight: 700, textAlign: "center" }]}>Цена</Text>
    <Text style={[styles.cell, styles.noBorder, { width: columns[4].width, fontWeight: 700, textAlign: "center" }]}>
      Сумма
    </Text>
  </View>
);

const TableRow = ({ item, index }: { item: TicketLine; index: number }) => {
  const sum = item.qty * item.price;
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.cell, { width: columns[0].width, textAlign: "right" }]}>{index + 1}</Text>
      <Text style={[styles.cell, { width: columns[1].width }]}>{item.title}</Text>
      <Text style={[styles.cell, { width: columns[2].width, textAlign: "right" }]}>{item.qty}</Text>
      <Text style={[styles.cell, { width: columns[3].width, textAlign: "right" }]}>{item.price.toLocaleString("ru-RU")}</Text>
      <Text style={[styles.cell, styles.noBorder, { width: columns[4].width, textAlign: "right" }]}>
        {sum.toLocaleString("ru-RU")}
      </Text>
    </View>
  );
};

const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
  <Text>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value ?? "—"}</Text>
  </Text>
);

export const TicketDocument = ({ ticket }: { ticket: Ticket }) => {
  const services = ticket.services ?? [];
  const parts = ticket.parts ?? [];
  const servicesTotal = services.reduce((acc, item) => acc + item.qty * item.price, 0);
  const partsTotal = parts.reduce((acc, item) => acc + item.qty * item.price, 0);
  const subtotal = servicesTotal + partsTotal;
  const discountNumeric =
    ticket.discountAmount && ticket.discountAmount > 0
      ? ticket.discountAmount
      : ticket.discountPercent
      ? Math.max(0, (subtotal * ticket.discountPercent) / 100)
      : 0;
  const total = Math.max(subtotal - discountNumeric, 0);
  const issuedAt = formatIssuedAt(ticket.issuedAt) || formatIssuedAt();
  const number = ticket.number ?? ticket.id ?? "";
  const totalWords = amountToWords(total);

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} wrap={false}>
          <Text style={styles.title}>Заказ-наряд № {number}</Text>
          <Text style={styles.company}>Авто Электрик Симферополь</Text>
          <Text style={styles.muted}>Адрес: 295000, Республика Крым, г. Симферополь, п. Айкаван, ул. Айвазовского, д. 21</Text>
          <Text style={styles.muted}>Телефон: +7 (978) 831-31-06</Text>
          <Text style={styles.subtitle}>от {issuedAt}</Text>
        </View>

        <View style={styles.infoTable} wrap={false}>
          <View style={styles.infoRow}>
            <View style={[styles.infoCell, { flex: 1 }]}>
              <InfoRow label="Заказчик: " value={ticket.customerName} />
            </View>
            <View style={[styles.infoCell, { flex: 1 }]}>
              <InfoRow label="Телефон заказчика: " value={ticket.phone} />
            </View>
            <View style={[styles.infoCell, styles.infoWide]}>
              <InfoRow label="Вид ремонта: " value={ticket.service} />
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.infoCell, { flex: 1 }]}>
              <InfoRow label="Автомобиль: " value={ticket.vehicle} />
            </View>
            <View style={[styles.infoCell, { flex: 0.8 }]}>
              <InfoRow label="Гос. номер: " value={ticket.govNumber} />
            </View>
            <View style={[styles.infoCell, { flex: 1 }]}>
              <InfoRow label="VIN: " value={ticket.vinNumber} />
            </View>
            <View style={[styles.infoCell, { flex: 0.7 }, styles.noBorder]}>
              <InfoRow label="Пробег: " value={ticket.mileage ? `${ticket.mileage} км` : ""} />
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Выполненные работы по заказ-наряду № {number} от {issuedAt}</Text>

        <View wrap>
          <View style={styles.table}>
            <TableHeader title="Наименование" />
            {services.length ? (
              services.map((item, idx) => <TableRow key={`${item.title}-${idx}`} item={item} index={idx} />)
            ) : (
              <View style={styles.tableRow}>
                <Text style={[styles.cell, { width: columns[0].width, textAlign: "right" }]}>1</Text>
                <Text style={[styles.cell, { width: columns[1].width }]}>—</Text>
                <Text style={[styles.cell, { width: columns[2].width, textAlign: "right" }]}>0</Text>
                <Text style={[styles.cell, { width: columns[3].width, textAlign: "right" }]}>0</Text>
                <Text style={[styles.cell, styles.noBorder, { width: columns[4].width, textAlign: "right" }]}>0</Text>
              </View>
            )}
          </View>
        </View>

        {parts.length ? (
          <View style={{ marginTop: 12 }} wrap>
            <Text style={styles.sectionTitle}>Материалы</Text>
            <View style={styles.table}>
              <TableHeader title="Наименование" />
              {parts.map((item, idx) => (
                <TableRow key={`${item.title}-${idx}`} item={item} index={idx} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.totals} wrap={false}>
          <View style={styles.totalRow}>
            <Text>Итого работ:</Text>
            <Text style={styles.totalLabel}>{currency(servicesTotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Итого материалов:</Text>
            <Text style={styles.totalLabel}>{currency(partsTotal)}</Text>
          </View>
          {discountNumeric > 0 ? (
            <View style={styles.totalRow}>
              <Text>Скидка:</Text>
              <Text style={styles.totalLabel}>-{currency(discountNumeric)}</Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text>ИТОГО:</Text>
            <Text style={[styles.totalLabel, { fontSize: 12 }]}>{currency(total)}</Text>
          </View>
          <View style={styles.amountWords}>
            <Text>{totalWords}</Text>
          </View>
        </View>

        <View style={styles.signature} wrap={false}>
          <View style={styles.signatureRow}>
            <Text>Мастер</Text>
            <View style={styles.signatureLine} />
            <Text>/ Заргарян А. Д.</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default TicketDocument;
