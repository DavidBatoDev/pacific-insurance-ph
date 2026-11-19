"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Download, FileCheck2, Link2 } from "lucide-react";
import { fileInboxAttachmentAction, linkInboxMessageAction } from "@/app/(app)/inbox/actions";
import { INPUT } from "@/components/hub/primitives";
import type { InboxReviewData } from "@/lib/gmail/review";
import type { FilingPurpose, InboxAttachment, InboxMessage } from "@/lib/repositories/inbox/inbox.entity";

const PRIMARY_BUTTON = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-brand px-3 py-2 text-xs font-semibold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50";

export function requirementReceiptOutcome(status: string): string {
  if (status === "Verified") return "Verified stays Verified. Adds evidence without undoing verification.";
  if (status === "Received") return "Received stays Received. Adds evidence to the existing receipt.";
  if (status === "Pending" || status === "Incomplete") return `${status} → Received. Receipt is not verification.`;
  return `${status} is preserved. Review this checklist item in its source module.`;
}

export function LinkMessageControl({ data, message }: { data: InboxReviewData; message: InboxMessage }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const targets = data.targets.filter((target) => `${target.kind} ${target.label} ${target.status}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = data.targets.find((target) => `${target.kind}:${target.id}` === targetKey);
  function linkMessage() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await linkInboxMessageAction(message.id, { kind: selected.kind, id: selected.id });
        if (!result.ok) { setError(result.error); return; }
        router.refresh();
      } catch { setError("The link could not be saved. Check your connection and try again."); }
    });
  }
  return <section aria-labelledby="link-heading" className="rounded-lg border border-amber-border bg-amber-soft/50 p-4">
    <h3 id="link-heading" className="flex items-center gap-2 text-sm font-bold"><Link2 size={16} className="text-amber" aria-hidden="true" />Link this email to a record</h3>
    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Confirm which record this whole email is about. Linking makes the email and its originals visible to users authorized for that client and adds one Received communication. It does not complete checklist requirements or change the record’s status.</p>
    {data.suggestions.length > 0 && <div className="mt-4 space-y-2"><p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Suggestions · confirmation required</p>{data.suggestions.map((suggestion) => <div key={`${suggestion.target.kind}:${suggestion.target.id}`} className="rounded-md border border-border bg-card p-3"><button type="button" disabled={pending} onClick={() => { setTargetKey(`${suggestion.target.kind}:${suggestion.target.id}`); setQuery(""); }} className="break-words text-left text-xs font-semibold text-brand-hover underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">{suggestion.target.kind} · {suggestion.target.label} · {suggestion.target.status}</button><p className="mt-1 text-[11px] text-muted-foreground">{suggestion.reasons.join(" · ")}</p>{suggestion.warnings.map((warning) => <p key={warning} className="mt-1 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber"><AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />{warning}</p>)}</div>)}</div>}
    <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); linkMessage(); }}>
      <label className="block text-xs font-semibold">Find a client or source record<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className={`${INPUT} mt-1.5`} placeholder="Search name, policy number or CRM reference" disabled={pending} /></label>
      <label className="block text-xs font-semibold">Which record is this email about?<select value={targetKey} onChange={(event) => setTargetKey(event.target.value)} className={`${INPUT} mt-1.5`} required disabled={pending}><option value="">Choose a record</option>{selected && !targets.some((target) => target.id === selected.id && target.kind === selected.kind) && <option value={targetKey}>{selected.kind} · {selected.label} · {selected.status}</option>}{targets.map((target) => <option key={`${target.kind}:${target.id}`} value={`${target.kind}:${target.id}`}>{target.kind} · {target.label} · {target.status}</option>)}</select></label>
      <p className="text-[11px] leading-relaxed text-muted-foreground">Search covers your authorized source records. A sender address or a reference alone is not confirmation.</p>
      {selected && <p className="rounded-md border border-border bg-card p-2.5 text-xs leading-relaxed"><span className="font-semibold">Confirm email link:</span> {selected.kind} · {selected.label} · {selected.status}. File attachments separately below if they satisfy a specific checklist item. Only an Admin can correct an existing link after reviewing its impact.</p>}
      {error && <p role="alert" className="text-xs leading-relaxed text-red">{error}</p>}
      <button type="submit" className={PRIMARY_BUTTON} disabled={pending || !selected}><Link2 size={14} aria-hidden="true" />{pending ? "Linking…" : "Confirm link to record"}</button>
    </form>
  </section>;
}

export function AttachmentControl({ attachment, message, data }: { attachment: InboxAttachment; message: InboxMessage; data: InboxReviewData }) {
  const router = useRouter();
  const [purpose, setPurpose] = useState<FilingPurpose>("document");
  const [requirementId, setRequirementId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const filedDocumentId = message.filedParts[attachment.partId];
  const isPdf = attachment.mimeType === "application/pdf" || attachment.fileName.toLowerCase().endsWith(".pdf");
  const withinLimit = attachment.size <= 25 * 1024 * 1024;
  const option = data.purposes.find((item) => item.value === purpose);
  const selectedRequirement = data.requirements.find((item) => item.id === requirementId);
  const policyRequirements = purpose === "travel_policy" ? data.requirements.filter((item) => item.label.split(" · ")[0] === "Issued Travel policy") : [];
  const canFile = data.canFile && !!message.targetId && isPdf && withinLimit && !filedDocumentId && !saved;
  function fileOriginal() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await fileInboxAttachmentAction(message.id, attachment.partId, purpose, option?.requiresRequirement ? requirementId || null : null);
        if (!result.ok) { setError(result.error); return; }
        setSaved(true);
        router.refresh();
      } catch { setError("The filing result could not be loaded. Refresh this message before retrying; the same original will not create a duplicate document."); }
    });
  }
  return <div className="rounded-md border border-border bg-card p-3">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="break-all text-[13px] font-semibold">{attachment.fileName}</p><p className="mt-1 font-mono text-[11px] text-subtle">{attachment.mimeType} · {attachment.size >= 1024 * 1024 ? `${(attachment.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(attachment.size / 1024)} KB`}</p></div><a href={`/api/inbox/${encodeURIComponent(message.id)}/attachments/${encodeURIComponent(attachment.partId || "__root__")}/download`} className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-2.5 text-xs font-semibold hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring"><Download size={13} aria-hidden="true" />Download original</a></div>
    {(filedDocumentId || saved) ? <div role="status" className="mt-3 flex items-start gap-1.5 border-t border-border-soft pt-3 text-xs text-green"><Check size={14} className="shrink-0" aria-hidden="true" /><span>Original already filed. Its filing and any checklist receipt are separate from the whole-email link. Receipt is not verification.</span></div> : !withinLimit ? <p className="mt-3 text-xs leading-relaxed text-amber">This original exceeds the app’s 25 MB attachment limit. An Admin with mailbox access must retrieve it in Gmail.</p> : !isPdf ? <p className="mt-3 text-xs leading-relaxed text-muted-foreground">This file type is available as an original download only. Inbox filing supports PDF attachments; no conversion or substitute document is created.</p> : !message.targetId ? <p className="mt-3 text-xs text-muted-foreground">Link the message to a record before filing this PDF.</p> : !data.canFile ? <p className="mt-3 text-xs text-muted-foreground">Admin or Staff can file this original into the linked record.</p> : null}
    {canFile && <form className="mt-3 space-y-3 border-t border-border-soft pt-3" onSubmit={(event) => { event.preventDefault(); fileOriginal(); }}>
      <div className="grid grid-cols-2 gap-3 max-[1000px]:grid-cols-1"><label className="block text-xs font-semibold">File as<select value={purpose} onChange={(event) => { setPurpose(event.target.value as FilingPurpose); setRequirementId(""); }} disabled={pending} className={`${INPUT} mt-1.5`}>{data.purposes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{option?.requiresRequirement && <label className="block text-xs font-semibold">Checklist item<select required value={requirementId} onChange={(event) => setRequirementId(event.target.value)} disabled={pending} className={`${INPUT} mt-1.5`}><option value="">Choose an existing item</option>{data.requirements.map((item) => <option value={item.id} key={item.id}>{item.label} · {item.status}</option>)}</select></label>}</div>
      {option?.requiresRequirement && data.requirements.length === 0 && <p className="text-xs text-amber">This record has no existing checklist items. Review its checklist in the source module; email text never creates requirements automatically.</p>}
      {purpose === "travel_policy" && <div className="space-y-1 rounded-md border border-border-soft bg-surface-2 p-2.5 text-[11px] leading-relaxed">
        {policyRequirements.length > 0 ? <><p className="font-semibold">Existing issued-policy checklist {policyRequirements.length === 1 ? "item" : "items"}</p>{policyRequirements.map((item) => <p key={item.id}>{item.label} · {item.status}. {requirementReceiptOutcome(item.status)}</p>)}{policyRequirements.length > 1 && <p>The filing workflow records receipt against the first issued-policy item in checklist order; review the source checklist if these items are ambiguous.</p>}</> : <p>No existing issued-policy checklist item is available. This files the Travel Policy original without creating a requirement or checklist receipt.</p>}
      </div>}
      <p className="text-[11px] leading-relaxed text-muted-foreground">{purpose === "proposal" ? "Files the actual proposal using the record’s current proposal guardrails. Later proposal decisions will not be reset." : option?.requiresRequirement ? selectedRequirement ? requirementReceiptOutcome(selectedRequirement.status) : "Choose an existing checklist item to see its current status and receipt outcome." : purpose === "travel_policy" ? "Files the original as Travel Policy evidence. Filing never issues a policy or changes its issuance state." : purpose === "document" ? "Supporting document only. Stores the original without satisfying a checklist requirement, approving it or verifying it." : "Stores the original as internal evidence without approving or verifying it."} Password protection is not removed.</p>
      {error && <p role="alert" className="text-xs leading-relaxed text-red">{error}</p>}
      <button className={PRIMARY_BUTTON} type="submit" disabled={pending || !!option?.requiresRequirement && !requirementId}><FileCheck2 size={14} aria-hidden="true" />{pending ? "Filing original…" : "File original PDF"}</button>
    </form>}
  </div>;
}
