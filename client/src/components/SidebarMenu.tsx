import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createOrder } from "../api/orders";
import { clearToken } from "../auth/token";
import logo_title from "../assets/img/volt_title.webp";
import logo_small from "../assets/img/volt_logo.png";

const items = [
  { key: "home", label: "Главная", path: "/", icon: "home" as const },
  { key: "new", label: "Новый заказ", path: "/orders/new", icon: "plus" as const },
  { key: "history", label: "История заказов", path: "/orders/history", icon: "archive" as const },
  { key: "tickets", label: "Акты", path: "/tickets", icon: "document" as const },
  { key: "clients", label: "Найти клиента", path: "/clients/search", icon: "search" as const },
  { key: "revenue", label: "Данные по выручкам", path: "/reports/revenue", icon: "chart" as const },
];

type Props = {
  mobileOpen?: boolean;
  onClose?: () => void;
};

type IconName = (typeof items)[number]["icon"];

const Icon = ({ name, active }: { name: IconName; active: boolean }) => {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className: "h-5 w-5",
  };

  const stroke = active ? "#4338ca" : "#334155"; // indigo-700 : slate-700
  const strokeWidth = 1.8;
  const strokeLinecap: any = "round";
  const strokeLinejoin: any = "round";

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path
            d="M3 10.5L12 3l9 7.5"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeLinejoin={strokeLinejoin}
          />
          <path
            d="M6.5 9.8V20a1 1 0 0 0 1 1H10v-6h4v6h2.5a1 1 0 0 0 1-1V9.8"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeLinejoin={strokeLinejoin}
          />
        </svg>
      );

    case "plus":
      return (
        <svg {...common}>
          <path
            d="M12 5v14M5 12h14"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeLinejoin={strokeLinejoin}
          />
        </svg>
      );

    case "archive":
      return (
        <svg {...common}>
          <path
            d="M4 7h16"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeLinejoin={strokeLinejoin}
          />
          <path
            d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeLinejoin={strokeLinejoin}
          />
          <path
            d="M10 11h4"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeLinejoin={strokeLinejoin}
          />
          <path
            d="M5 3h14a1 1 0 0 1 1 1v2H4V4a1 1 0 0 1 1-1Z"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeLinejoin={strokeLinejoin}
          />
        </svg>
      );

       case "document":
      return (
        <svg {...common}>
          {/* Лист */}
          <path
            d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeLinejoin={strokeLinejoin}
          />
          {/* Загнутый угол */}
          <path
            d="M14 3v5h5"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeLinejoin={strokeLinejoin}
          />
          {/* Строки */}
          <path
            d="M9 13h6M9 17h6"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeLinejoin={strokeLinejoin}
          />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <path
            d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeLinejoin={strokeLinejoin}
          />
          <path
            d="M16.5 16.5 21 21"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeLinejoin={strokeLinejoin}
          />
        </svg>
      );

    case "chart":
      return (
        <svg {...common}>
          <path
            d="M4 19h16"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeLinejoin={strokeLinejoin}
          />
          <path
            d="M6.5 16v-6"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeLinejoin={strokeLinejoin}
          />
          <path
            d="M12 16V7"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeLinejoin={strokeLinejoin}
          />
          <path
            d="M17.5 16v-9"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap={strokeLinecap}
            strokeLinejoin={strokeLinejoin}
          />
        </svg>
      );
  }
};

