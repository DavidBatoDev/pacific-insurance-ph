"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { ShellStats } from "@/lib/queries/shell";
import { OverlayProvider } from "./overlays/overlay-provider";
import { OverlayHost } from "./overlays/overlay-host";
import { PersonaProvider } from "./persona";
import { BrandGlyph, Sidebar, Topbar } from "./shell";

/**
 * Authenticated app chrome: brand corner + topbar + sidebar around the routed
 * page content. Holds the theme toggle state; rendered by the (app) layout,
 * which passes the server-resolved staff user.
 */
export function AppShell({
  children,
  userName,
  userRole,
  shellStats,
}: {
  children: ReactNode;
  userName: string;
  userRole: string;
  shellStats: ShellStats;
}) {
  const [dark, setDark] = useState(false);
  /** Desktop: the sidebar column is emptied rather than narrowed, so main gets the full width. */
  const [navCollapsed, setNavCollapsed] = useState(false);
  /** ≤900px: the sidebar has no column to live in, so it opens as an overlay drawer instead. */
  const [navOpen, setNavOpen] = useState(false);

  // Restore saved theme on mount (localStorage is client-only) to avoid a
  // server/client hydration mismatch on the theme toggle.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe theme restore
    setDark(localStorage.getItem("pi_dark") === "1");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("pi_dark", dark ? "1" : "0");
  }, [dark]);

  return (
    <PersonaProvider userName={userName} userRole={userRole}>
      <OverlayProvider host={OverlayHost}>
        <div
          className={cn(
            "grid h-screen grid-rows-[60px_1fr] overflow-hidden bg-background max-[900px]:grid-cols-[0_1fr]",
            navCollapsed ? "grid-cols-[64px_1fr]" : "grid-cols-[244px_1fr]",
          )}
        >
          {/* The wordmark doesn't fit the rail, but the glyph anchors the column — keep it. */}
          <div
            className={cn(
              "col-start-1 row-start-1 flex items-center border-b border-r border-border bg-surface max-[900px]:hidden",
              navCollapsed ? "justify-center px-0" : "gap-[11px] px-[18px]",
            )}
          >
            <div className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-[#10b981] to-[#047857] shadow-[0_2px_6px_rgba(4,120,87,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]">
              <BrandGlyph size={19} />
            </div>
            {!navCollapsed && (
              <div className="flex flex-col leading-[1.05]">
                <b className="text-[15px] font-bold tracking-[-0.02em]">Pacific</b>
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-subtle">
                  Insurance PH
                </span>
              </div>
            )}
          </div>

          <Topbar
            dark={dark}
            setDark={setDark}
            userName={userName}
            navCollapsed={navCollapsed}
            onToggleNav={() => setNavCollapsed((v) => !v)}
            onOpenNav={() => setNavOpen(true)}
          />
          <Sidebar
            collapsed={navCollapsed}
            mobileOpen={navOpen}
            onClose={() => setNavOpen(false)}
            stats={shellStats}
          />

          {/* min-w-0: a grid item defaults to min-width:auto, so wide content would
              push this track past the viewport and the shell's overflow-hidden
              would clip it with no way to scroll back. */}
          <main className="col-start-2 row-start-2 min-w-0 overflow-y-auto bg-background">
            <div className="mx-auto max-w-[1480px] px-7 pb-[60px] pt-[22px] max-[640px]:px-4">
              {children}
            </div>
          </main>
        </div>
      </OverlayProvider>
    </PersonaProvider>
  );
}
