import { useState } from "react";
import { Outlet } from "react-router-dom";
import Hamburger from "hamburger-react";
import { SidebarMenu } from "./SidebarMenu";
import { TabsBar } from "./TabsBar";

export const AppShell = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-shell flex flex-col min-h-screen">
      {/* <TabsBar /> */}
      <div className="fixed right-3 top-3 z-50 hidden max-[960px]:block">
        <Hamburger toggled={mobileOpen} toggle={setMobileOpen} size={24} rounded color="#222222" />
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
