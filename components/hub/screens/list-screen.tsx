"use client";

/**
 * DRAFT — mock UI only.
 * Ported from drafts/src/screens.jsx for prototype review. Generic filterable +
 * sortable list screen; renders placeholder data with no real data layer or actions.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Btn, Card, PageHead } from "../primitives";
import { I } from "../icons";
import { Row, Table, Td, Th, useSort } from "../table";

/** Filterable rows carry optional `_filter` / `_filter2` buckets used by the chip filters. */
export type FilterableRow = { _filter?: string; _filter2?: string };

export interface Column<T> {
  k: keyof T;
  label: string;
  num?: boolean;
}

export interface Stat {
  val: ReactNode;
  label: string;
  color?: string;
}

interface ListScreenProps<T extends FilterableRow> {
  title: string;
  sub: string;
  icon: LucideIcon;
  stats?: Stat[];
  filters?: string[];
  /** Second filter dimension, shown in the Filters popover (design screens.jsx). */
  filters2?: string[];
  filters2Label?: string;
  rows: T[];
  columns: Column<T>[];
  defaultSort: { key: keyof T; dir: "asc" | "desc" };
  renderRow: (row: T) => ReactNode;
  primaryAction?: string;
  /** Fired by the primary action button (wired screens open a drawer here). */
  onPrimary?: () => void;
  /** Wired screens pass false to drop the Draft badge. */
  draft?: boolean;
  emptyText?: string;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-[12.5px] font-semibold transition-colors",
        active
          ? "border-transparent bg-brand-soft text-brand-hover"
          : "border-border-strong bg-card text-muted-foreground hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}

export function ListScreen<T extends FilterableRow>({
  title,
  sub,
  icon,
  stats,
  filters,
  filters2,
  filters2Label,
  rows,
  columns,
  defaultSort,
  renderRow,
  primaryAction,
  onPrimary,
  draft = true,
  emptyText,
}: ListScreenProps<T>) {
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeFilter2, setActiveFilter2] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  let view = rows;
  if (filters && activeFilter !== "All") view = view.filter((r) => r._filter === activeFilter);
  if (filters2 && activeFilter2 !== "All") view = view.filter((r) => r._filter2 === activeFilter2);
  if (q.trim()) {
    const ql = q.toLowerCase();
    view = view.filter((r) =>
      Object.values(r as Record<string, unknown>).some((v) => String(v).toLowerCase().includes(ql)),
    );
  }
  const { sorted, sort, toggle } = useSort(view, defaultSort.key, defaultSort.dir);

  const exportCsv = useMemo(
    () => () => {
      const esc = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [
        columns.map((c) => esc(c.label)).join(","),
        ...sorted.map((r) => columns.map((c) => esc((r as Record<string, unknown>)[String(c.k)])).join(",")),
      ];
      const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.toLowerCase().replace(/\s+/g, "-")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [columns, sorted, title],
  );

  return (
    <div>
      <PageHead
        icon={icon}
        title={title}
        sub={sub}
        draft={draft}
        actions={
          <>
            <Btn onClick={exportCsv}>
              <I.download size={15} /> Export
            </Btn>
            {primaryAction && (
              <Btn variant="primary" onClick={onPrimary}>
                <I.plus size={15} /> {primaryAction}
              </Btn>
            )}
          </>
        }
      />

      {stats && (
        <div className="mb-4 grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
          {stats.map((s, i) => (
            <div key={i} className="rounded-lg border border-border bg-card px-4 py-3.5 shadow-sm">
              <div
                className="text-[22px] font-[760] leading-none tracking-[-0.02em] tabular-nums"
                style={{ color: s.color }}
              >
                {s.val}
              </div>
              <div className="mt-1.5 text-[12.5px] font-[550] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border-soft px-4 py-[13px]">
          <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2.5 rounded-md border border-border-strong bg-surface px-3 text-muted-foreground focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/20 max-[900px]:max-w-none sm:max-w-[320px]">
            <I.search size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${title.toLowerCase()}…`}
              className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-subtle"
            />
          </div>
          {filters && (
            <div className="flex flex-wrap gap-2">
              {["All", ...filters].map((f) => (
                <Chip key={f} active={activeFilter === f} onClick={() => setActiveFilter(f)}>
                  {f}
                </Chip>
              ))}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {filters2 && (
              <div className="relative" ref={filterRef}>
                <Chip active={filterOpen || activeFilter2 !== "All"} onClick={() => setFilterOpen((o) => !o)}>
                  <I.filter size={15} /> Filters
                  {activeFilter2 !== "All" && (
                    <span className="grid size-[17px] place-items-center rounded-full bg-brand text-[10.5px] font-bold text-white">
                      1
                    </span>
                  )}
                </Chip>
                {filterOpen && (
                  <div className="absolute right-0 top-[38px] z-40 w-[280px] rounded-md border border-border bg-card p-3 shadow-pop">
                    <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-faint">
                      {filters2Label ?? "Filter"}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {["All", ...filters2].map((f) => (
                        <Chip key={f} active={activeFilter2 === f} onClick={() => setActiveFilter2(f)}>
                          {f}
                        </Chip>
                      ))}
                    </div>
                    {activeFilter2 !== "All" && (
                      <button
                        onClick={() => setActiveFilter2("All")}
                        className="mt-2.5 text-[12px] font-semibold text-brand-hover hover:text-brand"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <span className="whitespace-nowrap text-[12.5px] font-semibold text-subtle">
              {sorted.length} of {rows.length}
            </span>
          </div>
        </div>

        <Table>
          <thead>
            <tr>
              {columns.map((c) => (
                <Th key={String(c.k)} label={c.label} k={c.k} sort={sort} toggle={toggle} num={c.num} />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-[13px] text-subtle">
                  {emptyText ?? "No matching records."}
                </td>
              </tr>
            )}
            {sorted.map((r) => renderRow(r))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

export { Row, Td };
