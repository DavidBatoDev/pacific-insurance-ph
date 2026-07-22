"use client";

import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { SearchHit } from "@/lib/queries/global-search";
import { cn } from "@/lib/utils";
import { I, type IconName } from "../icons";
import { SCREEN_PATH, type ScreenId } from "../shell";
import { hitHref, SEARCH_KIND_ICON, SearchHitRow, useGlobalSearch } from "./search-dropdown";

/**
 * Global ⌘K command palette (design: command-palette.jsx). Live grouped
 * results across people, groups, policies, applications, claims, renewals and
 * travel via `globalSearchAction`; empty query shows "Jump to" screen entries.
 */

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
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { groups, searching } = useGlobalSearch(q);

  const term = q.trim();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    setActiveIdx(0);
  }, [term]);

  const go = (path: string) => {
    router.push(path);
    onClose();
  };
  const openHit = (hit: SearchHit) => go(hitHref(hit));

  // Flat row list for keyboard nav: entity hits then the view-all footer row,
  // or the Jump-to screen entries when the query is empty.
  const flatHits = useMemo(() => groups.flatMap((g) => g.hits), [groups]);
  const jumpEntries = term ? [] : SCREEN_ENTRIES;
  const rowCount = term ? flatHits.length + 1 : jumpEntries.length;

  useEffect(() => {
    if (activeIdx >= rowCount) setActiveIdx(Math.max(0, rowCount - 1));
  }, [rowCount, activeIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((a) => Math.min(rowCount - 1, a + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!term) jumpEntries[activeIdx] && go(SCREEN_PATH[jumpEntries[activeIdx].id]);
        else if (activeIdx < flatHits.length) openHit(flatHits[activeIdx]);
        else go(`/search?q=${encodeURIComponent(term)}`);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nav state
  }, [rowCount, activeIdx, flatHits, jumpEntries, term, onClose]);

  // Keep the active row in view.
  useEffect(() => {
    listRef.current?.querySelector("[data-active='true']")?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  let idx = -1;
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
            placeholder="Search clients, leads, policies, applications, claims…"
            className="flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-subtle"
          />
          <button
            onClick={onClose}
            className="rounded-[5px] border border-border bg-surface px-1.5 py-px text-[11px] font-semibold text-subtle"
          >
            Esc
          </button>
        </div>

        <div ref={listRef} className="max-h-[420px] overflow-y-auto py-1.5">
          {!term ? (
            <>
              <div className="px-4 pb-1 pt-1.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-faint">
                Jump to
              </div>
              {jumpEntries.map((s, i) => {
                const Ico = I[s.icon];
                return (
                  <button
                    key={s.id}
                    data-active={i === activeIdx}
                    onMouseMove={() => setActiveIdx(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(SCREEN_PATH[s.id])}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                      i === activeIdx ? "bg-brand-soft" : "hover:bg-hover",
                    )}
                  >
                    <span className="grid size-[26px] shrink-0 place-items-center rounded-md bg-surface-3 text-muted-foreground">
                      <Ico size={15} />
                    </span>
                    <span className="flex-1 text-[13.5px] font-[550]">{s.label}</span>
                    <span className="text-[11.5px] text-subtle">Open screen</span>
                  </button>
                );
              })}
              <div className="px-4 pb-2 pt-2.5 text-[11.5px] leading-snug text-faint">
                Type to search across people, groups, policies, applications, claims, renewals and
                travel.
              </div>
            </>
          ) : flatHits.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center text-subtle">
              <I.search size={26} />
              <div className="text-[13.5px] font-semibold text-foreground">
                {searching ? "Searching…" : <>No results for “{term}”</>}
              </div>
              {!searching && (
                <div className="text-[12px]">
                  Try a name, a record ID, a POL- / CLM- / APP- number, or a company.
                </div>
              )}
            </div>
          ) : (
            groups.map((g) => {
              const GIco = I[SEARCH_KIND_ICON[g.kind]];
              return (
                <div key={g.kind}>
                  <div className="flex items-center gap-1.5 px-4 pb-1 pt-2.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-faint">
                    <GIco size={12} /> {g.label}
                    <span className="rounded-full bg-surface-3 px-1.5 text-[10px] font-bold text-subtle">
                      {g.hits.length + g.more}
                    </span>
                  </div>
                  {g.hits.map((hit) => {
                    idx++;
                    const myIdx = idx;
                    return (
                      <div key={hit.kind + hit.id} data-active={myIdx === activeIdx}>
                        <SearchHitRow
                          hit={hit}
                          active={myIdx === activeIdx}
                          onHover={() => setActiveIdx(myIdx)}
                          onOpen={() => openHit(hit)}
                        />
                      </div>
                    );
                  })}
                  {g.more > 0 && (
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => go(`/search?q=${encodeURIComponent(term)}`)}
                      className="w-full px-[46px] py-1 text-left text-[12px] font-semibold text-brand-hover transition-colors hover:bg-hover"
                    >
                      + {g.more} more {g.label.toLowerCase()}
                    </button>
                  )}
                </div>
              );
            })
          )}
          {term && flatHits.length > 0 && (
            <button
              data-active={activeIdx === flatHits.length}
              onMouseMove={() => setActiveIdx(flatHits.length)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(`/search?q=${encodeURIComponent(term)}`)}
              className={cn(
                "mt-1 flex w-full items-center gap-3 border-t border-border-soft px-4 py-2.5 text-left text-[12.5px] font-semibold transition-colors",
                activeIdx === flatHits.length
                  ? "bg-brand-soft text-brand-hover"
                  : "text-muted-foreground hover:bg-hover",
              )}
            >
              <I.search size={14} /> View all results for “{term}”
            </button>
          )}
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
