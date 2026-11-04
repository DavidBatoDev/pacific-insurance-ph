"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, FileCheck2, Inbox, Link2, Paperclip } from "lucide-react";
import type { InboxReviewData } from "@/lib/gmail/review";
import type { InboxMessage } from "@/lib/repositories/inbox/inbox.entity";
import { cn } from "@/lib/utils";
import { AttachmentControl, LinkMessageControl } from "./review-controls";
import { ReplyControl } from "./reply-control";

const receiptTime = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

export function InboxMessageDetail({ data, message }: { data: InboxReviewData; message: InboxMessage }) {
  const linked = !!message.targetId;
  const filedCount = Object.keys(message.filedParts).length;
  const stages = [
    { title: "Unassigned", description: "Admin review only", Icon: Inbox, current: !linked, complete: linked },
    { title: "Linked", description: "Received timeline evidence", Icon: Link2, current: linked && filedCount === 0, complete: filedCount > 0 },
    { title: "Filed", description: filedCount ? `${filedCount} original${filedCount === 1 ? "" : "s"} filed` : "Staff-confirmed PDF receipt", Icon: FileCheck2, current: filedCount > 0, complete: false },
  ];
  return <article aria-labelledby="message-subject" className="min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-xs">
    <div className="grid grid-cols-3 border-b border-border bg-surface-2" aria-label="Correspondence evidence state">{stages.map(({ title, description, Icon, current, complete }) => <div key={title} aria-current={current ? "step" : undefined} className={cn("min-w-0 border-r border-border px-3 py-3 last:border-r-0 max-[450px]:px-2", current ? title === "Unassigned" ? "bg-amber-soft text-amber" : "bg-green-soft text-green" : "text-subtle")}><div className="flex items-center gap-1.5 text-xs font-bold"><Icon size={14} aria-hidden="true" />{title}<span className="sr-only">{current ? ", current state" : complete ? ", completed" : ", not yet reached"}</span></div><p className="mt-1 text-[10px] leading-relaxed max-[450px]:hidden">{description}</p></div>)}</div>
    <div className="space-y-5 p-5 max-[640px]:p-4">
      <header>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-subtle"><span className="font-mono">GMAIL · INBOUND ORIGINAL</span><a href={`https://mail.google.com/mail/?authuser=admin%40pacificinsuranceph.com#all/${encodeURIComponent(message.gmailThreadId)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-hover underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">Open in Gmail<ArrowUpRight size={12} aria-hidden="true" /><span className="sr-only">(requires mailbox access, opens a new tab)</span></a></div>
        <h2 id="message-subject" className="break-words text-[21px] font-bold leading-snug tracking-[-0.025em]">{message.subject || "(No subject)"}</h2>
        <dl className="mt-4 grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs leading-relaxed"><dt className="text-subtle">From</dt><dd className="break-words"><span className="font-semibold">{message.fromName || message.fromAddress || "Sender not provided"}</span>{message.fromName && <span className="ml-1 text-muted-foreground">&lt;{message.fromAddress}&gt;</span>}</dd><dt className="text-subtle">To</dt><dd className="break-words text-muted-foreground">{message.toAddresses.join(", ") || "Not provided"}</dd>{message.ccAddresses.length > 0 && <><dt className="text-subtle">Cc</dt><dd className="break-words text-muted-foreground">{message.ccAddresses.join(", ")}</dd></>}<dt className="text-subtle">Received</dt><dd><time dateTime={message.receivedAt}>{receiptTime.format(new Date(message.receivedAt))} PHT</time><span className="ml-1.5 text-[10px] text-subtle">Google receipt time</span></dd></dl>
      </header>
      {message.isAutoReply && <p className="flex items-start gap-2 rounded-md border border-amber-border bg-amber-soft p-3 text-xs leading-relaxed text-amber"><AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />This message is marked as an automatic reply. It is not evidence of carrier approval, verification or a substantive response.</p>}
      {linked && <section aria-labelledby="association-heading" className="rounded-md border border-green-border bg-green-soft/50 p-3"><h3 id="association-heading" className="flex items-center gap-1.5 text-xs font-bold text-green"><Link2 size={14} aria-hidden="true" />Linked record · {message.targetKind}</h3><p className="mt-1.5 break-words text-[13px] font-semibold">{data.linkedTarget?.label || `${message.targetKind} · ${message.targetId}`}</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{message.linkedAt ? `Confirmed ${receiptTime.format(new Date(message.linkedAt))} PHT. ` : ""}One Received communication retains the original receipt time. No business decision is inferred.</p>{message.clientId && <Link href={`/clients/${encodeURIComponent(message.clientId)}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-hover underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">View client timeline<ArrowUpRight size={12} aria-hidden="true" /></Link>}{message.communicationId && <p className="mt-2 break-all font-mono text-[9px] text-subtle">Evidence {message.communicationId}</p>}</section>}
      <section aria-label="Original message text" className="border-y border-border py-5"><p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-subtle">Message text</p><div className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.8] [overflow-wrap:anywhere]">{message.bodyText || <p className="text-muted-foreground">No readable text was included in this message. The original may contain attachments.</p>}</div>{message.bodyTruncated && <p className="mt-4 rounded-md border border-amber-border bg-amber-soft p-2.5 text-xs text-amber">The message text exceeds the display limit and has been truncated. Review the complete original in Gmail if you have mailbox access.</p>}</section>
      <ReplyControl data={data} message={message} />
      {!linked && data.canLink && <LinkMessageControl data={data} message={message} />}
      <section aria-labelledby="attachments-heading"><h3 id="attachments-heading" className="mb-3 flex items-center gap-2 text-sm font-bold"><Paperclip size={15} aria-hidden="true" />Original attachments<span className="font-mono text-[11px] font-normal text-subtle">{message.attachments.length}</span></h3>{message.attachments.length > 0 ? <div className="space-y-3">{message.attachments.map((attachment) => <AttachmentControl key={attachment.partId} attachment={attachment} message={message} data={data} />)}</div> : <p className="text-xs text-muted-foreground">This message has no retained attachment parts.</p>}</section>
      <footer className="border-t border-border-soft pt-3 text-[10.5px] leading-relaxed text-subtle">Sender names, addresses and claims in this message are external content, not verification. Only safe plain text is displayed; remote images and active email content are never loaded.{message.rfcMessageId && <details className="mt-2"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-ring">Original message identity</summary><p className="mt-1 break-all font-mono text-[10px]">{message.rfcMessageId}</p></details>}</footer>
    </div>
  </article>;
}
