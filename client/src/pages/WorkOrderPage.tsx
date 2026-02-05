import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { IMaskInput } from "react-imask";
import { createOrder, fetchOrder, updateOrder } from "../api/orders";
import { fetchServices } from "../api/services";
import { api } from "../api/api";
import { generateAndUploadTicketPdf } from "../features/tickets/actions/generateAndUploadTicketPdf";
import { generateTicketPdfBlob, downloadBlob } from "../pdf/generateTicketPdf";
import { LineItem, OrderPayload, Payment, WorkStatus } from "../types";
import { PaymentModal } from "../components/PaymentModal";
import { Loader } from "../components/Loader";
import cars from "../data/cars.json";

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

type TableKind = "services" | "parts";

const statusOptions: Array<{ value: WorkStatus; label: string }> = [
  { value: "NEW", label: "Новый" },
  { value: "IN_PROGRESS", label: "В работе" },
   { value: "PENDING_PAYMENT", label: "Ожидание оплаты" },
  { value: "PAYED", label: "Оплачен" },
];

const normalizeStatus = (value: any): WorkStatus => {
  if (value === "PENDING_PAYMENT") return "PENDING_PAYMENT";
  if (value === "IN_PROGRESS") return "IN_PROGRESS";
  if (value === "PAYED") return "PAYED";
  return "NEW";
};

const sumLineItems = (items: LineItem[]) => items.reduce((acc, item) => acc + item.qty * item.price, 0);
const serviceCacheKey = "service-hints-cache";

