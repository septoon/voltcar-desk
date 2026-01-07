import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchOrders } from "../api/orders";
import { OrderPayload } from "../types";
import { Loader } from "../components/Loader";

const matches = (order: OrderPayload, q: string) => {
  const haystack = [
    order.customer,
    order.phone,
    order.govNumber,
    order.vinNumber,
    order.reason,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
};

export const ClientSearchPage = () => {
  const [orders, setOrders] = useState<OrderPayload[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchOrders();
        setOrders(data);
      } catch (err) {
        console.error(err);
        setError("Не удалось загрузить данные клиентов");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return orders.filter((o) => matches(o, q));
  }, [orders, query]);

  return (
    <div className="mx-auto flex flex-col gap-3 p-3 pt-12">
      <header className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 shadow-sm">
        <h2 className="text-xl font-bold text-[#1f1f1f]">Поиск клиента</h2>
        <div className="min-w-[300px]">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Имя, телефон, гос номер или VIN"
            className="w-full max-w-none rounded-md border border-[#cfcfcf] bg-white px-3 py-2 text-sm focus:outline-none"
          />
        </div>
      </header>

      {loading && <Loader />}
      {error && <div className="border border-[#d20000] bg-[#ffecec] px-3 py-2 text-sm">{error}</div>}

      {filtered.length === 0 && query && !loading ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 text-sm text-[#555555] shadow-sm">
          Ничего не найдено
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {filtered.map((order) => (
          <div key={order.id} className="rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 shadow-sm">
            <div className="font-bold text-[#1f1f1f]">
              {order.customer || "Без имени"} —{" "}
              <Link className="text-[#1a4c8b] underline" to={`/orders/${order.id}`}>
                Заказ {order.id}
              </Link>
            </div>
            <div className="text-sm text-[#555555]">
              {order.phone || "Телефон не указан"} · {order.govNumber || "Гос номер —"} · {order.vinNumber || "VIN —"}
            </div>
            <div className="text-sm text-[#555555]">Причина: {order.reason || "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
