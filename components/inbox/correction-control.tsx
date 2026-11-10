"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Link2 } from "lucide-react";
import { correctInboxMessageAction, previewInboxCorrectionAction } from "@/app/(app)/inbox/actions";
import { AREA, INPUT } from "@/components/hub/primitives";
import type { InboxReviewData } from "@/lib/gmail/review";
import type { InboxCorrectionImpact, InboxCorrectionInput, InboxMessage } from "@/lib/repositories/inbox/inbox.entity";
import { requirementReceiptOutcome } from "./review-controls";

const PRIMARY_BUTTON = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-brand px-3 py-2 text-xs font-semibold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BUTTON = "inline-flex min-h-9 items-center justify-center rounded-md border border-border-strong bg-card px-3 py-2 text-xs font-semibold hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50";
type FilingChoice = { action: "" | "keep" | "move"; requirementId: string };
type ReceiptChoice = { action: "" | "keep" | "detach"; remainingStatus: "" | "Pending" | "Incomplete" };
const purposeLabels = { document: "Supporting document", proposal: "Illustrative proposal", application_requirement: "Application checklist receipt", claim_requirement: "Claim checklist receipt", travel_requirement: "Travel checklist receipt", travel_policy: "Travel Policy", travel_application_copy: "Travel application copy" };

