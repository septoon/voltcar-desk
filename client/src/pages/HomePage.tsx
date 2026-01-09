import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import ruLocale from "@fullcalendar/core/locales/ru";
import { useEffect, useMemo, useRef, useState } from "react";
import { createAppointment, deleteAppointment, fetchAppointments, updateAppointment } from "../api/appointments";
import { fetchServices } from "../api/services";
import { Appointment, AppointmentPayload, AppointmentStatus } from "../types/appointment";
import { useNavigate } from "react-router-dom";
import { Loader } from "../components/Loader";
import { IMaskInput } from "react-imask";

type Draft = {
  id?: number;
  title: string;
  start: string;
  customerName: string;
  phone?: string;
  vehicle?: string;
  note?: string;
  end: string;
};

const statusStyles: Record<AppointmentStatus, string> = {
  new: "bg-[#e4f1ff] border-[#8bbef5] text-[#1f4e7a]",
  confirmed: "bg-[#e4f7ed] border-[#7bd7a8] text-[#1f6b3c]",
  in_progress: "bg-[#fff5d9] border-[#f5c96b] text-[#8a5a00]",
  done: "bg-[#eef0f5] border-[#c5cada] text-[#3f455c]",
  no_show: "bg-[#ffe9dd] border-[#f3a06c] text-[#8a3e0f]",
  canceled: "bg-[#ffe7ed] border-[#f59bb5] text-[#7b1d3a]",
};

const defaultServices = [
  "Компьютерная диагностика",
  "Диагностика ЭЛ. оборудования",
  "Диагностика ЭЛ. проводки",
  "Диагностика впускного тракта",
  "Диагностика выпускного тракта",
  "Ремонт трапеции",
  "Ремонт фар",
  "Ремонт кондиционера",
  "Ремонт зажигания",
  "Ремонт щитка приборов",
  "Ремонт печки",
  "Ремонт стеклоподъемника",
  "Ремонт замка",
  "Замена свечей",
  "Замена форсунок",
  "Замена катушек",
  "Замена моторчика",
  "Замена трапеции",
  "Замена фар",
  "Замена ремня",
  "Замена вентилятора",
  "Замена радиатора",
  "Замена стеклоподъемника",
  "Замена щитка приборов",
  "Замена замка",
  "Установка магнитолы",
  "Установка камеры з/в",
];

