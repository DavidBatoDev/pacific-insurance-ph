"use client";

import type { SubmissionRecord } from "@/lib/submissions/submission-email";
import { I } from "../icons";

const fmtSent = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Read-only view of the email logged to Pacific Cross (applications and claims): when, by whom,
 * to whom, and exactly what it said. Earlier sends collapse underneath as resubmissions.
 */
export function SubmissionRecordCard({ records }: { records: SubmissionRecord[] }) {
  const [latest, ...older] = records;
  if (!latest) return null;
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-green-border bg-green-soft/40 px-3.5 py-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-green text-white"><I.send size={12} /></span>
          <div className="min-w-0 text-[12.5px]">
            <div className="font-semibold">Sent {fmtSent(latest.occurredAt)}{latest.senderName ? ` by ${latest.senderName}` : ""}</div>
            <div className="text-muted-foreground">
              To {latest.contactName ?? "Pacific Cross"}{latest.contactEmail ? ` <${latest.contactEmail}>` : ""}
            </div>
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border border-border-soft">
        <div className="border-b border-border-soft bg-surface-2 px-3.5 py-2.5">
          <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">Subject</div>
          <div className="mt-0.5 text-[13px] font-semibold">{latest.subject ?? "—"}</div>
        </div>
        <pre className="max-h-[260px] overflow-y-auto whitespace-pre-wrap break-words px-3.5 py-3 font-sans text-[13px] leading-relaxed">{latest.body ?? "—"}</pre>
      </div>
      {older.length > 0 && (
        <details className="rounded-md border border-border-soft px-3.5 py-2 text-[12px]">
          <summary className="cursor-pointer font-semibold text-muted-foreground">
            {older.length} earlier send{older.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 space-y-1.5">
            {older.map((record) => (
              <li key={record.id} className="text-muted-foreground">
                {fmtSent(record.occurredAt)} — {record.subject ?? "(no subject)"} · {record.contactEmail ?? "Pacific Cross"}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-[11.5px] text-subtle">Logged in the CRM — the email itself was sent from your own mailbox.</p>
    </div>
  );
}
