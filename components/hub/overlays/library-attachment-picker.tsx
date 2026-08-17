"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { listEligibleLibraryDocumentsAction, type AttachmentFix } from "@/app/(app)/clients/engage-actions";
import type { LibraryDocument } from "@/lib/repositories/document-library/document-library.entity";
import { I } from "../icons";

export function templateNeedsLibraryAttachment(templateName: string) {
  return templateName === "Send brochure" || templateName === "Send application form";
}

/**
 * Call-to-action per fixable blocker. Both fields live on the contact record,
 * so both point at the same edit form — `product-interest` lands in its
 * Discovery details section, `date-of-birth` in the identity block above it.
 */
const FIX_LABEL: Record<AttachmentFix, string> = {
  "product-interest": "Set product interest",
  "date-of-birth": "Add date of birth",
};

export function LibraryAttachmentPicker({ clientId, templateName, value, onChange }: { clientId: string; templateName: string; value: string; onChange: (id: string) => void }) {
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [fix, setFix] = useState<AttachmentFix | undefined>(undefined);
  // Carried through so the edit form's Cancel/Save return to the profile the
  // way the user reached it, rather than dumping a lead on the Clients list.
  const from = useSearchParams().get("from");
  useEffect(() => {
    if (!templateNeedsLibraryAttachment(templateName)) return;
    let current = true;
    listEligibleLibraryDocumentsAction(clientId, templateName).then((result) => {
      if (!current) return;
      if (result.ok) { setDocuments(result.data.documents); setReason(result.data.reason); setFix(result.data.fix); if (value && !result.data.documents.some((doc) => doc.id === value)) onChange(""); }
      else { setDocuments([]); setReason(result.error); setFix(undefined); onChange(""); }
    });
    return () => { current = false; };
  }, [clientId, templateName, value, onChange]);
  if (!templateNeedsLibraryAttachment(templateName)) return null;
  const editHref = `/clients/${clientId}/edit${from === "prospects" ? "?from=prospects" : ""}`;
  return <div className="mt-4 rounded-md border border-border-soft bg-surface-2 p-3.5">
    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.05em] text-subtle"><I.folder size={13} /> Carrier attachment <span className="text-red">*</span></div>
    {reason
      ? <div className="rounded-md border border-amber-border bg-amber-soft px-3 py-2 text-[12px] text-amber">
          {reason}
          {/* Only the contact-record blockers get a link — an empty Carrier
              Library isn't fixable from here, so it stays a plain sentence. */}
          {fix && (
            <Link
              href={editHref}
              className="mt-2 inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-amber-border bg-card px-3 text-[12.5px] font-semibold text-amber transition-colors hover:bg-hover"
            >
              <I.edit size={14} /> {FIX_LABEL[fix]}
            </Link>
          )}
        </div>
      : <select className="h-9 w-full rounded-md border border-border-strong bg-card px-3 text-[12.5px]" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select approved asset…</option>{documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.documentName} · {doc.versionLabel}{doc.variant ? ` · ${doc.variant}` : ""} · {doc.ageBand}</option>)}</select>}
    <p className="mt-2 text-[11.5px] text-faint">Logged for audit only — this file and email are not delivered.</p>
  </div>;
}
