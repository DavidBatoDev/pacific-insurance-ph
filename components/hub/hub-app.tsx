"use client";

import { useEffect, useState } from "react";

import { Dashboard } from "./dashboard";
import { I } from "./icons";
import { Btn } from "./primitives";
import { BrandGlyph, Sidebar, Topbar, type ScreenId } from "./shell";

const TITLES: Record<ScreenId, string> = {
  dashboard: "Dashboard",
  prospects: "Prospect Pipeline",
  clients: "Clients",
  applications: "Applications",
  policies: "Policies",
  renewals: "Renewals",
  claims: "Claims",
  travel: "Travel Insurance",
  documents: "Documents",
  tasks: "Tasks",
  relationship: "Relationship Management",
  reports: "Reports",
  settings: "Settings",
};

function Placeholder({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-[70px] text-center text-muted-foreground">
      <div className="mb-4 grid size-[58px] place-items-center rounded-2xl bg-brand-soft text-brand-hover">
        <I.grid size={26} />
      </div>
      <h2 className="mb-1.5 text-[18px] text-foreground">{title}</h2>
      <p className="max-w-[360px] leading-relaxed">
        This module isn&apos;t built yet. The Dashboard is the live example — the rest of the
        screens come next.
      </p>
      <Btn className="mt-5" onClick={onBack}>
        Back to dashboard
      </Btn>
    </div>
  );
}

export function HubApp() {
  const [screen, setScreen] = useState<ScreenId>("dashboard");
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState("");

  // Restore saved theme on mount.
  useEffect(() => {
    setDark(localStorage.getItem("pi_dark") === "1");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("pi_dark", dark ? "1" : "0");
  }, [dark]);

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
          {screen === "dashboard" ? (
            <Dashboard setScreen={setScreen} />
          ) : (
            <Placeholder title={TITLES[screen]} onBack={() => setScreen("dashboard")} />
          )}
        </div>
      </main>
    </div>
  );
}
