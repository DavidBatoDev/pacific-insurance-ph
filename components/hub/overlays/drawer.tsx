"use client";

import { createPortal } from "react-dom";
import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { I, type IconName } from "../icons";

/**
 * Right-side form drawer shell (design: .overlay > .drawer with drawer-head /
 * drawer-body / drawer-foot). Portals to <body>, closes on backdrop click and
 * Escape. Pass `onRequestClose` to guard dirty state (e.g. a confirm()).
 */
export function Drawer({
  icon = "fileText",
  title,
  sub,
  wide = false,
  onClose,
  children,
  footer,
}: {
  icon?: IconName;
  title: ReactNode;
  sub?: ReactNode;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const Ico = I[icon];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-stretch justify-end bg-black/35 backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        className={cn(
          "flex h-full w-full flex-col border-l border-border bg-card shadow-pop",
          wide ? "max-w-[720px]" : "max-w-[520px]",
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3.5 border-b border-border-soft px-5 py-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand-hover">
            <Ico size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-bold tracking-[-0.01em]">{title}</h2>
            {sub && <div className="mt-px text-[12.5px] text-muted-foreground">{sub}</div>}
          </div>
          <button
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
          >
            <I.plus size={20} className="rotate-45" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-[18px]">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2.5 border-t border-border-soft px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
