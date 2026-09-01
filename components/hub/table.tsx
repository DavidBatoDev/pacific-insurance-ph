"use client";

import { useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { I } from "./icons";
import { Avatar } from "./primitives";

/* ---------- Sortable table state ---------- */
export function useSort<T>(rows: T[], defaultKey: keyof T, defaultDir: "asc" | "desc" = "asc") {
  const [sort, setSort] = useState<{ key: keyof T; dir: "asc" | "desc" }>({
    key: defaultKey,
    dir: defaultDir,
  });
  const toggle = (key: keyof T) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  const sorted = [...rows].sort((a, b) => {
    let av = a[sort.key] as string | number;
    let bv = b[sort.key] as string | number;
    if (typeof av === "string") {
      av = av.toLowerCase();
      bv = String(bv ?? "").toLowerCase();
    }
    if (av < bv) return sort.dir === "asc" ? -1 : 1;
    if (av > bv) return sort.dir === "asc" ? 1 : -1;
    return 0;
  });
  return { sorted, sort, toggle };
}

export function Th<T>({
  label,
  k,
  sort,
  toggle,
  num,
}: {
  label: string;
  k: keyof T;
  sort: { key: keyof T; dir: "asc" | "desc" };
  toggle: (k: keyof T) => void;
  num?: boolean;
}) {
  const active = sort.key === k;
  return (
    <th
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "sticky top-0 whitespace-nowrap border-b border-border-soft bg-surface p-0 text-[11px] font-bold uppercase tracking-[0.04em] text-subtle",
        num ? "text-right" : "text-left",
      )}
    >
      {/* The button spans the whole cell so the click target is unchanged, but
          sorting is now reachable and announced for keyboard users. */}
      <button
        type="button"
        onClick={() => toggle(k)}
        className={cn(
          // `uppercase` is repeated here because the UA stylesheet sets
          // text-transform:none on button, which beats inheritance from the th.
          "flex w-full select-none items-center gap-1 px-[18px] py-[9px] uppercase transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/50",
          num && "justify-end",
        )}
      >
        {label}
        <span className={cn(active ? "text-brand opacity-100" : "opacity-0")}>
          {active && sort.dir === "desc" ? <I.arrowDown size={12} /> : <I.arrowUp size={12} />}
        </span>
      </button>
    </th>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse">{children}</table>
    </div>
  );
}

export function Td({ className, children, ...props }: ComponentProps<"td">) {
  return (
    <td
      className={cn("border-b border-border-soft px-[18px] py-3 align-middle text-[13px]", className)}
      {...props}
    >
      {children}
    </td>
  );
}

export function ClientCell({ name, sub }: { name: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={name} size={28} />
      <div className="min-w-0">
        <div className="whitespace-nowrap font-semibold leading-tight">{name}</div>
        {sub && <div className="whitespace-nowrap text-[11.5px] text-subtle">{sub}</div>}
      </div>
    </div>
  );
}

/**
 * Clickable table row. Keeps native row semantics (no role override) but is
 * focusable and activates on Enter/Space, so the row action is not mouse-only.
 */
export const Row = ({ className, onClick, onKeyDown, ...props }: ComponentProps<"tr">) => (
  <tr
    tabIndex={onClick ? 0 : undefined}
    onClick={onClick}
    onKeyDown={(e) => {
      onKeyDown?.(e);
      if (!onClick || e.defaultPrevented) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick(e as unknown as MouseEvent<HTMLTableRowElement>);
      }
    }}
    className={cn(
      "transition-colors last:[&>td]:border-b-0",
      onClick &&
        "cursor-pointer hover:bg-hover focus-visible:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/50",
      className,
    )}
    {...props}
  />
);
