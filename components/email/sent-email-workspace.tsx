import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, ExternalLink, Paperclip, Send } from "lucide-react";

import { INPUT, SEL, TONE_BADGE } from "@/components/hub/primitives";
import {
  EMAIL_SEND_ERROR_MESSAGES, emailSendStatusLabel, gmailThreadUrl, SENDER_MAILBOX, type EmailSendState,
} from "@/lib/communications/outbound-email.types";
import {
  DEFAULT_SENT_EMAIL_FILTERS, originLabel, SEND_STATE_SHORT_LABELS, SENT_EMAIL_MAX_QUERY, SENT_EMAIL_PAGE_SIZE,
  SENT_EMAIL_PATH, SENT_EMAIL_STATUS_LABELS, SENT_EMAIL_STATUSES, sentEmailUrl,
  type SentEmailDetail, type SentEmailFilters, type SentEmailPage, type SentEmailSummary,
} from "@/lib/communications/sent-email.types";
import { cn } from "@/lib/utils";
import { SentEmailCheck } from "./sent-email-check";

const dateTime = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
const LINK = "font-semibold text-brand-hover underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring";

const STATE_TONE: Record<EmailSendState, string> = {
  accepted: TONE_BADGE.green,
  prepared: TONE_BADGE.slate,
  sending: TONE_BADGE.blue,
  failed: TONE_BADGE.red,
  unknown: TONE_BADGE.amber,
};

function StateBadge({ state }: { state: EmailSendState }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10.5px] font-semibold", STATE_TONE[state])}>{SEND_STATE_SHORT_LABELS[state]}</span>;
}

function Warning({ children }: { children: string }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10.5px] font-semibold", TONE_BADGE.amber)}>{children}</span>;
}

/** Which recorded time a row's date is: never a delivery claim. */
function occurredLabel(row: Pick<SentEmailSummary, "effectiveState" | "acceptedAt" | "occurredAt" | "createdAt">): string {
  if (row.acceptedAt) return "Accepted";
  return row.occurredAt !== row.createdAt ? "Dispatch started" : "Prepared";
}

function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function clientLabel(name: string, reference: string | null): string {
  return reference ? `${name} · ${reference}` : name;
}

function FilterForm({ filters }: { filters: SentEmailFilters }) {
  return (
    <form action={SENT_EMAIL_PATH} method="get" role="search" aria-label="Filter sent email" className="grid grid-cols-[minmax(200px,2fr)_minmax(150px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)_auto] items-end gap-2 border-b border-border p-3 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1">
      <label className="text-[11px] font-semibold text-muted-foreground">Search recipient or subject
        <input type="search" name="q" defaultValue={filters.query} maxLength={SENT_EMAIL_MAX_QUERY} placeholder="e.g. pacificcross.com.ph" className={cn(INPUT, "mt-1")} />
      </label>
      <label className="text-[11px] font-semibold text-muted-foreground">Status
        <select name="status" defaultValue={filters.status} className={cn(SEL, "mt-1 w-full")}>
          {SENT_EMAIL_STATUSES.map((status) => <option key={status} value={status}>{SENT_EMAIL_STATUS_LABELS[status]}</option>)}
        </select>
      </label>
      <label className="text-[11px] font-semibold text-muted-foreground">From
        <input type="date" max="9999-12-31" name="from" defaultValue={filters.from ?? ""} className={cn(INPUT, "mt-1")} />
      </label>
      <label className="text-[11px] font-semibold text-muted-foreground">To
        <input type="date" max="9999-12-31" name="to" defaultValue={filters.to ?? ""} className={cn(INPUT, "mt-1")} />
      </label>
      <div className="flex gap-2 max-[900px]:col-span-2 max-[520px]:col-span-1">
        <button type="submit" className="h-9 rounded-md bg-brand px-3 text-xs font-semibold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Apply</button>
        <Link href={SENT_EMAIL_PATH} className="inline-flex h-9 items-center rounded-md border border-border-strong bg-card px-3 text-xs font-semibold hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring">Clear</Link>
      </div>
    </form>
  );
}

function describeFilters(filters: SentEmailFilters): string {
  const parts = [SENT_EMAIL_STATUS_LABELS[filters.status]];
  if (filters.query) parts.push(`matching “${filters.query}”`);
  if (filters.from || filters.to) parts.push(`${filters.from ?? "any date"} to ${filters.to ?? "today"}`);
  return parts.join(" · ");
}

const COLUMNS = "grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_3.5rem]";
const ROW_COLUMNS = "min-[1000px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_3.5rem]";
const HEADINGS = ["Recipient", "Subject", "Client / workflow", "Staff", "Date", "Status", "Files"];

function Cell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <div className={cn("min-w-0", className)}><span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.06em] text-subtle min-[1000px]:sr-only">{label}</span>{children}</div>;
}

