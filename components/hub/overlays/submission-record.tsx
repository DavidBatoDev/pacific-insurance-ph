"use client";

import { deliveryOutcomeLabel, type SubmissionRecord } from "@/lib/submissions/submission-email";
import { cn } from "@/lib/utils";
import { I } from "../icons";

const fmtSent = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Where the email went: the immutable ledger snapshot, else (historical rows) the contact's current address. */
function recipientText(record: SubmissionRecord): string {
  if (record.recipient) return `${record.contactName ?? "Pacific Cross"} <${record.recipient}>`;
  const current = record.contactEmail ? ` (current contact email ${record.contactEmail})` : "";
  return `${record.contactName ?? "Pacific Cross"}${current}`;
}

const TONE: Record<string, string> = {
  sent: "border-green-border bg-green-soft/40",
  failed: "border-red-border bg-red-soft/40",
  unknown: "border-amber-border bg-amber-soft/50",
  sending: "border-amber-border bg-amber-soft/50",
};

/**
 * Read-only view of the emails recorded to Pacific Cross (applications and claims): outcome, when,
 * by whom, to whom, and exactly what it said. Only "Sent" means Gmail accepted it; historical
 * log-only rows are labelled as not sent by the CRM. Earlier records collapse underneath.
 */
export function SubmissionRecordCard({ records }: { records: SubmissionRecord[] }) {
  const [latest, ...older] = records;
  if (!latest) return null;
  return (
    <div className="space-y-3">
      <div className={cn("rounded-md border px-3.5 py-3", TONE[latest.deliveryStatus ?? ""] ?? "border-border-soft bg-surface-2")}>
        <div className="flex items-start gap-2.5">
          <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-white", latest.deliveryStatus === "sent" ? "bg-green" : "bg-subtle")}><I.send size={12} /></span>
          <div className="min-w-0 text-[12.5px]">
            <div className="font-semibold">{deliveryOutcomeLabel(latest.deliveryStatus)}</div>
            <div className="text-muted-foreground">
              {fmtSent(latest.occurredAt)}{latest.senderName ? ` · ${latest.senderName}` : ""}
            </div>
            <div className="text-muted-foreground">To {recipientText(latest)}</div>
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
            {older.length} earlier record{older.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 space-y-1.5">
            {older.map((record) => (
              <li key={record.id} className="text-muted-foreground">
                {fmtSent(record.occurredAt)} — {deliveryOutcomeLabel(record.deliveryStatus)} — {record.subject ?? "(no subject)"} · {recipientText(record)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
