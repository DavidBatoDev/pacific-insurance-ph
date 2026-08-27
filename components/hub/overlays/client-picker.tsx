"use client";

import { useEffect, useRef, useState } from "react";

import { searchClientsForPalette, type PaletteClientHit } from "@/app/(app)/search/actions";
import { I } from "../icons";
import { Avatar } from "../primitives";

export interface PickedClient {
  id: string;
  name: string;
  sub?: string;
  email?: string;
}

/** Debounced real-record contact search used by the operation drawers. */
export function ClientPicker({
  value,
  onPick,
  onClear,
  placeholder = "Search a client…",
}: {
  value: PickedClient | null;
  onPick: (c: PickedClient) => void;
  onClear: () => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PaletteClientHit[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const mySeq = ++seq.current;
    const t = setTimeout(() => {
      searchClientsForPalette(term)
        .then((rows) => {
          if (seq.current === mySeq) setResults(rows.slice(0, 5));
        })
        .catch(() => setResults([]));
    }, 160);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center gap-2.5 rounded-md border border-brand bg-brand-soft px-3 py-2.5">
        <Avatar name={value.name} size={30} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-[600]">{value.name}</div>
          {value.sub && <div className="truncate text-[11.5px] text-subtle">{value.sub}</div>}
        </div>
        <button
          onClick={onClear}
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-hover"
        >
          <I.plus size={15} className="rotate-45" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex h-[38px] items-center gap-2.5 rounded-md border border-border-strong bg-card px-3 text-muted-foreground focus-within:border-brand">
        <I.search size={16} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-subtle"
        />
      </div>
      {results.map((r) => (
        <button
          key={r.id}
          onClick={() => {
            onPick({
              id: r.id,
              name: r.name,
              sub: [r.clientType, r.email].filter(Boolean).join(" · "),
              email: r.email ?? undefined,
            });
            setQ("");
          }}
          className="mt-1.5 flex w-full items-center gap-2.5 rounded-md border border-border-soft px-3 py-2 text-left transition-colors hover:bg-hover"
        >
          <Avatar name={r.name} size={30} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-[600]">{r.name}</div>
            <div className="truncate text-[11.5px] text-subtle">
              {[r.clientType, r.email].filter(Boolean).join(" · ")}
            </div>
          </div>
          <I.plus size={16} className="text-subtle" />
        </button>
      ))}
    </div>
  );
}


export function DrawerField({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
        {label} {required && <span className="text-red">*</span>}
      </label>
      {children}
      {hint && <div className="mt-1 text-[11.5px] text-faint">{hint}</div>}
    </div>
  );
}
