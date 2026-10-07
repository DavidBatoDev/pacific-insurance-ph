"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { I } from "../icons";
import { Btn, StatusBadge } from "../primitives";
import { WorkflowRail, type WorkflowRailStep } from "./workflow-rail";

/**
 * The frame shared by the record workflows (application, claim): the New Application wizard's
 * layout — numbered step rail on the left, the step's heading and body, a footer bar — as a
 * centered modal. Workflows supply the steps, the body and the footer; this owns the chrome.
 */
export function WorkflowShell({
  label,
  title,
  subtitle,
  status,
  steps,
  active,
  onSelect,
  onClose,
  heading,
  headerAction,
  loading,
  error,
  footer,
  children,
}: {
  /** Accessible name of the dialog, e.g. "Application workflow". */
  label: string;
  title: string;
  subtitle?: string | null;
  /** Record status shown at the foot of the rail. */
  status?: { label: string; value: string } | null;
  steps: WorkflowRailStep[];
  active: number;
  onSelect: (n: number) => void;
  onClose: () => void;
  heading: { title: string; sub: string };
  headerAction?: ReactNode;
  /** Loading text while the record loads; the body is replaced until it resolves. */
  loading?: string | null;
  error?: { title: string; message: string } | null;
  /** Footer bar content; null when the step renders its own pinned action bar. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[65] grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative grid h-[min(720px,94vh)] w-full max-w-[980px] grid-cols-[260px_1fr] grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-xl border border-border bg-card shadow-pop max-[800px]:grid-cols-1"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
        >
          <I.plus size={20} className="rotate-45" />
        </button>

        <div className="row-span-2 flex min-h-0 max-[800px]:hidden">
          <WorkflowRail
            title={title}
            subtitle={subtitle}
            active={active}
            onSelect={onSelect}
            steps={steps}
            footer={status && (
              <div className="rounded-md border border-border-soft bg-card px-3 py-2.5 text-[11.5px]">
                <span className="text-subtle">{status.label}</span>
                <div className="mt-1"><StatusBadge status={status.value} /></div>
              </div>
            )}
          />
        </div>

        <div className="flex min-h-0 flex-col overflow-y-auto p-6">
          {loading ? (
            <div className="grid h-full place-items-center text-[13px] text-muted-foreground">{loading}</div>
          ) : error ? (
            <div className="py-8 text-center">
              <div className="mx-auto grid size-10 place-items-center rounded-full bg-red-soft text-red"><I.alertTri size={20} /></div>
              <h3 className="mt-3 text-[16px] font-bold">{error.title}</h3>
              <p className="mt-1 text-[13px] text-muted-foreground">{error.message}</p>
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-start justify-between gap-4 pr-8">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[.09em] text-brand-hover">Step {active} of {steps.length}</div>
                  <h2 className="mt-0.5 text-[18px] font-bold tracking-[-0.01em]">{heading.title}</h2>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">{heading.sub}</p>
                </div>
                {headerAction}
              </div>
              {children}
            </>
          )}
        </div>

        {footer && (
          <div className="col-start-2 flex items-center gap-3 border-t border-border-soft bg-surface-2 px-5 py-3.5 max-[800px]:col-start-1">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Footer content: back (or close), a note or "Still needed" list, and the step's actions. */
export function WorkflowFooter({ back, note, missing = [], children }: { back: ReactNode; note?: string; missing?: string[]; children?: ReactNode }) {
  return (
    <>
      {back}
      <span className="flex-1 text-[11.5px] text-faint">
        {missing.length ? <span className="text-amber">Still needed: {missing.join(", ")}</span> : note}
      </span>
      <div className="flex gap-2">{children}</div>
    </>
  );
}

/** Action bar pinned to the bottom of a step whose form lives in the step body. */
export function StepActionBar({ onBack, backLabel = "Back", note, missing = [], children }: { onBack: () => void; backLabel?: string; note?: string; missing?: string[]; children: ReactNode }) {
  return (
    <>
      <div aria-hidden className="min-h-6 flex-1" />
      <div className="sticky -bottom-6 -mx-6 -mb-6 mt-auto flex items-center gap-3 border-t border-border-soft bg-surface-2 px-5 py-3.5">
        <WorkflowFooter back={<Btn onClick={onBack}>{backLabel === "Back" && <I.chevRight size={15} className="rotate-180" />} {backLabel}</Btn>} note={note} missing={missing}>
          {children}
        </WorkflowFooter>
      </div>
    </>
  );
}

/** One row of a checkpoint list: dot + label + detail, green once done. */
export function Checkpoint({ done, label, detail }: { done: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <span
        aria-hidden
        className={cn("mt-px grid size-4 shrink-0 place-items-center rounded-full", done ? "bg-green text-white" : "border-[1.5px] border-faint")}
      >
        {done && <I.check size={10} strokeWidth={3} />}
      </span>
      <div className="min-w-0 text-[12.5px]">
        <span className={cn("font-semibold", !done && "text-muted-foreground")}>{label}</span>
        {detail && <span className="text-muted-foreground"> — {detail}</span>}
      </div>
    </li>
  );
}
