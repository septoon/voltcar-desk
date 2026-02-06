import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchOrders } from "../api/orders";
import { fetchTickets, TicketInfo, ticketUrl } from "../api/tickets";
import { Loader } from "../components/Loader";
import { OrderPayload } from "../types";

const currency = (value: number) => value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sumLineItems = (items: { qty: number; price: number }[] = []) => items.reduce((acc, i) => acc + i.qty * i.price, 0);
const computeTotal = (order: OrderPayload) => {
  const services = sumLineItems(order.services ?? []);
  const parts = sumLineItems(order.parts ?? []);
  const discountBase = services;
  const discountAmount = typeof order.discountAmount === "number" && order.discountAmount ? order.discountAmount : 0;
  const discountPercent = order.discountPercent ?? 0;
  const discountFromPercent = (discountBase * discountPercent) / 100;
  const discountValue = Math.min(Math.max(discountAmount > 0 ? discountAmount : discountFromPercent, 0), discountBase);
  return Math.max(discountBase - discountValue, 0) + parts;
};

const hasDraftContent = (draft: Partial<OrderPayload>) =>
  Boolean(
    draft &&
      ((draft as any).company?.toString().trim() ||
        draft.customer?.toString().trim() ||
        draft.phone?.toString().trim() ||
        draft.car?.toString().trim() ||
        draft.govNumber?.toString().trim() ||
        draft.vinNumber?.toString().trim() ||
        draft.reason?.toString().trim() ||
        (draft.services && draft.services.length) ||
        (draft.parts && draft.parts.length) ||
        (draft.payments && draft.payments.length) ||
        (draft.mileage && draft.mileage > 0) ||
        (typeof draft.prepayment === "number" && draft.prepayment > 0)),
  );

