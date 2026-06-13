"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { avColor, initials, type Tier, type Tone } from "./data";

/* ---------- Tone → utility-class maps (static so Tailwind keeps them) ---------- */
export const TONE_TEXT: Record<Tone, string> = {
  red: "text-red",
  amber: "text-amber",
  blue: "text-blue",
  violet: "text-violet",
  green: "text-green",
  slate: "text-slate",
};
/** Badge / soft chip: tinted bg + colour + border. */
export const TONE_BADGE: Record<Tone, string> = {
  green: "bg-green-soft text-green border-green-border",
  amber: "bg-amber-soft text-amber border-amber-border",
  red: "bg-red-soft text-red border-red-border",
  blue: "bg-blue-soft text-blue border-blue-border",
  violet: "bg-violet-soft text-violet border-violet-border",
  slate: "bg-slate-soft text-slate border-transparent",
};
/** Soft icon tile: tinted bg + colour. */
export const TONE_SOFT: Record<Tone, string> = {
  green: "bg-green-soft text-green",
  amber: "bg-amber-soft text-amber",
  red: "bg-red-soft text-red",
  blue: "bg-blue-soft text-blue",
  violet: "bg-violet-soft text-violet",
  slate: "bg-slate-soft text-slate",
};
/** Solid icon tile: solid bg + white. */
export const TONE_SOLID: Record<Tone, string> = {
  green: "bg-green text-white",
  amber: "bg-amber text-white",
  red: "bg-red text-white",
  blue: "bg-blue text-white",
  violet: "bg-violet text-white",
  slate: "bg-slate text-white",
};
/** Alert-card surface: tinted bg + border. */
export const TONE_ALERT: Record<Tone, string> = {
  green: "bg-green-soft border-green-border",
  amber: "bg-amber-soft border-amber-border",
  red: "bg-red-soft border-red-border",
  blue: "bg-blue-soft border-blue-border",
  violet: "bg-violet-soft border-violet-border",
  slate: "bg-slate-soft border-transparent",
};

/* ---------- Avatar ---------- */
export function Avatar({
  name,
  size = 28,
  color,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full font-bold tracking-tight text-white"
      style={{
        width: size,
        height: size,
        background: color ?? avColor(name),
        fontSize: size * 0.4,
      }}
    >
      {initials(name)}
    </div>
  );
}

/* ---------- Status badge ---------- */
const STATUS_TONE: Record<string, Tone> = {
  "Awaiting Payment": "amber",
  "Missing Documents": "red",
  "Missing Requirements": "red",
  "Under Review": "blue",
  Approved: "green",
  "Notice Sent": "blue",
  "In Progress": "violet",
  Overdue: "red",
  "Additional Documents Required": "red",
  "Awaiting Response": "amber",
  "Policy Issued": "green",
  Active: "green",
  "At Risk": "amber",
  New: "blue",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "slate";
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11.5px] font-[650]",
        TONE_BADGE[tone],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

/* ---------- Client tier badge ---------- */
const TIER_TONE: Record<Tier, Tone> = { Gold: "amber", Silver: "slate", Bronze: "violet" };

export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center whitespace-nowrap rounded-full border px-2.5 text-[11.5px] font-[650]",
        TONE_BADGE[TIER_TONE[tier]],
      )}
    >
      {tier}
    </span>
  );
}

/* ---------- Due-date cell ---------- */
export function DueCell({ days, label }: { days: number; label?: string }) {
  let cls = "text-muted-foreground font-medium";
  let text = label ?? `In ${days} days`;
  if (days < 0) {
    cls = "text-red font-semibold";
    text = days === -1 ? "1 day overdue" : `${Math.abs(days)} days overdue`;
  } else if (days === 0) {
    cls = "text-amber font-semibold";
    text = "Due today";
  } else if (days <= 5) {
    cls = "text-amber font-semibold";
    text = `In ${days} day${days > 1 ? "s" : ""}`;
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5", cls)}>
      <span className="size-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}

/* ---------- SVG sparkline ---------- */
export function Sparkline({
  data,
  color = "var(--brand)",
  w = 110,
  h = 26,
  fill = true,
}: {
  data: number[];
  color?: string;
  w?: number;
  h?: number;
  fill?: boolean;
}) {
  const gid = "spark" + useId().replace(/:/g, "");
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - 2 - ((v - min) / range) * (h - 4),
  ]);
  const line = pts
    .map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1))
    .join(" ");
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="block overflow-visible"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.3" fill={color} />
    </svg>
  );
}

/* ---------- Card shell + button ---------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-lg border border-border bg-card shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CountPill({ children }: { children: ReactNode }) {
  return (
    <span className="grid h-5 min-w-[21px] place-items-center rounded-full bg-surface-3 px-[7px] text-[11.5px] font-bold text-muted-foreground">
      {children}
    </span>
  );
}

export function CardHead({
  icon: Icon,
  title,
  count,
  action,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  count?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-soft px-[18px] py-[15px]">
      <h3 className="flex items-center gap-2.5 whitespace-nowrap text-[14.5px] font-[650] tracking-[-0.01em]">
        {Icon && <Icon size={17} className="text-muted-foreground" />}
        {title}
        {count != null && <CountPill>{count}</CountPill>}
      </h3>
      {action}
    </div>
  );
}

export function CardLink({
  children,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold text-brand-hover hover:text-brand"
      {...props}
    >
      {children}
    </button>
  );
}

type BtnProps = ComponentProps<"button"> & {
  variant?: "default" | "primary" | "ghost";
  size?: "md" | "sm";
};
export function Btn({
  variant = "default",
  size = "md",
  className,
  children,
  ...props
}: BtnProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-semibold transition-colors",
        size === "md" ? "h-9 px-3.5 text-[13px]" : "h-[30px] rounded-sm px-2.5 text-[12.5px]",
        variant === "default" &&
          "border-border-strong bg-card text-foreground hover:border-faint hover:bg-hover",
        variant === "primary" &&
          "border-transparent bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(4,120,87,0.25)] hover:bg-brand-hover",
        variant === "ghost" && "border-transparent bg-transparent hover:bg-hover",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------- Draft / mock-only badge ---------- */
/** Visible marker so prototype reviewers know a screen is static mock UI. */
export function DraftBadge() {
  return (
    <span
      title="Static draft — mock data only, not wired to live data yet."
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-border bg-amber-soft px-2.5 py-[3px] text-[11px] font-[650] text-amber"
    >
      <span className="size-1.5 rounded-full bg-current" />
      Draft · mock data
    </span>
  );
}

/* ---------- Page header ---------- */
/** Standard screen header: icon tile + title (+ draft badge) + sub + right actions. */
export function PageHead({
  icon: Icon,
  title,
  sub,
  actions,
}: {
  icon?: LucideIcon;
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-[18px] flex items-end justify-between gap-4">
      <div>
        <h1 className="flex flex-wrap items-center gap-x-[11px] gap-y-2 text-[23px] font-bold tracking-[-0.025em]">
          {Icon && (
            <span className="grid size-[34px] place-items-center rounded-[9px] bg-brand-soft text-brand-hover">
              <Icon size={19} />
            </span>
          )}
          {title}
          <DraftBadge />
        </h1>
        {sub && <p className="mt-[3px] text-[13.5px] text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5 max-[900px]:hidden">{actions}</div>}
    </div>
  );
}
