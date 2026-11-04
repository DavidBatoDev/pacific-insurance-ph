"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, FileCheck2, Inbox, Link2, Mail, Paperclip, Search } from "lucide-react";
import { INPUT } from "@/components/hub/primitives";
import type { InboxListMessage, InboxReviewData } from "@/lib/gmail/review";
import { cn } from "@/lib/utils";
import { InboxMessageDetail } from "./message-detail";
import { InboxFreshness } from "./inbox-freshness";

export type CorrespondenceState = "Unassigned" | "Linked" | "Filed";
export function correspondenceState(message: Pick<InboxListMessage, "targetId" | "filedParts">): CorrespondenceState {
  return !message.targetId ? "Unassigned" : Object.keys(message.filedParts).length > 0 ? "Filed" : "Linked";
}

export function CorrespondenceBadge({ message }: { message: InboxListMessage }) {
  const state = correspondenceState(message);
  const Icon = state === "Filed" ? FileCheck2 : state === "Linked" ? Link2 : Inbox;
  return <span className={cn("inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] font-semibold", state === "Unassigned" ? "border-amber-border bg-amber-soft text-amber" : state === "Filed" ? "border-green-border bg-green-soft text-green" : "border-border bg-surface-3 text-muted-foreground")}><Icon size={11} aria-hidden="true" />{state}</span>;
}

const receiptDay = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" });

