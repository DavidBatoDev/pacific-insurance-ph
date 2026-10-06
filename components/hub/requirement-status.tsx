import { cn } from "@/lib/utils";
import { I } from "./icons";

/**
 * One status language for every requirement checklist (applications, claims, travel): the row's
 * border and tint and the leading dot all follow the item's status, so a column of rows reads at a
 * glance — what's still outstanding, what's in hand, what bounced, what's verified.
 */
export type RequirementStatusValue = "Pending" | "Received" | "Incomplete" | "Verified";

export const REQUIREMENT_ROW_TONE: Record<RequirementStatusValue, string> = {
  Pending: "border-border-soft bg-card",
  Received: "border-blue-border bg-blue-soft/50",
  Incomplete: "border-red-border bg-red-soft/50",
  Verified: "border-green-border bg-green-soft/50",
};

const DOT: Record<RequirementStatusValue, { className: string; label: string }> = {
  Pending: { className: "border-[1.5px] border-faint bg-card text-faint", label: "Pending" },
  Received: { className: "bg-blue text-white", label: "Received — awaiting verification" },
  Incomplete: { className: "bg-red text-white", label: "Incomplete — needs a corrected copy" },
  Verified: { className: "bg-green text-white", label: "Verified" },
};

export function RequirementStatusDot({ status, className }: { status: string; className?: string }) {
  const key = (status in DOT ? status : "Pending") as RequirementStatusValue;
  const dot = DOT[key];
  return (
    <span
      role="img"
      aria-label={dot.label}
      title={dot.label}
      className={cn("grid size-7 shrink-0 place-items-center rounded-full", dot.className, className)}
    >
      {key === "Verified" && <I.check size={14} strokeWidth={2.5} />}
      {key === "Received" && <I.fileText size={13} />}
      {key === "Incomplete" && <I.alertTri size={13} />}
      {key === "Pending" && <I.clock size={13} />}
    </span>
  );
}

export const requirementRowTone = (status: string) =>
  REQUIREMENT_ROW_TONE[(status in REQUIREMENT_ROW_TONE ? status : "Pending") as RequirementStatusValue];
