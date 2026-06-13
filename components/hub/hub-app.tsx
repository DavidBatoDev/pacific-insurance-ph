"use client";

import { useEffect, useState } from "react";

import { Dashboard } from "./dashboard";
import {
  ApplicationsScreen, ClaimsScreen, ClientsScreen, DocumentsScreen,
  PoliciesScreen, RenewalsScreen, TravelScreen,
} from "./screens/list-screens";
import { ProspectsScreen } from "./screens/prospects";
import { ReportsScreen } from "./screens/reports";
import { SettingsScreen } from "./screens/settings";
import { RelationshipScreen, TasksScreen } from "./screens/workspace";
import { BrandGlyph, Sidebar, Topbar, type ScreenId } from "./shell";

export function HubApp() {
  const [screen, setScreen] = useState<ScreenId>("dashboard");
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState("");

  // Restore saved theme on mount. Done in an effect (not a lazy initializer) so the
  // server render and first client render agree — localStorage isn't available on the
  // server, and reading it during render would cause a theme-toggle hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe theme restore
    setDark(localStorage.getItem("pi_dark") === "1");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("pi_dark", dark ? "1" : "0");
  }, [dark]);

  // Every screen below the Dashboard is a static draft (mock data, no live wiring yet).
  const render = () => {
    switch (screen) {
      case "dashboard": return <Dashboard setScreen={setScreen} />;
      case "prospects": return <ProspectsScreen />;
      case "clients": return <ClientsScreen />;
      case "applications": return <ApplicationsScreen />;
      case "policies": return <PoliciesScreen />;
      case "renewals": return <RenewalsScreen />;
      case "claims": return <ClaimsScreen />;
      case "travel": return <TravelScreen />;
      case "documents": return <DocumentsScreen />;
      case "tasks": return <TasksScreen />;
      case "relationship": return <RelationshipScreen />;
      case "reports": return <ReportsScreen />;
      case "settings": return <SettingsScreen />;
      default: return <Dashboard setScreen={setScreen} />;
    }
  };

  return (
    <div className="grid h-screen grid-cols-[244px_1fr] grid-rows-[60px_1fr] overflow-hidden bg-background max-[900px]:grid-cols-[0_1fr]">
      {/* Brand corner */}
      <div className="col-start-1 row-start-1 flex items-center gap-[11px] border-b border-r border-border bg-surface px-[18px] max-[900px]:hidden">
        <div className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-[#10b981] to-[#047857] shadow-[0_2px_6px_rgba(4,120,87,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]">
          <BrandGlyph size={19} />
        </div>
        <div className="flex flex-col leading-[1.05]">
          <b className="text-[15px] font-bold tracking-[-0.02em]">Pacific</b>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-subtle">
            Insurance PH
          </span>
        </div>
      </div>

      <Topbar dark={dark} setDark={setDark} setScreen={setScreen} search={search} setSearch={setSearch} />
      <Sidebar screen={screen} setScreen={setScreen} />

      <main className="col-start-2 row-start-2 overflow-y-auto bg-background">
        <div key={screen} className="mx-auto max-w-[1480px] px-7 pb-[60px] pt-[22px]">
          {render()}
        </div>
      </main>
    </div>
  );
}
