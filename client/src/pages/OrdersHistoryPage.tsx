import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteOrder, fetchOrders } from "../api/orders";
import { OrderPayload, WorkStatus } from "../types";
import { Loader } from "../components/Loader";
import { deleteTicketFile, fetchTickets, TicketInfo, ticketUrl } from "../api/tickets";

const sumLineItems = (items: { qty: number; price: number }[]) => items.reduce((acc, i) => acc + i.qty * i.price, 0);

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

const statusLabels: Record<WorkStatus, string> = {
  NEW: "Новый",
  IN_PROGRESS: "В работе",
  PENDING_PAYMENT: "Ожидание оплаты",
  PAYED: "Оплачен",
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

const normalizeStatus = (value?: string): WorkStatus => {
  if (!value) return "NEW";
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, "_").replace(/-+/g, "_");
  if (["PENDING_PAYMENT", "PENDING", "WAITING_PAYMENT", "AWAITING_PAYMENT"].includes(cleaned)) return "PENDING_PAYMENT";
  if (cleaned === "PAYED") return "PAYED";
  if (["IN_PROGRESS", "INPROGRESS", "IN_PROGRESS_", "ISSUED"].includes(cleaned)) return "IN_PROGRESS";
  return "NEW";
};

const getStatusLabel = (value?: string) => {
  const normalized = normalizeStatus(value);
  return statusLabels[normalized];
};

