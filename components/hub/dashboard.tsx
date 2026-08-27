"use client";

import { Popover } from "@base-ui/react/popover";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useTransition } from "react";

import { toggleTaskAction } from "@/app/(app)/tasks/actions";
import type { DashboardStats, KpiTrend } from "@/lib/queries/dashboard";
import type { TouchpointRow } from "@/lib/queries/relationship";
import type { Application } from "@/lib/repositories/applications/application.entity";
import type { Claim } from "@/lib/repositories/claims/claim.entity";
import type { Renewal } from "@/lib/repositories/renewals/renewal.entity";
import type { Task as RealTask } from "@/lib/repositories/tasks/task.entity";
import type { TravelRequest } from "@/lib/repositories/travel/travel-request.entity";
import { cn } from "@/lib/utils";
import { fmtDate, peso } from "@/lib/format";
import type { Tone } from "./tone";
import { I, type IconName } from "./icons";
import { useOverlays } from "./overlays/overlay-provider";
import { usePersona } from "./persona";
import {
  Btn, Card, CardHead, CardLink, DueCell, Sparkline, StatusBadge,
  TONE_ALERT, TONE_SOFT, TONE_SOLID, TONE_TEXT,
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


/* ---------- Alert bar ---------- */
function AlertBar({ setScreen, stats }: Nav & { stats: DashboardStats }) {
  const alerts: { id: ScreenId; color: Tone; icon: IconName; num: number; label: string }[] = [
    { id: "renewals", color: "amber", icon: "refresh", num: stats.alerts.renewalsDue30, label: "Renewals due within 30 days" },
    { id: "claims", color: "red", icon: "fileMissing", num: stats.alerts.claimsAwaitingDocs, label: "Claims awaiting documents" },
    { id: "travel", color: "blue", icon: "wallet", num: stats.alerts.travelAwaitingPayment, label: "Travel requests awaiting payment" },
    { id: "applications", color: "violet", icon: "alertTri", num: stats.alerts.appsMissingRequirements, label: "Applications missing requirements" },
  ];
  return (
    <div className="mb-[18px] grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2">
      {alerts.map((a) => {
        const Ico = I[a.icon];
        return (
          <button
            key={a.id}
            onClick={() => setScreen(a.id)}
            className={cn(
              "group flex items-center gap-[13px] rounded-md border p-[13px] text-left transition-all hover:-translate-y-px hover:shadow-md",
              TONE_ALERT[a.color],
            )}
          >
            <span className={cn("grid size-[38px] shrink-0 place-items-center rounded-[9px]", TONE_SOLID[a.color])}>
              <Ico size={20} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={cn("text-[19px] font-[750] leading-[1.1] tracking-[-0.02em] tabular-nums", TONE_TEXT[a.color])}>
                {a.num}
              </span>
              <span className="mt-px text-[12px] font-[550] text-muted-foreground">{a.label}</span>
            </span>
            <I.arrowRight size={17} className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
          </button>
        );
      })}
    </div>
  );
}

/* ---------- KPI row ---------- */
function KpiRow({ setScreen, stats }: Nav & { stats: DashboardStats }) {
  const kpis: { id: ScreenId; icon: IconName; value: number; label: string; trend: KpiTrend }[] = [
    { id: "clients", icon: "users", value: stats.kpis.activeClients, label: "Active Clients", trend: stats.trends.activeClients },
    { id: "policies", icon: "shield", value: stats.kpis.activePolicies, label: "Active Policies", trend: stats.trends.activePolicies },
    { id: "applications", icon: "fileText", value: stats.kpis.applicationsInProgress, label: "Applications In Progress", trend: stats.trends.applicationsInProgress },
    { id: "claims", icon: "clipboard", value: stats.kpis.openClaims, label: "Open Claims", trend: stats.trends.openClaims },
    { id: "renewals", icon: "refresh", value: stats.kpis.upcomingRenewals, label: "Upcoming Renewals", trend: stats.trends.upcomingRenewals },
    { id: "travel", icon: "plane", value: stats.kpis.openTravel, label: "Open Travel Requests", trend: stats.trends.openTravel },
  ];
  const dirIco: Record<KpiTrend["dir"], IconName> = { up: "arrowUp", down: "arrowDown", flat: "arrowRight" };
  return (
    <div className="mb-4 grid grid-cols-6 gap-3.5 max-[1200px]:grid-cols-3">
      {kpis.map((k) => {
        const Ico = I[k.icon];
        const DirIco = I[dirIco[k.trend.dir]];
        const sparkColor = k.trend.dir === "down" ? "var(--red)" : k.trend.dir === "flat" ? "var(--text-subtle)" : "var(--brand)";
        return (
          <button
            key={k.id}
            onClick={() => setScreen(k.id)}
            className="overflow-hidden rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-px hover:border-border-strong hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="grid size-[30px] place-items-center rounded-lg bg-brand-soft text-brand-hover">
                <Ico size={17} />
              </span>
              <span
                title="New records this month vs last"
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums",
                  k.trend.dir === "up" ? "bg-green-soft text-green" : k.trend.dir === "down" ? "bg-red-soft text-red" : "bg-surface-3 text-subtle",
                )}
              >
                <DirIco size={12} /> {k.trend.delta}
              </span>
            </div>
            <div className="mt-3 text-[27px] font-[760] leading-none tracking-[-0.03em] tabular-nums">{k.value}</div>
            <div className="mt-1.5 text-[12.5px] font-[550] text-muted-foreground">{k.label}</div>
            <div className="mt-2.5">
              <Sparkline data={k.trend.spark} color={sparkColor} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Revenue widget ---------- */
function RevenueWidget({ setScreen, stats }: Nav & { stats: DashboardStats }) {
  const overlays = useOverlays();
  const persona = usePersona();
  const rows = stats.revenue.rows;
  const max = Math.max(...rows.map((r) => r.amount), 1);
  const items = rows.reduce((a, r) => a + r.count, 0);
  const colors: Record<string, string> = { Applications: "#059669", Renewals: "#2563eb", Travel: "#d97706" };
  const icons: Record<string, IconName> = { Applications: "fileText", Renewals: "refresh", Travel: "plane" };
  const canSend = persona.role !== "agent"; // Admin & Staff only (§12)

  return (
    <div className="mb-4 grid grid-cols-[1.1fr_2.4fr_auto] items-center gap-7 rounded-lg border border-border bg-card p-5 shadow-sm max-[1200px]:grid-cols-1">
      <div>
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-muted-foreground">
          <I.wallet size={15} /> Revenue opportunity awaiting collection
        </div>
        <div className="mt-1.5 text-[33px] font-[780] leading-none tracking-[-0.035em] tabular-nums">
          {peso(stats.revenue.total)}
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[12px] text-subtle">
          <I.trendUp size={13} className="text-brand" /> {items} items across 3 pipelines
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => {
          const Ico = I[icons[row.source]];
          return (
            <div key={row.source} className="grid grid-cols-[220px_1fr_110px] items-center gap-3.5 max-[1200px]:grid-cols-[150px_1fr_90px]">
              <span className="flex items-center gap-2 text-[12.5px] font-[550] text-muted-foreground">
                <Ico size={15} style={{ color: colors[row.source] }} />
                {row.source} awaiting payment
                <span className="tabular-nums text-subtle">· {row.count}</span>
              </span>
              <span className="h-[9px] overflow-hidden rounded-full bg-surface-3">
                <span className="block h-full rounded-full" style={{ width: `${(row.amount / max) * 100}%`, background: colors[row.source] }} />
              </span>
              <span className="text-right text-[13.5px] font-bold tabular-nums">{peso(row.amount)}</span>
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
          <Td><span className="font-mono text-[12px] text-muted-foreground">{a.referenceNo ?? "—"}</span></Td>
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
      defaultSort={{ key: "updatedAt", dir: "desc" }}
      columns={[
        { k: "referenceNo", label: "Claim" },
        { k: "clientName", label: "Client" },
        { k: "status", label: "Status" },
      ]}
      renderRow={(c) => (
        <>
          <Td><span className="font-mono text-[12px] text-muted-foreground">{c.referenceNo ?? "—"}</span></Td>
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
  const router = useRouter();
  const overlays = useOverlays();
  const setScreen = useScreenNav();
  const [, startTransition] = useTransition();

  const toggle = (t: RealTask) =>
    startTransition(async () => {
      const res = await toggleTaskAction(t.id);
      if (!res.ok) overlays.toast("Couldn’t update task", res.error);
      router.refresh();
    });

  const groups: { key: TaskBucket; overdue: boolean }[] = [
    { key: "overdue", overdue: true },
    { key: "today", overdue: false },
    { key: "week", overdue: false },
  ];
  const remaining = tasks.filter((t) => !t.done).length;
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
        {tasks.length === 0 && (
          <div className="px-[18px] py-3 text-[12.5px] text-subtle">
            No tasks yet — create one with “+ New”.
          </div>
        )}
        {groups.map((g) => {
          const items = tasks.filter((t) => taskBucket(t.dueDate).bucket === g.key);
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
                <button
                  key={t.id}
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
                      <span className={cn("rounded-[5px] bg-surface-3 px-1.5 py-px text-[10.5px] font-[650]", TAG_TONE[t.tag] ?? "text-slate")}>
                        {t.tag}
                      </span>
                      {taskBucket(t.dueDate).meta}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
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
  { format: "xlsx", label: "Excel workbook", ext: ".xlsx", sub: "All sheets, formatted" },
  { format: "ods", label: "OpenDocument", ext: ".ods", sub: "All sheets, for LibreOffice" },
  { format: "csv", label: "Summary CSV", ext: ".csv", sub: "Headline figures only" },
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
                  <span className="min-w-0">
                    <span className="block text-[13px] font-[550]">
                      {o.label} <span className="font-mono text-[11.5px] text-subtle">{o.ext}</span>
                    </span>
                    <span className="block text-[11.5px] text-faint">{o.sub}</span>
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
  const dateStr = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div>
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[23px] font-bold tracking-[-0.025em]">
            Good morning, {persona.userName.split(" ")[0]}
          </h1>
          <p className="mt-[3px] text-[13.5px] text-muted-foreground">
            {dateStr} · Here&apos;s what needs your attention today.
          </p>
        </div>
        {persona.can("dashboard", "export") && (
          <div className="flex items-center gap-2.5 max-[900px]:hidden">
            <ExportMenu />
          </div>
        )}
      </div>

      <AlertBar setScreen={setScreen} stats={stats} />
      <KpiRow setScreen={setScreen} stats={stats} />
      <RevenueWidget setScreen={setScreen} stats={stats} />

      <div className="grid grid-cols-12 gap-4 max-[1200px]:grid-cols-1">
        <div className="col-span-8 flex flex-col gap-4 max-[1200px]:col-span-1">
          <ApplicationsCard setScreen={setScreen} rows={queues.applications} count={stats.kpis.applicationsInProgress} />
          <RenewalsCard setScreen={setScreen} rows={queues.renewals} count={stats.kpis.upcomingRenewals} />
          <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
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
