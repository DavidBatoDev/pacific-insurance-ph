"use client";

import { createPortal } from "react-dom";
import { useEffect } from "react";

import { I } from "../icons";

export interface ToastData {
  id: number;
  title: string;
  sub?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/** Bottom-of-screen success toast stack; each auto-dismisses after 5s (design: NAToast). */
export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastData[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] flex flex-col items-center gap-2.5 px-4">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className="pointer-events-auto flex w-full max-w-[460px] items-center gap-3 rounded-md border border-border bg-card p-3.5 shadow-pop">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-green-soft text-green">
        <I.check size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-[650] leading-snug">{toast.title}</div>
        {toast.sub && <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{toast.sub}</div>}
      </div>
      {toast.action && (
        <button
          onClick={() => {
            onDismiss(toast.id);
            toast.action?.onClick();
          }}
          className="shrink-0 rounded-md px-2.5 py-1.5 text-[12.5px] font-semibold text-brand transition-colors hover:bg-brand-soft hover:text-brand-hover"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="grid size-[30px] shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
      >
        <I.plus size={16} className="rotate-45" />
      </button>
    </div>
  );
}
