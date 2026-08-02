"use client";

import { useEffect, useState } from "react";
import { listEligibleLibraryDocumentsAction } from "@/app/(app)/clients/engage-actions";
import type { LibraryDocument } from "@/lib/repositories/document-library/document-library.entity";
import { I } from "../icons";

export function templateNeedsLibraryAttachment(templateName: string) {
  return templateName === "Send brochure" || templateName === "Send application form";
}

export function LibraryAttachmentPicker({ clientId, templateName, value, onChange }: { clientId: string; templateName: string; value: string; onChange: (id: string) => void }) {
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  useEffect(() => {
    if (!templateNeedsLibraryAttachment(templateName)) return;
    let current = true;
    listEligibleLibraryDocumentsAction(clientId, templateName).then((result) => {
      if (!current) return;
      if (result.ok) { setDocuments(result.data.documents); setReason(result.data.reason); if (value && !result.data.documents.some((doc) => doc.id === value)) onChange(""); }
      else { setDocuments([]); setReason(result.error); onChange(""); }
    });
    return () => { current = false; };
  }, [clientId, templateName, value, onChange]);
  if (!templateNeedsLibraryAttachment(templateName)) return null;
  return <div className="mt-4 rounded-md border border-border-soft bg-surface-2 p-3.5">
    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.05em] text-subtle"><I.folder size={13} /> Carrier attachment <span className="text-red">*</span></div>
    {reason ? <div className="rounded-md border border-amber-border bg-amber-soft px-3 py-2 text-[12px] text-amber">{reason}</div> : <select className="h-9 w-full rounded-md border border-border-strong bg-card px-3 text-[12.5px]" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select approved asset…</option>{documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.documentName} · {doc.versionLabel}{doc.variant ? ` · ${doc.variant}` : ""} · {doc.ageBand}</option>)}</select>}
    <p className="mt-2 text-[11.5px] text-faint">Logged for audit only — this file and email are not delivered.</p>
  </div>;
}
