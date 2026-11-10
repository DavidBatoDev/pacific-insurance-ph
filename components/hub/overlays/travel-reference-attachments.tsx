"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { listTravelReferenceCandidatesAction, recordTravelReferenceAttachmentAction, unlinkTravelReferenceAttachmentAction } from "@/app/(app)/travel/actions";
import type { TravelReferenceAttachment, TravelReferenceCandidate, TravelReferenceCandidatePage } from "@/lib/repositories/travel";
import { suggestTravelReferenceSlot, TRAVEL_PACK_REFERENCE_SLOTS, type ResolvedTravelPackReference, type TravelPackReferenceKey, type TravelPackReferenceSlot } from "@/lib/travel/post-issuance-pack";
import { cn } from "@/lib/utils";
import { Btn, INPUT } from "../primitives";

const INLINE_MIME = ["application/pdf", "image/jpeg", "image/png"];
const originalUrl = (messageId: string, partId: string, action: "preview" | "download") =>
  `/api/requirement-attachments/${encodeURIComponent(messageId)}/${encodeURIComponent(partId || "__root__")}/${action}`;
const fileSize = (size: number) => size < 1024 * 1024 ? `${Math.max(1, Math.ceil(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
const receivedDate = (value: string) => new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
const LINK = "font-semibold text-brand-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-sm";

type Props = {
  travelRequestId: string;
  travelLabel: string;
  canEdit: boolean;
  attachments: TravelReferenceAttachment[];
  libraryReferences: ResolvedTravelPackReference[];
  onChange: (attachments: TravelReferenceAttachment[]) => void;
};

/** Optional links to actual Inbox attachments. They never gate issuance, payment or the checklist. */
export function TravelReferenceAttachments({ travelRequestId, travelLabel, canEdit, attachments, libraryReferences, onChange }: Props) {
  const [picking, setPicking] = useState<TravelPackReferenceSlot | null>(null);
  const [busySlot, setBusySlot] = useState<TravelPackReferenceKey | null>(null);
  const [errors, setErrors] = useState<Partial<Record<TravelPackReferenceKey, string>>>({});

  const unlink = async (slot: TravelPackReferenceKey) => {
    setBusySlot(slot);
    setErrors((current) => ({ ...current, [slot]: undefined }));
    try {
      const result = await unlinkTravelReferenceAttachmentAction(travelRequestId, slot);
      if (result.ok) onChange(result.data);
      else setErrors((current) => ({ ...current, [slot]: result.error }));
    } catch {
      setErrors((current) => ({ ...current, [slot]: "The reference could not be unlinked. Check your connection and retry." }));
    } finally { setBusySlot(null); }
  };

  return <div className="border-t border-border-soft pt-3">
    <div className="text-[12.5px] font-semibold">Supplementary references <span className="font-normal text-muted-foreground">(optional)</span></div>
    <p className="mt-1 text-[11px] text-muted-foreground">Link the actual email attachment the client or carrier sent. Nothing is uploaded again, and these links never affect issuance, payment or the checklist.</p>
    {!canEdit && <p className="mt-1 text-[11px] text-muted-foreground">Read-only. Admin or Staff record supplementary references.</p>}
    <div className="mt-2 space-y-2">
      {TRAVEL_PACK_REFERENCE_SLOTS.map((slot) => {
        const link = attachments.find((item) => item.slot === slot.key) ?? null;
        const library = libraryReferences.find((item) => item.key === slot.key)?.documents ?? [];
        const busy = busySlot === slot.key;
        return <div key={slot.key} className="min-w-0 rounded-sm border border-border-soft px-2.5 py-2">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="text-[11.5px] font-semibold">{slot.label}</div>
            {!link ? <span className="text-[11px] text-muted-foreground">Not linked</span>
              : link.available ? <span className="rounded-sm bg-green-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-green">Recorded from Inbox</span>
                : <span className="rounded-sm bg-amber-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-amber">Linked source unavailable</span>}
          </div>
          {link?.available && <div className="mt-1.5 min-w-0 text-[11px]">
            <p className="break-all font-semibold">{link.fileName}</p>
            <p className="mt-0.5 break-words text-muted-foreground">{link.fromAddress} · {link.receivedAt ? receivedDate(link.receivedAt) : ""}{link.size != null ? ` · ${fileSize(link.size)}` : ""}</p>
            <p className="break-words text-muted-foreground">{link.subject || "(No subject)"}{link.clientLevel ? " · Client-level email" : ""}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              <a href={`/inbox?message=${encodeURIComponent(link.messageId)}`} className={LINK}>View email</a>
              {link.mimeType && INLINE_MIME.includes(link.mimeType.toLowerCase()) && <a href={originalUrl(link.messageId, link.partId, "preview")} target="_blank" rel="noopener noreferrer" className={LINK}>Preview</a>}
              <a href={originalUrl(link.messageId, link.partId, "download")} className={LINK}>Download original</a>
            </div>
          </div>}
          {link && !link.available && <p className="mt-1.5 text-[11px] text-amber">The linked email attachment is no longer available to your account or to this trip. {canEdit ? "Unlink it or record a different attachment." : ""}</p>}
          {canEdit && <div className="mt-2 flex flex-wrap gap-2">
            <Btn type="button" size="sm" disabled={busy} onClick={() => setPicking(slot)}>{link ? "Change attachment" : "Record from Inbox"}</Btn>
            {link && <Btn type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void unlink(slot.key)}>{busy ? "Unlinking…" : "Unlink"}</Btn>}
          </div>}
          {errors[slot.key] && <p role="alert" className="mt-1.5 text-[11px] text-red">{errors[slot.key]}</p>}
          {library.length > 0 && <div className="mt-2 border-t border-border-soft pt-1.5">
            {library.map((document) => <a key={document.id} href={`/api/travel/${travelRequestId}/pack/${slot.key}/download?documentId=${document.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-sm px-1 py-1 text-[11px] font-semibold text-brand-hover hover:bg-hover hover:underline">
              <span className="min-w-0 truncate">Library copy · {document.documentName}</span><span className="shrink-0 text-muted-foreground">{document.versionLabel}</span>
            </a>)}
          </div>}
        </div>;
      })}
    </div>
    <p className="mt-2 text-[11px] text-muted-foreground">Library copies come from the carrier library and are separate from any email attachment.</p>
    {picking && <ReferencePicker
      travelRequestId={travelRequestId}
      travelLabel={travelLabel}
      slot={picking}
      current={attachments.find((item) => item.slot === picking.key) ?? null}
      onClose={() => setPicking(null)}
      onRecorded={(next) => { onChange(next); setErrors((current) => ({ ...current, [picking.key]: undefined })); setPicking(null); }}
    />}
  </div>;
}

