"use client";

/**
 * DRAFT — mock UI only.
 * Ported from drafts/src/screens-extra.jsx for prototype review. Tasks + Relationship
 * Management screens; checkbox toggles mutate local state only, and no real data layer
 * or actions are wired up yet.
 */
import { useState } from "react";

import { cn } from "@/lib/utils";
import { RELATIONSHIPS, TASKS, type Task, type Tone } from "../data";
import { I, type IconName } from "../icons";
import { Avatar, Btn, Card, CountPill, PageHead, TONE_SOFT, TONE_TEXT } from "../primitives";

const TASK_TONE: Record<Task["tag"], Tone> = {
  Application: "blue",
  Documents: "amber",
  Renewal: "violet",
  Travel: "blue",
  Claim: "red",
  Relationship: "green",
};

/* ---------- Tasks ---------- */
export function TasksScreen() {
  const [tasks, setTasks] = useState(TASKS);
  const toggle = (id: number) =>
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const cols = [
    { key: "overdue", label: "Overdue", tone: "red" },
    { key: "today", label: "Due today", tone: "amber" },
    { key: "week", label: "Due this week", tone: "blue" },
  ] as const;
  const open = tasks.filter((t) => !t.done).length;

  return (
    <div>
      <PageHead
        icon={I.checkSquare}
        title="Tasks"
        sub={`Your workload across the agency · ${open} open`}
        actions={<Btn variant="primary"><I.plus size={15} /> New task</Btn>}
      />
      <div className="grid grid-cols-3 gap-4 max-[1000px]:grid-cols-1">
        {cols.map((c) => {
          const items = tasks.filter((t) => t.group === c.key);
          return (
            <Card key={c.key} className="self-start">
              <div className="flex items-center gap-2.5 border-b border-border-soft px-[18px] py-[15px]">
                <span className="size-2 rounded-full" style={{ background: `var(--${c.tone})` }} />
                <h3 className="text-[14.5px] font-[650]">{c.label}</h3>
                <CountPill>{items.filter((t) => !t.done).length}</CountPill>
              </div>
              <div className="py-1.5">
                {items.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => toggle(t.id)}
                    className="flex w-full items-start gap-[11px] px-[18px] py-2 text-left transition-colors hover:bg-hover"
                  >
                    <span
                      className={cn(
                        "mt-px grid size-[18px] shrink-0 place-items-center rounded-md border-[1.6px] transition-colors",
                        t.done ? "border-brand bg-brand text-white" : "border-border-strong text-transparent",
                      )}
                    >
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
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Relationship management ---------- */
const REL_ICON: Record<string, IconName> = { birthday: "cake", anniversary: "award", loyalty: "gift" };
const REL_TONE: Record<string, Tone> = { birthday: "violet", anniversary: "green", loyalty: "amber" };

export function RelationshipScreen() {
  const cats = [
    { key: "birthday", title: "Upcoming birthdays" },
    { key: "anniversary", title: "Client anniversaries" },
    { key: "loyalty", title: "Loyalty activities due" },
  ] as const;

  return (
    <div>
      <PageHead
        icon={I.heart}
        title="Relationship Management"
        sub="Nurture client loyalty with timely, personal touchpoints"
        actions={<Btn variant="primary"><I.send size={15} /> New campaign</Btn>}
      />
      <div className="grid grid-cols-3 gap-4 max-[1000px]:grid-cols-1">
        {cats.map((cat) => {
          const items = RELATIONSHIPS.filter((r) => r.type === cat.key);
          const Ico = I[REL_ICON[cat.key]];
          return (
            <Card key={cat.key} className="flex flex-col self-start">
              <div className="flex items-center gap-2.5 border-b border-border-soft px-[18px] py-[15px]">
                <span className={cn("grid size-7 place-items-center rounded-lg", TONE_SOFT[REL_TONE[cat.key]])}>
                  <Ico size={15} />
                </span>
                <h3 className="text-[14.5px] font-[650]">{cat.title}</h3>
                <CountPill>{items.length}</CountPill>
              </div>
              <div className="flex-1">
                {items.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 border-b border-border-soft px-[18px] py-[11px] last:border-b-0"
                  >
                    <Avatar name={r.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold">{r.name}</div>
                      <div className="mt-px text-[11.5px] text-muted-foreground">{r.sub}</div>
                    </div>
                    <span
                      className={cn(
                        "whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-bold",
                        r.soon ? "bg-amber-soft text-amber" : "bg-surface-3 text-muted-foreground",
                      )}
                    >
                      {r.when}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border-soft p-3">
                <Btn size="sm" className="w-full">Send greetings</Btn>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