function SentList({ filters, page }: { filters: SentEmailFilters; page: SentEmailPage }) {
  const { messages } = page;
  return (
    <>
      <div aria-hidden="true" className={cn("grid gap-3 border-b border-border bg-surface-2 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-subtle max-[999px]:hidden", COLUMNS)}>
        {HEADINGS.map((heading) => <span key={heading}>{heading}</span>)}
      </div>
      {messages.length === 0 ? (
        <div className="p-6 text-[13px] leading-relaxed text-muted-foreground">
          <Send size={24} className="mb-3 text-subtle" aria-hidden="true" />
          <p className="font-semibold text-foreground">{page.page > 1 ? "No emails on this page" : "No emails match these filters"}</p>
          <p className="mt-1">Showing: {describeFilters(filters)}. {page.page > 1 ? "Return to the previous page." : "Try another status, search or date range."}</p>
        </div>
      ) : (
        <ul aria-label="Sent emails">
          {messages.map((row) => (
            <li key={row.id} className={cn("grid grid-cols-2 items-start gap-3 border-b border-border px-3 py-2.5 text-[12.5px] last:border-b-0 hover:bg-hover max-[520px]:grid-cols-1", ROW_COLUMNS)}>
              <Cell label="Recipient"><span className="block break-all font-semibold">{row.recipient}</span></Cell>
              <Cell label="Subject">
                <Link href={sentEmailUrl(filters, row.id)} className={cn(LINK, "line-clamp-2 break-words text-foreground")}>{row.subject || "(No subject)"}</Link>
                {(row.effectsPending || row.threadMismatch) && <div className="mt-1 flex flex-wrap gap-1">
                  {row.effectsPending && <Warning>Workflow update pending</Warning>}
                  {row.threadMismatch && <Warning>Different Gmail thread</Warning>}
                </div>}
              </Cell>
              <Cell label="Client / workflow">
                <span className="block truncate">{clientLabel(row.clientName, row.clientReference)}</span>
                <span className="block truncate text-[11.5px] text-muted-foreground">{originLabel(row.originType)}</span>
              </Cell>
              <Cell label="Staff"><span className="block truncate">{row.actorName}</span></Cell>
              <Cell label="Date">
                <time dateTime={row.occurredAt} className="block">{dateTime.format(new Date(row.occurredAt))}</time>
                <span className="block text-[11px] text-subtle">{occurredLabel(row)}</span>
              </Cell>
              <Cell label="Status"><StateBadge state={row.effectiveState} /></Cell>
              <Cell label="Files">
                {row.attachmentCount > 0
                  ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Paperclip size={12} aria-hidden="true" />{row.attachmentCount}<span className="sr-only"> attachments</span></span>
                  : <span className="text-subtle">—<span className="sr-only">No attachments</span></span>}
              </Cell>
            </li>
          ))}
        </ul>
      )}
      {(page.page > 1 || page.hasNext) && (
        <nav aria-label="Sent email pages" className="flex items-center justify-between gap-2 border-t border-border px-3 py-2.5 text-xs font-semibold">
          {page.page > 1
            ? <Link href={sentEmailUrl({ ...filters, page: page.page - 1 })} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-brand-hover hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring"><ArrowLeft size={13} aria-hidden="true" />Newer</Link>
            : <span aria-disabled="true" className="inline-flex items-center gap-1 px-2 py-1.5 text-subtle"><ArrowLeft size={13} aria-hidden="true" />Newer</span>}
          <span className="text-[11px] font-normal text-subtle">Page {page.page} · {SENT_EMAIL_PAGE_SIZE} per page</span>
          {page.hasNext
            ? <Link href={sentEmailUrl({ ...filters, page: page.page + 1 })} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-brand-hover hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring">Older<ArrowRight size={13} aria-hidden="true" /></Link>
            : <span aria-disabled="true" className="inline-flex items-center gap-1 px-2 py-1.5 text-subtle">Older<ArrowRight size={13} aria-hidden="true" /></span>}
        </nav>
      )}
    </>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2 py-1 max-[520px]:grid-cols-1 max-[520px]:gap-0"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words">{children}</dd></div>;
}

function SentDetail({ detail, backHref }: { detail: SentEmailDetail; backHref: string }) {
  const { email } = detail;
  const uncertain = email.state === "unknown" || email.state === "sending" || email.effectsPending;
  const error = email.state === "failed" || email.state === "unknown" ? (email.errorCode && EMAIL_SEND_ERROR_MESSAGES[email.errorCode]) : null;
  return (
    <article aria-labelledby="sent-detail-subject" className="p-4">
      <Link href={backHref} className={cn(LINK, "mb-3 inline-flex items-center gap-1 text-xs")}><ArrowLeft size={13} aria-hidden="true" />Back to list</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="sent-detail-subject" className="min-w-0 break-words text-lg font-bold">{email.subject || "(No subject)"}</h2>
        <div className="flex flex-wrap items-center gap-2"><StateBadge state={email.state} />
          {email.gmailThreadId && <a href={gmailThreadUrl(email.gmailThreadId)} target="_blank" rel="noreferrer" className={cn(LINK, "inline-flex items-center gap-1 text-xs")}>Open in Gmail<ExternalLink size={12} aria-hidden="true" /></a>}
        </div>
      </div>
      <div className={cn("mt-3 rounded-md border px-3 py-2 text-[12.5px]", email.state === "failed" ? TONE_BADGE.red : email.state === "accepted" && !email.effectsPending && !email.threadMismatch ? "border-border bg-surface-2" : TONE_BADGE.amber)}>
        <p>{emailSendStatusLabel(email)}</p>
        {error && <p className="mt-1">{error}</p>}
        {email.effectsPending && <p className="mt-1">Gmail accepted it, but the related workflow update has not been applied yet. Check status to finish it.</p>}
        {email.threadMismatch && <p className="mt-1">{EMAIL_SEND_ERROR_MESSAGES.gmail_send_thread_mismatch}</p>}
        {uncertain && <div className="mt-2"><SentEmailCheck id={email.id} /></div>}
      </div>
      <dl className="mt-4 text-[12.5px]">
        <Meta label="From">{SENDER_MAILBOX}</Meta>
        <Meta label="To"><span className="font-semibold">{email.recipient}</span></Meta>
        <Meta label="Client"><Link href={`/clients/${detail.clientId}`} className={LINK}>{clientLabel(detail.clientName, detail.clientReference)}</Link></Meta>
        <Meta label="Workflow">{originLabel(email.origin.type)} · {detail.targetKind} <span className="font-mono text-[11px] text-subtle">{detail.targetId}</span></Meta>
        <Meta label="Staff">{detail.actorName}</Meta>
        <Meta label="Prepared"><time dateTime={detail.createdAt}>{dateTime.format(new Date(detail.createdAt))}</time></Meta>
        {detail.dispatchStartedAt && <Meta label="Dispatch started"><time dateTime={detail.dispatchStartedAt}>{dateTime.format(new Date(detail.dispatchStartedAt))}</time></Meta>}
        {email.acceptedAt && <Meta label="Accepted by Gmail"><time dateTime={email.acceptedAt}>{dateTime.format(new Date(email.acceptedAt))}</time></Meta>}
      </dl>
      <section aria-label="Message" className="mt-4 rounded-md border border-border bg-card p-3">
        <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed">{email.body}</pre>
      </section>
      <section aria-labelledby="sent-detail-files" className="mt-4">
        <h3 id="sent-detail-files" className="text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">Attachments</h3>
        {email.attachments.length === 0 ? <p className="mt-1 text-[12.5px] text-muted-foreground">No attachments.</p> : (
          <>
            <ul className="mt-1 space-y-1 text-[12.5px]">
              {email.attachments.map((file, index) => (
                <li key={`${file.fileName}-${index}`} className="flex flex-wrap items-center gap-2"><Paperclip size={12} className="text-subtle" aria-hidden="true" /><span className="break-all font-semibold">{file.fileName}</span><span className="text-subtle">{file.mimeType} · {formatSize(file.size)}</span></li>
              ))}
            </ul>
            <p className="mt-1 text-[11.5px] text-subtle">Recorded at send time. Open in Gmail to view the files as sent.</p>
          </>
        )}
      </section>
    </article>
  );
}

export function SentEmailWorkspace({
  filters, filterError, page, detail,
}: {
  filters: SentEmailFilters;
  filterError: string | null;
  page: SentEmailPage | null;
  detail: SentEmailDetail | null;
}) {
  return (
    <section aria-labelledby="sent-title">
      <header className="mb-4">
        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"><Send size={14} aria-hidden="true" /> Outgoing evidence</div>
        <h1 id="sent-title" className="text-[27px] font-bold tracking-[-0.035em]">Sent email</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">Emails sent through the CRM, including Pacific Cross correspondence. Messages sent directly in Gmail are not included.</p>
      </header>
      <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        {detail ? <SentDetail detail={detail} backHref={sentEmailUrl(filterError ? DEFAULT_SENT_EMAIL_FILTERS : filters)} /> : (
          <>
            <FilterForm filters={filterError ? DEFAULT_SENT_EMAIL_FILTERS : filters} />
            {filterError ? (
              <div role="alert" className={cn("m-3 rounded-md border p-4 text-[13px]", TONE_BADGE.amber)}>
                <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={15} aria-hidden="true" />Invalid filters</p>
                <p className="mt-1">{filterError}</p>
                <Link href={SENT_EMAIL_PATH} className={cn(LINK, "mt-2 inline-block")}>Clear filters</Link>
              </div>
            ) : page && <SentList filters={filters} page={page} />}
          </>
        )}
      </div>
    </section>
  );
}