function ReferencePicker({ travelRequestId, travelLabel, slot, current, onClose, onRecorded }: {
  travelRequestId: string;
  travelLabel: string;
  slot: TravelPackReferenceSlot;
  current: TravelReferenceAttachment | null;
  onClose: () => void;
  onRecorded: (attachments: TravelReferenceAttachment[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<TravelReferenceCandidatePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<TravelReferenceCandidate | null>(null);
  const [confirmClientLevel, setConfirmClientLevel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const listRequest = useRef(0);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? []).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!busyRef.current) onClose();
      } else if (event.key === "Tab") {
        const controls = focusable();
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); dialog?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); if (previous?.isConnected) previous.focus(); };
  }, [onClose]);

  useEffect(() => {
    let active = true;
    const request = ++listRequest.current;
    const timer = setTimeout(() => {
      void listTravelReferenceCandidatesAction(travelRequestId, { search: query }).then((result) => {
        if (!active || request !== listRequest.current) return;
        if (result.ok) setPage(result.data);
        else setListError(result.error);
      }).catch(() => { if (active && request === listRequest.current) setListError("Email attachments could not be loaded. Retry to check available files."); })
        .finally(() => { if (active && request === listRequest.current) setLoading(false); });
    }, query ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [travelRequestId, query, reload]);

  const search = (value: string) => {
    listRequest.current++;
    setPage(null);
    setListError(null);
    setLoading(true);
    setQuery(value);
  };

  const loadMore = async () => {
    if (loading || page?.nextOffset == null) return;
    const request = ++listRequest.current;
    setLoading(true);
    setListError(null);
    try {
      const result = await listTravelReferenceCandidatesAction(travelRequestId, { search: query, offset: page.nextOffset });
      if (request !== listRequest.current) return;
      if (result.ok) setPage((existing) => ({ ...result.data, items: [...(existing?.items ?? []), ...result.data.items] }));
      else setListError(result.error);
    } catch { if (request === listRequest.current) setListError("More attachments could not be loaded. Retry to continue."); }
    finally { if (request === listRequest.current) setLoading(false); }
  };

  const items = page?.items ?? [];
  const isSuggested = (item: TravelReferenceCandidate) => suggestTravelReferenceSlot(item.fileName) === slot.key;
  // Stable: suggestions first within the loaded results, otherwise newest first as returned.
  const ordered = [...items].sort((a, b) => Number(isSuggested(b)) - Number(isSuggested(a)));
  const suggestedCount = items.filter(isSuggested).length;
  const isCurrent = (item: TravelReferenceCandidate) => current?.messageId === item.messageId && current.partId === item.partId;
  const canRecord = !!selected && !busy && !isCurrent(selected) && (!selected.clientLevel || confirmClientLevel);

  const record = async () => {
    if (!selected || !canRecord || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await recordTravelReferenceAttachmentAction({ travelRequestId, slot: slot.key, messageId: selected.messageId, partId: selected.partId, confirmClientLevel: selected.clientLevel && confirmClientLevel });
      if (result.ok) onRecorded(result.data);
      else setError(result.error);
    } catch {
      setError("The reference could not be recorded. Check your connection and retry; your selection is kept.");
    } finally { busyRef.current = false; setBusy(false); }
  };

  const previewable = !!selected && INLINE_MIME.includes(selected.mimeType.toLowerCase());

  return createPortal(<div className="fixed inset-0 z-[150] grid place-items-center bg-black/35 p-3 backdrop-blur-[2px] sm:p-4" onMouseDown={(event) => { event.stopPropagation(); if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[860px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-pop">
      <div className="flex items-start justify-between gap-4 border-b border-border-soft px-5 py-4">
        <div className="min-w-0"><h2 id={titleId} className="text-[16px] font-bold">Record {slot.label} from Inbox</h2><p id={descriptionId} className="mt-1 text-[12px] text-muted-foreground">For <span className="font-semibold text-foreground">{travelLabel}</span>. Shows attachments from emails linked to this trip or to the client.</p></div>
        <button type="button" aria-label="Close reference picker" disabled={busy} onClick={onClose} className="rounded-md px-2 py-1 text-[14px] text-muted-foreground hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">✕</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <input type="search" aria-label="Search email attachments" placeholder="Search file name, sender or subject" value={query} disabled={busy} onChange={(event) => search(event.target.value)} className={cn(INPUT, "mb-3 w-full")} />
        {listError && <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-border bg-amber-soft p-3 text-[12px]"><span>{listError}</span><Btn type="button" size="sm" onClick={() => { search(query); setReload((value) => value + 1); }}>Retry</Btn></div>}
        {loading && !page && <p role="status" className="mb-3 text-[11.5px] text-muted-foreground">Checking available email attachments…</p>}
        {suggestedCount > 1 && <p className="mb-2 text-[11.5px] text-amber">Several attachments match this category by file name. Check the preview before recording.</p>}
        {page && items.length === 0 && !loading && <p role="status" className="rounded-md border border-border-soft p-5 text-center text-[12px] text-muted-foreground">{query ? "No attachments match this search." : "No email attachments are linked to this trip or client yet. Link the email to the trip in Inbox first."}</p>}
        <div className="max-h-60 space-y-2 overflow-y-auto" aria-label="Available email attachments">
          {ordered.map((item) => {
            const active = selected?.messageId === item.messageId && selected.partId === item.partId;
            const otherSlots = item.linkedSlots.filter((key) => key !== slot.key).map((key) => TRAVEL_PACK_REFERENCE_SLOTS.find((candidate) => candidate.key === key)?.label ?? key);
            return <button key={`${item.messageId}:${item.partId}`} type="button" disabled={busy} aria-pressed={active} onClick={() => { setSelected(item); setConfirmClientLevel(false); setPreviewError(false); setError(null); }} className={cn("w-full rounded-md border px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand", active ? "border-brand bg-brand-soft" : "border-border-soft hover:bg-hover")}>
              <div className="flex items-start justify-between gap-3"><span className="break-all text-[12.5px] font-semibold">{item.fileName}</span><span className="shrink-0 text-[11px] text-muted-foreground">{fileSize(item.size)}</span></div>
              <div className="mt-1 truncate text-[11.5px] text-muted-foreground">{item.fromAddress} · {receivedDate(item.receivedAt)}</div>
              <div className="truncate text-[11.5px]">{item.subject || "(No subject)"}</div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[10.5px]">
                {isSuggested(item) && <span className="rounded-sm bg-brand-soft px-1.5 py-0.5 font-semibold text-brand-hover">Suggested by file name</span>}
                {isCurrent(item) && <span className="rounded-sm bg-green-soft px-1.5 py-0.5 font-semibold text-green">Current link</span>}
                {item.clientLevel && <span className="rounded-sm bg-amber-soft px-1.5 py-0.5 font-semibold text-amber">Client-level email</span>}
                {otherSlots.length > 0 && <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-muted-foreground">Also linked as {otherSlots.join(", ")}</span>}
                <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-muted-foreground">{item.stored ? "Stored original" : "Email original"}</span>
              </div>
            </button>;
          })}
        </div>
        {page?.nextOffset != null && <div className="mt-3"><Btn type="button" size="sm" disabled={loading || busy} onClick={() => void loadMore()}>{loading ? "Loading…" : "Load more"}</Btn></div>}
        {selected && <div className="mt-4 space-y-3">
          <div className="rounded-md border border-border-soft p-3 text-[11.5px]">
            <p className="break-all font-semibold">{selected.fileName}</p>
            <p className="mt-1 text-muted-foreground">From {selected.fromAddress} · {receivedDate(selected.receivedAt)}</p>
            <p className="mt-1">{selected.subject || "(No subject)"}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1"><a href={`/inbox?message=${encodeURIComponent(selected.messageId)}`} target="_blank" rel="noopener noreferrer" className={LINK}>View email</a><a href={originalUrl(selected.messageId, selected.partId, "download")} className={LINK}>Download original</a></div>
          </div>
          <div className="rounded-md border border-border-soft bg-surface-2 p-3">
            <div className="mb-2 text-[11.5px] font-semibold">Preview</div>
            {!previewable || previewError ? <p className="py-6 text-center text-[12px] text-muted-foreground">{previewError ? "Preview could not be loaded. Download the original to review it." : "Only PDF, JPG and PNG files can be previewed here. Download the original to review it."}</p>
              : selected.mimeType.toLowerCase() === "application/pdf" ? <iframe key={`${selected.messageId}:${selected.partId}`} src={originalUrl(selected.messageId, selected.partId, "preview")} title={`Preview of ${selected.fileName}`} tabIndex={-1} className="h-72 w-full rounded border-0 bg-card" onError={() => setPreviewError(true)} />
                // The private endpoint validates image signatures before serving inline content.
                // eslint-disable-next-line @next/next/no-img-element
                : <img key={`${selected.messageId}:${selected.partId}`} src={originalUrl(selected.messageId, selected.partId, "preview")} alt={`Preview of ${selected.fileName}`} className="max-h-72 w-full object-contain" onError={() => setPreviewError(true)} />}
          </div>
          {selected.clientLevel && <label className="flex items-start gap-2 rounded-md border border-amber-border bg-amber-soft p-3 text-[12px]"><input type="checkbox" disabled={busy} checked={confirmClientLevel} onChange={(event) => setConfirmClientLevel(event.target.checked)} className="mt-0.5" /><span>This email is linked to the client, not this trip. I confirm it belongs to <strong>{travelLabel}</strong>. Its Inbox link stays unchanged.</span></label>}
          {isCurrent(selected) && <p className="text-[11.5px] text-muted-foreground">This attachment is already the current link for {slot.label}.</p>}
        </div>}
        {error && <p role="alert" className="mt-3 text-[12px] text-red">{error}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft bg-surface-2 px-5 py-3">
        <p className="min-w-0 flex-1 text-[11.5px] text-muted-foreground">Records a link to the actual email attachment. No copy is uploaded and no checklist item changes.</p>
        <div className="flex gap-2"><Btn type="button" disabled={busy} onClick={onClose}>Cancel</Btn><Btn type="button" variant="primary" disabled={!canRecord} onClick={() => void record()}>{busy ? "Recording…" : "Record from Inbox"}</Btn></div>
      </div>
    </div>
  </div>, document.body);
}
