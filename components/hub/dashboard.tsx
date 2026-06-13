"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  ACTIVITY, ALERTS, APPLICATIONS, CLAIMS, KPIS, RELATIONSHIPS, RENEWALS,
  REVENUE, STAFF, TASKS, TRAVEL, peso, type Task, type Tone,
} from "./data";
import { I } from "./icons";
import {
  Avatar, Btn, Card, CardHead, CardLink, DueCell, Sparkline, StatusBadge,
  TONE_ALERT, TONE_SOFT, TONE_SOLID, TONE_TEXT,
} from "./primitives";
import { ClientCell, Row, Table, Td, Th, useSort } from "./table";
import type { ScreenId } from "./shell";

type Nav = { setScreen: (s: ScreenId) => void };

const DATE_STR = "Wednesday, June 10, 2026";

/* ---------- Alert bar ---------- */
function AlertBar({ setScreen }: Nav) {
  return (
    <div className="mb-[18px] grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2">
      {ALERTS.map((a) => {
        const Ico = I[a.icon];
        return (
          <button
            key={a.id}
            onClick={() => setScreen(a.id as ScreenId)}
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
function KpiRow({ setScreen }: Nav) {
  return (
    <div className="mb-4 grid grid-cols-6 gap-3.5 max-[1200px]:grid-cols-3">
      {KPIS.map((k) => {
        const Ico = I[k.icon];
        const sparkColor =
          k.dir === "down" ? "var(--red)" : k.dir === "flat" ? "var(--text-subtle)" : "var(--brand)";
        const DeltaIco = k.dir === "up" ? I.arrowUp : k.dir === "down" ? I.arrowDown : I.arrowRight;
        const deltaCls = k.dir === "up" ? "text-green" : k.dir === "down" ? "text-red" : "text-subtle";
        return (
          <button
            key={k.id}
            onClick={() => setScreen(k.id as ScreenId)}
            className="overflow-hidden rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-px hover:border-border-strong hover:shadow-md"
          >
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
            <div className="mt-2.5 h-[26px]">
              <Sparkline data={k.spark} color={sparkColor} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Revenue widget ---------- */
function RevenueWidget() {
  const max = Math.max(...REVENUE.rows.map((r) => r.value));
  return (
    <div className="mb-4 grid grid-cols-[1.1fr_2.4fr_auto] items-center gap-7 rounded-lg border border-border bg-card p-5 shadow-sm max-[1200px]:grid-cols-1">
      <div>
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-muted-foreground">
          <I.wallet size={15} /> Revenue opportunity awaiting collection
        </div>
        <div className="mt-1.5 text-[33px] font-[780] leading-none tracking-[-0.035em] tabular-nums">
          {peso(REVENUE.total)}
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[12px] text-subtle">
          <I.trendUp size={13} className="text-brand" /> 42 items across 3 pipelines · updated 5m ago
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {REVENUE.rows.map((row, i) => {
          const Ico = I[row.icon];
          return (
            <div
              key={i}
              className="grid grid-cols-[200px_1fr_110px] items-center gap-3.5 max-[1200px]:grid-cols-[140px_1fr_90px]"
            >
              <span className="flex items-center gap-2 text-[12.5px] font-[550] text-muted-foreground">
                <Ico size={15} style={{ color: row.color }} />
                {row.label}
              </span>
              <span className="h-[9px] overflow-hidden rounded-full bg-surface-3">
                <span className="block h-full rounded-full" style={{ width: `${(row.value / max) * 100}%`, background: row.color }} />
              </span>
              <span className="text-right text-[13.5px] font-bold tabular-nums">{peso(row.value)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-2">
        <Btn variant="primary"><I.send size={15} /> Send payment links</Btn>
        <Btn>View breakdown</Btn>
      </div>
    </div>
  );
}

/* ---------- Tables ---------- */
function ApplicationsCard({ setScreen }: Nav) {
  const { sorted, sort, toggle } = useSort(APPLICATIONS, "due");
  return (
    <Card>
      <CardHead
        icon={I.fileText}
        title="Applications requiring action"
        count={APPLICATIONS.length}
        action={<CardLink onClick={() => setScreen("applications")}>View all <I.chevRight size={13} /></CardLink>}
      />
      <Table>
        <thead>
          <tr>
            <Th label="Application" k="id" sort={sort} toggle={toggle} />
            <Th label="Client" k="client" sort={sort} toggle={toggle} />
            <Th label="Product" k="product" sort={sort} toggle={toggle} />
            <Th label="Status" k="status" sort={sort} toggle={toggle} />
            <Th label="Staff" k="staff" sort={sort} toggle={toggle} />
            <Th label="Due" k="due" sort={sort} toggle={toggle} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => (
            <Row key={a.id} onClick={() => setScreen("applications")}>
              <Td><span className="font-mono text-[12px] text-muted-foreground">{a.id}</span></Td>
              <Td><ClientCell name={a.client} sub={a.city} /></Td>
              <Td className="text-muted-foreground">{a.product}</Td>
              <Td><StatusBadge status={a.status} /></Td>
              <Td>
                <div className="flex items-center gap-2.5">
                  <Avatar name={STAFF[a.staff].name} size={24} />
                  <span className="text-[12.5px] text-muted-foreground">{STAFF[a.staff].name.split(" ")[0]}</span>
                </div>
              </Td>
              <Td><DueCell days={a.due} /></Td>
            </Row>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function RenewalsCard({ setScreen }: Nav) {
  const { sorted, sort, toggle } = useSort(RENEWALS, "due");
  return (
    <Card>
      <CardHead
        icon={I.refresh}
        title="Renewals queue"
        count={RENEWALS.length}
        action={<CardLink onClick={() => setScreen("renewals")}>View all <I.chevRight size={13} /></CardLink>}
      />
      <Table>
        <thead>
          <tr>
            <Th label="Client" k="client" sort={sort} toggle={toggle} />
            <Th label="Policy" k="policy" sort={sort} toggle={toggle} />
            <Th label="Renewal date" k="due" sort={sort} toggle={toggle} />
            <Th label="Status" k="status" sort={sort} toggle={toggle} />
            <Th label="Premium" k="amount" sort={sort} toggle={toggle} num />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <Row key={r.id} onClick={() => setScreen("renewals")}>
              <Td><ClientCell name={r.client} sub={r.city} /></Td>
              <Td className="text-muted-foreground">{r.policy}</Td>
              <Td><DueCell days={r.due} label={r.date} /></Td>
              <Td><StatusBadge status={r.status} /></Td>
              <Td className="text-right font-mono font-semibold tabular-nums">{peso(r.amount)}</Td>
            </Row>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function ClaimsCard({ setScreen }: Nav) {
  const { sorted, sort, toggle } = useSort(CLAIMS, "updated");
  return (
    <Card>
      <CardHead
        icon={I.clipboard}
        title="Claims requiring action"
        count={CLAIMS.length}
        action={<CardLink onClick={() => setScreen("claims")}>View all <I.chevRight size={13} /></CardLink>}
      />
      <Table>
        <thead>
          <tr>
            <Th label="Claim" k="id" sort={sort} toggle={toggle} />
            <Th label="Client" k="client" sort={sort} toggle={toggle} />
            <Th label="Status" k="status" sort={sort} toggle={toggle} />
            <Th label="Updated" k="updated" sort={sort} toggle={toggle} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <Row key={c.id} onClick={() => setScreen("claims")}>
              <Td><span className="font-mono text-[12px] text-muted-foreground">{c.id}</span></Td>
              <Td><ClientCell name={c.client} sub={c.policy} /></Td>
              <Td><StatusBadge status={c.status} /></Td>
              <Td className="text-muted-foreground">{c.updated}</Td>
            </Row>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function TravelCard({ setScreen }: Nav) {
  const { sorted, sort, toggle } = useSort(TRAVEL, "status");
  return (
    <Card>
      <CardHead
        icon={I.plane}
        title="Travel insurance queue"
        count={TRAVEL.length}
        action={<CardLink onClick={() => setScreen("travel")}>View all <I.chevRight size={13} /></CardLink>}
      />
      <Table>
        <thead>
          <tr>
            <Th label="Travel no." k="id" sort={sort} toggle={toggle} />
            <Th label="Client" k="client" sort={sort} toggle={toggle} />
            <Th label="Destination" k="dest" sort={sort} toggle={toggle} />
            <Th label="Status" k="status" sort={sort} toggle={toggle} />
            <Th label="Next step" k="next" sort={sort} toggle={toggle} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <Row key={t.id} onClick={() => setScreen("travel")}>
              <Td><span className="font-mono text-[12px] text-muted-foreground">{t.id}</span></Td>
              <Td><ClientCell name={t.client} sub={t.date} /></Td>
              <Td className="font-[550]">{t.flag} {t.dest}</Td>
              <Td><StatusBadge status={t.status} /></Td>
              <Td className="text-muted-foreground">{t.next}</Td>
            </Row>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

/* ---------- Rail widgets ---------- */
const TASK_TONE: Record<Task["tag"], Tone> = {
  Application: "blue",
  Documents: "amber",
  Renewal: "violet",
  Travel: "blue",
  Claim: "red",
  Relationship: "green",
};

function TasksWidget() {
  const [tasks, setTasks] = useState(TASKS);
  const toggle = (id: number) =>
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const groups = [
    { key: "overdue", label: "Overdue", overdue: true },
    { key: "today", label: "Due today", overdue: false },
    { key: "week", label: "Due this week", overdue: false },
  ] as const;
  const remaining = tasks.filter((t) => !t.done).length;
  return (
    <Card>
      <CardHead
        icon={I.checkSquare}
        title="My tasks"
        count={remaining}
        action={<CardLink>Open board <I.chevRight size={13} /></CardLink>}
      />
      <div className="py-1">
        {groups.map((g) => {
          const items = tasks.filter((t) => t.group === g.key);
          if (!items.length) return null;
          return (
            <div key={g.key} className="py-1">
              <div className={cn(
                "flex items-center gap-1.5 px-[18px] pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.04em]",
                g.overdue ? "text-red" : "text-subtle",
              )}>
                {g.overdue && <I.alertTri size={13} />}
                {g.label}
                <span className="text-faint">· {items.filter((t) => !t.done).length}</span>
              </div>
              {items.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggle(t.id)}
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
                      <span className={cn("rounded-[5px] bg-surface-3 px-1.5 py-px text-[10.5px] font-[650]", TONE_TEXT[TASK_TONE[t.tag]])}>
                        {t.tag}
                      </span>
                      {t.meta}
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

function ActivityWidget() {
  const tone: Record<string, Tone> = {
    policy: "green", payment: "green", claim: "red", travel: "blue", doc: "slate", renewal: "amber", client: "violet",
  };
  const ico = {
    policy: "shield", payment: "peso", claim: "clipboard", travel: "plane", doc: "upload", renewal: "refresh", client: "user",
  } as const;
  return (
    <Card>
      <CardHead icon={I.clock} title="Recent activity" action={<CardLink>View log <I.chevRight size={13} /></CardLink>} />
      <div className="py-1.5">
        {ACTIVITY.map((a, idx) => {
          const Ico = I[ico[a.type]];
          return (
            <div key={a.id} className="relative flex gap-3 px-[18px] py-2.5">
              <div className="relative flex shrink-0 flex-col items-center">
                <div className={cn("z-10 grid size-[30px] place-items-center rounded-lg", TONE_SOFT[tone[a.type]])}>
                  <Ico size={15} />
                </div>
                {idx < ACTIVITY.length - 1 && (
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

function RelationshipWidget() {
  const tone: Record<string, Tone> = { birthday: "violet", anniversary: "green", loyalty: "amber" };
  const ico = { birthday: "cake", anniversary: "award", loyalty: "gift" } as const;
  return (
    <Card>
      <CardHead icon={I.heart} title="Relationship management" action={<CardLink>View all <I.chevRight size={13} /></CardLink>} />
      <div>
        {RELATIONSHIPS.map((r) => {
          const Ico = I[ico[r.type]];
          return (
            <div
              key={r.id}
              className="flex items-center gap-3 border-b border-border-soft px-[18px] py-[11px] transition-colors last:border-b-0 hover:bg-hover"
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
                r.soon ? "bg-amber-soft text-amber" : "bg-surface-3 text-muted-foreground",
              )}>
                {r.when}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- Assembly ---------- */
export function Dashboard({ setScreen }: Nav) {
  return (
    <div>
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[23px] font-bold tracking-[-0.025em]">Good morning, Matt</h1>
          <p className="mt-[3px] text-[13.5px] text-muted-foreground">
            {DATE_STR} · Here&apos;s what needs your attention today.
          </p>
        </div>
        <div className="flex items-center gap-2.5 max-[900px]:hidden">
          <Btn><I.download size={15} /> Export</Btn>
          <Btn variant="primary" onClick={() => setScreen("applications")}>
            <I.plus size={15} /> New application
          </Btn>
        </div>
      </div>

      <AlertBar setScreen={setScreen} />
      <KpiRow setScreen={setScreen} />
      <RevenueWidget />

      <div className="grid grid-cols-12 gap-4 max-[1200px]:grid-cols-1">
        <div className="col-span-8 flex flex-col gap-4 max-[1200px]:col-span-1">
          <ApplicationsCard setScreen={setScreen} />
          <RenewalsCard setScreen={setScreen} />
          <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
            <ClaimsCard setScreen={setScreen} />
            <TravelCard setScreen={setScreen} />
          </div>
        </div>
        <div className="col-span-4 flex flex-col gap-4 max-[1200px]:col-span-1">
          <TasksWidget />
          <RelationshipWidget />
          <ActivityWidget />
        </div>
      </div>
    </div>
  );
}
