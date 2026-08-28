"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { globalSearchAction } from "@/app/(app)/search/actions";
import type { SearchGroup, SearchHit, SearchKind } from "@/lib/queries/global-search";
import { cn } from "@/lib/utils";
import { I, type IconName } from "../icons";
import { Avatar, StatusBadge } from "../primitives";

/**
 * Shared kit for the global multi-entity search (topbar dropdown + ⌘K palette
 * + /search page), backed by `globalSearchAction`. The dropdown is anchored
 * under the topbar input (user decision — differs from the design's
 * button-opens-palette, same data & grouping).
 */

export const SEARCH_KIND_ICON: Record<SearchKind, IconName> = {
  client: "users",
  group: "building",
  policy: "shield",
  application: "fileText",
  claim: "clipboard",
  renewal: "refresh",
  travel: "plane",
};

/** Register screen a kind's "+N more" and fallbacks point at. */
const KIND_LIST_PATH: Record<SearchKind, string> = {
  client: "/clients",
  group: "/clients?view=groups",
  policy: "/policies",
  application: "/applications",
  claim: "/claims",
  renewal: "/renewals",
  travel: "/travel",
};

/** Where clicking a hit navigates. Operational rows open their client profile. */
export function hitHref(hit: SearchHit): string {
  if (hit.kind === "group") return `/group/${hit.id}`;
  if (hit.clientId) return `/clients/${hit.clientId}`;
  return KIND_LIST_PATH[hit.kind];
}

/** Debounced live multi-entity search (design: 130ms; kept close at 150ms). */
export function useGlobalSearch(term: string) {
  // Results are tagged with the term that produced them; `searching` and the
  // empty-query case are derived, so the effect never writes state
  // synchronously (react-hooks/set-state-in-effect).
  const [result, setResult] = useState<{ term: string; groups: SearchGroup[] }>({ term: "", groups: [] });
  const seqRef = useRef(0);
  const q = term.trim();

  useEffect(() => {
    if (!q) return;
    const seq = ++seqRef.current;
    const t = setTimeout(() => {
      globalSearchAction(q)
        .then((g) => {
          if (seqRef.current === seq) setResult({ term: q, groups: g });
        })
        .catch(() => {
          if (seqRef.current === seq) setResult({ term: q, groups: [] });
        });
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  return { groups: q ? result.groups : [], searching: !!q && result.term !== q };
}

export function SearchHitRow({
  hit,
  active,
  onHover,
  onOpen,
}: {
  hit: SearchHit;
  active: boolean;
  onHover: () => void;
  onOpen: () => void;
}) {
  const Ico = I[SEARCH_KIND_ICON[hit.kind]];
  return (
    <button
      onMouseMove={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
        active ? "bg-brand-soft" : "hover:bg-hover",
      )}
    >
      {hit.kind === "client" ? (
        <Avatar name={hit.title} size={26} />
      ) : (
        <span className="grid size-[26px] shrink-0 place-items-center rounded-md bg-surface-3 text-muted-foreground">
          <Ico size={14} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-[550]">{hit.title}</span>
        <span className="block truncate text-[11.5px] text-subtle">{hit.sub}</span>
      </span>
      {hit.badge && (
        <span className="shrink-0">
          <StatusBadge status={hit.badge} />
        </span>
      )}
    </button>
  );
}

/**
 * Anchored results dropdown for the topbar search input. The parent owns the
 * input; this renders below it and handles ↑/↓/Enter via the exposed key
 * handler so focus stays in the input.
 */
export function SearchDropdown({
  term,
  onClose,
  bindKeys,
}: {
  term: string;
  onClose: () => void;
  /** Registers the keyboard handler on mount so the input can forward key events. */
  bindKeys: (handler: ((e: React.KeyboardEvent) => boolean) | null) => void;
}) {
  const router = useRouter();
  const { groups, searching } = useGlobalSearch(term);
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const q = term.trim();
  const flat = useMemo(() => groups.flatMap((g) => g.hits), [groups]);
  // Rows: all hits, then the "view all" footer row (always last).
  const rowCount = flat.length + (q ? 1 : 0);

  // Render-phase adjustments: a new query restarts keyboard nav at the top,
  // and a shrinking result list clamps the highlight into range.
  const [prevQ, setPrevQ] = useState(q);
  if (prevQ !== q) {
    setPrevQ(q);
    setActiveIdx(0);
  } else if (activeIdx >= rowCount && activeIdx > 0) {
    setActiveIdx(Math.max(0, rowCount - 1));
  }

  const openHit = (hit: SearchHit) => {
    router.push(hitHref(hit));
    onClose();
  };
  const viewAll = () => {
    router.push(`/search?q=${encodeURIComponent(q)}`);
    onClose();
  };

  // Keyboard handling delegated from the input. Returns true when consumed.
  useEffect(() => {
    bindKeys((e) => {
      if (e.key === "ArrowDown") {
        setActiveIdx((a) => Math.min(rowCount - 1, a + 1));
      } else if (e.key === "ArrowUp") {
        setActiveIdx((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter") {
        if (activeIdx < flat.length) openHit(flat[activeIdx]);
        else viewAll();
      } else if (e.key === "Escape") {
        onClose();
      } else {
        return false;
      }
      return true;
    });
    return () => bindKeys(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebind when nav state changes
  }, [rowCount, activeIdx, flat]);

  // Keep the active row scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector("[data-active='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (!q) return null;

  let idx = -1;
  return (
    <div className="absolute left-0 right-0 top-[44px] z-40 overflow-hidden rounded-md border border-border bg-card shadow-pop">
      <div ref={listRef} className="max-h-[420px] overflow-y-auto py-1">
        {flat.length === 0 && (
          <div className="px-4 py-6 text-center text-[12.5px] text-subtle">
            {searching ? "Searching…" : (
              <>No results for “{q}” — try a name, email, or a POL- / CLM- / APP- number.</>
            )}
          </div>
        )}
        {groups.map((g) => {
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
                  onClick={viewAll}
                  className="w-full px-[46px] py-1 text-left text-[12px] font-semibold text-brand-hover transition-colors hover:bg-hover"
                >
                  + {g.more} more {g.label.toLowerCase()}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        data-active={activeIdx === flat.length}
        onMouseDown={(e) => e.preventDefault()}
        onClick={viewAll}
        onMouseMove={() => setActiveIdx(flat.length)}
        className={cn(
          "flex w-full items-center gap-2 border-t border-border-soft px-4 py-2.5 text-[12.5px] font-semibold transition-colors",
          activeIdx === flat.length ? "bg-brand-soft text-brand-hover" : "text-muted-foreground hover:bg-hover",
        )}
      >
        <I.search size={14} /> View all results for “{q}”
        <span className="ml-auto rounded-[4px] border border-border bg-surface px-1.5 text-[10.5px] text-subtle">↵</span>
      </button>
    </div>
  );
}
