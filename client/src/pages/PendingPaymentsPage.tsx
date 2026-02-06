import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchOrders, updateOrder } from "../api/orders";
import { generateAndUploadTicketPdf } from "../features/tickets/actions/generateAndUploadTicketPdf";
import { Loader } from "../components/Loader";
import { OrderPayload, WorkStatus } from "../types";

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

const normalizeStatus = (value?: string): WorkStatus => {
  if (!value) return "NEW";
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, "_").replace(/-+/g, "_");
  if (cleaned === "PAYED") return "PAYED";
  if (cleaned === "PENDING_PAYMENT") return "PENDING_PAYMENT";
  if (["IN_PROGRESS", "INPROGRESS", "IN_PROGRESS_", "ISSUED"].includes(cleaned)) return "IN_PROGRESS";
  return "NEW";
};

export const PendingPaymentsPage = () => {
  const [orders, setOrders] = useState<OrderPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await fetchOrders();
        setOrders(
          (data as OrderPayload[]).map((o: OrderPayload) => ({ ...o, status: normalizeStatus(o.status) })),
        );
      } catch (err) {
        console.error(err);
        setError("Не удалось загрузить заказы");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const pendingOrders = useMemo(
    () =>
      orders
        .filter((o) => normalizeStatus(o.status) === "PENDING_PAYMENT")
        .sort((a, b) => (b.id || "").localeCompare(a.id || "")),
    [orders],
  );

  const handlePaid = async (order: OrderPayload) => {
    if (!order.id) return;
    try {
      setProcessing(order.id);
      const updated = await updateOrder(order.id, { status: "PAYED" as WorkStatus });
      // генерируем акт
      try {
        await generateAndUploadTicketPdf({
          orderId: updated.id ?? order.id,
          order: updated,
          issuedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Не удалось загрузить акт, попробуйте в истории заказов", err);
      }
      try {
        localStorage.removeItem(`order-draft-${order.id}`);
      } catch {
        // ignore
      }
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...updated, status: "PAYED" } : o)));
      // подтягиваем свежие данные, чтобы гарантировать корректный статус и суммы
      try {
        const fresh = await fetchOrders();
        setOrders(fresh);
      } catch (err) {
        console.warn("Не удалось обновить список заказов после оплаты", err);
      }
    } catch (err) {
      console.error(err);
      setError("Не удалось завершить оплату");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-full flex-col gap-3 p-3 max-[960px]:pt-16">
      <header className="flex items-center justify-between rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-[#1f1f1f]">Ожидание оплаты</h2>
          <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-sm font-semibold text-[#1f1f1f]">
            {pendingOrders.length} шт.
          </span>
        </div>
      </header>

      {loading && <Loader />}
      {error && <div className="border border-[#d20000] bg-[#ffecec] px-3 py-2 text-sm">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-[#e5e5e5] bg-white shadow-sm">
        <table className="min-w-[720px] w-full border-collapse text-sm">
          <thead>
            <tr>
              {["№", "Дата", "Клиент", "Авто", "Сумма, руб.", "Оплата"].map((h) => (
                <th key={h} className="border border-[#dcdcdc] bg-[#f5f5f5] px-3 py-2 text-left font-bold text-[#404040]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pendingOrders.map((o, idx) => (
              <tr key={o.id ?? idx} className={idx % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"}>
                <td className="border border-[#ededed] px-3 py-2">
                  {o.id ? (
                    <Link className="text-[#1a4c8b] hover:underline" to={`/orders/${o.id}`}>
                      {o.id}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="border border-[#ededed] px-3 py-2">{o.date || "—"}</td>
                <td className="border border-[#ededed] px-3 py-2">{o.customer || "—"}</td>
                <td className="border border-[#ededed] px-3 py-2">{o.car || "—"}</td>
                <td className="border border-[#ededed] px-3 py-2 font-semibold">
                  {computeTotal(o).toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
                </td>
                <td className="border border-[#ededed] px-3 py-2">
                  <button
                    disabled={processing === o.id}
                    className="rounded-md w-1/2 border px-1 py-1 text-[14px] font-semibold shadow-sm border-[#e2b007] bg-[#ffd54f] text-[#1f1f1f] hover:bg-[#ffc930]"
                    onClick={() => handlePaid(o)}
                  >
                    {processing === o.id ? "Обработка..." : "ПРИНЯТЬ ОПЛАТУ"}
                  </button>
                </td>
              </tr>
            ))}
            {pendingOrders.length === 0 && !loading && (
              <tr>
                <td className="px-3 py-4 text-center text-[#777]" colSpan={6}>
                  Нет заказов в ожидании оплаты
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
