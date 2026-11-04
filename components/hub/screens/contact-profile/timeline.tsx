"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { checkEmailSendAction } from "@/app/(app)/email/actions";
import { gmailThreadUrl } from "@/lib/communications/outbound-email.types";
import type { TimelineEntry, TimelineKind, TimelineStatus } from "@/lib/queries/contact-timeline";
import { cn } from "@/lib/utils";
import type { Tone } from "../../tone";
import { I, type IconName } from "../../icons";
import { usePersona } from "../../persona";
import { Card, CardHead, TONE_SOFT } from "../../primitives";

/** Only `sent` is provider-accepted; historical rows without a status are merely recorded. */
const STATUS_META: Record<TimelineStatus, { label: string; className: string }> = {
  prepared: { label: "Prepared", className: "bg-surface-3 text-subtle" },
  sending: { label: "Sending", className: "bg-amber-soft text-amber" },
  sent: { label: "Sent", className: "bg-blue-soft text-blue" },
  failed: { label: "Not sent", className: "bg-red-soft text-red" },
  unknown: { label: "Outcome unknown", className: "bg-amber-soft text-amber" },
  logged: { label: "Logged", className: "bg-amber-soft text-amber" },
  recorded: { label: "Recorded", className: "bg-surface-3 text-subtle" },
  received: { label: "Received", className: "bg-green-soft text-green" },
};

/** Open in Gmail and outcome reconciliation for CRM sends; the server re-authorizes every check. */
function OutboundControls({ entry }: { entry: TimelineEntry }) {
  const persona = usePersona();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const uncertain = entry.status === "unknown" || entry.status === "sending" || Boolean(entry.effectsPending);
  if (persona.role === "agent" || (!uncertain && !entry.gmailThreadId)) return null;
  const check = async () => {
    if (busy || !entry.outboundId) return;
    setBusy(true);
    try {
      const result = await checkEmailSendAction(entry.outboundId);
      setNote(result.ok ? result.data.notice ?? null : result.error);
      if (result.ok) router.refresh();
    } catch {
      setNote("Status could not be checked. Try again shortly; do not resend.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px]">
      {entry.gmailThreadId && <a href={gmailThreadUrl(entry.gmailThreadId)} target="_blank" rel="noreferrer" className="font-semibold text-primary underline underline-offset-2">Open in Gmail</a>}
      {uncertain && <button type="button" disabled={busy} onClick={() => void check()} className="font-semibold text-primary underline underline-offset-2 disabled:opacity-50">{busy ? "Checking…" : "Check status"}</button>}
      {note && <span role="status" className="text-subtle">{note}</span>}
    </div>
  );
}

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
                        {e.status && (
                          <span
                            className={cn(
                              "rounded-[5px] px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.04em]",
                              STATUS_META[e.status].className,
                            )}
                          >
                            {STATUS_META[e.status].label}
                          </span>
                        )}
                      </div>
                      {e.body && (
                        <div className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[12.5px] text-muted-foreground">{e.body}</div>
                      )}
                      <div className="mt-0.5 text-[11.5px] text-subtle">
                        {[e.actorName, e.atLabel].filter(Boolean).join(" · ")}
                      </div>
                      {e.inboxHref && <Link href={e.inboxHref} className="mt-1 inline-block text-[12px] font-semibold text-primary underline underline-offset-2">View received email</Link>}
                      {e.outboundId && <OutboundControls entry={e} />}
                    </div>
                  </div>
                );
              })}
            </div>
    </Card>
  );
}