export function CorrectionControl({ data, message }: { data: InboxReviewData; message: InboxMessage }) {
  const router = useRouter();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [impact, setImpact] = useState<InboxCorrectionImpact | null>(null);
  const [filings, setFilings] = useState<Record<string, FilingChoice>>({});
  const [receipts, setReceipts] = useState<Record<string, ReceiptChoice>>({});
  const [reason, setReason] = useState("");
  const [confirmCrossClient, setConfirmCrossClient] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [operation, setOperation] = useState<"preview" | "save">("preview");
  const [pending, startTransition] = useTransition();
  const candidates = data.targets.filter((target) => target.kind !== message.targetKind || target.id !== message.targetId);
  const targets = candidates.filter((target) => `${target.kind} ${target.label} ${target.status}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = candidates.find((target) => `${target.kind}:${target.id}` === targetKey);
  const usages = [...new Map(impact?.filings.flatMap((filing) => filing.usages.map((usage) => [usage.id, usage] as const)) ?? []).values()];

  function changeTarget(key: string) {
    setTargetKey(key);
    setImpact(null);
    setFilings({});
    setReceipts({});
    setConfirmCrossClient(false);
    setError(null);
  }

  function preview() {
    if (!selected || pending) return;
    setError(null);
    setOperation("preview");
    startTransition(async () => {
      try {
        const result = await previewInboxCorrectionAction(message.id, { kind: selected.kind, id: selected.id });
        if (!result.ok) { setError(result.error); return; }
        setImpact(result.data);
        setFilings({});
        setReceipts({});
        setConfirmCrossClient(false);
      } catch { setError("The correction review could not be loaded. Your entries are retained. Check your connection and review the impact again."); }
    });
  }

  function chooseReceipt(usageId: string, action: ReceiptChoice["action"]) {
    const usage = usages.find((item) => item.id === usageId)!;
    setReceipts((current) => {
      const fallback = usages.filter((item) => item.kind === usage.kind && item.requirementId === usage.requirementId)
        .map((item) => current[item.id]?.remainingStatus).find((value) => value) ?? "";
      return { ...current, [usageId]: { action, remainingStatus: action === "detach" ? fallback : "" } };
    });
  }

  function chooseFallback(usageId: string, remainingStatus: ReceiptChoice["remainingStatus"]) {
    const usage = usages.find((item) => item.id === usageId)!;
    setReceipts((current) => {
      const next = { ...current };
      for (const item of usages) {
        const choice = next[item.id];
        if (item.kind === usage.kind && item.requirementId === usage.requirementId && choice?.action === "detach")
          next[item.id] = { ...choice, remainingStatus };
      }
      return next;
    });
  }

  function correctionInput(): InboxCorrectionInput | null {
    if (!impact || !selected || impact.target.kind !== selected.kind || impact.target.id !== selected.id || impact.blockers.length || !reason.trim() || impact.crossClient && !confirmCrossClient) return null;
    const filingInputs: InboxCorrectionInput["filings"] = [];
    for (const filing of impact.filings) {
      const choice = filings[filing.partId];
      if (!choice?.action || choice.action === "keep" && impact.crossClient || choice.action === "move" && (!filing.canMove || filing.blockers.length)) return null;
      if (choice.action === "move" && choice.requirementId && !impact.targetRequirements.some((item) => item.id === choice.requirementId)) return null;
      filingInputs.push({ partId: filing.partId, action: choice.action, requirementId: choice.action === "move" ? choice.requirementId || null : null });
    }
    const receiptInputs: InboxCorrectionInput["receipts"] = [];
    for (const usage of usages) {
      const choice = receipts[usage.id];
      if (!choice?.action || choice.action === "keep" && impact.crossClient || choice.action === "detach" && (!usage.canDetach || usage.blockers.length || usage.status === "Verified")) return null;
      const needsRemainingStatus = choice.action === "detach" && usage.status === "Received" && !usage.hasOtherEvidence;
      if (needsRemainingStatus && !choice.remainingStatus) return null;
      receiptInputs.push({ usageId: usage.id, action: choice.action, remainingStatus: needsRemainingStatus ? choice.remainingStatus as "Pending" | "Incomplete" : null });
    }
    return { messageId: message.id, target: { kind: selected.kind, id: selected.id }, revision: impact.revision, reason: reason.trim(), confirmCrossClient, filings: filingInputs, receipts: receiptInputs };
  }

  const input = correctionInput();
  function correct() {
    if (!input || pending) return;
    setError(null);
    setOperation("save");
    startTransition(async () => {
      try {
        const result = await correctInboxMessageAction(input);
        if (!result.ok) { setError(result.error); return; }
        setSaved(true);
        setOpen(false);
        setImpact(null);
        setTargetKey("");
        setFilings({});
        setReceipts({});
        setReason("");
        setConfirmCrossClient(false);
        router.refresh();
      } catch { setError("The correction result could not be confirmed. Your entries are retained. Refresh the inbox to check the saved link before trying again; do not assume the correction failed."); }
    });
  }

  if (!data.canCorrect) return null;
  return <div className="mt-3 border-t border-green-border pt-3">
    {saved && <p role="status" className="mb-2 text-xs text-green">Email link corrected. The reason and evidence dispositions were recorded in the audit history.</p>}
    <button type="button" aria-expanded={open} aria-controls={panelId} disabled={pending} onClick={() => setOpen(!open)} className="inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-brand-hover underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"><Link2 size={14} aria-hidden="true" />{open ? "Close correction review" : "Correct link"}</button>
    {open && <div id={panelId} className="mt-3 rounded-md border border-border bg-card p-3">
      <h4 className="text-sm font-bold">Review email-link correction</h4>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Admin only. Choose the intended record, review every filed original and checklist receipt, and record why the link is wrong. Selecting a record does not save a correction. Original bytes and earlier audit history are retained.</p>
      <form className="mt-4 space-y-4" onSubmit={(event) => { event.preventDefault(); correct(); }} aria-busy={pending}>
        <fieldset disabled={pending} className="min-w-0 space-y-3">
          <legend className="mb-2 text-xs font-bold">New email link</legend>
          <label className="block text-xs font-semibold">Find a record<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className={`${INPUT} mt-1.5`} placeholder="Name, reference or status" /></label>
          <label className="block text-xs font-semibold">Which record is this email about?<select required value={targetKey} onChange={(event) => changeTarget(event.target.value)} className={`${INPUT} mt-1.5`}><option value="">Choose a different record</option>{selected && !targets.some((target) => target.id === selected.id && target.kind === selected.kind) && <option value={targetKey}>{selected.kind} · {selected.label} · {selected.status}</option>}{targets.map((target) => <option key={`${target.kind}:${target.id}`} value={`${target.kind}:${target.id}`}>{target.kind} · {target.label} · {target.status}</option>)}</select></label>
          {selected && <p className="break-words text-xs leading-relaxed"><span className="font-semibold">Proposed record:</span> {selected.kind} · {selected.label} · {selected.status}</p>}
          <button type="button" className={SECONDARY_BUTTON} disabled={!selected || pending} onClick={preview}>{pending && operation === "preview" ? "Loading impact…" : impact ? "Reload impact review" : "Review correction impact"}</button>
          {impact && <p className="text-[11px] leading-relaxed text-subtle">Reloading impact clears evidence choices and cross-client confirmation so you can review the current state. Your reason is retained.</p>}
        </fieldset>
        {impact && <>
          <div role="status" className="space-y-2 rounded-md border border-border bg-surface-2 p-3 text-xs leading-relaxed">
            <p className="break-words"><span className="font-semibold">From:</span> {impact.currentTarget.kind} · {impact.currentTarget.label} · {impact.currentTarget.status}</p>
            <p className="break-words"><span className="font-semibold">To:</span> {impact.target.kind} · {impact.target.label} · {impact.target.status}</p>
            <p>The email’s Received communication keeps its original receipt time. This correction does not change the destination record’s business status.</p>
          </div>
          {impact.blockers.length > 0 && <div role="alert" className="rounded-md border border-amber-border bg-amber-soft p-3 text-xs leading-relaxed text-amber"><p className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={14} aria-hidden="true" />Correction blocked</p><ul className="mt-2 list-disc space-y-1 pl-4">{impact.blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}</ul><p className="mt-2">Resolve these dependencies in the source workflow, then reload the impact review. Nothing can be corrected here while these blockers remain.</p></div>}
          {impact.crossClient && <div className="rounded-md border border-amber-border bg-amber-soft p-3 text-xs leading-relaxed text-amber"><p className="font-semibold">This changes which client’s users can access the email and its originals.</p><p className="mt-1">Every filed original must move and every old checklist receipt must detach. Keeping old-client evidence is not allowed. Blocked originals or Verified receipts must be resolved in their source workflow first.</p><label className="mt-3 flex items-start gap-2 font-semibold"><input type="checkbox" checked={confirmCrossClient} disabled={pending} onChange={(event) => setConfirmCrossClient(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-brand focus-visible:outline-2 focus-visible:outline-ring" /><span>I reviewed the new client and confirm this cross-client access change.</span></label></div>}
          <fieldset disabled={pending} className="min-w-0 space-y-3">
            <legend className="mb-2 text-xs font-bold">Filed originals · {impact.filings.length}</legend>
            <p className="text-[11px] leading-relaxed text-muted-foreground">Choose a disposition for every filing. Moving files it as a Supporting document on the new record; it does not recreate a proposal, issued policy or application copy. An optional checklist selection records a new receipt separately.</p>
            {impact.filings.length === 0 && <p className="text-xs text-subtle">No filed originals need a disposition.</p>}
            {impact.filings.map((filing) => {
              const choice = filings[filing.partId];
              const requirement = impact.targetRequirements.find((item) => item.id === choice?.requirementId);
              return <div key={filing.partId} className="min-w-0 space-y-2 rounded-md border border-border p-3">
                <p className="break-all text-xs font-semibold">{filing.fileName}</p>
                <p className="text-[11px] text-subtle">Current filing: {purposeLabels[filing.purpose]}</p>
                <p className="break-words text-[11px] text-subtle">Existing destination: {filing.target ? `${filing.target.kind} · ${filing.target.label} · ${filing.target.status}` : "Unavailable — resolve the source record association before moving"}</p>
                <label className="block text-xs font-semibold">Filing disposition<select required value={choice?.action ?? ""} onChange={(event) => setFilings((current) => ({ ...current, [filing.partId]: { action: event.target.value as FilingChoice["action"], requirementId: "" } }))} className={`${INPUT} mt-1.5`}><option value="">Choose explicitly</option><option value="keep" disabled={impact.crossClient}>Keep on the existing record{impact.crossClient ? " — different client; unavailable" : ""}</option><option value="move" disabled={!filing.canMove || filing.blockers.length > 0}>Move as Supporting document{!filing.canMove || filing.blockers.length ? " — blocked" : ""}</option></select></label>
                {filing.blockers.length > 0 && <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-amber">{filing.blockers.map((blocker, index) => <li key={index}>Move blocked: {blocker}</li>)}</ul>}
                {!filing.canMove && filing.blockers.length === 0 && <p className="text-[11px] text-amber">Moving this original is not supported here. Review its source workflow.</p>}
                {choice?.action === "keep" && <p className="text-[11px] leading-relaxed text-muted-foreground">This filing stays on the existing record even though the email link changes. Resolve its checklist receipts separately below.</p>}
                {choice?.action === "move" && <>
                  {filing.usages.some((usage) => usage.documentId === filing.documentId) && <p className="text-[11px] leading-relaxed text-muted-foreground">If you keep this original's existing receipt, the correction retains a document association with the same bytes and provenance on that checklist.</p>}
                  {impact.targetRequirements.length > 0 ? <label className="block text-xs font-semibold">New target checklist receipt (optional)<select value={choice.requirementId} onChange={(event) => setFilings((current) => ({ ...current, [filing.partId]: { ...choice, requirementId: event.target.value } }))} className={`${INPUT} mt-1.5`}><option value="">Supporting document only — no new receipt</option>{impact.targetRequirements.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.status}</option>)}</select></label> : <p className="text-[11px] leading-relaxed text-muted-foreground">No supported target checklist items are available. This move creates a Supporting document only.</p>}
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{requirement ? requirementReceiptOutcome(requirement.status) : "Supporting document only. No checklist requirement is satisfied by this move."}</p>
                </>}
              </div>;
            })}
          </fieldset>
          <fieldset disabled={pending} className="min-w-0 space-y-3">
            <legend className="mb-2 text-xs font-bold">Existing checklist receipts · {usages.length}</legend>
            {usages.length === 0 && <p className="text-xs text-subtle">No existing checklist receipts need a disposition.</p>}
            {usages.map((usage) => {
              const choice = receipts[usage.id];
              const needsRemainingStatus = choice?.action === "detach" && usage.status === "Received" && !usage.hasOtherEvidence;
              const files = impact.filings.filter((filing) => filing.usages.some((item) => item.id === usage.id)).map((filing) => filing.fileName);
              return <div key={usage.id} className="min-w-0 space-y-2 rounded-md border border-border p-3">
                <p className="break-words text-xs font-semibold">{usage.label} · {usage.status}</p>
                <p className="break-all text-[11px] text-subtle">{usage.kind} · {usage.recordId} · {files.join(", ")}</p>
                <label className="block text-xs font-semibold">Receipt disposition<select required value={choice?.action ?? ""} onChange={(event) => chooseReceipt(usage.id, event.target.value as ReceiptChoice["action"])} className={`${INPUT} mt-1.5`}><option value="">Choose explicitly</option><option value="keep" disabled={impact.crossClient}>Keep on the existing checklist{impact.crossClient ? " — different client; unavailable" : ""}</option><option value="detach" disabled={!usage.canDetach || usage.blockers.length > 0 || usage.status === "Verified"}>Detach this evidence{!usage.canDetach || usage.blockers.length || usage.status === "Verified" ? " — blocked" : ""}</option></select></label>
                {usage.blockers.length > 0 && <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-amber">{usage.blockers.map((blocker, index) => <li key={index}>Detach blocked: {blocker}</li>)}</ul>}
                {usage.status === "Verified" && <p className="text-[11px] leading-relaxed text-amber">Verified evidence cannot be detached here. Review and change verification in the source workflow first; this correction never silently undoes it.</p>}
                {!usage.canDetach && usage.status !== "Verified" && usage.blockers.length === 0 && <p className="text-[11px] text-amber">Detaching this receipt is not supported here. Review its source workflow.</p>}
                {choice?.action === "keep" && <p className="text-[11px] leading-relaxed text-muted-foreground">Keeps this evidence on its existing checklist item. {usage.status} stays {usage.status}.</p>}
                {needsRemainingStatus && <label className="block text-xs font-semibold">Fallback status if no active evidence remains<select required value={choice.remainingStatus} onChange={(event) => chooseFallback(usage.id, event.target.value as ReceiptChoice["remainingStatus"])} className={`${INPUT} mt-1.5`}><option value="">Choose Pending or Incomplete</option><option value="Pending">Pending</option><option value="Incomplete">Incomplete</option></select></label>}
                {choice?.action === "detach" && <p className="text-[11px] leading-relaxed text-muted-foreground">{usage.hasOtherEvidence ? `Other active evidence remains outside this email. ${usage.status} stays ${usage.status}.` : needsRemainingStatus ? choice.remainingStatus ? `If no active evidence remains after all dispositions, Received → ${choice.remainingStatus}. If another receipt is kept, Received is preserved and this fallback is unused.` : "No evidence outside this email is guaranteed to remain. Choose the fallback checklist status; it applies only if all active evidence is detached." : `Detaches this evidence; ${usage.status} stays ${usage.status}.`}</p>}
              </div>;
            })}
          </fieldset>
          <label className="block text-xs font-semibold">Reason for correction<textarea required maxLength={2000} value={reason} disabled={pending} onChange={(event) => setReason(event.target.value)} className={`${AREA} mt-1.5 min-h-24`} placeholder="Explain why the existing link is incorrect and why these evidence dispositions are appropriate." /></label>
          <p className="text-[11px] leading-relaxed text-muted-foreground">Your account, time, reason, previous and new record, and every evidence disposition will be audited. Resolve all choices and blockers before saving. If the records change, the server rejects this review; reload impact and review again.</p>
        </>}
        {error && <p role="alert" className="break-words text-xs leading-relaxed text-red">{error}</p>}
        {impact && <div className="space-y-2"><button type="submit" className={PRIMARY_BUTTON} disabled={pending || !input}><Link2 size={14} aria-hidden="true" />{pending && operation === "save" ? "Saving correction…" : "Confirm reviewed correction"}</button>{!input && <p className="text-[11px] leading-relaxed text-amber">Correction is not ready: resolve blockers, explicitly choose every filing and receipt disposition, provide a reason, and confirm any cross-client change.</p>}</div>}
      </form>
    </div>}
  </div>;
}
