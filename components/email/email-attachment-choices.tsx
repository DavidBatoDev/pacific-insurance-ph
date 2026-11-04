"use client";

import { useEffect, useState } from "react";

import { listRequirementEmailAttachmentsAction } from "@/app/(app)/documents/requirement-attachment-actions";
import { listEmailDocumentsAction } from "@/app/(app)/email/actions";
import type { EmailDocumentOption } from "@/lib/communications/outbound-email.types";
import type { RequirementEmailAttachment } from "@/lib/documents/requirement-attachment.types";
import { I } from "@/components/hub/icons";
import { formatBytes } from "./email-send-controls";

type EmailOriginal = { messageId: string; partId: string };

/**
 * Same-client stored documents and released email originals as real attachments. Selecting an
 * email original never files or receives a requirement; the server re-validates every choice.
 */
export function EmailAttachmentChoices({
  clientId,
  documentIds,
  onDocumentIds,
  emailAttachments,
  onEmailAttachments,
  lockedDocumentIds = [],
}: {
  clientId: string;
  documentIds: string[];
  onDocumentIds: (ids: string[]) => void;
  emailAttachments: EmailOriginal[];
  onEmailAttachments: (items: EmailOriginal[]) => void;
  /** Preselected by the workflow (e.g. the current proposal); shown checked and not removable. */
  lockedDocumentIds?: string[];
}) {
  const [open, setOpen] = useState(documentIds.length > 0 || emailAttachments.length > 0);
  const [documents, setDocuments] = useState<EmailDocumentOption[] | null>(null);
  const [originals, setOriginals] = useState<RequirementEmailAttachment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    Promise.all([listEmailDocumentsAction(clientId), listRequirementEmailAttachmentsAction({ type: "client", clientId })])
      .then(([docs, mail]) => {
        if (!live) return;
        if (docs.ok) setDocuments(docs.data); else { setDocuments([]); setError(docs.error); }
        if (mail.ok) setOriginals(mail.data.items); else setOriginals([]);
      })
      .catch(() => { if (live) setError("Attachments could not be loaded."); });
    return () => { live = false; };
  }, [clientId, open]);

  const selectedOriginal = (item: EmailOriginal) => emailAttachments.some((x) => x.messageId === item.messageId && x.partId === item.partId);
  const toggleDocument = (id: string) => {
    if (lockedDocumentIds.includes(id)) return;
    onDocumentIds(documentIds.includes(id) ? documentIds.filter((x) => x !== id) : [...documentIds, id]);
  };
  const toggleOriginal = (item: EmailOriginal) => onEmailAttachments(selectedOriginal(item)
    ? emailAttachments.filter((x) => !(x.messageId === item.messageId && x.partId === item.partId))
    : [...emailAttachments, { messageId: item.messageId, partId: item.partId }]);
  const count = documentIds.length + emailAttachments.length;

  return (
    <div className="mt-3.5 rounded-md border border-border-soft bg-surface-2 p-3.5 text-[12.5px]">
      <button type="button" className="flex w-full items-center justify-between gap-2 font-semibold" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="flex items-center gap-2"><I.folder size={14} /> Client files and email attachments{count ? ` · ${count} selected` : ""}</span>
        <span className="text-subtle">{open ? "Hide" : "Choose"}</span>
      </button>
      {open && (
        <div className="mt-2.5 space-y-3">
          {error && <p role="alert" className="text-red">{error}</p>}
          <fieldset>
            <legend className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">Stored client documents</legend>
            {documents === null ? <p className="text-subtle">Loading…</p> : documents.length === 0 ? <p className="text-subtle">No stored files for this client.</p> : (
              <ul className="max-h-48 space-y-1 overflow-auto">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <label className="flex items-start gap-2">
                      <input type="checkbox" className="mt-0.5" checked={documentIds.includes(doc.id)} disabled={lockedDocumentIds.includes(doc.id)} onChange={() => toggleDocument(doc.id)} />
                      <span className="break-all">{doc.name}{doc.documentType ? <span className="text-subtle"> · {doc.documentType}</span> : null}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">Email attachments released to this client</legend>
            {originals === null ? <p className="text-subtle">Loading…</p> : originals.length === 0 ? <p className="text-subtle">No released email attachments.</p> : (
              <ul className="max-h-48 space-y-1 overflow-auto">
                {originals.map((item) => (
                  <li key={`${item.messageId}:${item.partId}`}>
                    <label className="flex items-start gap-2">
                      <input type="checkbox" className="mt-0.5" checked={selectedOriginal(item)} onChange={() => toggleOriginal(item)} />
                      <span className="break-all">{item.fileName} <span className="text-subtle">· {formatBytes(item.size)} · from {item.fromAddress}</span></span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          <p className="text-[11.5px] text-faint">Files are sent as real attachments in their original format. The review step shows exact names and sizes.</p>
        </div>
      )}
    </div>
  );
}
