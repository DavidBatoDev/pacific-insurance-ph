"use client";

import { Popover } from "@base-ui/react/popover";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";

import { toggleTaskAction } from "@/app/(app)/tasks/actions";
import type { DashboardStats } from "@/lib/queries/dashboard";
import type { TouchpointRow } from "@/lib/queries/relationship";
import type { Application } from "@/lib/repositories/applications/application.entity";
import type { Claim } from "@/lib/repositories/claims/claim.entity";
import type { Renewal } from "@/lib/repositories/renewals/renewal.entity";
import type { Task as RealTask } from "@/lib/repositories/tasks/task.entity";
import type { TravelRequest } from "@/lib/repositories/travel/travel-request.entity";
import { cn } from "@/lib/utils";
import { fmtDate, money, peso } from "@/lib/format";
import type { Tone } from "./tone";
import { I, type IconName } from "./icons";
import { useOverlays } from "./overlays/overlay-provider";
import { RenewalEmailDraftModal } from "./overlays/renewal-email-draft";
import { usePersona } from "./persona";
import {
  Btn, Card, CardHead, CardLink, DueCell, PageHead, StatusBadge,
  TONE_SOFT, TONE_TEXT,
} from "./primitives";
import { ClientCell, Td } from "./table";
import { QueueCard } from "./dashboard/queue-card";
import { BUCKET_LABEL, TAG_TONE, taskBucket, type TaskBucket } from "./task-buckets";
import { useRecordNav, useScreenNav } from "./nav";
import type { ScreenId } from "./shell";

/**
 * Dashboard — the owner's daily command center: alerts, KPIs, revenue widget, queues, tasks,
 * relationship touchpoints and activity all read live data.
 */

type Nav = { setScreen: (s: ScreenId) => void };

export interface DashboardQueues {
  applications: Application[];
  renewals: Renewal[];
  claims: Claim[];
  travel: TravelRequest[];
}

const daysUntil = (iso: string | null): number | null => {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso + "T00:00:00").getTime() - today.getTime()) / 86_400_000);
};

/* ---------- At a glance: the book and what needs attention, in one card ---------- */
const ATTENTION: { id: ScreenId; tone: Tone; key: keyof DashboardStats["alerts"]; label: string }[] = [
  { id: "renewals", tone: "amber", key: "renewalsDue30", label: "Renewals due in 30 days" },
  { id: "claims", tone: "red", key: "claimsAwaitingDocs", label: "Claims awaiting documents" },
  { id: "travel", tone: "blue", key: "travelAwaitingPayment", label: "Travel awaiting payment" },
  { id: "applications", tone: "violet", key: "appsMissingRequirements", label: "Applications missing requirements" },
];
const BOOK: { id: ScreenId; key: keyof DashboardStats["kpis"]; label: string }[] = [
  { id: "clients", key: "activeClients", label: "Active clients" },
  { id: "policies", key: "activePolicies", label: "Active policies" },
  { id: "applications", key: "applicationsInProgress", label: "Applications in progress" },
  { id: "claims", key: "openClaims", label: "Open claims" },
  { id: "renewals", key: "upcomingRenewals", label: "Upcoming renewals" },
  { id: "travel", key: "openTravel", label: "Open travel requests" },
];

/**
 * One quiet card instead of alert tiles plus KPI tiles: the book as six numbers over hairlines,
 * and the four queues that need someone beneath as a tone dot, a count and a label. A cleared
 * queue drops to a grey dot so the counts that do need attention stand out.
 */
