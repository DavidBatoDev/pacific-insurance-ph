"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { listRequirementEmailAttachmentsAction } from "@/app/(app)/documents/requirement-attachment-actions";
import { I } from "@/components/hub/icons";
import { Btn, INPUT } from "@/components/hub/primitives";
import type { AttachmentPickerScope, RequirementAttachmentPage, RequirementAttachmentReceipt, RequirementAttachmentSelection, RequirementEmailAttachment, RequirementTarget } from "@/lib/documents/requirement-attachment.types";
import { cn } from "@/lib/utils";
import { FilePickField } from "./file-pick-field";
import { attachRequirementSelection } from "./requirement-attachment-client";

type Props = {
  clientId?: string;
  target?: RequirementTarget;
  label: string;
  value?: RequirementAttachmentSelection | null;
  onSelect?: (selection: RequirementAttachmentSelection | null) => void;
  onAttached?: (receipt: RequirementAttachmentReceipt) => void;
  disabled?: boolean;
};

const inlineMime = (mime: string) => ["application/pdf", "image/jpeg", "image/png"].includes(mime.toLowerCase());
const sourceUrl = (attachment: RequirementEmailAttachment, action: "preview" | "download") => `/api/requirement-attachments/${encodeURIComponent(attachment.messageId)}/${encodeURIComponent(attachment.partId || "__root__")}/${action}`;
const fileSize = (size: number) => size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
const receivedDate = (value: string) => new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
const selectionName = (selection: RequirementAttachmentSelection) => selection.type === "device" ? selection.file.name : selection.attachment.fileName;

function needsAcknowledgement(attachment: RequirementEmailAttachment, target?: RequirementTarget) {
  return [attachment.sourceRecord, ...attachment.usages].some((record) => record.kind !== "client" && (!target || record.recordId !== target.recordId || record.kind !== target.kind));
}

