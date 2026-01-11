import { useEffect, useState } from "react";
import { createService, deleteService, fetchServiceList, ServiceItem, updateService } from "../api/services";

export const ServicesPage = () => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchServiceList();
      const normalized = data.map((item, idx) =>
        typeof item === "string" ? { id: `tmp-${idx}-${item}`, name: item } : item,
      );
      setServices(normalized);
    } catch (err) {
      console.error(err);
      setError("Не удалось загрузить услуги");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const normalize = (value: string) => value.trim().replace(/\s+/g, " ");

  const handleAdd = async () => {
    const name = normalize(newName);
    if (!name) {
      setError("Введите название услуги");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const created = await createService(name);
      setServices((prev) => [...prev, created]);
      setNewName("");
    } catch (err: any) {
      const message = err?.response?.data?.error ?? "Не удалось добавить услугу";
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (item: ServiceItem) => {
    setEditingId(item.id);
    setDraft(item.name);
    setError(null);
  };

  const handleUpdate = async (id: string) => {
    const name = normalize(draft);
    if (!name) {
      setError("Введите название услуги");
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      const updated = await updateService(id, name);
      setServices((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setEditingId(null);
      setDraft("");
    } catch (err: any) {
      const message = err?.response?.data?.error ?? "Не удалось сохранить услугу";
      setError(message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Удалить услугу?")) return;
    setSavingId(id);
    setError(null);
    try {
      await deleteService(id);
      setServices((prev) => prev.filter((item) => item.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setDraft("");
      }
    } catch (err: any) {
      const message = err?.response?.data?.error ?? "Не удалось удалить услугу";
      setError(message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="mx-auto flex flex-col gap-3 p-3 max-[960px]:pt-16">
      <header className="flex flex-col gap-3 rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 shadow-sm max-[640px]:gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#6c6c6c]">Справочники</p>
            <h1 className="text-2xl font-bold text-[#1f1f1f]">Услуги</h1>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Добавить новую услугу"
              className="h-10 min-w-[220px] rounded-lg border border-[#e5e5e5] bg-white px-3 text-[15px] text-[#1f1f1f] placeholder:text-[#9b9b9b] focus:border-[#4338ca] focus:outline-none"
              maxLength={200}
            />
            <button
              onClick={handleAdd}
              disabled={creating}
              className="h-10 rounded-lg bg-[#4338ca] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#352ea3] disabled:opacity-60"
            >
              {creating ? "Сохраняю..." : "Добавить"}
            </button>
          </div>
        </div>
        {error ? <div className="rounded-lg bg-[#fff3f0] px-3 py-2 text-sm text-[#a33030]">{error}</div> : null}
      </header>

      <section className="rounded-xl border border-[#e5e5e5] bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-[#6c6c6c]">
            <span className="inline-flex h-7 items-center justify-center rounded-full bg-[#f5f5f5] px-3 font-semibold text-[#1f1f1f]">
              {services.length}
            </span>
            <span>услуг в списке</span>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="text-sm font-semibold text-[#4338ca] hover:text-[#352ea3] disabled:opacity-60"
          >
            Обновить
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-[#6c6c6c]">Загружаем услуги...</div>
        ) : services.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-[#6c6c6c]">
            <p>Пока нет услуг.</p>
            <p>Добавьте первую услугу через форму выше.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-[#f0f0f0]">
            {services.map((item) => {
              const isEditing = editingId === item.id;
              const busy = savingId === item.id;
              return (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  {isEditing ? (
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="w-full max-w-[520px] rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-[15px] text-[#1f1f1f] placeholder:text-[#9b9b9b] focus:border-[#4338ca] focus:outline-none"
                      autoFocus
                      maxLength={200}
                    />
                  ) : (
                    <p className="text-[15px] font-semibold text-[#1f1f1f]">{item.name}</p>
                  )}
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleUpdate(item.id)}
                          disabled={busy}
                          className="rounded-lg bg-[#41c36c] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#36a65c] disabled:opacity-60"
                        >
                          {busy ? "Сохраняю..." : "Сохранить"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setDraft("");
                          }}
                          className="rounded-lg bg-[#f5f5f5] px-3 py-2 text-sm font-semibold text-[#1f1f1f] hover:bg-[#ebebeb]"
                        >
                          Отмена
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(item)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#f5f5f5] text-[#1f1f1f] hover:bg-[#ebebeb]"
                          title="Редактировать"
                          aria-label="Редактировать"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12.4 6.1 17.9 11.6 8.5 21H3v-5.5z" />
                            <path d="m14.2 4.3 2.1-2.1a2 2 0 0 1 2.8 0l1.7 1.7a2 2 0 0 1 0 2.8l-2.1 2.1" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={busy}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#fce8e8] text-[#a33030] hover:bg-[#f7d8d8] disabled:opacity-60"
                          title="Удалить"
                          aria-label="Удалить"
                        >
                          {busy ? (
                            <span className="text-xs font-semibold">...</span>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 7h14" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                              <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
                              <path d="M9 5h6l-1-2h-4z" />
                            </svg>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
