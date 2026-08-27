"use client";

import { cn } from "@/lib/utils";
import { I } from "../../icons";
import { followDays, STAGE_TONE, STATUS_TONE } from "../../lead-config";
import { Pill } from "../../primitives";

export function FollowPill({ date }: { date: string | null }) {
  const days = followDays(date);
  if (days == null)
    return <span className="text-[11px] font-semibold text-faint">No follow-up</span>;
  const cls =
    days < 0 ? "text-red" : days === 0 ? "text-amber" : days <= 1 ? "text-amber" : "text-muted-foreground";
  const label =
    days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : days === 1 ? "Tomorrow" : `In ${days}d`;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold", cls)}>
      <I.clock size={12} /> {label}
    </span>
  );
}

export const StageBadge = ({ stage }: { stage: string | null }) => (
  <Pill size="sm" tone={STAGE_TONE[stage ?? ""] ?? "slate"}>{stage ?? "—"}</Pill>
);
export const StatusChip = ({ status }: { status: string | null }) => (
  <Pill size="sm" tone={STATUS_TONE[status ?? ""] ?? "slate"} dot>{status ?? "—"}</Pill>
);
