"use client";

import { useState, type ComponentProps, type ReactNode } from "react";

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
      onClick={() => toggle(k)}
      className={cn(
        "sticky top-0 cursor-pointer select-none whitespace-nowrap border-b border-border-soft bg-surface px-[18px] py-[9px] text-[11px] font-bold uppercase tracking-[0.04em] text-subtle hover:text-muted-foreground",
        num ? "text-right" : "text-left",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={cn(active ? "text-brand opacity-100" : "opacity-0")}>
          {active && sort.dir === "desc" ? <I.arrowDown size={12} /> : <I.arrowUp size={12} />}
        </span>
      </span>
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

export const Row = ({ className, ...props }: ComponentProps<"tr">) => (
  <tr
    className={cn("cursor-pointer transition-colors last:[&>td]:border-b-0 hover:bg-hover", className)}
    {...props}
  />
);