export function InboxWorkspace({ data }: { data: InboxReviewData }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CorrespondenceState | "All">("All");
  const query = search.trim().toLowerCase();
  const visible = data.messages.filter((message) =>
    (filter === "All" || correspondenceState(message) === filter) &&
    (!query || [message.subject, message.fromAddress, message.fromName].some((value) => value.toLowerCase().includes(query))),
  );
  const filters: (CorrespondenceState | "All")[] = data.canLink ? ["All", "Unassigned", "Linked", "Filed"] : ["All", "Linked", "Filed"];
  const selectedQuery = data.selected ? `&message=${encodeURIComponent(data.selected.id)}` : "";
  return <section aria-labelledby="inbox-title">
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"><Mail size={14} aria-hidden="true" /> Correspondence evidence</div><h1 id="inbox-title" className="text-[27px] font-bold tracking-[-0.035em]">Inbox</h1><p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">{data.canLink ? "Review incoming mail, release it to a record, then file the original evidence." : "Correspondence released to your authorized records. Filing records receipt, not verification."}</p></div>
      {data.canLink && <Link href="/settings?tab=Integrations" className="rounded-md border border-border-strong bg-card px-3 py-2 text-xs font-semibold hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring">Mailbox & sync settings</Link>}
    </header>
    <InboxFreshness key={data.revision} revision={data.revision} selectedMessageId={data.selected?.id ?? null} page={data.page} />
    <div className="grid min-w-0 grid-cols-[minmax(270px,0.85fr)_minmax(0,1.8fr)] items-start gap-4 max-[1100px]:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.4fr)] max-[800px]:grid-cols-1">
      <aside aria-label="Correspondence list" className="min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        <div className="border-b border-border p-3">
          <label className="relative block"><span className="sr-only">Search this page of authorized correspondence</span><Search size={15} className="pointer-events-none absolute left-2.5 top-2.5 text-subtle" aria-hidden="true" /><input type="search" className={cn(INPUT, "pl-8")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sender or subject on this page" /></label>
          <div aria-label="Filter correspondence state" className="mt-3 flex flex-wrap gap-1">{filters.map((item) => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)} className={cn("rounded-md px-2 py-1 text-[11.5px] font-semibold focus-visible:outline-2 focus-visible:outline-ring", filter === item ? "bg-brand-soft text-brand-hover" : "text-muted-foreground hover:bg-hover")}>{item}<span className="ml-1 font-mono text-[10px] opacity-70">{item === "All" ? data.messages.length : data.messages.filter((message) => correspondenceState(message) === item).length}</span></button>)}</div>
          <p className="mt-2 text-[10.5px] text-subtle">Page {data.page} · {data.messages.length} authorized messages · 100 per page</p>
        </div>
        <div className="max-h-[calc(100dvh-300px)] overflow-y-auto max-[800px]:max-h-[320px]">
          {visible.length === 0 ? <div className="p-6 text-[13px] leading-relaxed text-muted-foreground"><Inbox size={25} className="mb-3 text-subtle" aria-hidden="true" /><p className="font-semibold text-foreground">{data.messages.length ? "No matching correspondence" : data.page > 1 ? "No older correspondence" : "No correspondence available"}</p><p className="mt-1">{data.messages.length ? "Try another search or state filter, or browse another page." : data.page > 1 ? "You have reached the end of the available messages. Return to the previous page for newer correspondence." : data.canLink ? "Enable incoming mail in Settings and sync new correspondence. Only mail received after enablement is imported." : "An Admin must link relevant incoming mail to an authorized record before it appears here."}</p></div> : <ul>{visible.map((message) => <li key={message.id}><Link href={`/inbox?page=${data.page}&message=${encodeURIComponent(message.id)}`} scroll={false} aria-current={message.id === data.selected?.id ? "page" : undefined} className={cn("block border-b border-border-soft px-3.5 py-3 last:border-0 hover:bg-hover focus-visible:relative focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring", message.id === data.selected?.id && "border-l-[3px] border-l-brand bg-brand-soft/50 pl-[11px]")}>
            <div className="mb-1.5 flex items-center justify-between gap-2"><span className="truncate text-[12.5px] font-semibold">{message.fromName || message.fromAddress || "Sender not provided"}</span><time dateTime={message.receivedAt} className="shrink-0 font-mono text-[10px] text-subtle">{receiptDay.format(new Date(message.receivedAt))}</time></div>
            <div className="truncate text-[13px] font-semibold">{message.subject || "(No subject)"}</div><p className="mt-1 truncate text-[11.5px] text-muted-foreground">{message.fromAddress}</p>
            <div className="mt-2 flex items-center justify-between gap-2"><CorrespondenceBadge message={message} /><span className="flex items-center gap-1 text-[10.5px] text-subtle">{message.isAutoReply && <span>Auto reply</span>}{message.attachmentCount > 0 && <><Paperclip size={12} aria-hidden="true" />{message.attachmentCount}<span className="sr-only">attachments</span></>}</span></div>
          </Link></li>)}</ul>}
        </div>
        {(data.page > 1 || data.mayHaveNextPage) && <nav aria-label="Correspondence pages" className="flex items-center justify-between gap-2 border-t border-border px-3 py-2.5 text-xs font-semibold">
          {data.page > 1 ? <Link href={`/inbox?page=${data.page - 1}${selectedQuery}`} scroll={false} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-brand-hover hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring"><ArrowLeft size={13} aria-hidden="true" />Newer</Link> : <span />}
          {data.mayHaveNextPage && <Link href={`/inbox?page=${data.page + 1}${selectedQuery}`} scroll={false} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-brand-hover hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring">Older<ArrowRight size={13} aria-hidden="true" /></Link>}
        </nav>}
        <div className="flex gap-1.5 border-t border-border bg-surface-2 px-3 py-2.5 text-[10.5px] text-muted-foreground"><Check size={13} className="shrink-0 text-brand" aria-hidden="true" />{data.canLink ? "Unassigned mail is visible only to Admin." : "Only authorized linked correspondence is shown."}</div>
      </aside>
      {data.selected ? <InboxMessageDetail key={data.selected.id} data={data} message={data.selected} /> : <div className="flex min-h-[340px] flex-col items-center justify-center rounded-lg border border-dashed border-border-strong px-6 text-center"><Mail size={32} className="mb-4 text-subtle" aria-hidden="true" /><h2 className="text-base font-semibold">Correspondence belongs with its record</h2><p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">Select a message to read the original text, inspect attachments and review the evidence associated with a client.</p></div>}
    </div>
  </section>;
}
