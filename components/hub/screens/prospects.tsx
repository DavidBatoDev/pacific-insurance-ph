"use client";

/**
 * DRAFT — mock UI only.
 * Ported from drafts/src/prospects.jsx for prototype review. The kanban board's
 * drag-and-drop mutates local component state only — nothing is persisted, and no
 * real data layer or actions are wired up yet.
 */
import { useState, type DragEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { peso, pesoShort, type Tone } from "../data";
import { I } from "../icons";
import { Avatar, Btn, Card, CardHead, CardLink, PageHead, TONE_BADGE, TONE_SOFT } from "../primitives";
import {
  PP_ACTIVITY, PP_COLUMNS, PP_FOLLOWUPS, PP_INTAKE, PP_KPIS, PP_PIPELINE, PP_PRODUCT_INTEREST,
  PP_PRODUCTS, PP_PROPOSALS, PP_PROSPECTS, PP_QUICK, PP_STAFF,
  type Health, type Priority, type PpActivityType, type Prospect, type Urgency,
} from "../prospect-data";

/* ---------- KPIs ---------- */
function ProspectKpis() {
  const dirIco = { up: I.arrowUp, down: I.arrowDown, flat: I.clock };
  return (
    <div className="mb-4 grid grid-cols-6 gap-3.5 max-[1200px]:grid-cols-3 max-[700px]:grid-cols-2">
      {PP_KPIS.map((k) => {
        const Ico = I[k.icon];
        const DeltaIco = dirIco[k.dir];
        const deltaCls = k.tone === "amber"
          ? "text-amber"
          : k.dir === "down" ? "text-red" : k.dir === "flat" ? "text-subtle" : "text-green";
        return (
          <div key={k.id} className="overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="grid size-[30px] place-items-center rounded-lg bg-brand-soft text-brand-hover">
                <Ico size={17} />
              </span>
              <span className={cn("inline-flex items-center gap-0.5 text-[11.5px] font-bold", deltaCls)}>
                <DeltaIco size={12} />
                {k.delta}
              </span>
            </div>
            <div className="mt-3 text-[27px] font-[760] leading-none tracking-[-0.03em] tabular-nums">{k.value}</div>
            <div className="mt-1.5 text-[12.5px] font-[550] text-muted-foreground">{k.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Quick actions ---------- */
function QuickActions() {
  return (
    <div className="mb-4 flex flex-wrap gap-2.5">
      {PP_QUICK.map((q) => {
        const Ico = I[q.icon];
        if (q.primary) {
          return (
            <Btn key={q.label} variant="primary">
              <Ico size={16} /> {q.label}
            </Btn>
          );
        }
        return (
          <button
            key={q.label}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-[13px] font-semibold text-muted-foreground shadow-sm transition-colors hover:border-border-strong hover:bg-hover"
          >
            <span className="grid size-[22px] place-items-center rounded-md bg-brand-soft text-brand-hover">
              <Ico size={14} />
            </span>
            {q.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Pipeline overview ---------- */
const HEALTH_TONE: Record<Health, Tone> = { good: "green", watch: "amber", risk: "red" };
const HEALTH_LABEL: Record<Health, string> = { good: "Healthy", watch: "Watch", risk: "At risk" };

function PipelineOverview() {
  const stageColor = (name: string) =>
    name === "Lost" ? "var(--red)" : name === "Converted" ? "var(--brand)" : "var(--blue)";
  return (
    <div className="mb-4">
      <Card>
        <CardHead
          icon={I.chart}
          title="Pipeline overview"
          action={<span className="text-[12.5px] font-semibold text-subtle tabular-nums">42 active · {peso(9930000)} weighted</span>}
        />
        <div className="flex items-stretch gap-1 overflow-x-auto px-4 py-4">
          {PP_PIPELINE.map((s, i) => (
            <div key={s.name} className="flex items-center gap-1">
              <div className="flex w-[104px] shrink-0 flex-col gap-1 rounded-md border border-border-soft bg-surface-2 px-3 py-2.5">
                <div className="h-1 w-full rounded-full" style={{ background: stageColor(s.name) }} />
                <div className="mt-1 text-[20px] font-[750] leading-none tabular-nums">{s.count}</div>
                <div className="text-[11.5px] font-semibold leading-tight">{s.name}</div>
                <div className="text-[11px] text-subtle tabular-nums">{s.value ? pesoShort(s.value) : "—"}</div>
                <div
                  className="flex items-center gap-1 text-[10.5px] font-bold"
                  style={{ color: `var(--${HEALTH_TONE[s.health]})` }}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {HEALTH_LABEL[s.health]}
                </div>
              </div>
              {i < PP_PIPELINE.length - 1 && <I.chevRight size={15} className="shrink-0 text-faint" />}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------- Kanban board ---------- */
function FollowPill({ days }: { days: number }) {
  let cls = "bg-surface-3 text-muted-foreground";
  let text: ReactNode = `In ${days}d`;
  let Ico = I.clock;
  if (days === 99) {
    cls = "bg-green-soft text-green";
    text = "Won";
    Ico = I.check;
  } else if (days < 0) {
    cls = "bg-red-soft text-red";
    text = `${Math.abs(days)}d overdue`;
  } else if (days === 0) {
    cls = "bg-amber-soft text-amber";
    text = "Due today";
  } else if (days === 1) {
    cls = "bg-amber-soft text-amber";
    text = "Tomorrow";
  }
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-px text-[10.5px] font-bold", cls)}>
      <Ico size={12} /> {text}
    </span>
  );
}

const PRIO_BORDER: Record<Priority, string> = {
  high: "border-l-red",
  med: "border-l-amber",
  low: "border-l-slate",
};
const PRIO_BADGE: Record<Priority, Tone> = { high: "red", med: "amber", low: "slate" };

function ProspectCard({
  p,
  onDragStart,
}: {
  p: Prospect;
  onDragStart: (e: DragEvent, id: number) => void;
}) {
  const color = PP_PRODUCTS[p.product] ?? "var(--slate)";
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, p.id)}
      className={cn(
        "cursor-grab rounded-md border border-l-[3px] border-border bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
        PRIO_BORDER[p.prio],
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-[650]">{p.name}</span>
        <span className={cn("rounded px-1.5 py-px text-[9.5px] font-bold uppercase", TONE_BADGE[PRIO_BADGE[p.prio]])}>
          {p.prio}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold">
        <span className="size-2 rounded-full" style={{ background: color }} />
        {p.product}
      </div>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-subtle">
        <I.clock size={11} /> {p.last}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Avatar name={PP_STAFF[p.staff]} size={20} />
          <span className="text-[11.5px] font-semibold text-muted-foreground">{PP_STAFF[p.staff].split(" ")[0]}</span>
        </div>
        <FollowPill days={p.follow} />
      </div>
    </div>
  );
}

function KanbanBoard() {
  const [prospects, setProspects] = useState(PP_PROSPECTS);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const onDragStart = (e: DragEvent, id: number) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDrop = (stage: string) => {
    if (dragId != null) setProspects((ps) => ps.map((p) => (p.id === dragId ? { ...p, stage } : p)));
    setDragId(null);
    setOverCol(null);
  };

  return (
    <div className="mb-4">
      <Card className="overflow-hidden">
        <CardHead
          icon={I.grid}
          title="Prospect board"
          count={prospects.filter((p) => p.stage !== "Converted").length}
          action={
            <div className="flex items-center gap-2.5">
              <span className="text-[12px] font-semibold text-subtle max-[900px]:hidden">Drag cards to move stage</span>
              <Btn size="sm">
                <I.filter size={14} /> Filter
              </Btn>
            </div>
          }
        />
        <div className="overflow-x-auto px-4 pb-4 pt-3.5">
          <div className="flex gap-3">
            {PP_COLUMNS.map((col) => {
              const items = prospects.filter((p) => p.stage === col.key);
              const val = items.reduce((a, p) => a + p.value, 0);
              return (
                <div
                  key={col.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverCol(col.key);
                  }}
                  onDrop={() => onDrop(col.key)}
                  className="flex w-[240px] shrink-0 flex-col rounded-lg bg-surface-2 p-2.5"
                >
                  <div className="flex items-center gap-1.5 px-1 pb-2">
                    <span className="size-2 rounded-full" style={{ background: col.color }} />
                    <span className="text-[12.5px] font-[650]">{col.key}</span>
                    <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-surface-3 px-1 text-[10.5px] font-bold text-muted-foreground">
                      {items.length}
                    </span>
                    <span className="ml-auto text-[11px] font-semibold text-subtle tabular-nums">
                      {val ? pesoShort(val) : ""}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "flex min-h-[80px] flex-col gap-2 rounded-md p-1",
                      overCol === col.key && dragId != null && "outline-2 outline-dashed outline-brand",
                    )}
                  >
                    {items.map((p) => (
                      <ProspectCard key={p.id} p={p} onDragStart={onDragStart} />
                    ))}
                    <button className="rounded-md border border-dashed border-border-strong px-2.5 py-2 text-center text-[12px] font-semibold text-subtle transition-colors hover:bg-hover">
                      <I.plus size={13} className="mr-1 inline align-[-2px]" />
                      Add prospect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Proposal tracking ---------- */
const PROPOSAL_TONE: Record<string, Tone> = {
  "Awaiting Decision": "amber",
  "Proposal Received": "blue",
  "Proposal Requested": "slate",
  Negotiating: "violet",
};

function ProposalTracking() {
  const steps = ["Requested", "Received", "Sent", "Decision"];
  return (
    <Card>
      <CardHead
        icon={I.fileText}
        title="Proposal tracking"
        count={PP_PROPOSALS.length}
        action={<CardLink>View all <I.chevRight size={13} /></CardLink>}
      />
      <div className="grid grid-cols-[1.6fr_1fr_1.2fr_auto] gap-3.5 border-b border-border-soft px-[18px] py-2.5">
        {["Prospect", "Stage", "Progress", "Status"].map((h) => (
          <div key={h} className="text-[11px] font-bold uppercase tracking-[0.04em] text-subtle">{h}</div>
        ))}
      </div>
      {PP_PROPOSALS.map((p) => (
        <div
          key={p.name}
          className="grid grid-cols-[1.6fr_1fr_1.2fr_auto] items-center gap-3.5 border-b border-border-soft px-[18px] py-3 last:border-b-0"
        >
          <div className="flex items-center gap-2.5">
            <Avatar name={p.name} size={30} />
            <div className="min-w-0">
              <div className="whitespace-nowrap font-semibold leading-tight">{p.name}</div>
              <div className="text-[11.5px] text-subtle">{p.product}</div>
            </div>
          </div>
          <div className="text-[12px] text-muted-foreground">{p.days}</div>
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <span
                key={s}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  i < p.step ? "bg-brand" : i === p.step ? "bg-brand/45" : "bg-surface-3",
                )}
              />
            ))}
          </div>
          <div>
            <span
              className={cn(
                "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11.5px] font-[650]",
                TONE_BADGE[PROPOSAL_TONE[p.status] ?? "slate"],
              )}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {p.status}
            </span>
          </div>
        </div>
      ))}
    </Card>
  );
}

/* ---------- Product interest ---------- */
function ProductInterest() {
  return (
    <Card>
      <CardHead icon={I.shield} title="Product interest" />
      <div className="px-[18px] py-4">
        <div className="mb-4 flex h-3 overflow-hidden rounded-full">
          {PP_PRODUCT_INTEREST.map((p) => (
            <div key={p.name} style={{ width: `${p.pct}%`, background: p.color }} title={p.name} />
          ))}
        </div>
        {PP_PRODUCT_INTEREST.map((p) => (
          <div key={p.name} className="flex items-center gap-2.5 py-1.5">
            <span className="flex w-[130px] shrink-0 items-center gap-2 text-[12.5px] font-[550]">
              <span className="size-2.5 rounded-sm" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
              <span className="block h-full rounded-full" style={{ width: `${p.pct}%`, background: p.color }} />
            </span>
            <span className="w-10 text-right text-[12.5px] font-bold tabular-nums">{p.pct}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- Intake forms ---------- */
function IntakeForms() {
  const { sent, completed, awaiting, recent } = PP_INTAKE;
  const pct = Math.round((completed / sent) * 100);
  const C = 2 * Math.PI * 26;
  return (
    <Card>
      <CardHead icon={I.clipboard} title="Intake forms" action={<CardLink>Manage <I.chevRight size={13} /></CardLink>} />
      <div className="flex items-center gap-4 px-[18px] py-4">
        <svg width="68" height="68" viewBox="0 0 68 68" className="shrink-0">
          <circle cx="34" cy="34" r="26" fill="none" stroke="var(--surface-3)" strokeWidth="8" />
          <circle
            cx="34" cy="34" r="26" fill="none" stroke="var(--brand)" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 34 34)"
          />
          <text x="34" y="34" textAnchor="middle" dominantBaseline="central" fontSize="16" fontWeight="750" fill="var(--foreground)">
            {pct}%
          </text>
        </svg>
        <div className="flex flex-col gap-1.5 text-[12.5px]">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm bg-blue" />
            <span className="font-bold tabular-nums">{sent}</span> Forms sent
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm bg-brand" />
            <span className="font-bold tabular-nums">{completed}</span> Completed
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm bg-amber" />
            <span className="font-bold tabular-nums">{awaiting}</span> Awaiting completion
          </div>
        </div>
      </div>
      <div className="border-t border-border-soft px-[18px] pb-2">
        <div className="py-3 text-[11px] font-bold uppercase tracking-[0.04em] text-subtle">Recent responses</div>
        {recent.map((r) => (
          <div key={r.name} className="flex items-center gap-2.5 py-1.5">
            <Avatar name={r.name} size={24} />
            <span className="flex-1 text-[12.5px] font-[550]">{r.name}</span>
            <span className="text-[11px] text-subtle">{r.when}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- Follow-up queue ---------- */
const FQ_TONE: Record<string, Tone> = { phone: "green", mail: "blue", fileText: "violet", clipboard: "amber" };
const FQ_WHEN: Record<Urgency, string> = { over: "text-red", today: "text-amber", soon: "text-blue" };

function FollowUpQueue() {
  return (
    <Card>
      <CardHead
        icon={I.phone}
        title="Follow-up queue"
        count={PP_FOLLOWUPS.length}
        action={<CardLink>View all <I.chevRight size={13} /></CardLink>}
      />
      <div>
        {PP_FOLLOWUPS.map((f, i) => {
          const Ico = I[f.icon];
          return (
            <div key={i} className="flex items-center gap-3 border-b border-border-soft px-[18px] py-2.5 last:border-b-0">
              <div className={cn("grid size-[30px] shrink-0 place-items-center rounded-[9px]", TONE_SOFT[FQ_TONE[f.icon]])}>
                <Ico size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-[550] leading-snug">{f.action}</div>
                <div className="mt-0.5 text-[11.5px] text-subtle">
                  <span className="font-semibold" style={{ color: PP_PRODUCTS[f.product] }}>{f.product}</span> · {f.sub}
                </div>
              </div>
              <span className={cn("whitespace-nowrap text-[11.5px] font-bold", FQ_WHEN[f.urg])}>{f.when}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- Activity ---------- */
const ACT_TONE: Record<PpActivityType, Tone> = {
  convert: "green", proposal_sent: "violet", discovery: "blue", brochure: "blue", proposal_req: "amber", inquiry: "slate", intake: "green",
};
const ACT_ICON = {
  convert: "award", proposal_sent: "send", discovery: "phone", brochure: "mail", proposal_req: "fileText", inquiry: "user", intake: "clipboard",
} as const;

function ProspectActivity() {
  return (
    <Card>
      <CardHead icon={I.clock} title="Recent prospect activity" action={<CardLink>View log <I.chevRight size={13} /></CardLink>} />
      <div className="py-1.5">
        {PP_ACTIVITY.map((a, idx) => {
          const Ico = I[ACT_ICON[a.type]];
          return (
            <div key={idx} className="relative flex gap-3 px-[18px] py-2.5">
              <div className="relative flex shrink-0 flex-col items-center">
                <div className={cn("z-10 grid size-[30px] place-items-center rounded-lg", TONE_SOFT[ACT_TONE[a.type]])}>
                  <Ico size={15} />
                </div>
                {idx < PP_ACTIVITY.length - 1 && (
                  <div className="absolute -bottom-[18px] left-1/2 top-[30px] w-0.5 -translate-x-1/2 bg-border" />
                )}
              </div>
              <div className="flex-1 pb-1.5 pt-0.5">
                <div className="text-[13px] leading-snug">
                  <b className="font-[650]">{a.who}</b> <span dangerouslySetInnerHTML={{ __html: a.text }} />
                </div>
                <div className="mt-0.5 text-[11.5px] text-subtle">{a.time}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- Segmented view switch (static mock) ---------- */
function Seg() {
  const opts = ["Board", "List", "Forecast"];
  return (
    <div className="inline-flex rounded-md border border-border-strong bg-card p-0.5">
      {opts.map((s, i) => (
        <button
          key={s}
          className={cn(
            "h-7 rounded-[6px] px-3 text-[12.5px] font-semibold transition-colors",
            i === 0 ? "bg-brand-soft text-brand-hover" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

/* ---------- Assembly ---------- */
export function ProspectsScreen() {
  return (
    <div>
      <PageHead
        icon={I.trendUp}
        title="Prospect Pipeline"
        sub="Move prospects from first inquiry to a started application. Prospects become clients only after a policy is issued."
        actions={<Seg />}
      />

      <QuickActions />
      <ProspectKpis />
      <PipelineOverview />
      <KanbanBoard />

      <div className="grid grid-cols-12 gap-4 max-[1200px]:grid-cols-1">
        <div className="col-span-8 flex flex-col gap-4 max-[1200px]:col-span-1">
          <ProposalTracking />
          <FollowUpQueue />
        </div>
        <div className="col-span-4 flex flex-col gap-4 max-[1200px]:col-span-1">
          <ProductInterest />
          <IntakeForms />
          <ProspectActivity />
        </div>
      </div>
    </div>
  );
}
