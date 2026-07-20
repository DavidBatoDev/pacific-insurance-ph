"use client";

import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { searchClientsForPalette, type PaletteClientHit } from "@/app/(app)/search/actions";
import { cn } from "@/lib/utils";
import { I, type IconName } from "../icons";
import { Avatar } from "../primitives";
import { SCREEN_PATH, type ScreenId } from "../shell";

/**
 * Global ⌘K command palette (design: command-palette.jsx). Searches real
 * client records via the search server action, plus screen jump entries.
 */

interface PaletteRow {
  key: string;
  icon: IconName;
  label: string;
  sub?: string;
  run: () => void;
}

const SCREEN_ENTRIES: { id: ScreenId; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "prospects", label: "Leads", icon: "trendUp" },
  { id: "clients", label: "Clients", icon: "users" },
  { id: "applications", label: "Applications", icon: "fileText" },
  { id: "policies", label: "Policies", icon: "shield" },
  { id: "renewals", label: "Renewals", icon: "refresh" },
  { id: "claims", label: "Claims", icon: "clipboard" },
  { id: "travel", label: "Travel Insurance", icon: "plane" },
  { id: "payments", label: "Payments", icon: "peso" },
  { id: "documents", label: "Documents", icon: "folder" },
  { id: "tasks", label: "Tasks", icon: "checkSquare" },
  { id: "relationship", label: "Relationship Mgmt", icon: "heart" },
  { id: "reports", label: "Reports", icon: "chart" },
  { id: "products", label: "Products", icon: "folder" },
  { id: "templates", label: "Email Templates", icon: "mail" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PaletteClientHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced live search against real client records.
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++seqRef.current;
    const t = setTimeout(() => {
      searchClientsForPalette(term)
        .then((rows) => {
          if (seqRef.current === seq) setHits(rows);
        })
        .catch(() => {
          if (seqRef.current === seq) setHits([]);
        })
        .finally(() => {
          if (seqRef.current === seq) setSearching(false);
        });
    }, 160);
    return () => clearTimeout(t);
  }, [q]);

  const rows = useMemo<PaletteRow[]>(() => {
    const term = q.trim().toLowerCase();
    const go = (path: string) => () => {
      router.push(path);
      onClose();
    };
    const clientRows: PaletteRow[] = hits.map((c) => ({
      key: "cl-" + c.id,
      icon: "users",
      label: c.name,
      sub: [c.email, c.referenceNo ? "#" + c.referenceNo : null].filter(Boolean).join(" · ") || c.clientType,
      run: go(`/clients/${c.id}`),
    }));
    const screenRows: PaletteRow[] = SCREEN_ENTRIES.filter(
      (s) => !term || s.label.toLowerCase().includes(term),
    ).map((s) => ({
      key: "sc-" + s.id,
      icon: s.icon,
      label: s.label,
      sub: "Open screen",
      run: go(SCREEN_PATH[s.id]),
    }));
    const searchRow: PaletteRow[] = term
      ? [
          {
            key: "search-all",
            icon: "search",
            label: `Search clients for “${q.trim()}”`,
            sub: "Full search results",
            run: go(`/search?q=${encodeURIComponent(q.trim())}`),
          },
        ]
      : [];
    return [...clientRows, ...searchRow, ...screenRows];
  }, [hits, q, router, onClose]);

  useEffect(() => {
    if (activeIdx >= rows.length) setActiveIdx(Math.max(0, rows.length - 1));
  }, [rows.length, activeIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((a) => Math.min(rows.length - 1, a + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        rows[activeIdx]?.run();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rows, activeIdx, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[85] flex items-start justify-center bg-black/35 px-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-[640px] overflow-hidden rounded-lg border border-border bg-card shadow-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border-soft px-4 py-3.5 text-muted-foreground">
          <I.search size={18} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clients, or jump to a screen…"
            className="flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-subtle"
          />
          <button
            onClick={onClose}
            className="rounded-[5px] border border-border bg-surface px-1.5 py-px text-[11px] font-semibold text-subtle"
          >
            Esc
          </button>
        </div>

        <div className="max-h-[380px] overflow-y-auto py-1.5">
          {q.trim() && hits.length === 0 && !searching && (
            <div className="px-4 py-2 text-[12px] text-subtle">
              No client matches — try a name, email, mobile, or reference number.
            </div>
          )}
          {rows.map((r, i) => {
            const Ico = I[r.icon];
            return (
              <button
                key={r.key}
                onMouseMove={() => setActiveIdx(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={r.run}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  i === activeIdx ? "bg-brand-soft" : "hover:bg-hover",
                )}
              >
                {r.key.startsWith("cl-") ? (
                  <Avatar name={r.label} size={26} />
                ) : (
                  <span className="grid size-[26px] shrink-0 place-items-center rounded-md bg-surface-3 text-muted-foreground">
                    <Ico size={15} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-[550]">{r.label}</span>
                  {r.sub && <span className="block truncate text-[11.5px] text-subtle">{r.sub}</span>}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-border-soft bg-surface-2 px-4 py-2 text-[11px] font-semibold text-subtle">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
