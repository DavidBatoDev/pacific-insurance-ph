"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { toggleTaskAction } from "@/app/(app)/tasks/actions";
import type { Task } from "@/lib/repositories/tasks/task.entity";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import { useOverlays } from "../overlays/overlay-provider";
import { Btn, Card, CountPill, PageHead } from "../primitives";
import { BUCKET_LABEL, TAG_TONE, taskBucket, type TaskBucket } from "../task-buckets";

/**
 * Tasks board — three due-date columns over real tasks rows (design
 * screens-extra.jsx TasksScreen, wired). Shares the table with the dashboard
 * My-tasks widget; the Add Task drawer writes into the same store.
 */
export function TasksBoard({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [, startTransition] = useTransition();

  const toggle = (t: Task) =>
    startTransition(async () => {
      const res = await toggleTaskAction(t.id);
      if (!res.ok) overlays.toast("Couldn’t update task", res.error);
      else if (res.data.done && t.clientName)
        overlays.toast("Task completed", `Logged to ${t.clientName}’s timeline.`);
      router.refresh();
    });

  const cols: { key: TaskBucket; tone: string }[] = [
    { key: "overdue", tone: "red" },
    { key: "today", tone: "amber" },
    { key: "week", tone: "blue" },
  ];
  const open = tasks.filter((t) => !t.done).length;

  return (
    <div>
      <PageHead
        icon={I.checkSquare}
        title="Tasks"
        draft={false}
        sub={`Your workload across the agency · ${open} open`}
        actions={
          <Btn variant="primary" onClick={() => overlays.openAddTask()}>
            <I.plus size={15} /> New task
          </Btn>
        }
      />
      <div className="grid grid-cols-3 gap-4 max-[1000px]:grid-cols-1">
        {cols.map((c) => {
          const items = tasks.filter((t) => taskBucket(t.dueDate).bucket === c.key);
          return (
            <Card key={c.key} className="self-start">
              <div className="flex items-center gap-2.5 border-b border-border-soft px-[18px] py-[15px]">
                <span className="size-2 rounded-full" style={{ background: `var(--${c.tone})` }} />
                <h3 className="text-[14.5px] font-[650]">{BUCKET_LABEL[c.key]}</h3>
                <CountPill>{items.filter((t) => !t.done).length}</CountPill>
              </div>
              <div className="py-1.5">
                {items.length === 0 && (
                  <div className="px-[18px] py-3 text-[12.5px] text-subtle">Nothing here.</div>
                )}
                {items.map((t) => {
                  const { meta } = taskBucket(t.dueDate);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggle(t)}
                      className="flex w-full items-start gap-[11px] px-[18px] py-2 text-left transition-colors hover:bg-hover"
                    >
                      <span
                        className={cn(
                          "mt-px grid size-[18px] shrink-0 place-items-center rounded-md border-[1.6px] transition-colors",
                          t.done
                            ? "border-brand bg-brand text-white"
                            : "border-border-strong text-transparent",
                        )}
                      >
                        {t.done && <I.check size={13} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block text-[13px] font-[550] leading-snug",
                            t.done && "text-subtle line-through",
                          )}
                        >
                          {t.title}
                          {t.clientName && (
                            <span className="text-subtle"> — {t.clientName}</span>
                          )}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-subtle">
                          <span
                            className={cn(
                              "rounded-[5px] bg-surface-3 px-1.5 py-px text-[10.5px] font-[650]",
                              TAG_TONE[t.tag] ?? "text-slate",
                            )}
                          >
                            {t.tag}
                          </span>
                          {meta}
                          {t.priority === "High" && (
                            <span className="font-semibold text-red">· High</span>
                          )}
                          {t.linkedRecordRef && (
                            <span className="font-mono text-[10.5px]">{t.linkedRecordRef}</span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