const mergeDraft = (order: OrderPayload): OrderPayload => {
  if (typeof window === "undefined" || !order.id) return order;
  const key = `order-draft-${order.id}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return order;
    const draft = JSON.parse(raw) as Partial<OrderPayload>;
    if (!hasDraftContent(draft)) return order;
    return {
      ...order,
      ...draft,
      services: draft.services ?? order.services ?? [],
      parts: draft.parts ?? order.parts ?? [],
      payments: draft.payments ?? order.payments ?? [],
      prepayment: draft.prepayment ?? order.prepayment ?? 0,
    };
  } catch {
    return order;
  }
};

export const CompaniesPage = () => {
  const [orders, setOrders] = useState<OrderPayload[]>([]);
  const [tickets, setTickets] = useState<TicketInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await fetchOrders();
        const t = await fetchTickets();
        setOrders(data.map((o: OrderPayload) => mergeDraft(o)));
        setTickets(t);
      } catch (err) {
        console.error(err);
        setError("Не удалось загрузить компании");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const companies = useMemo(() => {
    const map: Record<string, { name: string; orders: OrderPayload[]; total: number; payed: number; inProgress: number }> = {};
    orders.forEach((o) => {
      const rawName = (o as any).company;
      const name = (rawName ?? "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!map[key]) {
        map[key] = { name, orders: [], total: 0, payed: 0, inProgress: 0 };
      }
      map[key].orders.push(o);
      if (o.status === "PAYED") map[key].payed += 1;
      if (o.status === "IN_PROGRESS" || o.status === "PENDING_PAYMENT") map[key].inProgress += 1;
      const paidSum = (o.payments ?? []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      const effectiveTotal = paidSum > 0 ? paidSum : computeTotal(o);
      map[key].total += effectiveTotal;
    });
    const list = Object.values(map).sort((a, b) => b.total - a.total || b.orders.length - a.orders.length);
    const q = query.trim().toLowerCase();
    if (!q) return list;

    return list
      .map((c) => {
        const matchedOrders = c.orders.filter((o) => {
          const haystack = [
            (o as any).company ?? "",
            o.customer ?? "",
            o.car ?? "",
            o.govNumber ?? "",
            o.phone ?? "",
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        });
        return matchedOrders.length ? { ...c, orders: matchedOrders } : null;
      })
      .filter(Boolean) as typeof list;
  }, [orders, query]);

  return (
    <div className="mx-auto flex max-w-full flex-col gap-3 p-3 max-[960px]:pt-16">
      <header className="flex items-center justify-between rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-[#1f1f1f]">Компании</h2>
          <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-sm font-semibold text-[#1f1f1f]">
            {companies.length} шт.
          </span>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по компании"
          className="w-64 rounded-md border border-[#cfcfcf] bg-white px-3 py-2 text-sm focus:outline-none"
        />
      </header>

      {loading && <Loader />}
      {error && <div className="border border-[#d20000] bg-[#ffecec] px-3 py-2 text-sm">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-[#e5e5e5] bg-white shadow-sm">
        <table className="min-w-[760px] w-full border-collapse text-sm">
          <thead>
            <tr>
              {["Компания", "Заказы", "Закрытые", "В работе", "Сумма, руб."].map((h) => (
                <th key={h} className="border border-[#dcdcdc] bg-[#f5f5f5] px-3 py-2 text-left font-bold text-[#404040]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.map((c, idx) => (
              <tr
                key={c.name}
                className={`cursor-pointer border-t border-[#ededed] hover:bg-[#f8fafc] ${idx % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"}`}
                onClick={() => setExpanded(expanded === c.name ? null : c.name)}
              >
                <td className="px-3 py-2 font-semibold text-[#1a4c8b]">{c.name}</td>
                <td className="px-3 py-2">{c.orders.length}</td>
                <td className="px-3 py-2 text-[#0f9d58] font-semibold">{c.payed}</td>
                <td className="px-3 py-2 text-[#f2994a] font-semibold">{c.inProgress}</td>
                <td className="px-3 py-2 text-right font-semibold">{currency(c.total)}</td>
              </tr>
            ))}
            {companies.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-[#6b7294]">
                  Нет данных
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {expanded && (
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-[#1f1f1f]">Заказы компании: {expanded}</h3>
            <button type="button" className="text-sm font-semibold text-[#1a4c8b] hover:underline" onClick={() => setExpanded(null)}>
              Свернуть
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-collapse text-sm">
              <thead>
                <tr>
                  {["№", "Дата", "Клиент", "Авто", "Сумма, руб.", "Акт", "Статус"].map((h) => (
                    <th key={h} className="border border-[#dcdcdc] bg-[#f5f5f5] px-3 py-2 text-left font-bold text-[#404040]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies
                  .find((c) => c.name === expanded)
                  ?.orders.map((o, idx) => (
                    <tr key={o.id} className={`border-t border-[#ededed] ${idx % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"}`}>
                      <td className="px-3 py-2">
                        <Link className="text-[#1a4c8b] underline" to={`/orders/${o.id}`}>
                          {o.id}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{o.date || "—"}</td>
                      <td className="px-3 py-2">{o.customer || "—"}</td>
                      <td className="px-3 py-2">{o.car || "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {currency(
                          (o.payments && o.payments.length
                            ? (o.payments ?? []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
                            : computeTotal(o)) || 0,
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {(() => {
                          if (o.status !== "PAYED") return <span className="text-[#999999]">—</span>;
                          const orderId = o.id ? String(o.id) : "";
                          const orderTickets = tickets.filter((t) => t.name.includes(orderId));
                          const first = orderTickets[0];
                          const url = first?.name
                            ? ticketUrl(first.name, false)
                            : (o as any).pdfPath
                              ? ticketUrl((o as any).pdfPath, false)
                              : (o as any).pdfUrl
                                ? ticketUrl((o as any).pdfUrl, false)
                                : null;
                          return url ? (
                            <a
                              className="inline-flex items-center rounded-md border border-[#dcdcdc] px-2 py-1 text-[12px] font-semibold text-[#1a4c8b] hover:bg-[#f5f5f5]"
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Открыть
                            </a>
                          ) : (
                            <span className="text-[#999999]">—</span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-flex items-center rounded-md px-2 py-0 text-[11px] font-semibold uppercase text-white"
                          style={{
                            backgroundColor:
                              o.status === "PAYED"
                                ? "#0f9d58"
                                : o.status === "PENDING_PAYMENT"
                                  ? "#8b5cf6"
                                  : o.status === "IN_PROGRESS"
                                    ? "#f2994a"
                                    : "#1d4ed8",
                          }}
                        >
                          {o.status === "PAYED"
                            ? "Оплачен"
                            : o.status === "PENDING_PAYMENT"
                              ? "Ожидание оплаты"
                              : o.status === "IN_PROGRESS"
                                ? "В работе"
                                : "Новый"}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