function GlanceCard({ setScreen, stats }: Nav & { stats: DashboardStats }) {
  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="grid grid-cols-6 divide-x divide-border-soft max-[1200px]:grid-cols-3 max-[1200px]:divide-x-0">
        {BOOK.map((b) => (
          <button key={b.key} type="button" onClick={() => setScreen(b.id)} className="px-4 py-3.5 text-left transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-brand/25">
            <div className="text-[22px] font-[760] leading-none tracking-[-0.02em] tabular-nums">{stats.kpis[b.key]}</div>
            <div className="mt-1.5 text-[12px] font-[550] text-muted-foreground">{b.label}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-x-4 border-t border-border-soft bg-surface-2 px-4 py-2.5 max-[1200px]:grid-cols-2">
        {ATTENTION.map((a) => {
          const n = stats.alerts[a.key];
          return (
            <button key={a.id} type="button" onClick={() => setScreen(a.id)} className="flex items-center gap-2 rounded-sm py-1 text-left text-[12.5px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30">
              <span className={cn("size-2 shrink-0 rounded-full", n ? `bg-current ${TONE_TEXT[a.tone]}` : "bg-border-strong")} />
              <span className={cn("font-semibold tabular-nums", n ? TONE_TEXT[a.tone] : "text-subtle")}>{n}</span>
              <span className="min-w-0 truncate">{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Revenue widget ---------- */
function RevenueWidget({ setScreen, stats }: Nav & { stats: DashboardStats }) {
  const overlays = useOverlays();
  const persona = usePersona();
  const rows = stats.revenue.rows;
  // Bars compare peso pipelines only; non-PHP amounts are listed beside the figure,
  // never converted into the bar scale (DH15).
  const max = Math.max(...rows.map((r) => r.amounts.PHP ?? 0), 1);
  const items = rows.reduce((a, r) => a + r.count, 0);
  /** One figure per currency, PHP first; never summed across currencies (DH15). */
  const moneyParts = (amounts: Record<string, number>) => {
    const parts = Object.entries(amounts)
      .filter(([, amount]) => amount !== 0)
      .sort(([a], [b]) => (a === "PHP" ? -1 : b === "PHP" ? 1 : a.localeCompare(b)))
      .map(([currency, amount]) => money(amount, currency));
    return parts.length ? parts : [peso(0)];
  };
  // Theme tokens, not literals: these bars sit on --card and have to re-tint in dark.
  const colors: Record<string, string> = {
    Applications: "var(--green)",
    Renewals: "var(--blue)",
    Travel: "var(--amber)",
  };
  const icons: Record<string, IconName> = { Applications: "fileText", Renewals: "refresh", Travel: "plane" };
  const canSend = persona.role !== "agent"; // Admin & Staff only (§12)
  // Headline shows the peso figure; other currencies sit beneath it, never added in.
  const [headline, ...otherTotals] = moneyParts(stats.revenue.totals);

  return (
    <div className="mb-4 grid grid-cols-[1.1fr_2.4fr_auto] items-center gap-7 rounded-lg border border-border bg-card p-5 shadow-sm max-[1200px]:grid-cols-1">
      <div>
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-muted-foreground">
          <I.wallet size={15} /> Revenue opportunity awaiting collection
        </div>
        <div className="mt-1.5 text-[33px] font-[780] leading-none tracking-[-0.035em] tabular-nums">{headline}</div>
        {otherTotals.length > 0 && (
          <div className="mt-1 text-[17px] font-[700] leading-none tracking-[-0.02em] tabular-nums text-muted-foreground">
            {otherTotals.join(" · ")}
          </div>
        )}
        <div className="mt-2 flex items-center gap-1.5 text-[12px] text-subtle">
          <I.trendUp size={13} className="text-brand" /> {items} item{items === 1 ? "" : "s"} across{" "}
          {rows.length} pipelines
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => {
          const Ico = I[icons[row.source]];
          // Wide: label | bar | amount. Narrow: label and amount share the first
          // row and the bar spans beneath them, so nothing has to wrap.
          return (
            <div
              key={row.source}
              className="grid grid-cols-[248px_1fr_110px] items-center gap-3.5 max-[1200px]:grid-cols-[1fr_auto] max-[1200px]:gap-x-3 max-[1200px]:gap-y-1.5"
            >
              <span className="flex items-center gap-2 whitespace-nowrap text-[12.5px] font-[550] text-muted-foreground max-[1200px]:col-start-1 max-[1200px]:row-start-1">
                <Ico size={15} className="shrink-0" style={{ color: colors[row.source] }} />
                {row.source} awaiting payment
                <span className="tabular-nums text-subtle">· {row.count}</span>
              </span>
              <span className="h-[9px] overflow-hidden rounded-full bg-surface-3 max-[1200px]:col-span-2 max-[1200px]:row-start-2">
                <span className="block h-full rounded-full" style={{ width: `${((row.amounts.PHP ?? 0) / max) * 100}%`, background: colors[row.source] }} />
              </span>
              <span className="text-right text-[13.5px] font-bold leading-tight tabular-nums max-[1200px]:col-start-2 max-[1200px]:row-start-1">
                {moneyParts(row.amounts).map((part) => (
                  <span key={part} className="block whitespace-nowrap">{part}</span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-2">
        {canSend && (
          <Btn variant="primary" onClick={() => overlays.openPaymentLinks()}>
            <I.send size={15} /> Log payment links
          </Btn>
        )}
        <Btn onClick={() => setScreen("payments")}>View breakdown</Btn>
      </div>
    </div>
  );
}

/* ---------- Queue tables ---------- */
function ApplicationsCard({ setScreen, rows, count }: Nav & { rows: Application[]; count: number }) {
  return (
    <QueueCard
      icon={I.fileText}
      title="Applications requiring action"
      count={count}
      screen="applications"
      setScreen={setScreen}
      rows={rows}
      slice={6}
      empty="No applications need action right now."
      defaultSort={{ key: "createdAt", dir: "desc" }}
      columns={[
        { k: "referenceNo", label: "Application" },
        { k: "clientName", label: "Client" },
        { k: "productName", label: "Product" },
        { k: "status", label: "Status" },
        { k: "dateStarted", label: "Started" },
      ]}
      renderRow={(a) => (
        <>
          <Td><span className="whitespace-nowrap font-mono text-[12px] text-muted-foreground">{a.referenceNo ?? "—"}</span></Td>
          <Td><ClientCell name={a.clientName ?? "—"} sub={a.applicationType} /></Td>
          <Td className="text-muted-foreground">{a.productName ?? "—"}</Td>
          <Td><StatusBadge status={a.status} /></Td>
          <Td className="text-muted-foreground">{fmtDate(a.dateStarted)}</Td>
        </>
      )}
    />
  );
}

function RenewalsCard({ setScreen, rows, count }: Nav & { rows: Renewal[]; count: number }) {
  return (
    <QueueCard
      icon={I.refresh}
      title="Renewals queue"
      count={count}
      screen="renewals"
      setScreen={setScreen}
      rows={rows}
      slice={6}
      empty="No renewals in the queue."
      defaultSort={{ key: "renewalDueDate", dir: "asc" }}
      columns={[
        { k: "clientName", label: "Client" },
        { k: "policyRef", label: "Policy" },
        { k: "renewalDueDate", label: "Renewal date" },
        { k: "status", label: "Status" },
        { k: "premiumAmount", label: "Premium", num: true },
      ]}
      renderRow={(r) => (
        <>
          <Td><ClientCell name={r.clientName ?? "—"} sub={r.policyNumber ?? undefined} /></Td>
          <Td className="text-muted-foreground">{r.policyRef ?? "—"}</Td>
          <Td>{r.renewalDueDate ? <DueCell days={daysUntil(r.renewalDueDate) ?? 0} label={fmtDate(r.renewalDueDate)} /> : "—"}</Td>
          <Td><StatusBadge status={r.status} /></Td>
          <Td className="text-right font-mono font-semibold tabular-nums">
            {r.premiumAmount != null ? peso(r.premiumAmount) : "—"}
          </Td>
        </>
      )}
    />
  );
}

function ClaimsCard({ setScreen, rows, count }: Nav & { rows: Claim[]; count: number }) {
  return (
    <QueueCard
      icon={I.clipboard}
      title="Claims requiring action"
      count={count}
      screen="claims"
      setScreen={setScreen}
      rows={rows}
      slice={5}
      empty="No claims need action right now."
      defaultSort={{ key: "updatedAt", dir: "desc" }}
      columns={[
        { k: "referenceNo", label: "Claim" },
        { k: "clientName", label: "Client" },
        { k: "status", label: "Status" },
      ]}
      renderRow={(c) => (
        <>
          <Td><span className="whitespace-nowrap font-mono text-[12px] text-muted-foreground">{c.referenceNo ?? "—"}</span></Td>
          <Td><ClientCell name={c.clientName ?? "—"} sub={c.claimType ?? undefined} /></Td>
          <Td><StatusBadge status={c.status} /></Td>
        </>
      )}
    />
  );
}

function TravelCard({ setScreen, rows, count }: Nav & { rows: TravelRequest[]; count: number }) {
  return (
    <QueueCard
      icon={I.plane}
      title="Travel insurance queue"
      count={count}
      screen="travel"
      setScreen={setScreen}
      rows={rows}
      slice={5}
      empty="No travel requests in the queue."
      defaultSort={{ key: "departureDate", dir: "asc" }}
      columns={[
        { k: "clientName", label: "Client" },
        { k: "destination", label: "Destination" },
        { k: "status", label: "Status" },
      ]}
      renderRow={(t) => (
        <>
          <Td><ClientCell name={t.clientName ?? "—"} sub={fmtDate(t.departureDate)} /></Td>
          <Td className="font-[550]">{t.destination ?? "—"}</Td>
          <Td><StatusBadge status={t.status} /></Td>
        </>
      )}
    />
  );
}

/* ---------- Rail widgets ---------- */
function TasksWidget({ tasks }: { tasks: RealTask[] }) {
  const overlays = useOverlays();
  const setScreen = useScreenNav();
  const [, startTransition] = useTransition();
  const persona = usePersona();
  const [draftId, setDraftId] = useState<string | null>(null);

  /**
   * Ticking a box is a local, reversible edit, so it paints immediately and the
   * server catches up. `toggleTaskAction` already revalidates /dashboard, so no
   * router.refresh() is needed — the optimistic value holds until that fresh
   * data arrives, then React drops it. If the action fails the optimistic edit
   * is discarded the same way and the row snaps back, with a toast to say why.
   */
  const [shownTasks, toggleOptimistic] = useOptimistic(tasks, (state: RealTask[], id: string) =>
    state.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
  );

  const toggle = (t: RealTask) =>
    startTransition(async () => {
      toggleOptimistic(t.id);
      try {
        const res = await toggleTaskAction(t.id);
        if (!res.ok) overlays.toast("Couldn’t update task", res.error);
      } catch {
        // The action only returns { ok: false } for errors it reaches the server
        // to discover. A dropped connection rejects instead, and an unhandled
        // rejection here would escape the transition and take the widget down.
        overlays.toast("Couldn’t update task", "Check your connection and try again.");
      }
    });

  const groups: { key: TaskBucket; overdue: boolean }[] = [
    { key: "overdue", overdue: true },
    { key: "today", overdue: false },
    { key: "week", overdue: false },
  ];
  const remaining = shownTasks.filter((t) => !t.done).length;
  return (
    <Card>
      <CardHead
        icon={I.checkSquare}
        title="My tasks"
        count={remaining}
        action={
          <div className="flex items-center gap-2">
            <CardLink onClick={() => overlays.openAddTask()}>
              <I.plus size={13} /> New
            </CardLink>
            <CardLink onClick={() => setScreen("tasks")}>
              Open board <I.chevRight size={13} />
            </CardLink>
          </div>
        }
      />
      <div className="py-1">
        {shownTasks.length === 0 && (
          <div className="px-[18px] py-3 text-[12.5px] text-subtle">
            No tasks yet — create one with “+ New”.
          </div>
        )}
        {groups.map((g) => {
          const items = shownTasks.filter((t) => taskBucket(t.dueDate).bucket === g.key);
          if (!items.length) return null;
          return (
            <div key={g.key} className="py-1">
              <div className={cn(
                "flex items-center gap-1.5 px-[18px] pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.04em]",
                g.overdue ? "text-red" : "text-subtle",
              )}>
                {g.overdue && <I.alertTri size={13} />}
                {BUCKET_LABEL[g.key]}
                <span className="text-faint">· {items.filter((t) => !t.done).length}</span>
              </div>
              {items.map((t) => (
                <div key={t.id}>
                <button
                  onClick={() => toggle(t)}
                  className="flex w-full items-start gap-[11px] px-[18px] py-2 text-left transition-colors hover:bg-hover"
                >
                  <span className={cn(
                    "mt-px grid size-[18px] shrink-0 place-items-center rounded-md border-[1.6px] transition-colors",
                    t.done ? "border-brand bg-brand text-white" : "border-border-strong text-transparent",
                  )}>
                    {t.done && <I.check size={13} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[13px] font-[550] leading-snug", t.done && "text-subtle line-through")}>
                      {t.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-subtle">
                      <span className={cn("rounded-[5px] bg-surface-3 px-1.5 py-px text-[11px] font-[650]", TAG_TONE[t.tag] ?? "text-slate")}>
                        {t.tag}
                      </span>
                      {taskBucket(t.dueDate).meta}
                    </span>
                  </span>
                </button>
                {persona.role !== "agent" && t.renewalDraftId && (
                  <div className="px-[18px] pb-2 pl-[47px]">
                    <Btn size="sm" variant="primary" onClick={() => setDraftId(t.renewalDraftId)}>
                      {t.renewalDraftStatus === "Draft" ? "Open draft" : "View draft"}
                    </Btn>
                  </div>
                )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {persona.role !== "agent" && draftId && (
        <RenewalEmailDraftModal key={draftId} draftId={draftId} onClose={() => setDraftId(null)} />
      )}
    </Card>
  );
}

/** activity_type prefix → feed icon/tone for the activity widget. */
const ACT_META: Record<string, { icon: IconName; tone: Tone }> = {
  policy: { icon: "shield", tone: "green" },
  payment: { icon: "peso", tone: "green" },
  claim: { icon: "clipboard", tone: "red" },
  travel: { icon: "plane", tone: "blue" },
  document: { icon: "upload", tone: "slate" },
  renewal: { icon: "refresh", tone: "amber" },
  client: { icon: "user", tone: "violet" },
  lead: { icon: "trendUp", tone: "violet" },
  application: { icon: "fileText", tone: "blue" },
  group: { icon: "building", tone: "blue" },
  task: { icon: "checkSquare", tone: "slate" },
  campaign: { icon: "send", tone: "violet" },
  contact: { icon: "user", tone: "slate" },
  dependent: { icon: "users", tone: "slate" },
};

function ActivityWidget({ stats }: { stats: DashboardStats }) {
  return (
    <Card>
      <CardHead icon={I.clock} title="Recent activity" />
      <div className="py-1.5">
        {stats.activity.length === 0 && (
          <div className="px-[18px] py-3 text-[12.5px] text-subtle">No activity yet.</div>
        )}
        {stats.activity.map((a, idx) => {
          const meta = ACT_META[a.type.split(".")[0]] ?? { icon: "clock" as IconName, tone: "slate" as Tone };
          const Ico = I[meta.icon];
          return (
          <div key={a.id} className="relative flex gap-3 px-[18px] py-2.5">
            <div className="relative flex shrink-0 flex-col items-center">
              <div className={cn("z-10 grid size-[28px] place-items-center rounded-lg", TONE_SOFT[meta.tone])}>
                <Ico size={14} />
              </div>
              {idx < stats.activity.length - 1 && (
                <div className="absolute -bottom-[18px] left-1/2 top-[28px] w-0.5 -translate-x-1/2 bg-border" />
              )}
            </div>
            <div className="flex-1 pb-1.5 pt-0.5">
              <div className="text-[13px] leading-snug">
                {a.actorName && <b className="font-[650]">{a.actorName} </b>}
                {a.summary}
              </div>
              <div className="mt-0.5 text-[11.5px] text-subtle">{a.when}</div>
            </div>
          </div>
          );
        })}
      </div>
    </Card>
  );
}

function RelationshipWidget({ touchpoints }: { touchpoints: TouchpointRow[] }) {
  const setScreen = useScreenNav();
  const { openContact } = useRecordNav();
  const tone: Record<string, Tone> = { birthday: "violet", anniversary: "green", renurture: "amber" };
  const ico: Record<string, IconName> = { birthday: "cake", anniversary: "award", renurture: "refresh" };
  const top = touchpoints.slice(0, 6);
  return (
    <Card>
      <CardHead
        icon={I.heart}
        title="Relationship management"
        action={<CardLink onClick={() => setScreen("relationship")}>View all <I.chevRight size={13} /></CardLink>}
      />
      <div>
        {top.length === 0 && (
          <div className="px-[18px] py-3 text-[12.5px] text-subtle">No touchpoints coming up.</div>
        )}
        {top.map((r) => {
          const Ico = I[ico[r.type]];
          return (
            <button
              key={r.clientId + r.type}
              onClick={() => openContact(r.clientId)}
              className="flex w-full items-center gap-3 border-b border-border-soft px-[18px] py-[11px] text-left transition-colors last:border-b-0 hover:bg-hover"
            >
              <div className={cn("grid size-[34px] shrink-0 place-items-center rounded-[9px]", TONE_SOFT[tone[r.type]])}>
                <Ico size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">{r.name}</div>
                <div className="mt-px text-[11.5px] text-muted-foreground">{r.sub}</div>
              </div>
              <span className={cn(
                "whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-bold",
                r.daysUntil <= 7 ? "bg-amber-soft text-amber" : "bg-surface-3 text-muted-foreground",
              )}>
                {r.when}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- Export ---------- */

const EXPORT_OPTIONS = [
  { format: "xlsx", label: "Excel workbook", ext: ".xlsx" },
  { format: "ods", label: "OpenDocument", ext: ".ods" },
  { format: "csv", label: "Summary CSV", ext: ".csv" },
] as const;

/**
 * Export menu. Each item is a plain anchor to the export route rather than a
 * fetch + Blob: the route already answers with `Content-Disposition:
 * attachment`, so the browser downloads it without leaving the page, the
 * session cookie rides along automatically, nothing is buffered in JS memory,
 * and right-click / middle-click keep working.
 */
function ExportMenu() {
  const overlays = useOverlays();
  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <Btn>
            <I.download size={15} /> Export
          </Btn>
        }
      />
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50 outline-none">
          <Popover.Popup className="w-[260px] max-w-[calc(100vw-24px)] overflow-hidden rounded-lg border border-border bg-card shadow-pop outline-none">
            <Popover.Title className="border-b border-border-soft px-4 py-3 text-[13.5px] font-bold">
              Export dashboard
            </Popover.Title>
            <div className="p-1.5">
              {EXPORT_OPTIONS.map((o) => (
                <a
                  key={o.format}
                  href={`/api/dashboard/export?format=${o.format}`}
                  download
                  onClick={() =>
                    overlays.toast("Preparing export", `Your ${o.ext} download will start shortly.`)
                  }
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
                >
                  <I.download size={15} className="shrink-0 text-subtle" />
                  <span className="min-w-0 text-[13px] font-[550]">
                    {o.label} <span className="font-mono text-[11.5px] text-subtle">{o.ext}</span>
                  </span>
                </a>
              ))}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * The export route answers with a file, so it has no way to surface an error as
 * a toast — on failure it redirects back here with `?exportError=1`, which this
 * turns into one and then clears from the URL.
 */
function useExportErrorToast() {
  const params = useSearchParams();
  const router = useRouter();
  const overlays = useOverlays();
  const failed = params.get("exportError") === "1";
  useEffect(() => {
    if (!failed) return;
    overlays.toast("Export failed", "We couldn't build the file. Please try again.");
    router.replace("/dashboard");
  }, [failed, overlays, router]);
}

/* ---------- Assembly ---------- */

/**
 * Greeting + date, both pinned to Asia/Manila. The brokerage works one timezone,
 * and pinning it also keeps the server render and the client hydration agreeing
 * on the same day and hour regardless of where the server runs.
 */
function manilaHeading() {
  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("en-PH", {
      timeZone: MANILA,
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  return {
    greeting: hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening",
    dateStr: now.toLocaleDateString("en-PH", {
      timeZone: MANILA,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
}
const MANILA = "Asia/Manila";

export function Dashboard({
  stats,
  queues,
  tasks = [],
  touchpoints = [],
}: {
  stats: DashboardStats;
  queues: DashboardQueues;
  tasks?: RealTask[];
  touchpoints?: TouchpointRow[];
}) {
  const setScreen = useScreenNav();
  const persona = usePersona();
  useExportErrorToast();
  const { greeting, dateStr } = manilaHeading();
  return (
    <div>
      <PageHead
        title={`${greeting}, ${persona.userName.split(" ")[0]}`}
        /* One expression, not `{dateStr} · text`: the React Compiler's SSR output
           drops the leading space of a text node that follows an expression,
           which hydration then rejects. */
        sub={`${dateStr} · Here’s what needs your attention today.`}
        actions={persona.can("dashboard", "export") ? <ExportMenu /> : undefined}
      />

      <GlanceCard setScreen={setScreen} stats={stats} />
      <RevenueWidget setScreen={setScreen} stats={stats} />

      <div className="grid grid-cols-12 gap-4 max-[1200px]:grid-cols-1">
        <div className="col-span-8 flex flex-col gap-4 max-[1200px]:col-span-1">
          <ApplicationsCard setScreen={setScreen} rows={queues.applications} count={stats.kpis.applicationsInProgress} />
          <RenewalsCard setScreen={setScreen} rows={queues.renewals} count={stats.kpis.upcomingRenewals} />
          {/* Side by side only on a genuinely wide monitor: below that the pair
              cannot fit client + status without clipping the status column, which
              is the one cell these queues exist to show. */}
          <div className="grid grid-cols-1 gap-4 min-[1700px]:grid-cols-2">
            <ClaimsCard setScreen={setScreen} rows={queues.claims} count={stats.kpis.openClaims} />
            <TravelCard setScreen={setScreen} rows={queues.travel} count={stats.kpis.openTravel} />
          </div>
        </div>
        <div className="col-span-4 flex flex-col gap-4 max-[1200px]:col-span-1">
          <TasksWidget tasks={tasks} />
          <RelationshipWidget touchpoints={touchpoints} />
          <ActivityWidget stats={stats} />
        </div>
      </div>
    </div>
  );
}