const parseDateValue = (value?: string) => {
  if (!value) return null;
  if (value.includes(".")) {
    const [d, m, y] = value.split(".").map((v) => Number(v));
    if (d && m && y) return new Date(y, m - 1, d);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toInputDate = (value?: string) => {
  const parsed = parseDateValue(value);
  return parsed ? parsed.toISOString().slice(0, 10) : "";
};

const toDisplayDate = (value?: string) => {
  const parsed = parseDateValue(value);
  return parsed ? parsed.toLocaleDateString("ru-RU") : "";
};

export const WorkOrderPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const orderNumber = id ?? "new";
  const today = new Date();
  const todayString = today.toLocaleDateString("ru-RU");

  const [company, setCompany] = useState("");
  const [customer, setCustomer] = useState("");
  const [car, setCar] = useState("");
  const [mileage, setMileage] = useState<string>("");
  const [reason, setReason] = useState("");
  const [phone, setPhone] = useState("");
  const [govNumber, setGovNumber] = useState("");
  const [vinNumber, setVinNumber] = useState("");
  const [status, setStatus] = useState<WorkStatus>("NEW");
  const [activeTab, setActiveTab] = useState<TableKind>("services");
  const [services, setServices] = useState<LineItem[]>([]);
  const [parts, setParts] = useState<LineItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<{ kind: TableKind; id: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<
    | {
        kind: TableKind;
        id: number;
        x: number;
        y: number;
        visible: true;
      }
    | { visible: false }
  >({ visible: false });
  const [orderDate, setOrderDate] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<{ kind: TableKind; id: number } | null>(null);
  const [editingDraft, setEditingDraft] = useState<{ title: string; qty: string; price: string } | null>(null);
  const touchTimerRef = useRef<number | null>(null);
  const [serviceHints, setServiceHints] = useState<string[]>(defaultServices);
  const [filteredHints, setFilteredHints] = useState<string[]>([]);
  const [carHints, setCarHints] = useState<string[]>([]);
  const [carBrandMap, setCarBrandMap] = useState<Record<string, string[]>>({});
  const [carFilteredBrands, setCarFilteredBrands] = useState<string[]>([]);
  const [carFilteredModels, setCarFilteredModels] = useState<string[]>([]);
  const [selectedCarBrand, setSelectedCarBrand] = useState<string | null>(null);
  const [showCarHints, setShowCarHints] = useState(false);
  const [showHintsFor, setShowHintsFor] = useState<{ kind: TableKind; id: number } | null>(null);
  const [hintPosition, setHintPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const hintSelectionRef = useRef(false);
  const draftKey = useMemo(() => `order-draft-${orderNumber || "new"}`, [orderNumber]);
  const [discountPercent, setDiscountPercent] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "later">("cash");
  const [payAmountInput, setPayAmountInput] = useState<string>("0");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [ticketPdfUrl, setTicketPdfUrl] = useState<string | null>(null);
  const [ticketPdfPath, setTicketPdfPath] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState(false);
  const lastSavedRef = useRef<string>("");
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 1024);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  // Флаг, что форма уже гидратирована (драфт/сервер) и можно писать в localStorage.
  // Без него StrictMode в dev перезаписывает существующий черновик пустыми значениями при первом проходе эффектов.
  const [readyToPersist, setReadyToPersist] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusButtonRef = useRef<HTMLButtonElement | null>(null);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    return () => {
      if (invoiceUrl?.startsWith("blob:")) URL.revokeObjectURL(invoiceUrl);
    };
  }, [invoiceUrl]);

  useEffect(() => {
    if (!statusMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (statusButtonRef.current?.contains(target)) return;
      if (statusMenuRef.current?.contains(target)) return;
      setStatusMenuOpen(false);
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setStatusMenuOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [statusMenuOpen]);

  const servicesTotal = useMemo(() => sumLineItems(services), [services]);
  const partsTotal = useMemo(() => sumLineItems(parts), [parts]);
  const subtotal = servicesTotal + partsTotal;
  const paid = useMemo(() => payments.reduce((acc, payment) => acc + payment.amount, 0), [payments]);

  // Разрешаем редактировать даже оплаченные заказы (по требованию бизнеса)
  const isLocked = false;
  const statusLabel = statusOptions.find((option) => option.value === status)?.label ?? "—";
  const orderNumberDisplay = orderNumber === "new" ? "—" : orderNumber;
  const formatSummary = (value: number) => value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parseInputNumber = (value: string) => Number(String(value).replace(",", "."));
  const serializeOrder = (payload: OrderPayload) =>
    JSON.stringify({
      ...payload,
      services: payload.services ?? [],
      parts: payload.parts ?? [],
      payments: payload.payments ?? [],
    });

  const hasContent = () =>
    Boolean(
      company.trim() ||
        customer.trim() ||
        phone.trim() ||
        car.trim() ||
        govNumber.trim() ||
        vinNumber.trim() ||
        mileage.trim() ||
        reason.trim() ||
        services.length ||
        parts.length ||
        payments.length,
    );

  const discountValue = useMemo(() => {
    const amount = parseInputNumber(discountAmount);
    const percent = parseInputNumber(discountPercent);
    if (!Number.isNaN(amount) && amount > 0) {
      return Math.min(amount, subtotal);
    }
    if (!Number.isNaN(percent) && percent > 0) {
      return Math.min((subtotal * percent) / 100, subtotal);
    }
    return 0;
  }, [discountAmount, discountPercent, subtotal]);

  const hasDiscountInput = useMemo(() => {
    const amount = parseInputNumber(discountAmount);
    const percent = parseInputNumber(discountPercent);
    const hasAmount = discountAmount.trim() !== "" && !Number.isNaN(amount) && amount !== 0;
    const hasPercent = discountPercent.trim() !== "" && !Number.isNaN(percent) && percent !== 0;
    return hasAmount || hasPercent;
  }, [discountAmount, discountPercent]);
  const total = Math.max(subtotal - discountValue, 0);

  const baseBtn =
    "border text-[#1f1f1f] font-semibold leading-tight focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed";
  const ghostBtn = `${baseBtn} border-[#cfcfcf] bg-transparent hover:bg-[#f0f0f0]`;
  const smallBtn = "px-3 py-2 text-sm";

  const hasDraftContent = (draft: Partial<OrderPayload>) => {
    if (!draft) return false;
    return Boolean(
      (draft.company && draft.company.trim()) ||
        (draft.customer && draft.customer.trim()) ||
        (draft.phone && draft.phone.trim()) ||
        (draft.car && draft.car.trim()) ||
        (draft.govNumber && String(draft.govNumber).trim()) ||
      (draft.vinNumber && String(draft.vinNumber).trim()) ||
      (draft.reason && draft.reason.trim()) ||
      (draft.services && draft.services.length) ||
      (draft.parts && draft.parts.length) ||
      (draft.payments && draft.payments.length) ||
      (draft.mileage && draft.mileage > 0),
    );
  };

  const resetForm = () => {
    setCompany("");
    setCustomer("");
    setPhone("");
    setCar("");
    setGovNumber("");
    setVinNumber("");
    setMileage("");
    setReason("");
    setOrderDate("");
    setStatus("NEW");
    setServices([]);
    setParts([]);
    setPayments([]);
    setSelectedRow(null);
    setContextMenu({ visible: false });
    setDiscountPercent("0");
    setDiscountAmount("0");
    setTicketPdfUrl(null);
    setTicketPdfPath(null);
    setInvoiceUrl(null);
    setInvoiceError(null);
  };

  const setFromOrder = (data: OrderPayload) => {
    setCompany((data as any).company ?? "");
    setCustomer(data.customer ?? "");
    setPhone(data.phone ?? "");
    setCar(data.car ?? "");
    setGovNumber(data.govNumber ?? "");
    setVinNumber(data.vinNumber ?? "");
    setMileage(data.mileage ? String(data.mileage) : "");
    setReason(data.reason ?? "");
    setOrderDate(data.date ?? "");
    setStatus(normalizeStatus((data.status as WorkStatus) ?? "NEW"));
    setServices(data.services ?? []);
    setParts(data.parts ?? []);
    setPayments(data.payments ?? []);
    if (typeof data.discountPercent === "number" && !Number.isNaN(data.discountPercent)) {
      setDiscountPercent(String(data.discountPercent));
    }
    if (typeof data.discountAmount === "number" && !Number.isNaN(data.discountAmount)) {
      setDiscountAmount(String(data.discountAmount));
    }
    setTicketPdfUrl((data as any).pdfUrl ?? null);
    setTicketPdfPath((data as any).pdfPath ?? null);
    setPhone(data.phone ?? "");
  };

  useEffect(() => {
    setSelectedRow(null);
    setContextMenu({ visible: false });
    setReadyToPersist(false);
    if (!orderNumber || orderNumber === "new") {
      resetForm();
      setInitialized(true);
      setReadyToPersist(true);
    }

    type DraftOrder = OrderPayload & { discountPercent?: string; discountAmount?: string };
    let draft: DraftOrder | null = null;
    try {
      const raw = localStorage.getItem(draftKey);
      draft = raw ? (JSON.parse(raw) as DraftOrder) : null;
    } catch (err) {
      console.error("Failed to parse draft", err);
    }

    // новые заказы не подхватываем из локального черновика (сервер создаёт номер)
    if (!orderNumber || orderNumber === "new") {
      return;
    }

    // сразу показываем локальный черновик, если он есть (чтобы не видеть пустую форму до загрузки сервера)
    if (draft && hasDraftContent(draft)) {
      setFromOrder(draft as OrderPayload);
      lastSavedRef.current = serializeOrder(draft as OrderPayload);
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);
    const load = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const data = await fetchOrder(orderNumber, { signal: controller.signal });
        // Черновик применяем только если заказ не новый и в черновике есть данные
        if (draft && hasDraftContent(draft) && orderNumber !== "new") {
          const combined: OrderPayload = {
            ...data,
            ...(draft as OrderPayload),
            services: (draft as OrderPayload).services ?? data.services,
            parts: (draft as OrderPayload).parts ?? data.parts,
            payments: (draft as OrderPayload).payments ?? data.payments,
            status: (draft as any).status ?? data.status,
            date: (draft as any).date ?? data.date,
          };
          setFromOrder(combined);
          lastSavedRef.current = serializeOrder(combined);
        } else {
          setFromOrder(data);
          lastSavedRef.current = serializeOrder(data);
        }
        setInitialized(true);
        setReadyToPersist(true);
      } catch (err) {
        if ((err as any)?.name === "CanceledError" || (err as any)?.code === "ERR_CANCELED") {
          // таймаут или отмена — просто выходим без алерта, оставляем черновик
          return;
        }
        console.error(err);
        setLoadError("Не удалось загрузить заказ. Проверьте соединение и обновите страницу.");
        if (draft && hasDraftContent(draft) && orderNumber !== "new") {
          const fallback = {
            ...(draft as OrderPayload),
            status: (draft as any).status ?? status,
            date: (draft as any).date ?? orderDate,
          };
          setFromOrder(fallback as OrderPayload);
          lastSavedRef.current = serializeOrder(fallback as OrderPayload);
        } else {
          setFromOrder({
            company,
            customer,
            phone,
            car,
            govNumber,
            vinNumber,
            mileage: mileage ? Number(mileage) : null,
            reason,
            status,
            services,
            parts,
            payments,
            date: orderDate || todayString,
          } as OrderPayload);
          lastSavedRef.current = "";
        }
        setInitialized(true);
        setReadyToPersist(true);
      } finally {
        window.clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber, todayString, draftKey]);

  useEffect(() => {
    if (!readyToPersist) return;
    const draft: OrderPayload = {
      date: orderDate || undefined,
      company,
      customer,
      car,
      govNumber,
      vinNumber,
      mileage: mileage ? Number(mileage) : null,
      reason,
      phone,
      status,
      services,
      parts,
      payments,
    };
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          ...draft,
          company,
          discountPercent,
          discountAmount,
        }),
      );
    } catch (err) {
      console.error("Failed to save draft", err);
    }
  }, [
    draftKey,
    customer,
    car,
    govNumber,
    vinNumber,
    phone,
    mileage,
    reason,
    status,
    services,
    parts,
    payments,
    orderDate,
    discountPercent,
    discountAmount,
    company,
    readyToPersist,
  ]);

  useEffect(() => {
    // load cached services first
    try {
      const cached = localStorage.getItem(serviceCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as string[];
        if (parsed.length) {
          setServiceHints(parsed);
        }
      }
    } catch (err) {
      console.error("Failed to load cached services", err);
    }

    const loadServices = async () => {
      try {
        const data = await fetchServices();
        const next = data.length > 0 ? data : defaultServices;
        setServiceHints(next);
        localStorage.setItem(serviceCacheKey, JSON.stringify(next));
      } catch (err) {
        console.error(err);
        setServiceHints((prev) => {
          if (prev.length) return prev;
          localStorage.setItem(serviceCacheKey, JSON.stringify(defaultServices));
          return defaultServices;
        });
      }
    };
    loadServices();
    // init car hints from bundled list
    const source = Array.isArray(cars) ? (cars as string[]) : [];
    const uniq = Array.from(new Set(source.map((v) => v.trim()).filter(Boolean)));
    setCarHints(uniq);
    const brandMap: Record<string, string[]> = {};
    uniq.forEach((full) => {
      const [brandRaw] = full.split(/\s+/);
      if (!brandRaw) return;
      const brand = brandRaw.trim();
      const models = brandMap[brand] ?? [];
      models.push(full);
      brandMap[brand] = models;
    });
    setCarBrandMap(brandMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showHintsFor?.kind === "services") {
      const source = serviceHints.length ? serviceHints : defaultServices;
      setFilteredHints(source.slice(0, 8));
    }
  }, [showHintsFor, serviceHints]);

  useEffect(() => {
    if (status !== "PAYED" && statusMenuOpen) {
      setStatusMenuOpen(false);
    }
  }, [status, statusMenuOpen]);

  const normalizeCar = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  useEffect(() => {
    const q = normalizeCar(car);
    if (!car || q.length < 2) {
      setShowCarHints(false);
      setSelectedCarBrand(null);
      setCarFilteredBrands([]);
      setCarFilteredModels([]);
      return;
    }

    if (selectedCarBrand) {
      const models = carBrandMap[selectedCarBrand] ?? [];
      const matches = models
        .filter((m) => normalizeCar(m).includes(q))
        .slice(0, 10);
      setCarFilteredModels(matches);
      setShowCarHints(matches.length > 0);
      return;
    }

    const brands = Object.keys(carBrandMap);
    const matchesBrands = brands
      .filter((b) => normalizeCar(b).includes(q))
      .slice(0, 10);
    const fallbackModels = carHints
      .filter((name) => normalizeCar(name).includes(q))
      .slice(0, 10);

    setCarFilteredBrands(matchesBrands);
    setCarFilteredModels(matchesBrands.length ? [] : fallbackModels);
    setShowCarHints(matchesBrands.length > 0 || fallbackModels.length > 0);
  }, [car, carBrandMap, selectedCarBrand, carHints]);

  useEffect(() => {
    const hideMenu = () => setContextMenu({ visible: false });
    window.addEventListener("click", hideMenu);
    return () => {
      window.removeEventListener("click", hideMenu);
    };
  }, []);

  const orderPayload = (): OrderPayload => ({
    company,
    customer,
    phone: phone,
    car,
    govNumber,
    vinNumber,
    mileage: mileage ? Number(mileage) : null,
    reason,
    status,
    services,
    parts,
    payments,
    discountPercent: Number(discountPercent) || 0,
    discountAmount: Number(discountAmount) || 0,
    pdfUrl: ticketPdfUrl ?? undefined,
    pdfPath: ticketPdfPath ?? undefined,
    id: orderNumber && orderNumber !== "new" ? orderNumber : undefined,
  });

  const LETTERS = "АВЕКМНОРСТУХ";

  const VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

  const computeStatusForSave = (): WorkStatus => {
    if (status === "PENDING_PAYMENT") return "PENDING_PAYMENT";
    if (status === "PAYED") return "PAYED";
    if (status === "IN_PROGRESS") return "IN_PROGRESS";
    if (payments.length > 0) return "PAYED";
    if (hasContent()) return "IN_PROGRESS";
    return "NEW";
  };

  useEffect(() => {
    if (!initialized) return;
    const next = computeStatusForSave();
    if (next !== status) setStatus(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, status, customer, phone, car, govNumber, vinNumber, mileage, reason, services, parts, payments]);

  const handleSave = async (nextStatus?: WorkStatus, nextPayments?: Payment[]): Promise<OrderPayload | null> => {
    try {
      setSaving(true);
      const resolvedStatus = nextStatus ?? computeStatusForSave();
      setStatus(resolvedStatus);
      const payload = { ...orderPayload(), payments: nextPayments ?? payments, status: resolvedStatus };
      let saved: OrderPayload | null = null;
      if (!orderNumber || orderNumber === "new") {
        const created: OrderPayload = await createOrder(payload);
        saved = created;
        setFromOrder(created);
        navigate(`/orders/${created.id}`);
      } else {
        try {
          const updated: OrderPayload = await updateOrder(orderNumber, payload);
          saved = updated;
          setFromOrder(updated);
        } catch (err: any) {
          if (err?.status === 404) {
            const created: OrderPayload = await createOrder(payload);
            saved = created;
            setFromOrder(created);
            navigate(`/orders/${created.id}`);
          } else {
            throw err;
          }
        }
      }
      if (!saved) {
        throw new Error("Не удалось сохранить заказ");
      }
      lastSavedRef.current = serializeOrder(payload);
      setStatus((saved.status as WorkStatus) ?? payload.status);
      setOrderDate(saved.date ?? orderDate ?? todayString);
      setPayments(saved.payments ?? nextPayments ?? payments);
      setTicketPdfUrl((saved as any)?.pdfUrl ?? payload.pdfUrl ?? null);
      setTicketPdfPath((saved as any)?.pdfPath ?? payload.pdfPath ?? null);
      return saved;
    } catch (err) {
      console.error(err);
      alert("Не удалось сохранить заказ");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (next: WorkStatus) => {
    setStatusMenuOpen(false);
    if (next === status) return;
    setStatus(next);
    const saved = await handleSave(next);
    if (saved?.status) {
      setStatus(saved.status as WorkStatus);
    }
  };

  // Если загрузка зависла (например, таймаут запроса), выключаем лоадер через 8 секунд.
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => {
      setLoading(false);
      setLoadError((prev) => prev ?? "Не удалось загрузить заказ. Попробуйте обновить.");
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [loading]);

  const openContextMenu = (kind: TableKind, id: number, x: number, y: number) => {
    setSelectedRow({ kind, id });
    setContextMenu({ kind, id, x, y, visible: true });
  };

  const handleDeleteRow = () => {
    if (!contextMenu.visible) return;
    const { kind, id } = contextMenu;
    if (!window.confirm("Удалить строку?")) return;

    if (kind === "services") {
      setServices((prev) => prev.filter((item) => item.id !== id));
    } else {
      setParts((prev) => prev.filter((item) => item.id !== id));
    }
    setContextMenu({ visible: false });
    setSelectedRow(null);
    if (editingRow && editingRow.kind === kind && editingRow.id === id) {
      setEditingRow(null);
      setEditingDraft(null);
    }
  };

  const rowHandlers = (kind: TableKind, id: number) => {
    if (isLocked) {
      return {
        onClick: (event: React.MouseEvent) => event.stopPropagation(),
        onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
        onDoubleClick: (event: React.MouseEvent) => event.stopPropagation(),
        onTouchStart: () => undefined,
        onTouchEnd: () => undefined,
      };
    }
    const onClick = (event: React.MouseEvent) => {
      event.stopPropagation();
      setSelectedRow({ kind, id });
      setContextMenu({ visible: false });
    };

    const onContextMenu = (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      openContextMenu(kind, id, event.clientX, event.clientY);
    };

    const onDoubleClick = (event: React.MouseEvent) => {
      event.stopPropagation();
      openContextMenu(kind, id, event.clientX, event.clientY);
    };

    const onTouchStart = (event: React.TouchEvent) => {
      const touch = event.touches[0];
      setSelectedRow({ kind, id });
      if (touchTimerRef.current) {
        window.clearTimeout(touchTimerRef.current);
      }
      touchTimerRef.current = window.setTimeout(() => {
        openContextMenu(kind, id, touch.clientX, touch.clientY);
      }, 500);
    };

    const onTouchEnd = () => {
      if (touchTimerRef.current) {
        window.clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    };

    return { onClick, onContextMenu, onDoubleClick, onTouchStart, onTouchEnd };
  };

  const saveInlineEdit = useCallback(() => {
    if (!editingRow || !editingDraft) return;
    const { kind, id } = editingRow;
    const title = editingDraft.title.trim();
    const qty = Number(editingDraft.qty || "0");
    const price = Number(editingDraft.price === "" ? "0" : editingDraft.price || "0");
    const updater = (list: LineItem[]) => {
      if (!title) {
        return list.filter((i) => i.id !== id);
      }
      return list.map((i) => (i.id === id ? { ...i, title, qty: Number.isNaN(qty) ? 0 : qty, price: Number.isNaN(price) ? 0 : price } : i));
    };
    if (kind === "services") {
      setServices((prev) => updater(prev));
    } else {
      setParts((prev) => updater(prev));
    }
    setEditingRow(null);
    setEditingDraft(null);
    setShowHintsFor(null);
  }, [editingDraft, editingRow]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!editingRow) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest(".inline-edit-field") || target?.closest(".hint-list")) return;
      saveInlineEdit();
    };
    window.addEventListener("mousedown", handleOutside);
    return () => {
      window.removeEventListener("mousedown", handleOutside);
    };
  }, [editingRow, saveInlineEdit]);

  const handleEditKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveInlineEdit();
    }
  };

  const handleEditBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (hintSelectionRef.current) {
      hintSelectionRef.current = false;
      return;
    }
    const next = event.relatedTarget as HTMLElement | null;
    if (next?.closest(".inline-edit-field") || next?.closest(".hint-list")) {
      return;
    }
    saveInlineEdit();
  };

  const beginEdit = (kind: TableKind, item: LineItem) => {
    if (isLocked) return;
    setSelectedRow({ kind, id: item.id });
    setEditingRow({ kind, id: item.id });
    setEditingDraft({
      title: item.title ?? "",
      qty: String(item.qty ?? 1),
      price: item.price ? String(item.price) : "",
    });
    if (kind === "services") {
      setShowHintsFor({ kind, id: item.id });
      setFilteredHints(serviceHints);
    } else {
      setShowHintsFor(null);
      setFilteredHints([]);
    }
  };

  const addLineItem = (kind: TableKind) => {
    if (isLocked) return;
    const item: LineItem = { id: Date.now(), title: "", qty: 1, price: 0 };
    if (kind === "services") {
      setServices((prev) => [...prev, item]);
      setActiveTab("services");
    } else {
      setParts((prev) => [...prev, item]);
      setActiveTab("parts");
    }
    beginEdit(kind, item);
  };

  const editLineItem = (kind: TableKind) => {
    if (isLocked) return;
    if (!selectedRow || selectedRow.kind !== kind) return;
    const list = kind === "services" ? services : parts;
    const item = list.find((i) => i.id === selectedRow.id);
    if (!item) return;
    beginEdit(kind, item);
  };

  const deleteSelected = (kind: TableKind) => {
    if (!selectedRow || selectedRow.kind !== kind) return;
    if (!window.confirm("Удалить строку?")) return;
    if (kind === "services") {
      setServices((prev) => prev.filter((i) => i.id !== selectedRow.id));
    } else {
      setParts((prev) => prev.filter((i) => i.id !== selectedRow.id));
    }
    setSelectedRow(null);
    if (editingRow && editingRow.kind === kind && editingRow.id === selectedRow.id) {
      setEditingRow(null);
      setEditingDraft(null);
    }
  };

  const toAbsoluteUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith("blob:")) return url;
    if (/^https?:\/\//i.test(url) || url.startsWith("tauri://") || url.startsWith("https://tauri.")) return url;
    const base = api.defaults.baseURL || window.location.origin;
    try {
      return new URL(url, base).toString();
    } catch {
      return url;
    }
  };

  const mapOrderToTicket = (order: OrderPayload, issuedAt?: string) => ({
    id: order.id ?? orderNumber,
    number: order.id ?? orderNumber,
    issuedAt: issuedAt ?? new Date().toISOString(),
    customerName: order.customer ?? "",
    phone: order.phone ?? "",
    vehicle: order.car ?? "",
    govNumber: order.govNumber ?? "",
    vinNumber: order.vinNumber ?? "",
    mileage: order.mileage ?? null,
    service: order.reason ?? "",
    services: (order.services ?? []).map((s) => ({
      title: s.title ?? "",
      qty: Number.isFinite(s.qty) ? Number(s.qty) : 0,
      price: Number.isFinite(s.price) ? Number(s.price) : 0,
    })),
    parts: (order.parts ?? []).map((p) => ({
      title: p.title ?? "",
      qty: Number.isFinite(p.qty) ? Number(p.qty) : 0,
      price: Number.isFinite(p.price) ? Number(p.price) : 0,
    })),
    discountPercent: order.discountPercent != null ? order.discountPercent : parseInputNumber(discountPercent) || 0,
    discountAmount: order.discountAmount != null ? order.discountAmount : parseInputNumber(discountAmount) || 0,
  });

  const ensureSavedOrder = async (nextStatus?: WorkStatus, nextPayments?: Payment[]) => {
    const saved = await handleSave(nextStatus, nextPayments);
    const resolvedId = saved?.id ?? orderNumber;
    if (!resolvedId || resolvedId === "new") {
      throw new Error("Сохраните заказ перед генерацией PDF");
    }
    return { order: saved ?? { ...orderPayload(), id: resolvedId }, id: String(resolvedId) };
  };

  const generatePdfAndUpload = async (resolved?: { order: OrderPayload; id: string }) => {
    const target = resolved ?? (await ensureSavedOrder());
    try {
      setInvoiceLoading(true);
      setInvoiceError(null);
      const issuedAtIso = new Date().toISOString();
      const result = await generateAndUploadTicketPdf({
        orderId: target.id,
        order: target.order,
        issuedAt: issuedAtIso,
      });
      const finalOrder = result.updatedOrder ?? target.order;
      setFromOrder(finalOrder);
      setTicketPdfUrl((result.uploadUrl ?? (finalOrder as any).pdfUrl ?? null) as string | null);
      setTicketPdfPath((result.uploadPath ?? (finalOrder as any).pdfPath ?? null) as string | null);
      if (result.uploadUrl ?? (finalOrder as any).pdfUrl) {
        setInvoiceUrl(toAbsoluteUrl(result.uploadUrl ?? (finalOrder as any).pdfUrl ?? null));
      }
      return result;
    } catch (err) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.error ||
        (err as any)?.message ||
        "Не удалось загрузить PDF на сервер. Скачайте файл локально.";
      setInvoiceError(msg);
      throw err;
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleInvoiceCreate = async (event: React.MouseEvent) => {
    event.preventDefault();
    try {
      setPdfLoading(true);
      if (payMethod === "later") {
        await ensureSavedOrder("PENDING_PAYMENT", payments);
        setStatus("PENDING_PAYMENT");
        setShowPaymentsModal(false);
        setTicketPdfUrl(null);
        setTicketPdfPath(null);
        setInvoiceUrl(null);
        setPdfLoading(false);
        return;
      }
      const due = Math.max(total - paid, 0);
      const payValue = parseInputNumber(payAmountInput);
      const amount = Number.isFinite(payValue) && payValue > 0 ? payValue : due;
      const newPayment: Payment = {
        id: Date.now(),
        date: orderDate || todayString,
        method: payMethod,
        amount: amount > 0 ? amount : due,
      };
      const nextPayments = [...payments, newPayment];
      setPayments(nextPayments);
      const resolved = await ensureSavedOrder("PAYED", nextPayments);
      setShowPaymentsModal(false);
      setShowInvoiceModal(true);
      try {
        await generatePdfAndUpload(resolved);
      } catch {
        const ticket = mapOrderToTicket(resolved.order, new Date().toISOString());
        const blob = await generateTicketPdfBlob(ticket);
        downloadBlob(blob, `ticket-${resolved.id}.pdf`);
      }
    } catch (err) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.error ||
        (err as any)?.message ||
        "Не удалось сформировать счет-фактуру";
      alert(msg);
    } finally {
      setPdfLoading(false);
    }
  };

  const applyHint = (kind: TableKind, id: number, title: string) => {
    if (kind !== "services") return;
    setEditingDraft((prev) => ({ ...(prev ?? { title: "", qty: "1", price: "0" }), title }));
    setShowHintsFor(null);
    setFilteredHints([]);
    setSelectedRow({ kind, id });
  };

  useEffect(() => {
    if (showPaymentsModal) {
      const due = Math.max(total - paid, 0);
      setPayAmountInput(formatSummary(due).replace(/\s/g, ""));
      setPayMethod("cash");
    }
  }, [showPaymentsModal, total, paid]);

  const handleKeypad = (val: string) => {
    setPayAmountInput((prev) => {
      if (val === "clear") return "0";
      if (val === "back") return prev.length > 1 ? prev.slice(0, -1) : "0";
      if (val === "," || val === ".") {
        return prev.includes(".") ? prev : prev + ".";
      }
      const next = prev === "0" ? val : prev + val;
      return next;
    });
  };

  const handleDateChange = (value: string) => {
    const display = toDisplayDate(value) || todayString;
    setOrderDate(display);
    setEditingDate(false);
  };

  const openInvoiceModal = () => {
    setShowInvoiceModal(true);
    setInvoiceError(null);
  };

  const openInvoicePdf = async () => {
    const link = toAbsoluteUrl(ticketPdfUrl ?? ticketPdfPath ?? invoiceUrl ?? null);
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
      return;
    }
    openInvoiceModal();
  };

  const handlePendingPaymentConfirm = async () => {
    try {
      setPdfLoading(true);
      const due = Math.max(total - paid, 0);
      const payment: Payment = {
        id: Date.now(),
        date: orderDate || todayString,
        method: payMethod === "later" ? "cash" : payMethod,
        amount: due,
      };
      const nextPayments = [...payments, payment];
      setPayments(nextPayments);

      const resolved = await ensureSavedOrder("PAYED", nextPayments);
      setStatus("PAYED");
      setShowInvoiceModal(true);
      try {
        await generatePdfAndUpload(resolved);
      } catch {
        const ticket = mapOrderToTicket(resolved.order, new Date().toISOString());
        const blob = await generateTicketPdfBlob(ticket);
        downloadBlob(blob, `ticket-${resolved.id}.pdf`);
      }
    } catch (err) {
      console.error(err);
      alert("Не удалось завершить оплату и сформировать акт");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="relative mx-auto flex flex-col gap-3 p-3 max-[960px]:pt-16">
      {(loading || saving || pdfLoading) && <Loader />}
      {loadError && (
        <div className="rounded-lg border border-[#f2b8b5] bg-[#fff4f3] px-3 py-2 text-sm font-semibold text-[#8a1f1f]">
          {loadError}
        </div>
      )}

      <header className="flex items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 shadow-sm">
        <div className="space-y-1 leading-tight">
          <h1 className="text-xl font-bold text-[#1f1f1f]">Заказ-наряд № {orderNumberDisplay}</h1>
          <div className="flex items-center gap-2 text-sm text-[#555555]">
            <span>от {orderDate || todayString}</span>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700"
              onClick={() => setEditingDate((prev) => !prev)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 20h4.2c.26 0 .39 0 .5-.05.1-.04.2-.1.27-.18.07-.07.12-.2.22-.45L9.5 19l-.1.22 8.76-8.76a2 2 0 0 0 0-2.83l-.79-.79a2 2 0 0 0-2.83 0L5.79 15.6c-.2.2-.3.3-.38.42-.08.11-.14.24-.17.38-.03.12-.03.26-.03.54V20Z"
                  stroke="#1f1f1f"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="m13.5 6.5 4 4"
                  stroke="#1f1f1f"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {editingDate ? (
              <input
                type="date"
                className="rounded-md border border-[#c3c3c3] bg-white px-2 py-1 text-[13px] text-[#1f1f1f] focus:outline-none"
                value={toInputDate(orderDate || todayString)}
                onChange={(e) => handleDateChange(e.target.value)}
                onBlur={() => setEditingDate(false)}
              />
            ) : null}
          </div>
        </div>
        {status === "PAYED" && (
          <div className="relative">
            <button
              type="button"
              ref={statusButtonRef}
              className="status-pill inline-flex items-center gap-1 rounded-md border border-[#0f9d58] bg-[#0f9d58] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm hover:bg-[#0c7d45]"
              onClick={() => setStatusMenuOpen((prev) => !prev)}
              title="Сменить статус"
            >
              {statusLabel}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {statusMenuOpen && (
              <div
                ref={statusMenuRef}
                className="absolute right-0 z-30 mt-2 w-48 rounded-md border border-[#dcdcdc] bg-white shadow-lg"
              >
                <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  Сменить статус
                </div>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm font-semibold text-[#1f2937] hover:bg-[#f5f5f5]"
                  onClick={() => handleStatusChange("IN_PROGRESS")}
                >
                  В работе
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm font-semibold text-[#1f2937] hover:bg-[#f5f5f5]"
                  onClick={() => handleStatusChange("PENDING_PAYMENT")}
                >
                  Ожидание оплаты
                </button>
              </div>
            )}
          </div>
        )}
        {status === "PENDING_PAYMENT" && (
          <span className="status-pill inline-block rounded-md border border-[#8b5cf6] bg-[#8b5cf6] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            {statusLabel}
          </span>
        )}
        {status === "IN_PROGRESS" && (
          <span className="status-pill inline-block rounded-md border border-[#f2994a] bg-[#f2994a] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            {statusLabel}
          </span>
        )}
        {status === "NEW" && (
          <span className="status-pill inline-block rounded-md border border-[#074587] bg-[#1d4ed8] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            {statusLabel}
          </span>
        )}
      </header>

      <fieldset className="contents">
      <section className="header-grid grid grid-cols-1 gap-3 rounded-xl border border-[#e5e5e5] bg-white p-4 shadow-sm md:grid-cols-2">
        <div className="field flex flex-col gap-1">
          <label className="text-[13px] font-semibold text-[#2c2c2c]">Заказчик</label>
          <div className="field-row flex items-center gap-2">
            <input
              className="w-full rounded-md border border-[#c3c3c3] bg-white px-2.5 py-2 text-[13px] focus:outline-none"
              type="text"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Введите имя"
            />
          </div>
        </div>

        <div className="field flex flex-col gap-1">
          <label className="text-[13px] font-semibold text-[#2c2c2c]">Телефон</label>
          <div className="field-row flex items-center gap-2">
            <IMaskInput
              className="w-full rounded-md border border-[#c3c3c3] bg-white px-2.5 py-2 text-[13px] focus:outline-none"
              mask="+7 (000) 000-00-00"
              overwrite
              lazy={false}
              value={phone}
              onAccept={(val: unknown) => setPhone(String(val))}
              placeholder="+7 (___) ___-__-__"
              inputMode="tel"
            />
          </div>
        </div>

        <div className="field flex flex-col gap-1">
          <label className="text-[13px] font-semibold text-[#2c2c2c]">Автомобиль</label>
          <div className="field-row flex items-center gap-2">
            <input
              className="w-full rounded-md border border-[#c3c3c3] bg-white px-2.5 py-2 text-[13px] focus:outline-none"
              type="text"
              value={car}
              onChange={(e) => setCar(e.target.value)}
              onFocus={() => {
                if (car.trim().length >= 2) setShowCarHints(true);
              }}
              onBlur={() => setTimeout(() => setShowCarHints(false), 120)}
              placeholder="Введите модель, марку"
            />
          </div>
          {showCarHints && (
            <div className="mt-1 max-h-60 overflow-y-auto rounded-md border border-[#dcdcdc] bg-white shadow-sm">
              {!selectedCarBrand && carFilteredBrands.length > 0 &&
                carFilteredBrands.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    className="block w-full px-2.5 py-2 text-left text-sm hover:bg-[#f5f5f5]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSelectedCarBrand(brand);
                      setCar(`${brand} `);
                      setShowCarHints(true);
                    }}
                  >
                    {brand}
                  </button>
                ))}
              {!selectedCarBrand && carFilteredBrands.length === 0 &&
                carFilteredModels.map((model) => (
                  <button
                    key={model}
                    type="button"
                    className="block w-full px-2.5 py-2 text-left text-sm hover:bg-[#f5f5f5]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setCar(model);
                      setSelectedCarBrand(null);
                      setShowCarHints(false);
                    }}
                  >
                    {model}
                  </button>
                ))}
              {selectedCarBrand &&
                carFilteredModels.map((model) => (
                  <button
                    key={model}
                    type="button"
                    className="block w/full px-2.5 py-2 text-left text-sm hover:bg-[#f5f5f5]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setCar(model);
                      setSelectedCarBrand(null);
                      setShowCarHints(false);
                    }}
                  >
                    {model}
                  </button>
                ))}
            </div>
          )}
        </div>

        <div className="field flex flex-col gap-1">
          <label className="text-[13px] font-semibold text-[#2c2c2c]">Гос номер</label>
          <div className="field-row flex items-center gap-2">
            <IMaskInput
              className="w-full rounded-md border border-[#c3c3c3] bg-white px-2.5 py-2 text-[13px] focus:outline-none"
              mask="a000aa 00[0]"
              definitions={{
                a: {
                  mask: new RegExp(`[${LETTERS}]`),
                },
              }}
              prepare={(str) => str.toUpperCase()}
              value={govNumber}
              onAccept={(val) => setGovNumber(String(val))}
              placeholder="А123ВС 77"
              lazy={false}
            />
          </div>
        </div>

        <div className="field flex flex-col gap-1">
          <label className="text-[13px] font-semibold text-[#2c2c2c]">VIN</label>
          <div className="field-row flex items-center gap-2">
            <IMaskInput
              className="w-full rounded-md border border-[#c3c3c3] bg-white px-2.5 py-2 text-[13px] focus:outline-none"
              mask="*****************"
              definitions={{
                "*": {
                  mask: new RegExp(`[${VIN_CHARS}]`),
                },
              }}
              prepare={(str) => str.toUpperCase()}
              value={vinNumber}
              onAccept={(val) => setVinNumber(String(val))}
              placeholder="VIN (17 символов)"
              lazy={false}
            />
          </div>
        </div>

        <div className="field flex flex-col gap-1">
          <label className="text-[13px] font-semibold text-[#2c2c2c]">Пробег</label>
          <div className="field-row flex items-center gap-2">
            <input
              className="w-full rounded-md border border-[#c3c3c3] bg-white px-2.5 py-2 text-[13px] focus:outline-none"
              type="number"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="Пробег"
              aria-label="Пробег"
            />
            <span className="unit text-[13px] text-[#555555]">км</span>
          </div>
        </div>

        <div className="field flex flex-col gap-1">
          <label className="text-[13px] font-semibold text-[#2c2c2c]">Причина</label>
          <input
            className="w-full rounded-md border border-[#c3c3c3] bg-white px-2.5 py-2 text-[13px] focus:outline-none"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Причина обращения"
          />
        </div>

        <div className="field flex flex-col gap-1">
          <label className="text-[13px] font-semibold text-[#2c2c2c]">Компания</label>
          <div className="field-row flex items-center gap-2">
            <input
              className="w-full rounded-md border border-[#c3c3c3] bg-white px-2.5 py-2 text-[13px] focus:outline-none"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Название компании"
            />
          </div>
        </div>
      </section>

      <section className="mt-3 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 shadow-sm">
          <span className="text-[14px] font-semibold text-[#444444]">Быстрые действия:</span>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md border border-[#e2b007] bg-[#ffd54f] px-4 py-2 text-[14px] font-semibold text-[#1f1f1f] shadow-sm hover:bg-[#ffc930]"
              onClick={() => addLineItem("services")}
            >
              Добавить работу
            </button>
            <button
              className="rounded-md border border-[#d6d6d6] bg-[#f5f5f5] px-4 py-2 text-[14px] font-semibold text-[#2c2c2c] shadow-sm hover:bg-[#ededed]"
              onClick={() => addLineItem("parts")}
            >
              Добавить запчасть
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-1 rounded-xl border border-[#e5e5e5] bg-white p-3 shadow-sm">
            <div className="flex items-end gap-6 border-b border-[#ededed] px-1">
              <button
                className={`pb-2 text-[16px] font-bold ${activeTab === "services" ? "border-b-2 border-[#f5a700] text-[#1f1f1f]" : "text-[#6c6c6c]"}`}
                onClick={() => setActiveTab("services")}
              >
                Работы
              </button>
              <button
                className={`pb-2 text-[16px] font-bold ${activeTab === "parts" ? "border-b-2 border-[#f5a700] text-[#1f1f1f]" : "text-[#6c6c6c]"}`}
                onClick={() => setActiveTab("parts")}
              >
                Запчасти
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {activeTab === "services" ? (
                <>
                  <button
                    className="rounded-md border border-[#e2b007] bg-[#ffd54f] px-4 py-2 text-[14px] font-semibold text-[#1f1f1f] shadow-sm hover:bg-[#ffc930]"
                    onClick={() => addLineItem("services")}
                  >
                    Добавить
                  </button>
                  <button
                    className="rounded-md border border-[#d6d6d6] bg-[#f7f7f7] px-4 py-2 text-[14px] font-semibold text-[#2c2c2c] shadow-sm hover:bg-[#ededed]"
                    onClick={() => editLineItem("services")}
                  >
                    Редактировать
                  </button>
                  <button
                    className="rounded-md border border-[#e5b1b1] bg-[#fff6f6] px-4 py-2 text-[14px] font-semibold text-[#c0392b] shadow-sm hover:bg-[#ffe9e9]"
                    onClick={() => deleteSelected("services")}
                  >
                    Удалить
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="rounded-md border border-[#e2b007] bg-[#ffd54f] px-4 py-2 text-[14px] font-semibold text-[#1f1f1f] shadow-sm hover:bg-[#ffc930]"
                    onClick={() => addLineItem("parts")}
                  >
                    Добавить
                  </button>
                  <button
                    className="rounded-md border border-[#d6d6d6] bg-[#f7f7f7] px-4 py-2 text-[14px] font-semibold text-[#2c2c2c] shadow-sm hover:bg-[#ededed]"
                    onClick={() => editLineItem("parts")}
                  >
                    Редактировать
                  </button>
                  <button
                    className="rounded-md border border-[#e5b1b1] bg-[#fff6f6] px-4 py-2 text-[14px] font-semibold text-[#c0392b] shadow-sm hover:bg-[#ffe9e9]"
                    onClick={() => deleteSelected("parts")}
                  >
                    Удалить
                  </button>
                </>
              )}
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border border-[#dcdcdc] bg-white">
              {activeTab === "services" ? (
                <table className="min-w-[640px] w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#f5f5f5]">
                      <th className="border border-[#dcdcdc] px-3 py-2 text-center text-[#404040] font-bold">№</th>
                      <th className="border border-[#dcdcdc] px-3 py-2 text-center text-[#404040] font-bold">Наименование</th>
                      <th className="border border-[#dcdcdc] px-3 py-2 text-center text-[#404040] font-bold">Кол-во</th>
                      <th className="border border-[#dcdcdc] px-3 py-2 text-center text-[#404040] font-bold">Цена, руб.</th>
                      <th className="border border-[#dcdcdc] px-3 py-2 text-center text-[#404040] font-bold">Сумма, руб.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((item, index) => {
                      const isEditing = editingRow?.kind === "services" && editingRow.id === item.id;
                      const isSelected = selectedRow?.kind === "services" && selectedRow.id === item.id;
                      const draft =
                        isEditing && editingDraft
                          ? editingDraft
                          : { title: item.title, qty: String(item.qty), price: String(item.price) };
                      const cellBase = "border border-[#dcdcdc] px-3 py-2 align-top text-[13px]";
                      const selectedCell = isSelected ? "bg-[#fff7d6]" : "";
                      return (
                        <tr
                          key={item.id}
                          className={`text-[13px] ${isSelected ? "bg-[#fff2b2]" : ""}`}
                          {...rowHandlers("services", item.id)}
                        >
                          <td className={`${cellBase} ${selectedCell} text-center font-semibold`}>{index + 1}</td>
                          <td className={`${cellBase} ${selectedCell}`}>
                            {isEditing ? (
                              <div className="inline-edit-container relative">
                                <input
                                  className="inline-edit-field w-full border border-[#c3c3c3] bg-white px-2 py-1 text-[13px] focus:outline-none"
                                  autoFocus
                                  value={draft.title}
                                  onChange={async (e) => {
                                    const val = e.target.value;
                                    setEditingDraft((prev) => ({ ...(prev ?? draft), title: val }));
                                    setShowHintsFor({ kind: "services", id: item.id });
                                    const source = serviceHints.length ? serviceHints : defaultServices;
                                    const localFiltered = val.trim().length
                                      ? source.filter((s) => s.toLowerCase().includes(val.toLowerCase()))
                                      : source;
                                    setFilteredHints(localFiltered.slice(0, 8));
                                    try {
                                      const hints = await fetchServices(val);
                                      const merged =
                                        hints && hints.length ? hints : source.filter((s) => s.toLowerCase().includes(val.toLowerCase()));
                                      setFilteredHints(merged.slice(0, 8));
                                      localStorage.setItem(serviceCacheKey, JSON.stringify(merged));
                                    } catch (err) {
                                      console.error(err);
                                      const fallback = source.filter((s) => s.toLowerCase().includes(val.toLowerCase()));
                                      setFilteredHints(fallback.slice(0, 8));
                                    }
                                  }}
                                  onFocus={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setHintPosition({
                                      top: rect.top + window.scrollY,
                                      left: rect.left + window.scrollX,
                                      width: rect.width,
                                    });
                                    const source = serviceHints.length ? serviceHints : defaultServices;
                                    setShowHintsFor({ kind: "services", id: item.id });
                                    setFilteredHints(source.slice(0, 8));
                                  }}
                                  onKeyDown={handleEditKeyDown}
                                  onBlur={handleEditBlur}
                                />
                                {showHintsFor?.kind === "services" &&
                                showHintsFor.id === item.id &&
                                filteredHints.length > 0 &&
                                hintPosition
                                  ? createPortal(
                                      <ul
                                        className="hint-list fixed z-[2000] max-h-56 list-none overflow-y-auto border border-[#c3c3c3] bg-white p-0 shadow-lg"
                                        style={{
                                          top: (hintPosition?.top ?? 0) - 4,
                                          left: hintPosition?.left ?? 0,
                                          minWidth: hintPosition?.width ?? 180,
                                          right: viewportWidth < 480 ? 8 : undefined,
                                          transform: "translateY(-100%)",
                                        }}
                                      >
                                        {filteredHints.map((hint) => (
                                          <li
                                            key={hint}
                                            className="cursor-pointer px-2 py-1 hover:bg-[#f0f0f0]"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              hintSelectionRef.current = true;
                                            }}
                                            onClick={() => {
                                              hintSelectionRef.current = false;
                                              applyHint("services", item.id, hint);
                                            }}
                                          >
                                            {hint}
                                          </li>
                                        ))}
                                      </ul>,
                                      document.body,
                                    )
                                  : null}
                              </div>
                            ) : (
                              item.title
                            )}
                          </td>
                          <td className={`${cellBase} ${selectedCell} whitespace-nowrap text-right`}>
                            {isEditing ? (
                              <input
                                className="inline-edit-field w-full border border-[#c3c3c3] bg-white px-2 py-1 text-[13px] text-right focus:outline-none"
                                type="number"
                                value={draft.qty}
                                onChange={(e) => setEditingDraft((prev) => ({ ...(prev ?? draft), qty: e.target.value }))}
                                onKeyDown={handleEditKeyDown}
                                onBlur={handleEditBlur}
                              />
                            ) : (
                              item.qty
                            )}
                          </td>
                          <td className={`${cellBase} ${selectedCell} whitespace-nowrap text-right`}>
                            {isEditing ? (
                              <input
                                className="inline-edit-field w-full border border-[#c3c3c3] bg-white px-2 py-1 text-[13px] text-right focus:outline-none"
                                type="number"
                                value={draft.price}
                                onChange={(e) => setEditingDraft((prev) => ({ ...(prev ?? draft), price: e.target.value }))}
                                onKeyDown={handleEditKeyDown}
                                onBlur={handleEditBlur}
                              />
                            ) : (
                              item.price.toLocaleString("ru-RU")
                            )}
                          </td>
                          <td className={`${cellBase} ${selectedCell} whitespace-nowrap text-right`}>
                            {(item.qty * item.price).toLocaleString("ru-RU")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-[640px] w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#f5f5f5]">
                      <th className="border border-[#dcdcdc] px-3 py-2 text-center text-[#404040] font-bold">№</th>
                      <th className="border border-[#dcdcdc] px-3 py-2 text-center text-[#404040] font-bold">Наименование</th>
                      <th className="border border-[#dcdcdc] px-3 py-2 text-center text-[#404040] font-bold">Кол-во</th>
                      <th className="border border-[#dcdcdc] px-3 py-2 text-center text-[#404040] font-bold">Цена, руб.</th>
                      <th className="border border-[#dcdcdc] px-3 py-2 text-center text-[#404040] font-bold">Сумма, руб.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((item, index) => {
                      const isEditing = editingRow?.kind === "parts" && editingRow.id === item.id;
                      const isSelected = selectedRow?.kind === "parts" && selectedRow.id === item.id;
                      const draft =
                        isEditing && editingDraft
                          ? editingDraft
                          : { title: item.title, qty: String(item.qty), price: String(item.price) };
                      const cellBase = "border border-[#dcdcdc] px-3 py-2 align-top text-[13px]";
                      const selectedCell = isSelected ? "bg-[#fff7d6]" : "";
                      return (
                        <tr
                          key={item.id}
                          className={`text-[13px] ${isSelected ? "bg-[#fff2b2]" : ""}`}
                          {...rowHandlers("parts", item.id)}
                        >
                          <td className={`${cellBase} ${selectedCell} text-center font-semibold`}>{index + 1}</td>
                          <td className={`${cellBase} ${selectedCell}`}>
                            {isEditing ? (
                              <input
                                className="inline-edit-field w-full border border-[#c3c3c3] bg-white px-2 py-1 text-[13px] focus:outline-none"
                                autoFocus
                                value={draft.title}
                                onChange={(e) => setEditingDraft((prev) => ({ ...(prev ?? draft), title: e.target.value }))}
                                onKeyDown={handleEditKeyDown}
                                onBlur={handleEditBlur}
                              />
                            ) : (
                              item.title
                            )}
                          </td>
                          <td className={`${cellBase} ${selectedCell} whitespace-nowrap text-right`}>
                            {isEditing ? (
                              <input
                                className="inline-edit-field w-full border border-[#c3c3c3] bg-white px-2 py-1 text-[13px] text-right focus:outline-none"
                                type="number"
                                value={draft.qty}
                                onChange={(e) => setEditingDraft((prev) => ({ ...(prev ?? draft), qty: e.target.value }))}
                                onKeyDown={handleEditKeyDown}
                                onBlur={handleEditBlur}
                              />
                            ) : (
                              item.qty
                            )}
                          </td>
                          <td className={`${cellBase} ${selectedCell} whitespace-nowrap text-right`}>
                            {isEditing ? (
                              <input
                                className="inline-edit-field w-full border border-[#c3c3c3] bg-white px-2 py-1 text-[13px] text-right focus:outline-none"
                                type="number"
                                value={draft.price}
                                onChange={(e) => setEditingDraft((prev) => ({ ...(prev ?? draft), price: e.target.value }))}
                                onKeyDown={handleEditKeyDown}
                                onBlur={handleEditBlur}
                              />
                            ) : (
                              item.price.toLocaleString("ru-RU")
                            )}
                          </td>
                          <td className={`${cellBase} ${selectedCell} whitespace-nowrap text-right`}>
                            {(item.qty * item.price).toLocaleString("ru-RU")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-3 text-[15px] font-semibold text-[#1f1f1f]">
              {activeTab === "services"
                ? `Итого работ: ${servicesTotal.toLocaleString("ru-RU")} руб.`
                : `Итого запчастей: ${partsTotal.toLocaleString("ru-RU")} руб.`}
            </div>
          </div>

          <div className="w-full rounded-xl border border-[#e5e5e5] bg-white p-4 shadow-sm lg:w-80">
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-semibold text-[#1f1f1f]">Счет-фактура:</div>
            </div>

            <div className="mt-3 flex items-center justify-between text-[14px]">
              <span className="text-[#444444]">Скидка:</span>
              <div className="flex items-center justify-between">
                <input
                className="w-16 rounded-md border border-[#c3c3c3] bg-white px-2 py-1 mr-1 text-right text-[14px] focus:outline-none"
                type="text"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
              />
              <span className="text-[#444444] mr-1">%</span>
              <input
                className="w-20 rounded-md border border-[#c3c3c3] bg-white px-2 py-1 mr-1 text-right text-[14px] focus:outline-none"
                type="text"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
              <span className="text-[#444444]">р.</span>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-[15px]">
              <div className="flex items-center justify-between text-[#555555]">
                <span>Запчасти:</span>
                <span className="font-semibold text-[#222222]">
                  {formatSummary(partsTotal)} руб.
                </span>
              </div>
              <div className="flex items-center justify-between text-[#555555]">
                <span>Работа:</span>
                <span className="font-semibold text-[#222222]">
                  {formatSummary(servicesTotal)} руб.
                </span>
              </div>
              {hasDiscountInput || discountValue > 0 ? (
                <div className="flex items-center justify-between text-[#555555]">
                  <span>Скидка:</span>
                  <span className="font-semibold text-[#222222]">
                    {formatSummary(discountValue)} руб.
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-[#ededed] pt-2 text-[16px] font-bold text-[#111111]">
                <span>Всего:</span>
                <span>{formatSummary(total)} руб.</span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {status === "PAYED" ? (
                <button
                  className="rounded-md w-full border border-[#4a6aff] bg-[#e8edff] px-4 py-2 text-[14px] font-semibold text-[#1c2a80] shadow-sm hover:bg-[#dbe4ff]"
                  onClick={async () => {
                    setStatus("PAYED");
                    setShowInvoiceModal(true);
                    try {
                      setPdfLoading(true);
                      const resolved = await ensureSavedOrder("PAYED", payments);
                      await generatePdfAndUpload(resolved);
                    } catch {
                      // fall back to local download if upload fails
                      try {
                        const { order, id } = await ensureSavedOrder("PAYED", payments);
                        const blob = await generateTicketPdfBlob(mapOrderToTicket(order, new Date().toISOString()));
                        downloadBlob(blob, `ticket-${id}.pdf`);
                      } catch (err) {
                        console.error(err);
                        alert("Не удалось сформировать PDF");
                      }
                    } finally {
                      setPdfLoading(false);
                    }
                  }}
                >
                  Сохранить
                </button>
              ) : status === "PENDING_PAYMENT" ? (
                <>
                  <button
                    className="rounded-md w-full border border-[#1f8f3a] bg-[#1fad4c] px-4 py-2 text-[14px] font-semibold text-white shadow-sm hover:bg-[#179340]"
                    onClick={handlePendingPaymentConfirm}
                  >
                    Оплата принята
                  </button>
                  <button
                    className="rounded-md w-full border border-[#4a6aff] bg-[#e8edff] px-4 py-2 text-[14px] font-semibold text-[#1c2a80] shadow-sm hover:bg-[#dbe4ff]"
                    onClick={async () => {
                      try {
                        setPdfLoading(true);
                        const resolved = await ensureSavedOrder("PENDING_PAYMENT", payments);
                        if (resolved) setFromOrder(resolved.order ?? resolved);
                      } catch (err) {
                        console.error(err);
                        alert("Не удалось сохранить заказ");
                      } finally {
                        setPdfLoading(false);
                      }
                    }}
                  >
                    Сохранить
                  </button>
                </>
              ) : (
                <button
                  disabled={status === "NEW"}
                  className={`rounded-md w-full border px-4 py-2 text-[14px] font-semibold shadow-sm ${
                    status === "NEW"
                      ? "cursor-not-allowed border-[#d6d6d6] bg-[#f0f0f0] text-[#888888]"
                      : "border-[#e2b007] bg-[#ffd54f] text-[#1f1f1f] hover:bg-[#ffc930]"
                  }`}
                  onClick={() => setShowPaymentsModal(true)}
                >
                  Принять оплату
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {contextMenu.visible && (
        <div
          className="context-menu fixed z-50 min-w-[140px] border border-black bg-white shadow"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="context-menu__item block w-full bg-transparent px-3 py-2 text-left hover:bg-[#f0f0f0]" onClick={handleDeleteRow}>
            Удалить строку
          </button>
        </div>
      )}

      <PaymentModal
        open={showPaymentsModal}
        onClose={() => setShowPaymentsModal(false)}
        orderNumber={orderNumberDisplay}
        payMethod={payMethod}
        setPayMethod={setPayMethod}
        payAmountInput={payAmountInput}
        setPayAmountInput={setPayAmountInput}
        parseInputNumber={parseInputNumber}
        total={total}
        paid={paid}
        servicesTotal={servicesTotal}
        partsTotal={partsTotal}
        discountValue={discountValue}
        servicesCount={services.length}
        partsCount={parts.length}
        handleKeypad={handleKeypad}
        handleInvoiceCreate={handleInvoiceCreate}
        ghostBtn={ghostBtn}
        smallBtn={smallBtn}
        payButtonLabel={payMethod === "later" ? "Отсрочка платежа" : "Оплатить"}
      />
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3" onClick={() => setShowInvoiceModal(false)}>
          <div
            className="w-full max-w-lg rounded-xl border border-[#dcdcdc] bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#6c6c6c]">Оплата проведена</p>
                <h3 className="text-xl font-bold text-[#1f1f1f]">Заказ № {orderNumberDisplay}</h3>
              </div>
              <button className={`${ghostBtn} ${smallBtn} rounded-md`} onClick={() => setShowInvoiceModal(false)}>
                Закрыть
              </button>
            </div>

<div className="mt-4 rounded-md border border-[#d9d9d9] bg-white shadow-sm">
  {/* Верхняя статус-плашка (как на терминале) */}
  <div className="flex items-center justify-between border-b border-[#e9e9e9] px-4 py-3">
    <div className="flex items-center gap-3">
      <div className="h-3 w-3 rounded-full bg-[#1fad4c]" />
      <div className="flex flex-col leading-tight">
        <span className="text-[11px] uppercase tracking-wider text-[#666666]">
          Операция
        </span>
        <span className="text-sm font-semibold text-[#1f1f1f]">
          Оплата прошла успешно
        </span>
      </div>
    </div>

    <span className="rounded-sm bg-[#e9f7ee] px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#1f8f3a]">
      ОДОБРЕНО
    </span>
  </div>

  <div className="mt-3 rounded-sm border border-[#ededed] bg-[#fcfcfc] p-3">

    <div className="my-2 border-t border-dashed border-[#dcdcdc]" />

    {invoiceLoading ? (
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-5 w-5 animate-spin rounded-full border-2 border-[#9e9e9e] border-t-transparent" />
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-bold text-[#222222]">
            ПЕЧАТЬ ДОКУМЕНТА...
          </span>
          <span className="text-[11px] text-[#666666]">
            Готовим счет-фактуру и PDF
          </span>
        </div>
      </div>
    ) : invoiceError ? (
      <div className="flex flex-col gap-2">
        <div className="rounded-sm border border-[#f2b5b5] bg-[#fff3f3] px-2 py-2 text-[12px] text-[#a33030]">
          {invoiceError}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-sm cursor-pointer border border-[#b9b9b9] bg-white px-3 py-2 text-[12px] font-bold text-[#1f1f1f] shadow-sm hover:bg-[#f6f6f6]"
            onClick={() => generatePdfAndUpload().catch(() => undefined)}
          >
            ПОВТОРИТЬ
          </button>

          {invoiceUrl ? (
            <a
              className="rounded-sm border border-[#b9b9b9] bg-white px-3 py-2 text-[12px] font-bold text-[#1f1f1f] shadow-sm hover:bg-[#f6f6f6]"
              href={
                toAbsoluteUrl(invoiceUrl ?? ticketPdfUrl ?? ticketPdfPath ?? null) ??
                invoiceUrl ??
                undefined
              }
              download={`ticket-${orderNumberDisplay}.pdf`}
              target="_blank"
              rel="noreferrer"
            >
              СКАЧАТЬ PDF
            </a>
          ) : null}
        </div>
      </div>
    ) : ticketPdfUrl || ticketPdfPath || invoiceUrl ? (
      <div className="flex items-center justify-between w-full">
        <button
          className="border border-[#1f8f3a] bg-[#1fad4c] rounded-md px-4 py-2 text-[12px] font-bold tracking-wider text-white shadow-sm hover:bg-[#179340]"
          onClick={() => openInvoicePdf()}
        >
          Открыть Акт
        </button>
      </div>
    ) : null}

    <div className="mt-3 border-t border-dashed border-[#dcdcdc]" />

  </div>
</div>
          </div>
        </div>
      )}
      </fieldset>

    </div>
  );
};