export const OrdersHistoryPage = () => {
  const [orders, setOrders] = useState<OrderPayload[]>([]);
  const [tickets, setTickets] = useState<TicketInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [advancedQuery, setAdvancedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkStatus | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string; visible: true } | { visible: false }>({
    visible: false,
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await fetchOrders();
        const ticketFiles = await fetchTickets();
        setTickets(ticketFiles);
        setOrders(
          data.map((order: OrderPayload) =>
            mergeDraft({
              ...order,
              status: normalizeStatus(order.status),
            }),
          ),
        );
      } catch (err) {
        console.error(err);
        setError("Не удалось загрузить историю");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

const filtered = useMemo(() => {
  const adv = advancedQuery.trim().toLowerCase();
  const advDigits = adv.replace(/\D/g, "");
  const normalize = (val?: string | null) => (val ? String(val).toLowerCase() : "");
  const digits = (val?: string | null) => (val ? String(val).replace(/\D/g, "") : "");

  const result = orders.filter((o) => {
    const haystack = [
      normalize(o.id),
      normalize(o.customer),
      normalize((o as any).company),
      normalize(o.car),
      normalize(o.govNumber),
      normalize(o.vinNumber),
      normalize(o.phone),
      normalize(o.reason),
    ]
      .filter(Boolean)
      .join(" ");

    const haystackDigits = [digits(o.phone), digits(o.govNumber), digits(o.id)].filter(Boolean).join(" ");

    const matchAdv = adv
      ? haystack.includes(adv) || (advDigits ? haystackDigits.includes(advDigits) : false)
      : true;
    const matchStatus = statusFilter ? normalizeStatus(o.status) === statusFilter : true;

    return matchAdv && matchStatus;
  });

  // сортировка по id (DESC)
  return result.slice().sort((a, b) => {
    const aNum = Number(String(a.id ?? "").replace(/\D/g, ""));
    const bNum = Number(String(b.id ?? "").replace(/\D/g, ""));
    // если оба нормально парсятся — сравниваем как числа
    if (Number.isFinite(aNum) && Number.isFinite(bNum) && (a.id != null) && (b.id != null)) {
      return bNum - aNum;
    }
    return String(b.id ?? "").localeCompare(String(a.id ?? ""), "ru");
  });
}, [orders, advancedQuery, statusFilter]);

  const handleDelete = async (id: string) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    if (!window.confirm(`Удалить заказ ${id}?`)) return;
    try {
      setLoading(true);
      await deleteOrder(id);
      // удаляем связанные PDF на сервере
      const relatedTickets = tickets.filter((t) => t.name.includes(id));
      for (const t of relatedTickets) {
        try {
          await deleteTicketFile(t.name, id);
        } catch (err) {
          console.warn("Не удалось удалить файл акта", t.name, err);
        }
      }
      try {
        localStorage.removeItem(`order-draft-${id}`);
      } catch {
        // ignore localStorage errors
      }
      setOrders((prev) => prev.filter((o) => o.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      console.error(err);
      alert("Не удалось удалить заказ");
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (id: string) => {
    setSelectedId(id);
    setContextMenu({ visible: false });
  };

  const handleContextMenu = (event: React.MouseEvent, id: string) => {
    event.preventDefault();
    setSelectedId(id);
    setContextMenu({ x: event.clientX, y: event.clientY, id, visible: true });
  };

  useEffect(() => {
    const hideMenu = () => setContextMenu({ visible: false });
    window.addEventListener("click", hideMenu);
    return () => window.removeEventListener("click", hideMenu);
  }, []);

  return (
    <div className="mx-auto flex max-w-full flex-col gap-3 p-3 max-[960px]:pt-16">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-2 max-[960px]:flex-col w-full">
         <div className="flex max-[960px]:w-full max-[960px]:justify-between">
           <h2 className="text-xl font-bold mr-4 text-[#1f1f1f]">История заказов</h2>
            <input
              type="text"
              value={advancedQuery}
              onChange={(e) => setAdvancedQuery(e.target.value)}
              placeholder="Поиск клиента"
              className="w-56 max-[960px]:w-[40%] rounded-md border border-[#cfcfcf] bg-white px-3 py-2 text-sm focus:outline-none"
            />
         </div>
         <div className="flex gap-3 max-[960px]:w-full max-[960px]:justify-between">
          <label className="flex items-center gap-2">
            Статус
            <select
              className="rounded-md border border-[#cfcfcf] bg-white px-2 py-1 focus:outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as WorkStatus | "")}
            >
              <option value="">Все</option>
              <option value="NEW">{statusLabels.NEW}</option>
              <option value="IN_PROGRESS">{statusLabels.IN_PROGRESS}</option>
              <option value="PENDING_PAYMENT">{statusLabels.PENDING_PAYMENT}</option>
              <option value="PAYED">{statusLabels.PAYED}</option>
            </select>
          </label>

          <button
            className="rounded-md border border-[#d6d6d6] bg-[#f5f5f5] px-3 py-2 text-sm font-semibold text-[#2c2c2c] shadow-sm hover:bg-[#ededed] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!selectedId}
            onClick={() => selectedId && handleDelete(selectedId)}
          >
            Удалить
          </button>
         </div>
        </div>
      </header>

      {loading && <Loader />}
      {error && <div className="border border-[#d20000] bg-[#ffecec] px-3 py-2 text-sm">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-[#e5e5e5] bg-white shadow-sm">
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
            {filtered.map((order, idx) => {
              const isSelected = selectedId === order.id;
              const orderTickets = tickets.filter(
                (t) => (t.ticketId && t.ticketId === order.id) || t.name.includes(order.id ?? "")
              );
              const total = computeTotal(order);
              const prepayment = Number(order.prepayment ?? 0) || 0;
              const st = normalizeStatus(order.status);
              return (
                <tr
                  key={order.id}
                  className={`text-sm ${isSelected ? "bg-[#fff7d6]" : idx % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"}`}
                  onClick={() => handleRowClick(order.id!)}
                  onContextMenu={(e) => handleContextMenu(e, order.id!)}
                >
                  <td className="border border-[#dcdcdc] px-3 py-2">
                    <Link className="text-[#1a4c8b] underline" to={`/orders/${order.id}`}>
                      {order.id}
                    </Link>
                  </td>
                  <td className="border border-[#dcdcdc] px-3 py-2">{order.date || "—"}</td>
                  <td className="border border-[#dcdcdc] px-3 py-2">{order.customer || "—"}</td>
                  <td className="border border-[#dcdcdc] px-3 py-2">{order.car || "—"}</td>
                  <td className="border border-[#dcdcdc] px-3 py-2 text-right">
                    {prepayment > 0 && st !== "PAYED" ? (
                      <>
                        {total.toLocaleString("ru-RU")}{" / "}
                        <span className="text-[#008000]">{prepayment.toLocaleString("ru-RU")}</span>
                      </>
                    ) : (
                      total.toLocaleString("ru-RU")
                    )}
                  </td>
                  <td className="border border-[#dcdcdc] px-3 py-2">
                    {orderTickets.length === 0 ? (
                      <span className="text-[#999999]">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {orderTickets.map((t) => (
                          <a
                            key={`${order.id}-${t.name}`}
                            className="inline-flex items-center rounded-md border border-[#dcdcdc] px-2 py-1 text-[12px] font-semibold text-[#1a4c8b] hover:bg-[#f5f5f5]"
                            href={ticketUrl(t.name, false)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Открыть
                          </a>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="border border-[#dcdcdc] px-3 py-2">
                    {order.status === "PAYED" && (
                      <span className="inline-block rounded-md border border-[#0f9d58] bg-[#0f9d58] px-2 py-0 text-[12px] font-semibold uppercase text-white">
                        {getStatusLabel(order.status)}
                      </span>
                    )}
                    {order.status === "PENDING_PAYMENT" && (
                      <span className="inline-block rounded-md border border-[#8b5cf6] bg-[#8b5cf6] px-2 py-0 text-[12px] font-semibold uppercase text-white">
                        {getStatusLabel(order.status)}
                      </span>
                    )}
                    {order.status === "IN_PROGRESS" && (
                      <span className="inline-block rounded-md border border-[#f2994a] bg-[#f2994a] px-2 py-0 text-[12px] font-semibold uppercase text-white">
                        {getStatusLabel(order.status)}
                      </span>
                    )}
                    {order.status === "NEW" && (
                      <span className="inline-block rounded-md border border-[#074587] bg-[#1d4ed8] px-2 py-0 text-[12px] font-semibold uppercase text-white">
                        {getStatusLabel(order.status)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {contextMenu.visible && (
        <div
          className="fixed rounded-md z-50 border border-[#bdbdbd] bg-white shadow"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="block rounded-md w-full px-3 py-2 text-left text-sm hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => handleDelete(contextMenu.id)}
          >
            Удалить
          </button>
        </div>
      )}
    </div>
  );
};
