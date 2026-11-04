"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { uploadDocumentAction } from "@/app/(app)/documents/actions";
import { I } from "@/components/hub/icons";
import { Btn } from "@/components/hub/primitives";
import { cn } from "@/lib/utils";
import type { RequirementAttachmentReceipt, RequirementTarget } from "@/lib/documents/requirement-attachment.types";
import { RequirementAttachmentPicker } from "./requirement-attachment-picker";
import { FilePickField } from "./file-pick-field";

const inputCls =
  "h-[30px] min-w-0 rounded-md border border-border-strong bg-card px-2.5 text-[12.5px] outline-none transition-colors focus:border-brand focus:ring-[3px] focus:ring-brand/20";

function SubmitButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Btn type="submit" variant="primary" size="sm" disabled={!ready || pending}>
      <I.upload size={13} /> {pending ? "Uploading…" : "Upload"}
    </Btn>
  );
}

/**
 * Requirement rows use the shared two-source picker and return an authoritative receipt.
 * Ordinary uploads keep their compact device form, including name/type/visibility details.
 * `onAttached` updates local checklist state immediately; `onUploaded` can refresh other data.
 */
export function DocumentUploadForm({ clientId, applicationId, travelRequestId, claimId, requirementId, requirementLabel, sourceLibraryDocumentId, onUploaded, onAttached }: { clientId?: string; applicationId?: string; travelRequestId?: string; claimId?: string; requirementId?: string; requirementLabel?: string; sourceLibraryDocumentId?: string; onUploaded?: () => void; onAttached?: (receipt: RequirementAttachmentReceipt) => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const pick = (next: File | null) => {
    setFile(next);
    if (!next && fileRef.current) fileRef.current.value = "";
  };

  const target: RequirementTarget | null = requirementId
    ? travelRequestId ? { kind: "travel", recordId: travelRequestId, requirementId }
      : claimId ? { kind: "claim", recordId: claimId, requirementId }
        : applicationId ? { kind: "application", recordId: applicationId, requirementId } : null
    : null;
  if (target) return <RequirementAttachmentPicker
    clientId={clientId}
    target={target}
    label={requirementLabel ?? "This requirement"}
    onAttached={(receipt) => { onAttached?.(receipt); onUploaded?.(); }}
  />;

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await uploadDocumentAction(fd);
        formRef.current?.reset();
        setFile(null);
        setDetailsOpen(false);
        onUploaded?.();
      }}
      className="min-w-0"
    >
      {clientId && <input type="hidden" name="clientId" value={clientId} />}
      {applicationId && <input type="hidden" name="applicationId" value={applicationId} />}
      {travelRequestId && <input type="hidden" name="travelRequestId" value={travelRequestId} />}
      {claimId && <input type="hidden" name="claimId" value={claimId} />}
      {sourceLibraryDocumentId && <input type="hidden" name="sourceLibraryDocumentId" value={sourceLibraryDocumentId} />}

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <FilePickField ref={fileRef} name="file" file={file} onChange={pick} hint="Any document · up to 25 MB" />
        <button
          type="button"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
          className="inline-flex h-[30px] items-center gap-1 rounded-md px-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/25"
        >
          Details <I.chevDown size={13} className={cn("transition-transform", detailsOpen && "rotate-180")} />
        </button>
        <SubmitButton ready={!!file} />
      </div>
      {/* Kept mounted (hidden) so the defaults still submit when Details is never opened. */}
      <div className={cn("mt-2 grid grid-cols-3 gap-2 max-[640px]:grid-cols-1", !detailsOpen && "hidden")}>
        <input name="name" placeholder="Display name (optional)" aria-label="Display name" className={inputCls} />
        <input name="documentType" placeholder="Type (e.g. Valid ID)" aria-label="Document type" className={inputCls} />
        <select name="visibility" defaultValue="Internal Only" aria-label="Visibility" className={inputCls}>
          <option value="Internal Only">Internal Only</option>
          <option value="Staff Only">Staff Only</option>
          <option value="Client Visible">Client Visible</option>
        </select>
      </div>
    </form>
  );
}