function AttachmentPreview({ selection }: { selection: RequirementAttachmentSelection }) {
  const [devicePreview, setDevicePreview] = useState<{ url: string; inline: boolean } | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const file = selection.type === "device" ? selection.file : null;
  useEffect(() => {
    if (!file) return;
    let active = true;
    let objectUrl: string | null = null;
    // Resolve the browser File resource asynchronously. Selection changes remount this
    // component, so no previous URL/error state needs to be reset in the effect.
    void file.slice(0, 8).arrayBuffer().then((buffer) => {
      if (!active) return;
      const bytes = new Uint8Array(buffer);
      const valid = file.type === "application/pdf" ? String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
        : file.type === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
          : file.type === "image/png" && bytes[0] === 0x89 && String.fromCharCode(...bytes.slice(1, 4)) === "PNG";
      objectUrl = URL.createObjectURL(file);
      setDevicePreview({ url: objectUrl, inline: valid });
    }).catch(() => { if (active) setPreviewError(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file]);
  const mime = selection.type === "device" ? selection.file.type : selection.attachment.mimeType;
  const url = selection.type === "device" ? devicePreview?.inline ? devicePreview.url : null : inlineMime(mime) ? sourceUrl(selection.attachment, "preview") : null;
  return <div className="rounded-md border border-border-soft bg-surface-2 p-3">
    <div className="mb-2 flex items-center justify-between gap-3 text-[11.5px]">
      <span className="font-semibold">Preview</span>
      {selection.type === "email"
        ? <a href={sourceUrl(selection.attachment, "download")} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-hover hover:underline">Download original</a>
        : devicePreview && <a href={devicePreview.url} download={selection.file.name} className="font-semibold text-brand-hover hover:underline">Download original</a>}
    </div>
    {!url || previewError ? <p className="py-6 text-center text-[12px] text-muted-foreground">{previewError ? "Preview could not be loaded. Download the original to review it." : file && !devicePreview ? "Loading file preview…" : "Only PDF, JPG and PNG files can be previewed here. Review other files in their original application."}</p>
      : mime === "application/pdf" ? <iframe key={url} src={url} title={`Preview of ${selectionName(selection)}`} tabIndex={-1} className="h-72 w-full rounded border-0 bg-card" onError={() => setPreviewError(true)} />
        // The private endpoint validates image signatures; device previews validate them above.
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={url} alt={`Preview of ${selectionName(selection)}`} className="max-h-72 w-full object-contain" onError={() => setPreviewError(true)} />}
  </div>;
}

/** One picker for staged creation selections and receipts on existing requirement rows. */
export function RequirementAttachmentPicker({ clientId, target, label, value, onSelect, onAttached, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"device" | "email">("device");
  const [draft, setDraft] = useState<RequirementAttachmentSelection | null>(null);
  const [receipt, setReceipt] = useState<RequirementAttachmentReceipt | null>(null);
  const [page, setPage] = useState<RequirementAttachmentPage | null>(null);
  const [canUseEmail, setCanUseEmail] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [previewVersion, setPreviewVersion] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);
  const listRequest = useRef(0);
  const titleId = useId();
  const descriptionId = useId();
  const tabId = useId();
  const kind = target?.kind;
  const recordId = target?.recordId;
  const requirementId = target?.requirementId;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : triggerRef.current;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? []).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!busyRef.current) setOpen(false);
      } else if (event.key === "Tab") {
        const controls = focusable();
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); dialog?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    const onFocus = (event: FocusEvent) => { if (event.target instanceof Node && !dialog?.contains(event.target)) (focusable()[0] ?? dialog)?.focus(); };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocus);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open || (!kind && !clientId)) return;
    let active = true;
    const request = ++listRequest.current;
    const scope: AttachmentPickerScope = kind && recordId && requirementId ? { type: "requirement", target: { kind, recordId, requirementId } } : { type: "client", clientId: clientId! };
    const timer = setTimeout(() => {
      void listRequirementEmailAttachmentsAction(scope, { search: query }).then((result) => {
        if (!active || request !== listRequest.current) return;
        if (result.ok) { setPage(result.data); setCanUseEmail(result.data.canUseEmail); if (!result.data.canUseEmail) { setTab("device"); setDraft((current) => current?.type === "email" ? null : current); } }
        else setListError(result.error);
      }).catch(() => { if (active && request === listRequest.current) setListError("Email attachments could not be loaded. Retry to check available files."); })
        .finally(() => { if (active && request === listRequest.current) setLoading(false); });
    }, query ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [open, clientId, kind, recordId, requirementId, query, reload]);

  const loadMore = async () => {
    if (loading || page?.nextOffset == null) return;
    const request = ++listRequest.current;
    const scope: AttachmentPickerScope = target ? { type: "requirement", target } : { type: "client", clientId: clientId! };
    setLoading(true);
    setListError(null);
    try {
      const result = await listRequirementEmailAttachmentsAction(scope, { search: query, offset: page.nextOffset });
      if (request !== listRequest.current) return;
      if (!result.ok) setListError(result.error);
      else if (!result.data.canUseEmail) { setPage(result.data); setCanUseEmail(false); setTab("device"); setDraft(null); }
      else setPage((current) => ({ ...result.data, items: [...(current?.items ?? []), ...result.data.items] }));
    } catch { if (request === listRequest.current) setListError("More attachments could not be loaded. Retry to continue."); }
    finally { if (request === listRequest.current) setLoading(false); }
  };

  const resetListing = (search: string) => {
    listRequest.current++;
    setPage(null);
    setListError(null);
    setLoading(!!kind || !!clientId);
    setQuery(search);
  };

  const show = () => {
    setDraft(value ?? null);
    setTab("device");
    resetListing("");
    setCanUseEmail(null);
    setPreviewVersion((current) => current + 1);
    setError(null);
    setOpen(true);
  };
  const selected = draft?.type === tab ? draft : null;
  const acknowledgementRequired = selected?.type === "email" && needsAcknowledgement(selected.attachment, target);
  const confirm = async () => {
    if (!selected || busyRef.current || (acknowledgementRequired && selected.type === "email" && !selected.confirmOtherRecord)) return;
    if (!target) { onSelect?.(selected); setOpen(false); return; }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const result = await attachRequirementSelection(target, selected);
    busyRef.current = false;
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setReceipt(result.data);
    setOpen(false);
    onAttached?.(result.data);
  };

  return <div className="min-w-0 space-y-1.5">
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Btn type="button" ref={triggerRef} size="sm" disabled={disabled} onClick={show}><I.upload size={13} /> {receipt ? "Attach another file" : value ? "Change file" : "Choose file"}</Btn>
      {!target && value && <span className="inline-flex min-w-0 items-center gap-2 rounded-md border border-brand/25 bg-brand-soft px-2 py-1 text-[11.5px]">
        <span className="truncate font-semibold">{selectionName(value)}</span><span className="shrink-0 text-muted-foreground">On create</span>
        <button type="button" disabled={disabled} onClick={() => onSelect?.(null)} className="font-semibold text-brand-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Remove</button>
      </span>}
    </div>
    {receipt && <p role="status" className="text-[11.5px] text-green">{receipt.alreadyAttached ? "Already attached" : "Attached"} · {receipt.requirementStatus} · <a href={`/api/documents/${receipt.document.id}/download`} target="_blank" rel="noopener noreferrer" className="font-semibold underline">{receipt.document.name}</a></p>}
    {open && createPortal(<div className="fixed inset-0 z-[150] grid place-items-center bg-black/35 p-3 backdrop-blur-[2px] sm:p-4" onMouseDown={(event) => { event.stopPropagation(); if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[900px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-pop">
        <div className="flex items-start justify-between gap-4 border-b border-border-soft px-5 py-4">
          <div className="min-w-0"><h2 id={titleId} className="text-[16px] font-bold">Attach requirement document</h2><p id={descriptionId} className="mt-1 text-[12px] text-muted-foreground">For <span className="font-semibold text-foreground">{label}</span>{!target && " · Attached after the record is created"}</p></div>
          <button type="button" aria-label="Close attachment picker" disabled={busy} onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-[14px] text-muted-foreground hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div role="tablist" aria-label="Attachment source" className="mb-4 flex gap-1 border-b border-border-soft">
            {(["device", ...(canUseEmail ? ["email" as const] : [])] as const).map((source) => <button key={source} type="button" role="tab" id={`${tabId}-${source}`} aria-controls={`${tabId}-panel-${source}`} aria-selected={tab === source} tabIndex={tab === source ? 0 : -1} disabled={busy} onClick={() => { setTab(source); setError(null); }} onKeyDown={(event) => { if (canUseEmail && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "device" : event.key === "End" ? "email" : source === "device" ? "email" : "device"; setTab(next); document.getElementById(`${tabId}-${next}`)?.focus(); } }} className={cn("border-b-2 px-3 py-2 text-[12px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand", tab === source ? "border-brand text-brand-hover" : "border-transparent text-muted-foreground hover:bg-hover")}>{source === "device" ? "Upload from device" : "From email attachments"}</button>)}
          </div>
          {!target && !clientId && <p className="mb-3 text-[12px] text-muted-foreground">Choose a client to make their email attachments available. You can select a device file now.</p>}
          {listError && <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-md border border-amber-border bg-amber-soft p-3 text-[12px]"><span>{listError}</span><Btn type="button" size="sm" onClick={() => { resetListing(query); setReload((current) => current + 1); }}>Retry</Btn></div>}
          {loading && !page && <p role="status" className="mb-3 text-[11.5px] text-muted-foreground">Checking available attachment sources…</p>}
          <div role="tabpanel" id={`${tabId}-panel-${tab}`} aria-labelledby={`${tabId}-${tab}`}>
            {tab === "device" ? <div className="rounded-md border border-dashed border-border-strong bg-surface-2 p-4"><FilePickField file={draft?.type === "device" ? draft.file : null} disabled={busy} ariaLabel={`Choose file for ${label}`} hint="Any document · up to 25 MB" onChange={(file) => { setDraft(file ? { type: "device", file } : null); setPreviewVersion((current) => current + 1); setError(null); }} /></div>
              : <div>
                <input type="search" aria-label="Search email attachments" placeholder="Search file name, sender or subject" value={query} disabled={busy} onChange={(event) => resetListing(event.target.value)} className={cn(INPUT, "mb-3 w-full")} />
                <p className="mb-2 text-[11.5px] text-muted-foreground">Released email attachments for this client, including stored originals. Choosing a file does not move its original filing.</p>
                {page?.items.length === 0 && !loading && <p role="status" className="rounded-md border border-border-soft p-5 text-center text-[12px] text-muted-foreground">{query ? "No attachments match this search." : "No available email attachments for this client."}</p>}
                <div className="max-h-56 space-y-2 overflow-y-auto" aria-label="Available email attachments">
                  {page?.items.map((attachment) => {
                    const active = draft?.type === "email" && draft.attachment.messageId === attachment.messageId && draft.attachment.partId === attachment.partId;
                    return <button key={`${attachment.messageId}:${attachment.partId}`} type="button" disabled={busy} aria-pressed={active} onClick={() => { setDraft({ type: "email", attachment, confirmOtherRecord: false }); setPreviewVersion((current) => current + 1); setError(null); }} className={cn("w-full rounded-md border px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand", active ? "border-brand bg-brand-soft" : "border-border-soft hover:bg-hover")}>
                      <div className="flex items-start justify-between gap-3"><span className="break-all text-[12.5px] font-semibold">{attachment.fileName}</span><span className="shrink-0 text-[11px] text-muted-foreground">{fileSize(attachment.size)}</span></div>
                      <div className="mt-1 truncate text-[11.5px] text-muted-foreground">{attachment.fromAddress} · {receivedDate(attachment.receivedAt)}</div>
                      <div className="truncate text-[11.5px]">{attachment.subject || "(No subject)"}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{attachment.sourceRecord.label} · {attachment.stored ? "Stored original" : "Email original"}{attachment.alreadyAttached && " · Already on this requirement"}{attachment.usages.length > 0 && ` · Used in ${attachment.usages.length} requirement${attachment.usages.length === 1 ? "" : "s"}`}</div>
                    </button>;
                  })}
                </div>
                {page?.nextOffset != null && <div className="mt-3"><Btn type="button" size="sm" disabled={loading || busy} onClick={() => void loadMore()}>{loading ? "Loading…" : "Load more"}</Btn></div>}
              </div>}
          </div>
          {selected && <div className="mt-4 space-y-3">
            {selected.type === "email" && <div className="rounded-md border border-border-soft p-3 text-[11.5px]">
              <p className="break-all font-semibold">{selected.attachment.fileName}</p><p className="mt-1 text-muted-foreground">From {selected.attachment.fromAddress} · {receivedDate(selected.attachment.receivedAt)}</p><p className="mt-1">{selected.attachment.subject || "(No subject)"}</p>
              <p className="mt-2"><span className="font-semibold">Original record:</span> {selected.attachment.sourceRecord.label} ({selected.attachment.sourceRecord.kind})</p>
              {selected.attachment.usages.length > 0 && <div className="mt-2"><span className="font-semibold">Also used for:</span><ul className="mt-1 list-disc pl-4">{selected.attachment.usages.map((usage, index) => <li key={`${usage.kind}:${usage.recordId}:${usage.requirementId}:${index}`}>{usage.label} ({usage.kind})</li>)}</ul></div>}
            </div>}
            <AttachmentPreview key={previewVersion} selection={selected} />
            {acknowledgementRequired && selected.type === "email" && <label className="flex items-start gap-2 rounded-md border border-amber-border bg-amber-soft p-3 text-[12px]"><input type="checkbox" disabled={busy} checked={selected.confirmOtherRecord} onChange={(event) => setDraft({ ...selected, confirmOtherRecord: event.target.checked })} className="mt-0.5" /><span>I confirm this same-client attachment is appropriate for <strong>{label}</strong>. Its original record and email link will stay unchanged.</span></label>}
          </div>}
          {error && <p role="alert" className="mt-3 text-[12px] text-red">{error}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft bg-surface-2 px-5 py-3">
          <p className="min-w-0 flex-1 text-[11.5px] text-muted-foreground">{target ? "Only this requirement is marked Received. Verified stays Verified." : "This selection will be attached when you create the record."}</p>
          <div className="flex gap-2"><Btn type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</Btn><Btn type="button" variant="primary" disabled={disabled || busy || !selected || (selected.type === "email" && (!page?.canUseEmail || !!acknowledgementRequired && !selected.confirmOtherRecord))} onClick={() => void confirm()}>{busy ? "Attaching…" : "Use for this requirement"}</Btn></div>
        </div>
      </div>
    </div>, document.body)}
  </div>;
}
