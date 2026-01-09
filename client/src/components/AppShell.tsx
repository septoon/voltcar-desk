import { useState } from "react";
import { Outlet } from "react-router-dom";
import Hamburger from "hamburger-react";
import { SidebarMenu } from "./SidebarMenu";

export const AppShell = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-shell flex flex-col min-h-screen">
      <div className="fixed right-3 top-3 z-[60] hidden max-[960px]:block">
  <button
    type="button"
    className="inline-flex items-center justify-center"
  >
    <Hamburger
      toggled={mobileOpen}
      toggle={setMobileOpen}
      size={24}
      rounded
      color="#222222"
    />
  </button>
</div>
      <div className="flex min-h-[calc(100vh-38px)] max-[960px]:flex-col">
        <SidebarMenu mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="w-full max-[960px]:pt-2">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
