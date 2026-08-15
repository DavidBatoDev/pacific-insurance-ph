"use client";

import { createPortal } from "react-dom";
import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Btn } from "../primitives";
import { I } from "../icons";

/** Centered confirm/dialog shell (design: .overlay > .modal). */
export function Modal({
  onClose,
  children,
  footer,
  maxWidth = 420,
}: {
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/35 p-4 backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-pop"
        style={{ maxWidth }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* min-h-0 lets this flex child shrink so its own scroll engages instead of
            growing the card past the viewport (footer stays pinned below). overflow-x-hidden
            is explicit, not incidental: setting only overflow-y makes the browser compute
            overflow-x as `auto` too, so any absolutely-positioned child that overflows
            horizontally (e.g. a hover popover) turns into an ugly horizontal scrollbar
            instead of just being clipped. */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 pb-4 pt-6">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2.5 border-t border-border-soft bg-surface-2 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export interface ConfirmOptions {
  kind?: "danger" | "warn";
  title: string;
  /** Plain-text body (no HTML injection). */
  message: ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
}

/** Confirm dialog rendered by the overlay provider's `confirm()` promise API. */
export function ConfirmDialog({
  options,
  onResolve,
}: {
  options: ConfirmOptions;
  onResolve: (ok: boolean) => void;
}) {
  const kind = options.kind ?? "warn";
  return (
    <Modal onClose={() => onResolve(false)}>
      <div className="flex flex-col items-center text-center">
        <div
          className={cn(
            "mb-3.5 grid size-12 place-items-center rounded-full",
            kind === "danger" ? "bg-red-soft text-red" : "bg-amber-soft text-amber",
          )}
        >
          <I.alertTri size={24} />
        </div>
        <h3 className="text-[16px] font-bold tracking-[-0.01em]">{options.title}</h3>
        <div className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{options.message}</div>
        <div className="mt-5 flex w-full items-center justify-center gap-2.5">
          <Btn onClick={() => onResolve(false)}>{options.cancelLabel ?? "Cancel"}</Btn>
          <Btn
            variant="primary"
            className={kind === "danger" ? "border-transparent bg-red text-white hover:bg-red/90" : undefined}
            onClick={() => onResolve(true)}
          >
            {options.confirmLabel ?? "Confirm"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
