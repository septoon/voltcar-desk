import { useEffect, useMemo, useState } from "react";
import { deleteTicketFile, fetchTickets, TicketInfo, ticketUrl } from "../api/tickets";
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
  const [deleting, setDeleting] = useState<string | null>(null);

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

  const handleDelete = async (item: TicketInfo) => {
    const confirmed = window.confirm(`Удалить акт ${item.name}?`);
    if (!confirmed) return;
    try {
      setDeleting(item.name);
      setError("");
      await deleteTicketFile(item.name, item.ticketId);
      setTickets((prev) => prev.filter((t) => t.name !== item.name));
    } catch (err) {
      console.error(err);
      setError("Не удалось удалить акт");
    } finally {
      setDeleting(null);
    }
  };

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
                <td className="flex px-3 py-2 space-x-2">
                  <a
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-100"
                    href={ticketUrl(t.name, true)}
                    target="_blank"
                    rel="noreferrer"
                    title="Скачать"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 4v11" />
                      <path d="m7 11 5 5 5-5" />
                      <path d="M5 19h14" />
                    </svg>
                  </a>
                  <button
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-100 disabled:opacity-60"
                    onClick={() => handleDelete(t)}
                    disabled={deleting === t.name}
                    title={deleting === t.name ? "Удаление..." : "Удалить"}
                  >
                    {deleting === t.name ? (
                      <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 7h12" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M8 7l1-2h6l1 2" />
                        <path d="M6.5 7v12a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V7" />
                      </svg>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
