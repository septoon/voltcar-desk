import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type Tab = { id: string; title: string; path: string };

const storageKey = "open-tabs";

const isAllowedTab = (tab: Tab) => /^\/orders\/[^/]+$/.test(tab.path);

export const TabsBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [tabs, setTabs] = useState<Tab[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Tab[];
        const filtered = parsed.filter(isAllowedTab);
        if (filtered.length > 0) setTabs(filtered);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    const match = location.pathname.match(/^\/orders\/([^/]+)/);
    if (match) {
      const id = match[1];
      if (id.toLowerCase() === "history") return;
      setTabs((prev) => {
        if (prev.some((t) => t.id === id)) return prev;
        return [...prev, { id, title: `Заказ ${id}`, path: `/orders/${id}` }];
      });
    }
  }, [location.pathname]);

  const activePath = location.pathname;

  const closeTab = (id: string) => {
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== id);
      if (activePath.includes(id)) {
        const fallback = filtered[filtered.length - 1];
        if (fallback) navigate(fallback.path);
      }
      return filtered;
    });
  };

  return (
    <div className="tabs-bar fixed top-0 right-0 left-72 max-[960px]:left-40 z-10 flex gap-1 overflow-x-auto whitespace-nowrap pl-2">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab-pill my-2 rounded-md flex items-center px-2 text-md bg-white shadow border border-[#d7ddff] cursor-pointer ${
            activePath === tab.path ? "bg-green-300 border-b-1 border-green-600" : ""
          }`}
          onClick={() => navigate(tab.path)}
        >
          <span>{tab.title}</span>
          <button
            className="tab-close border-none bg-transparent cursor-pointer font-bold ml-2"
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
