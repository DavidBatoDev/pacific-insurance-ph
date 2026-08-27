"use client";

import { useState } from "react";

import type { TimelineEntry, TimelineKind } from "@/lib/queries/contact-timeline";
import { cn } from "@/lib/utils";
import type { Tone } from "../../tone";
import { I, type IconName } from "../../icons";
import { Card, CardHead, TONE_SOFT } from "../../primitives";

const FILTERS: { label: string; kinds: TimelineKind[] | null }[] = [
    { label: "All", kinds: null },
    { label: "Emails", kinds: ["email"] },
    { label: "Messages", kinds: ["message"] },
    { label: "Calls", kinds: ["call"] },
    { label: "Notes", kinds: ["note"] },
    { label: "Status", kinds: ["status"] },
    { label: "Tasks", kinds: ["task"] },
    { label: "Payments", kinds: ["payment"] },
  ];

const TL_META: Record<TimelineKind, { icon: IconName; tone: Tone }> = {
    email: { icon: "mail", tone: "blue" },
    message: { icon: "phone", tone: "green" },
    call: { icon: "phone", tone: "green" },
    note: { icon: "doc2", tone: "slate" },
    status: { icon: "refresh", tone: "violet" },
    task: { icon: "checkSquare", tone: "amber" },
    payment: { icon: "peso", tone: "green" },
    doc: { icon: "folder", tone: "amber" },
  };

/** The centre-column activity timeline with kind filters. */
export function ContactTimeline({ timeline }: { timeline: TimelineEntry[] }) {
  const [timelineFilter, setTimelineFilter] = useState("All");
  const activeFilter = FILTERS.find((f) => f.label === timelineFilter) ?? FILTERS[0];
  const visibleTimeline = activeFilter.kinds
    ? timeline.filter((e) => activeFilter.kinds!.includes(e.kind))
    : timeline;

  return (
    <Card>
      <CardHead iconName="clock" title="Timeline" count={visibleTimeline.length} />
            <div className="flex flex-wrap gap-1.5 border-b border-border-soft px-[18px] py-2.5">
              {FILTERS.map((f) => (
                <button
                  key={f.label}
                  onClick={() => setTimelineFilter(f.label)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                    timelineFilter === f.label
                      ? "border-brand bg-brand-soft text-brand-hover"
                      : "border-border bg-card text-muted-foreground hover:bg-hover",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="py-1.5">
              {visibleTimeline.length === 0 && (
                <p className="px-[18px] py-4 text-[13px] text-muted-foreground">
                  {timeline.length === 0 ? "No calls logged yet — log the first touch." : "Nothing here yet."}
                </p>
              )}
              {visibleTimeline.map((e, idx) => {
                const meta = TL_META[e.kind];
                const Ico = I[meta.icon];
                return (
                  <div key={e.id} className="relative flex gap-3 px-[18px] py-2.5">
                    <div className="relative flex shrink-0 flex-col items-center">
                      <div className={cn("z-10 grid size-[28px] place-items-center rounded-lg", TONE_SOFT[meta.tone])}>
                        <Ico size={14} />
                      </div>
                      {idx < visibleTimeline.length - 1 && (
                        <div className="absolute -bottom-[18px] left-1/2 top-[28px] w-0.5 -translate-x-1/2 bg-border" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-[600] leading-snug">
                        {e.title}
                        {e.direction && (
                          <span
                            className={cn(
                              "rounded-[5px] px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.04em]",
                              e.direction === "sent" ? "bg-blue-soft text-blue" : e.direction === "logged" ? "bg-amber-soft text-amber" : "bg-green-soft text-green",
                            )}
                          >
                            {e.direction}
                          </span>
                        )}
                      </div>
                      {e.body && (
                        <div className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[12.5px] text-muted-foreground">{e.body}</div>
                      )}
                      <div className="mt-0.5 text-[11.5px] text-subtle">
                        {[e.actorName, e.atLabel].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
    </Card>
  );
}
