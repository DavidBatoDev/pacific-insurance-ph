"use client";

import { useEffect, useState } from "react";

import { listOptionalLibraryDocumentsAction, type AttachmentFix } from "@/app/(app)/clients/engage-actions";
import type { LibraryDocument } from "@/lib/repositories/document-library";
import {
  LIBRARY_DOCUMENT_TYPES, MAX_OPTIONAL_ATTACHMENTS,
} from "@/lib/repositories/document-library/document-library.entity";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import { usePersona } from "../persona";

/**
 * Optional carrier-library attachments — the sibling of `LibraryAttachmentPicker`,
 * deliberately kept as a separate control rather than merged into it.
 *
 * The required picker enforces a gate: exactly one approved asset of one type,
 * or the composer refuses to send. This one has no wrong choice, so it offers
 * everything approved for the contact's product regardless of email template,
 * and it never blocks anything. Merging the two would make "which selection
 * satisfies the requirement?" a runtime question, which is precisely how a
 * mandatory gate gets relaxed by accident.
 *
 * Amber and red belong to the required path. Nothing here uses them.
 */
export function OptionalLibraryAttachments({
  clientId,
  value,
  onChange,
  exclude,
}: {
  clientId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  /** The id chosen in the required picker — shown there, so hidden here. */
  exclude?: string;
}) {
  const persona = usePersona();
  const allowed = persona.can("documentLibrary", "view");
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<LibraryDocument[] | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [fix, setFix] = useState<AttachmentFix | undefined>();

  useEffect(() => {
    if (!allowed) return;
    let live = true;
    listOptionalLibraryDocumentsAction(clientId).then((res) => {
      if (!live) return;
      if (!res.ok) { setDocs([]); setReason(res.error); return; }
      setDocs(res.data.documents);
      setReason(res.data.reason);
      setFix(res.data.fix);
    });
    return () => { live = false; };
  }, [clientId, allowed]);

  if (!allowed) return null;

  const available = (docs ?? []).filter((d) => d.id !== exclude);
  const selected = value.filter((id) => available.some((d) => d.id === id));
  const atCap = selected.length >= MAX_OPTIONAL_ATTACHMENTS;

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const grouped = LIBRARY_DOCUMENT_TYPES
    .map((type) => ({ type, items: available.filter((d) => d.documentType === type) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="mt-3.5 rounded-md border border-border-soft bg-surface-2 p-3.5">
      <div className="flex items-center gap-2">
        <I.folder size={15} className="shrink-0 text-subtle" />
        <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">
          Library attachments
        </span>
        <span className="text-[11px] font-[550] text-faint">Optional</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={!available.length}
          className="ml-auto inline-flex items-center gap-1 rounded-sm text-[12.5px] font-semibold text-brand-hover transition-colors hover:text-brand disabled:cursor-default disabled:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        >
          {selected.length ? `${selected.length} selected` : "Add attachments"}
          <I.chevDown size={13} className={cn("transition-transform duration-150", !open && "-rotate-90")} />
        </button>
      </div>

      {docs === null && <div className="mt-2 text-[12px] text-faint">Loading library…</div>}

      {docs !== null && !available.length && (
        <div className="mt-2 text-[12px] leading-relaxed text-subtle">
          {reason ?? "No approved library assets match this contact yet."}
          {fix === "product-interest" && (
            <>
              {" "}
              <a href={`/clients/${clientId}/edit`} className="font-semibold text-brand-hover hover:text-brand">
                Set product interest
              </a>
            </>
          )}
        </div>
      )}

      {!!selected.length && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const doc = available.find((d) => d.id === id)!;
            return (
              <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-[3px] text-[11.5px] font-[550]">
                {doc.documentName}
                <span className="text-faint">{doc.versionLabel}</span>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-label={`Remove ${doc.documentName}`}
                  className="text-subtle transition-colors hover:text-foreground"
                >
                  <I.x size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {open && !!available.length && (
        <div className="mt-2.5 max-h-[260px] overflow-y-auto rounded-md border border-border bg-card">
          {grouped.map((group) => (
            <div key={group.type}>
              <div className="sticky top-0 border-b border-border-soft bg-surface px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                {group.type}
              </div>
              {group.items.map((doc) => {
                const checked = selected.includes(doc.id);
                return (
                  <label
                    key={doc.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 border-b border-border-soft px-3 py-2 last:border-b-0 transition-colors hover:bg-hover",
                      !checked && atCap && "cursor-default opacity-50 hover:bg-transparent",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && atCap}
                      onChange={() => toggle(doc.id)}
                      className="mt-0.5 size-[15px] shrink-0 accent-brand"
                    />
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-[550] leading-snug">
                        {doc.documentName} <span className="font-normal text-subtle">· {doc.versionLabel}</span>
                      </span>
                      <span className="block text-[11px] text-faint">
                        {[doc.variant, doc.ageBand, doc.productVersionName].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {open && atCap && (
        <div className="mt-1.5 text-[11px] text-faint">
          Up to {MAX_OPTIONAL_ATTACHMENTS} attachments. Remove one to choose another.
        </div>
      )}
    </div>
  );
}
