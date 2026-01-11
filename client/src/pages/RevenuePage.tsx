import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchOrders } from "../api/orders";
import { OrderPayload, WorkStatus } from "../types";
import { Loader } from "../components/Loader";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const sumLineItems = (items: { qty: number; price: number }[]) => items.reduce((acc, i) => acc + i.qty * i.price, 0);

const computeTotal = (order: OrderPayload) => {
  const services = sumLineItems(order.services ?? []);
  const parts = sumLineItems(order.parts ?? []);
  const subtotal = services + parts;
  const discount =
    typeof order.discountAmount === "number" && order.discountAmount
      ? order.discountAmount
      : ((order.discountPercent ?? 0) / 100) * subtotal;
  return Math.max(subtotal - (discount || 0), 0);
};

const parseDate = (value?: string) => {
  if (!value) return null;
  if (value.includes(".")) {
    const [d, m, y] = value.split(".").map((v) => Number(v));
    if (d && m && y) return new Date(y, m - 1, d);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const RevenuePage = () => {
  const [orders, setOrders] = useState<OrderPayload[]>([]);
  const [from, setFrom] = useState(() => formatDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(() => formatDateInput(new Date()));
  const [status, setStatus] = useState<"" | WorkStatus>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizeStatus = useCallback((value?: string): WorkStatus => {
    if (!value) return "NEW";
    const cleaned = value.trim().toUpperCase().replace(/\s+/g, "_").replace(/-+/g, "_");
    if (cleaned === "PAYED") return "PAYED";
    if (["IN_PROGRESS", "INPROGRESS", "IN_PROGRESS_", "ISSUED"].includes(cleaned)) return "IN_PROGRESS";
    return "NEW";
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchOrders();
        setOrders(
          data.map((order: OrderPayload) => ({
            ...order,
            status: normalizeStatus(order.status),
          })),
        );
      } catch (err) {
        console.error(err);
        setError("Не удалось загрузить данные");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const stats = useMemo(() => {
    const start = from ? new Date(from) : null;
    const end = to ? new Date(to) : null;
    const filtered = orders.filter((o) => {
      const normalized = normalizeStatus(o.status);
      if (normalized !== "PAYED") return false;
      if (status && normalized !== status) return false;
      const date = parseDate(o.date);
      if (start && date && date < start) return false;
      if (end && date && date > end) return false;
      return true;
    });
    const total = filtered.reduce((acc, o) => acc + computeTotal(o), 0);
    return { count: filtered.length, total, filtered };
  }, [orders, from, to, status, normalizeStatus]);

  const monthlyChartData = useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
    const map = new Map<
      string,
      { label: string; revenue: number; services: number; parts: number; dateKey: string }
    >();
    stats.filtered.forEach((o) => {
      const date = parseDate(o.date);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = monthFormatter.format(date);
      const revenue = computeTotal(o);
      const servicesSum = sumLineItems(o.services ?? []);
      const partsSum = sumLineItems(o.parts ?? []);
      if (!map.has(key)) {
        map.set(key, { label, revenue: 0, services: 0, parts: 0, dateKey: key });
      }
      const prev = map.get(key)!;
      map.set(key, {
        ...prev,
        revenue: prev.revenue + revenue,
        services: prev.services + servicesSum,
        parts: prev.parts + partsSum,
      });
    });
    return Array.from(map.values()).sort((a, b) => (a.dateKey > b.dateKey ? 1 : -1));
  }, [stats.filtered]);

  const palette = useMemo(
    () => ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc949", "#af7aa1", "#ff9da7", "#9c755f", "#bab0ab"],
    [],
  );

  const donutData = useMemo(() => {
    const serviceMap = new Map<string, number>();
    stats.filtered.forEach((o) => {
      (o.services ?? []).forEach((s) => {
        const sum = (Number(s.qty) || 0) * (Number(s.price) || 0);
        if (!sum) return;
        serviceMap.set(s.title, (serviceMap.get(s.title) || 0) + sum);
      });
    });
    const entries = Array.from(serviceMap.entries())
      .filter(([, v]) => v > 0)
      .map(([name, value], idx) => ({
        name,
        value,
        color: palette[idx % palette.length],
      }));
    if (!entries.length) {
      return [{ name: "Нет данных", value: 1, color: "#dcdcdc" }];
    }
    return entries;
  }, [stats.filtered, palette]);

  const paymentTotals = useMemo(() => {
    let cash = 0;
    let card = 0;
    stats.filtered.forEach((o) => {
      (o.payments ?? []).forEach((p) => {
        const amount = Number(p.amount) || 0;
        const method = (p.method || "cash").toLowerCase();
        if (method === "card") card += amount;
        else cash += amount;
      });
    });
    return { cash, card, total: cash + card };
  }, [stats.filtered]);

  return (
    <div className="mx-auto flex flex-col gap-3 p-3 max-[960px]:pt-16">
      <header className="flex items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 shadow-sm">
        <h2 className="text-xl font-bold text-[#1f1f1f]">Данные по выручкам</h2>
        <div className="flex flex-wrap max-[960px]:justify-end max-[960px]:p-0 gap-3 px-4 py-3 text-sm">
          <label className="flex items-center gap-2">
            С
            <input
              className="rounded-md border border-[#cfcfcf] bg-white px-2 py-1 focus:outline-none"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2">
            По
            <input
              className="rounded-md border border-[#cfcfcf] bg-white px-2 py-1 focus:outline-none"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      </header>


      {loading && <Loader />}
      {error && <div className="border border-[#d20000] bg-[#ffecec] px-3 py-2 text-sm">{error}</div>}

      <div className="grid gap-2 rounded-xl border border-[#e5e5e5] bg-white p-4 shadow-sm lg:grid-cols-[2fr_1fr]">
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyChartData}>
              <CartesianGrid stroke="#e5e5e5" strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="revenue" name="Выручка" barSize={28} fill="#4e79a7" />
              <Line type="monotone" dataKey="services" name="Работы" stroke="#f28e2b" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="parts" name="Запчасти" stroke="#76b7b2" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="flex h-80 flex-col items-center justify-center">
          <h4 className="mb-2 text-sm font-semibold text-[#1f1f1f]">Распределение услуг</h4>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {donutData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color as string} />
                ))}
              </Pie>
              <Tooltip formatter={(val: any, name) => [`${Number(val).toLocaleString("ru-RU")}`, name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>

        </div>
        <div className="flex flex-col gap-2 w-full rounded-xl border border-[#e5e5e5] bg-white p-4 text-sm text-[#404040] shadow-sm">
          <div className="flex items-center justify-between max-[960px]:w-full">
            <span className="text-[#555555]">Количество заказов:</span>
            <span className="text-[15px] font-semibold text-[#4e79a7]">{stats.count}</span>
          </div>
          <div className="flex items-center justify-between max-[960px]:w-full">
            <span className="text-[#555555]">Наличные:</span>
            <span className="text-[15px] font-semibold text-[#1f1f1f]">
              {paymentTotals.cash.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽
            </span>
          </div>
          <div className="flex items-center justify-between max-[960px]:w-full">
            <span className="text-[#555555]">Перевод:</span>
            <span className="text-[15px] font-semibold text-[#1f1f1f]">
              {paymentTotals.card.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ₽
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-[#ededed] pt-2 max-[960px]:w-full">
            <span className="text-[#555555]">Итоговая сумма:</span>
            <span className="text-[16px] font-bold text-[#4e79a7]">
              {stats.total.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} <span className="text-[#4e79a7]">₽</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
