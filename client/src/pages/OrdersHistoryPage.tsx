import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteOrder, fetchOrders } from "../api/orders";
import { OrderPayload, WorkStatus } from "../types";
import { Loader } from "../components/Loader";

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

const statusLabels: Record<WorkStatus, string> = {
  NEW: "Новый",
  IN_PROGRESS: "В работе",
  PAYED: "Оплачен",
};

const normalizeStatus = (value?: string): WorkStatus => {
  if (!value) return "NEW";
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, "_").replace(/-+/g, "_");
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
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
        setOrders(
          data.map((order: OrderPayload) => ({
            ...order,
            status: normalizeStatus(order.status),
          })),
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
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const normalize = (val?: string | null) => (val ? String(val).toLowerCase() : "");
    const digits = (val?: string | null) => (val ? String(val).replace(/\D/g, "") : "");
    return orders.filter((o) => {
      const haystack = [
        normalize(o.id),
        normalize(o.customer),
        normalize(o.car),
        normalize(o.govNumber),
        normalize(o.vinNumber),
        normalize(o.phone),
        normalize(o.reason),
      ]
        .filter(Boolean)
        .join(" ");

      const haystackDigits = [digits(o.phone), digits(o.govNumber), digits(o.id)].filter(Boolean).join(" ");

      const matchQuery = q ? haystack.includes(q) || (qDigits ? haystackDigits.includes(qDigits) : false) : true;
      const matchStatus = statusFilter ? normalizeStatus(o.status) === statusFilter : true;
      return matchQuery && matchStatus;
    });
  }, [orders, query, statusFilter]);

  const handleDelete = async (id: string) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    if (!window.confirm(`Удалить заказ ${id}?`)) return;
    try {
      setLoading(true);
      await deleteOrder(id);
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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по номеру"
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
              {["№", "Дата", "Клиент", "Авто", "Сумма, руб.", "Статус"].map((h) => (
                <th key={h} className="border border-[#dcdcdc] bg-[#f5f5f5] px-3 py-2 text-left font-bold text-[#404040]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => {
              const isSelected = selectedId === order.id;
              return (
                <tr
                  key={order.id}
                  className={`text-sm ${isSelected ? "bg-[#fff7d6]" : ""}`}
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
                    {computeTotal(order).toLocaleString("ru-RU")}
                  </td>
                  <td className="border border-[#dcdcdc] px-3 py-2">
                    <span className="inline-block rounded-md border border-[#dcdcdc] bg-[#f7f7f7] px-2 py-1 text-[12px] font-semibold uppercase text-[#333]">
                      {getStatusLabel(order.status)}
                    </span>
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
