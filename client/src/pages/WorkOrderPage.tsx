import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { IMaskInput } from "react-imask";
import { createOrder, fetchOrder, updateOrder } from "../api/orders";
import { fetchServices } from "../api/services";
import { api } from "../api/api";
import { LineItem, OrderPayload, Payment, WorkStatus } from "../types";
import { PaymentModal } from "../components/PaymentModal";
import { Loader } from "../components/Loader";

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
  { value: "PAYED", label: "Оплачен" },
];

const normalizeStatus = (value: any): WorkStatus => {
  if (value === "IN_PROGRESS") return "IN_PROGRESS";
  if (value === "PAYED") return "PAYED";
  return "NEW";
};

const sumLineItems = (items: LineItem[]) => items.reduce((acc, item) => acc + item.qty * item.price, 0);
const serviceCacheKey = "service-hints-cache";

export const WorkOrderPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const orderNumber = id ?? "new";
  const today = new Date();
  const todayString = today.toLocaleDateString("ru-RU");

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
  const [showHintsFor, setShowHintsFor] = useState<{ kind: TableKind; id: number } | null>(null);
  const [hintPosition, setHintPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const hintSelectionRef = useRef(false);
  const draftKey = useMemo(() => `order-draft-${orderNumber || "new"}`, [orderNumber]);
  const [discountPercent, setDiscountPercent] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [payMethod, setPayMethod] = useState<"cash" | "card">("cash");
  const [payAmountInput, setPayAmountInput] = useState<string>("0");
  const autoSaveTimer = useRef<number | null>(null);
  const initialLoadedRef = useRef(false);
  const lastSavedRef = useRef<string>("");
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 1024);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const servicesTotal = useMemo(() => sumLineItems(services), [services]);
  const partsTotal = useMemo(() => sumLineItems(parts), [parts]);
  const subtotal = servicesTotal + partsTotal;
  const paid = useMemo(() => payments.reduce((acc, payment) => acc + payment.amount, 0), [payments]);

  const isLocked = status === "PAYED";
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
  const neutralBtn = `${baseBtn} border-[#b5b5b5] bg-[#f0f0f0] hover:bg-[#e0e0e0]`;
  const successBtn = `${baseBtn} border-[#caa200] bg-[#ffd659] hover:bg-[#f2c94d]`;
  const ghostBtn = `${baseBtn} border-[#cfcfcf] bg-transparent hover:bg-[#f0f0f0]`;
  const outlineBtn = `${baseBtn} border-[#c3c3c3] bg-white hover:bg-[#f7f7f7]`;
  const smallBtn = "px-3 py-2 text-sm";
  const regularBtn = "px-4 py-2 text-sm md:text-base";

  const hasDraftContent = (draft: Partial<OrderPayload>) => {
    if (!draft) return false;
    return Boolean(
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
  };

  const setFromOrder = (data: OrderPayload) => {
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
    setPhone(data.phone ?? "");
  };

  useEffect(() => {
    setSelectedRow(null);
    setContextMenu({ visible: false });
    resetForm();

    type DraftOrder = OrderPayload & { discountPercent?: string; discountAmount?: string };
    let draft: DraftOrder | null = null;
    try {
      const raw = localStorage.getItem(draftKey);
      draft = raw ? (JSON.parse(raw) as DraftOrder) : null;
    } catch (err) {
      console.error("Failed to parse draft", err);
    }

    if (!orderNumber || orderNumber === "new") {
      if (draft) {
        setFromOrder(draft);
        lastSavedRef.current = serializeOrder(draft);
        if (typeof (draft as any).discountPercent === "string") setDiscountPercent((draft as any).discountPercent);
        if (typeof (draft as any).discountAmount === "string") setDiscountAmount((draft as any).discountAmount);
        if (typeof (draft as any).phone === "string") setPhone((draft as any).phone);
      }
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchOrder(orderNumber);
        const useDraft = draft && hasDraftContent(draft);
        if (useDraft) {
          const combined: OrderPayload = {
            ...data,
            ...(draft as OrderPayload),
            services: (draft as OrderPayload).services ?? data.services,
            parts: (draft as OrderPayload).parts ?? data.parts,
            payments: (draft as OrderPayload).payments ?? data.payments,
          };
          setFromOrder(combined);
          lastSavedRef.current = serializeOrder(combined);
          if (typeof (draft as any).discountPercent === "string") setDiscountPercent((draft as any).discountPercent);
          if (typeof (draft as any).discountAmount === "string") setDiscountAmount((draft as any).discountAmount);
          if (typeof (draft as any).phone === "string") setPhone((draft as any).phone);
        } else {
          setFromOrder(data);
          lastSavedRef.current = serializeOrder(data);
        }
      } catch (err) {
        console.error(err);
        const useDraft = draft && hasDraftContent(draft);
        if (useDraft) {
          setFromOrder(draft as OrderPayload);
          lastSavedRef.current = serializeOrder(draft as OrderPayload);
          if (typeof (draft as any).discountPercent === "string") setDiscountPercent((draft as any).discountPercent);
          if (typeof (draft as any).discountAmount === "string") setDiscountAmount((draft as any).discountAmount);
          if (typeof (draft as any).phone === "string") setPhone((draft as any).phone);
        } else {
          resetForm();
        }
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [orderNumber, todayString, draftKey]);

  useEffect(() => {
    const draft: OrderPayload = {
      date: orderDate || undefined,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showHintsFor?.kind === "services") {
      const source = serviceHints.length ? serviceHints : defaultServices;
      setFilteredHints(source.slice(0, 8));
    }
  }, [showHintsFor, serviceHints]);

  useEffect(() => {
    const hideMenu = () => setContextMenu({ visible: false });
    window.addEventListener("click", hideMenu);
    return () => {
      window.removeEventListener("click", hideMenu);
    };
  }, []);

  const orderPayload = (): OrderPayload => ({
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
  });

  const LETTERS = "АВЕКМНОРСТУХ";

  const VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

  const computeStatusForSave = (): WorkStatus => {
    if (status === "PAYED") return "PAYED";
    if (payments.length > 0) return "PAYED";
    if (hasContent()) return "IN_PROGRESS";
    return "NEW";
  };

  useEffect(() => {
    const next = computeStatusForSave();
    if (next !== status) setStatus(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, phone, car, govNumber, vinNumber, mileage, reason, services, parts, payments]);

  // Автосохранение на сервер при любых изменениях, если есть содержимое
  useEffect(() => {
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      return;
    }
    if (isLocked || loading || saving || pdfLoading) return;
    if (!hasContent()) return;
    if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = window.setTimeout(async () => {
      try {
        setSaving(true);
        const resolvedStatus = computeStatusForSave();
        const payload = { ...orderPayload(), status: resolvedStatus };
        const serialized = serializeOrder(payload);
        if (serialized === lastSavedRef.current) return;
        let saved: OrderPayload;
        if (!orderNumber || orderNumber === "new") {
          saved = await createOrder(payload);
          navigate(`/orders/${saved.id}`, { replace: true });
          setFromOrder(saved);
        } else {
          saved = await updateOrder(orderNumber, payload);
          setFromOrder(saved);
        }
        lastSavedRef.current = serialized;
      } catch (err) {
        console.error("auto-save failed", err);
      } finally {
        setSaving(false);
      }
    }, 800);

    return () => {
      if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    customer,
    phone,
    car,
    govNumber,
    vinNumber,
    mileage,
    reason,
    services,
    parts,
    payments,
    discountPercent,
    discountAmount,
    status,
  ]);

  const handleSave = async (nextStatus?: WorkStatus, nextPayments?: Payment[]) => {
    try {
      setSaving(true);
      const resolvedStatus = nextStatus ?? computeStatusForSave();
      setStatus(resolvedStatus);
      const payload = { ...orderPayload(), payments: nextPayments ?? payments, status: resolvedStatus };
      let saved: OrderPayload;
      if (!orderNumber || orderNumber === "new") {
        saved = await createOrder(payload);
        navigate(`/orders/${saved.id}`);
      } else {
        try {
          saved = await updateOrder(orderNumber, payload);
          setFromOrder(saved);
        } catch (err: any) {
          if (err?.status === 404) {
            saved = await createOrder(payload);
            navigate(`/orders/${saved.id}`);
          } else {
            throw err;
          }
        }
      }
      lastSavedRef.current = serializeOrder(payload);
      setStatus((saved.status as WorkStatus) ?? payload.status);
      setOrderDate(saved.date ?? orderDate ?? todayString);
      setPayments(saved.payments ?? nextPayments ?? payments);
    } catch (err) {
      console.error(err);
      alert("Не удалось сохранить заказ");
    } finally {
      setSaving(false);
    }
  };

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

  const saveInlineEdit = () => {
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
  };

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
  }, [editingRow, editingDraft]);

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
    if (isLocked) return;
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

  const handleInvoiceCreate = async (event: React.MouseEvent) => {
    event.preventDefault();
    try {
      setPdfLoading(true);
      const discountCents = Number.isFinite(discountValue) ? Math.round(discountValue * 100) : 0;
      const totalCentsRaw = Number.isFinite(total) ? Math.round(total * 100) : 0;
      const subtotalCentsRaw = Number.isFinite(subtotal) ? Math.round(subtotal * 100) : 0;
      const totalCents = Number.isFinite(totalCentsRaw) ? totalCentsRaw : 0;
      const subtotalCents = Number.isFinite(subtotalCentsRaw) ? subtotalCentsRaw : totalCents;
      const safeCustomer = customer.trim() || "Без имени";
      const safeReason = reason.trim() || "—";
      const res = await api.post(
        "/api/tickets/pdf",
        {
          id: orderNumberDisplay,
          customerName: safeCustomer,
          vehicle: car,
          phone,
          govNumber,
          vinNumber,
          mileage: mileage ? Number(mileage) : null,
          status,
          date: orderDate || todayString,
          services,
          parts,
          service: safeReason,
          totalCents,
          totalWithoutDiscountCents: subtotalCents,
          discountCents,
          discountPercent: Number(discountPercent) || 0,
          notes: "",
        },
        { responseType: "blob" },
      );
      const blob = res.data as Blob;
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
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
      await handleSave("PAYED", nextPayments);
    } catch (err) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.error ||
        (err as any)?.message ||
        "Не удалось сформировать счет-фактуру";
      alert(msg);
    } finally {
      setPdfLoading(false);
      setShowPaymentsModal(false)
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

  return (
    <div className="relative mx-auto flex flex-col gap-3 p-3 max-[960px]:pt-16">
      {(loading || saving || pdfLoading) && <Loader />}

      <header className="flex items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 shadow-sm">
        <div className="space-y-1 leading-tight">
          <h1 className="text-xl font-bold text-[#1f1f1f]">Заказ-наряд № {orderNumberDisplay}</h1>
          <p className="muted text-sm text-[#555555]">от {orderDate || todayString}</p>
        </div>
        <span
          className={`status-pill inline-block rounded-md border border-[#dcdcdc] bg-[#f7f7f7] px-3 py-1 text-xs font-bold uppercase tracking-wide status-${status.toLowerCase()}`}
        >
          {statusLabel}
        </span>
      </header>

      <fieldset disabled={isLocked} className="contents">
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
              placeholder="Введите модель, марку"
            />
          </div>
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
                                      top: rect.bottom + window.scrollY,
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
                                          top: (hintPosition?.top ?? 0) + 4,
                                          left: hintPosition?.left ?? 0,
                                          minWidth: hintPosition?.width ?? 180,
                                          right: viewportWidth < 480 ? 8 : undefined,
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

            <button
              disabled={status === "PAYED" || status === "NEW"}
              className={`rounded-md w-full mt-4 border px-4 py-2 text-[14px] font-semibold shadow-sm ${
                status === "PAYED"
                  ? "cursor-not-allowed border-[#d6d6d6] bg-[#f0f0f0] text-[#888888]"
                  : "border-[#e2b007] bg-[#ffd54f] text-[#1f1f1f] hover:bg-[#ffc930]"
              }`}
              onClick={() => setShowPaymentsModal(true)}
            >
            Принять оплату
          </button>
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
      />
      </fieldset>

    </div>
  );
};
