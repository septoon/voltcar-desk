import { useEffect, useMemo, useState } from "react";
import { fetchTickets, TicketInfo, ticketUrl } from "../api/tickets";
import { Loader } from "../components/Loader";

const formatSize = (bytes: number) => {
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} МБ`;
  if (bytes > 1_000) return `${(bytes / 1_000).toFixed(1)} КБ`;
  return `${bytes} Б`;
};

export const TicketsPage = () => {
  const [tickets, setTickets] = useState<TicketInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await fetchTickets();
        setTickets(data);
      } catch (err) {
        console.error(err);
        setError("Не удалось загрузить акты");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t) => t.name.toLowerCase().includes(q));
  }, [tickets, query]);

  return (
    <div className="mx-auto flex max-w-full flex-col gap-3 p-3 max-[960px]:pt-16">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold mr-4 text-[#1f1f1f]">Акты (PDF)</h2>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию"
            className="w-56 rounded-md border border-[#cfcfcf] bg-white px-3 py-2 text-sm focus:outline-none"
          />
        </div>
      </header>

      {loading && <Loader />}
      {error && <div className="border border-[#d20000] bg-[#ffecec] px-3 py-2 text-sm">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-[#e5e5e5] bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-[#f6f7fb] text-[#1f1f1f]">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Файл</th>
              <th className="px-3 py-2 text-left font-semibold">Сформирован</th>
              <th className="px-3 py-2 text-left font-semibold">Размер</th>
              <th className="px-3 py-2 text-left font-semibold">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-[#6b7294]">
                  Нет актов
                </td>
              </tr>
            )}
            {filtered.map((t) => (
              <tr key={t.name} className="border-t border-[#ededed]">
                <td className="px-3 py-2 font-semibold text-indigo-700 underline cursor-pointer" onClick={() => window.open(ticketUrl(t.name, false), "_blank", "noopener")}>{t.name}</td>
                <td className="px-3 py-2 text-[#4b5563]">{new Date(t.mtime).toLocaleString("ru-RU")}</td>
                <td className="px-3 py-2 text-[#4b5563]">{formatSize(t.size)}</td>
                <td className="px-3 py-2 space-x-2">
                  <a
                    className="rounded-md border border-[#caa200] bg-[#ffd659] px-3 py-1 text-sm font-semibold text-[#1f1f1f] hover:bg-[#f3c945]"
                    href={ticketUrl(t.name, true)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Скачать
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