export const HomePage = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [view, setView] = useState<"dayGridMonth">("dayGridMonth");
  const [range, setRange] = useState<{ start?: string; end?: string }>({});
  const [filters, setFilters] = useState<{ statuses: AppointmentStatus[]; masterId?: string }>({ statuses: [] });
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);
  const [serviceHints, setServiceHints] = useState<string[]>(defaultServices);
  const [filteredHints, setFilteredHints] = useState<string[]>([]);
  const [showHints, setShowHints] = useState(false);

  const [monthLabel, setMonthLabel] = useState("");

  const load = async (nextRange = range, nextFilters = filters) => {
    if (!nextRange.start || !nextRange.end) return;
    setLoading(true);
    try {
      const data = await fetchAppointments({
        from: nextRange.start,
        to: nextRange.end,
        masterId: nextFilters.masterId,
        statuses: nextFilters.statuses.length ? nextFilters.statuses : undefined,
      });
      setAppointments(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, filters]);

  useEffect(() => {
    (async () => {
      try {
        const fromApi = await fetchServices();
        if (fromApi && fromApi.length) {
          const merged = Array.from(new Set([...defaultServices, ...fromApi]));
          setServiceHints(merged);
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  const calendarRef = useRef<FullCalendar | null>(null);

  const goPrev = () => {
    const api = calendarRef.current?.getApi();
    api?.prev();
  };

  const goNext = () => {
    const api = calendarRef.current?.getApi();
    api?.next();
  };

  const openCreate = (start: string) => {
    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime())) return;
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    setDraft({
      title: "",
      customerName: "",
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });
    setModalOpen(true);
  };

  const saveDraft = async () => {
    if (!draft) return;
    const startIso = new Date(draft.start).toISOString();
    const endIso = new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
    const payload: AppointmentPayload = {
      title: draft.title,
      customerName: draft.customerName,
      start: startIso,
      end: endIso,
      status: "confirmed",
      phone: draft.phone,
      vehicle: draft.vehicle,
      note: draft.note,
    };
    if (draft.id) {
      const updated = await updateAppointment(draft.id, payload);
      setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSelected(updated);
    } else {
      const created = await createAppointment(payload);
      setAppointments((prev) => [...prev, created]);
      setSelected(created);
    }
    setModalOpen(false);
    setDraft(null);
  };

  const remove = async (id: number) => {
    if (window.confirm(`Удалить запись ${id}?`)) {
      await deleteAppointment(id);
      setAppointments((prev) => prev.filter((a) => a.id !== id));
      setSelected(null);
      setModalOpen(false)
    }
  };

  return (
    <div className="relative mx-auto flex max-w-full flex-col gap-3 p-4 max-[960px]:pt-16 bg-[#f6f7fb]">
      {loading ? <Loader /> : null}
      <header className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#1f1f1f]">Записать клиента</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="rounded-full bg-[#41c36c] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#36a65c]"
            onClick={() => {
              const start = new Date();
              openCreate(start.toISOString());
            }}
          >
            + Запись
          </button>
        </div>
      </header>

      <div className="grid grid-cols-[1fr_300px] gap-4 max-[960px]:grid-cols-1 max-[960px]:flex max-[960px]:flex-col-reverse">
        <div className="rounded-2xl border border-[#e3e7ff] bg-white p-2 shadow-sm cursor-pointer">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView={view}
            locales={[ruLocale]}
            locale="ru"
            headerToolbar={false}
            height="auto"
            selectable
            editable
            events={appointments.map((a) => ({
              id: String(a.id),
              title: a.title,
              start: a.start,
              end: a.end,
              extendedProps: a,
            }))}
            eventClassNames={(arg) => {
              const appt = arg.event.extendedProps as Appointment;
              return `border ${statusStyles[appt.status] ?? "bg-gray-200 border-gray-400 text-black"} px-1`;
            }}
            eventContent={(arg) => {
              const appt = arg.event.extendedProps as Appointment;
              return (
                <div className="text-xs leading-tight">
                  <div className="font-semibold">{arg.event.title.split(" ")[0]}..</div>
                  <div>{appt.customerName}</div>
                </div>
              );
            }}
            select={(info) => {
              openCreate(info.startStr);
            }}
            eventClick={(info) => {
              const appt = info.event.extendedProps as Appointment;
              setSelected(appt);
              setDraft({
                ...appt,
                id: Number(info.event.id),
                phone: appt.phone ?? "",
                vehicle: appt.vehicle ?? "",
                note: appt.note ?? "",
              } as Draft);
              // setModalOpen(true);
            }}
            eventDrop={async (info) => {
              const id = Number(info.event.id);
              const updated = await updateAppointment(id, { start: info.event.startStr, end: info.event.endStr });
              setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
            }}
            eventResize={async (info) => {
              const id = Number(info.event.id);
              const updated = await updateAppointment(id, { start: info.event.startStr, end: info.event.endStr });
              setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
            }}
            datesSet={(info) => {
              const start = info.view.currentStart.toISOString();
              const end = info.view.currentEnd.toISOString();
              setMonthLabel(info.view.title);
              setRange((prev) => {
                if (prev.start === start && prev.end === end) return prev;
                return { start, end };
              });

              const nextView = info.view.type as "dayGridMonth";
              if (nextView !== view) setView(nextView);
            }}
          />
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-[#e3e7ff]">
            {monthLabel && <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-sm font-semibold text-[#1f1f1f] capitalize">{monthLabel}</span>}
            <div className="flex items-center gap-2 mt-4">
              <button
                className="rounded-md border border-[#cfcfcf] bg-white px-3 py-1 text-sm font-semibold hover:bg-[#f5f5f5]"
                onClick={goPrev}
              >
                ← Пред
              </button>
              <button
                className="rounded-md border border-[#cfcfcf] bg-white px-3 py-1 text-sm font-semibold hover:bg-[#f5f5f5]"
                onClick={goNext}
              >
                След →
              </button>
            </div>
          </div>

        </aside>
      </div>

      {loading && <div className="text-sm text-[#555555]">Загрузка записей...</div>}

      {modalOpen && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3" onClick={() => setModalOpen(false)}>
          <div
            className="w-full max-w-lg rounded-2xl border border-[#cfcfcf] bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-lg font-bold text-[#1f1f1f]">{draft.id ? "Редактировать запись" : "Создать запись"}</h3>
            <div className="grid grid-cols-1 gap-2">
              <label className="relative flex flex-col gap-1 text-sm">
                Услуга
                <input
                  className="rounded-md border border-[#cfcfcf] px-2 py-2"
                  value={draft.title}
                  onFocus={() => setShowHints(true)}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDraft({ ...draft, title: value });
                    const filtered = serviceHints.filter((s) => s.toLowerCase().includes(value.toLowerCase())).slice(0, 8);
                    setFilteredHints(filtered);
                    setShowHints(true);
                  }}
                  onBlur={() => setTimeout(() => setShowHints(false), 120)}
                />
                {showHints && filteredHints.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-[#cfcfcf] bg-white shadow-sm">
                    {filteredHints.map((hint) => (
                      <button
                        key={hint}
                        type="button"
                        className="block w-full px-2 py-1 text-left text-sm hover:bg-[#f5f5f5]"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setDraft({ ...draft, title: hint });
                          setShowHints(false);
                        }}
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                )}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Клиент
                <input
                  className="rounded-md border border-[#cfcfcf] px-2 py-2"
                  value={draft.customerName}
                  onChange={(e) => setDraft({ ...draft, customerName: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label className="flex flex-col gap-1">
                  Телефон
                  <IMaskInput
                    className="rounded-md border border-[#cfcfcf] px-2 py-2"
                    mask="+7 (000) 000-00-00"
                    overwrite
                    lazy={false}
                    value={draft.phone ?? ""}
                    onAccept={(val: unknown) => setDraft({ ...draft, phone: String(val) })}
                    placeholder="+7 (___) ___-__-__"
                    inputMode="tel"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Автомобиль
                  <input
                    className="rounded-md border border-[#cfcfcf] px-2 py-2"
                    value={draft.vehicle ?? ""}
                    onChange={(e) => setDraft({ ...draft, vehicle: e.target.value })}
                    placeholder="Марка, модель, год"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                Дата и время
                <input
                  type="datetime-local"
                  className="rounded-md border border-[#cfcfcf] px-2 py-2"
                  value={draft.start.slice(0, 16)}
                  onChange={(e) => {
                    const nextStart = new Date(e.target.value).toISOString();
                    const nextEnd = new Date(new Date(nextStart).getTime() + 60 * 60 * 1000).toISOString();
                    setDraft({ ...draft, start: nextStart, end: nextEnd });
                  }}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Примечание
                <textarea
                  className="rounded-md border border-[#cfcfcf] px-2 py-2"
                  value={draft.note ?? ""}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                />
              </label>
            </div>
            <div className="mt-3 flex justify-between gap-2">
              {draft.id && (
                <button
                  className="rounded-md border border-[#FF474D] bg-[#E0666A] text-white px-3 py-1 text-sm font-semibold hover:bg-[#FF474D]"
                  onClick={() => draft.id && remove(draft.id)}
                >
                  Удалить
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <button className="rounded-md border border-[#cfcfcf] bg-white px-3 py-1 text-sm font-semibold hover:bg-[#f5f5f5]" onClick={() => setModalOpen(false)}>
                  Отмена
                </button>
                <button className="rounded-md border border-[#caa200] bg-[#ffd659] px-3 py-2 text-sm font-semibold" onClick={saveDraft}>
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="rounded-lg border border-[#cfcfcf] bg-white p-3 text-sm">
          <div className="flex items-center justify-between">
            <div className="text-base font-bold">{selected.title}</div>
          </div>
          <div className="mt-2 space-y-1 text-[#1f1f1f]">
            <div>
              Клиент: <strong>{selected.customerName}</strong> {selected.phone ? `(${selected.phone})` : ""}
            </div>
            <div>Авто: {selected.vehicle ?? "—"}</div>
            <div>
              Время: {new Date(selected.start).toLocaleString()}
            </div>
            <div>Примечание: {selected.note ?? "—"}</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {selected.orderId ? (
              <button
                className="border border-[#c3c3c3] bg-[#f0f0f0] px-3 py-1 text-sm font-semibold"
                onClick={() => navigate(`/orders/${selected.orderId}`)}
              >
                Открыть заказ {selected.orderId}
              </button>
            ) : null}
            <button
              className="rounded-md border border-[#caa200] bg-[#ffd659] px-3 py-1 text-sm font-semibold"
              onClick={() =>
              {
                setDraft({
                  id: selected.id,
                  title: selected.title,
                  customerName: selected.customerName,
                  start: selected.start,
                  end: selected.end,
                  phone: selected.phone ?? "",
                  vehicle: selected.vehicle ?? "",
                  note: selected.note ?? "",
                })
                setModalOpen(true);
              }
              }
            >
              Редактировать
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
