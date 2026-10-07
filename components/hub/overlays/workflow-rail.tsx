"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { BrandGlyph } from "../shell";
import { I } from "../icons";

export interface WorkflowRailStep {
  n: number;
  label: string;
  done: boolean;
  locked: boolean;
  lockedReason?: string;
}

/**
 * The numbered left rail of the New Application wizard, for record workflows that follow it
 * (the application workflow). Done steps show a check, the open step is outlined.
 */
export function WorkflowRail({
  title,
  subtitle,
  steps,
  active,
  onSelect,
  footer,
}: {
  title: string;
  subtitle?: string | null;
  steps: WorkflowRailStep[];
  active: number;
  onSelect: (n: number) => void;
  footer?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col border-r border-border-soft bg-surface-2 p-5 max-[800px]:hidden">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-[8px] bg-gradient-to-br from-[#10b981] to-[#047857]">
          <BrandGlyph size={16} />
        </span>
        <span className="text-[12.5px] font-bold">Pacific Insurance PH</span>
      </div>
      <div className="text-[17px] font-bold leading-snug tracking-[-0.01em]">{title}</div>
      {subtitle && <div className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</div>}
      <nav aria-label="Workflow steps" className="mt-5 flex flex-col gap-1">
        {steps.map((step) => (
          <button
            key={step.n}
            type="button"
            onClick={() => onSelect(step.n)}
            disabled={step.locked}
            title={step.locked ? step.lockedReason : undefined}
            aria-current={active === step.n ? "step" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              active === step.n ? "bg-brand-soft" : "hover:bg-hover disabled:hover:bg-transparent",
            )}
          >
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-[11.5px] font-bold",
                step.done
                  ? "bg-brand text-white"
                  : active === step.n
                    ? "border-2 border-brand text-brand"
                    : "border border-border-strong text-subtle",
              )}
            >
              {step.done ? <I.check size={13} /> : step.n}
            </span>
            <span className={cn("text-[12.5px] font-[650]", active === step.n ? "text-brand-hover" : "")}>{step.label}</span>
          </button>
        ))}
      </nav>
      {footer && <div className="mt-auto">{footer}</div>}
    </div>
  );
}