export const SidebarMenu = ({ mobileOpen, onClose }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [creating, setCreating] = useState(false);
  const [hovered, setHovered] = useState(false);

  const activeKey = (() => {
    if (location.pathname === "/") return "home";
    if (location.pathname.startsWith("/orders/history")) return "history";
    if (location.pathname.startsWith("/tickets")) return "tickets";
    if (location.pathname.startsWith("/clients")) return "clients";
    if (location.pathname.startsWith("/reports/revenue")) return "revenue";
    if (location.pathname.startsWith("/orders/")) return "new";
    return "";
  })();

  const handleNew = async () => {
    try {
      setCreating(true);
      const order = await createOrder({
        customer: "",
        phone: "",
        car: "",
        govNumber: "",
        vinNumber: "",
        mileage: null,
        reason: "",
        status: "NEW",
        services: [],
        parts: [],
        payments: [],
        discountAmount: 0,
        discountPercent: 0,
      });
      navigate(`/orders/${order.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleClick = (key: string, path: string) => {
    if (key === "new") {
      handleNew();
    } else {
      navigate(path);
    }
    if (onClose) onClose();
  };

  const expanded = mobileOpen || hovered || window.innerWidth > 960;

  return (
          <nav
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={[
          "z-[40] bg-white border-r border-slate-200 flex flex-col sticky top-0 self-start h-[calc(100vh-0px)]",
          "max-[960px]:fixed max-[960px]:top-0 max-[960px]:bottom-0 max-[960px]:left-0",
          "max-[960px]:w-full max-[960px]:transition-transform max-[960px]:duration-200 max-[960px]:ease-out",
          mobileOpen ? "max-[960px]:translate-x-0 max-[960px]:w-full" : "max-[960px]:-translate-x-full",
          "shadow-[0_10px_30px_rgba(0,0,0,0.18)]",
        ].join(" ")}
        style={{
          transition: "width 180ms ease",
        }}
      >
        {/* Header (MUI Toolbar vibe) */}
        <div className="h-16 flex items-center px-4 border-b border-slate-200">
          {expanded ? (
            <img
              src={logo_title}
              alt="Вольт Авто"
              className="h-8 object-contain"
              style={{ transition: "opacity 120ms ease" }}
            />
          ) : (
            <img
              src={logo_small}
              alt="Вольт Авто"
              className="h-8 w-8 object-contain"
              style={{ transition: "opacity 120ms ease" }}
            />
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-2">
          {items.map((item) => {
            const selected = activeKey === item.key;
            const isNewAndCreating = item.key === "new" && creating;

            return (
          <div key={item.key} className="px-2">
            <button
              type="button"
              onClick={() => handleClick(item.key, item.path)}
              disabled={isNewAndCreating}
              title={item.label}
              className={[
                "w-full relative flex items-center gap-3 rounded-xl px-3 py-2",
                    "transition-colors duration-150",
                    selected
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-700 hover:bg-slate-100 active:bg-slate-200",
                    isNewAndCreating ? "opacity-70 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {/* Icon container (ListItemIcon vibe) */}
                  <span
                    className={[
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      selected ? "bg-indigo-100" : "bg-slate-100",
                    ].join(" ")}
                  >
                    {isNewAndCreating ? (
                      <span className="text-[11px] font-bold text-slate-600">...</span>
                    ) : (
                      <Icon name={item.icon} active={selected} />
                    )}
                  </span>

                  {/* Label (collapses in mini mode) */}
                  <span
                    className={[
                      "text-[13px] font-semibold whitespace-nowrap",
                      expanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden",
                    ].join(" ")}
                    style={{ transition: "opacity 120ms ease" }}
                  >
                    {item.label}
                  </span>

                  {/* Mini tooltip */}
                  {!expanded && (
                    <span className="pointer-events-none absolute left-[72px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow opacity-0 transition-all duration-150 group-hover:opacity-100">
                      {item.label}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-2">
          <div
            className={[
              "rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-600",
              expanded ? "block" : "hidden",
            ].join(" ")}
          >
            Симферополь, п. Айкаван, ул. Айвазовского, д. 21
          </div>
          <button
            className="mt-2 w-full rounded-lg border border-[#d6d6d6] bg-white px-2 py-2 text-[12px] font-semibold text-[#c2410c] hover:bg-[#fff3e6]"
            onClick={() => {
              clearToken();
              if (onClose) onClose();
              navigate("/login");
            }}
          >
            Выйти
          </button>
        </div>
      </nav>
  );
};
