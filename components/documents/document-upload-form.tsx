"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";

import { uploadDocumentAction } from "@/app/(app)/documents/actions";
import { I } from "@/components/hub/icons";

const inputCls =
  "h-9 rounded-md border border-border bg-surface px-2.5 text-[12.5px] outline-none focus:border-brand";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-transparent bg-brand px-3.5 text-[13px] font-semibold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60"
    >
      <I.upload size={14} /> {pending ? "Uploading…" : "Upload"}
    </button>
  );
}

export function DocumentUploadForm({ clientId, applicationId, travelRequestId, claimId, requirementId, sourceLibraryDocumentId }: { clientId?: string; applicationId?: string; travelRequestId?: string; claimId?: string; requirementId?: string; sourceLibraryDocumentId?: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await uploadDocumentAction(fd);
        formRef.current?.reset();
      }}
      className="flex flex-wrap items-center gap-2.5"
    >
      {clientId && <input type="hidden" name="clientId" value={clientId} />}
      {applicationId && <input type="hidden" name="applicationId" value={applicationId} />}
      {travelRequestId && <input type="hidden" name="travelRequestId" value={travelRequestId} />}
      {claimId && <input type="hidden" name="claimId" value={claimId} />}
      {requirementId && (
        <input
          type="hidden"
          name={travelRequestId ? "travelRequirementId" : claimId ? "claimRequirementId" : "applicationRequirementId"}
          value={requirementId}
        />
      )}
      {sourceLibraryDocumentId && <input type="hidden" name="sourceLibraryDocumentId" value={sourceLibraryDocumentId} />}
      <input
        type="file"
        name="file"
        required
        className="text-[12.5px] file:mr-3 file:rounded-md file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-[12.5px] file:font-semibold"
      />
      <input name="name" placeholder="Display name (optional)" className={inputCls} />
      <input name="documentType" placeholder="Type (e.g. Valid ID)" className={inputCls} />
      <select name="visibility" defaultValue="Internal Only" className={inputCls}>
        <option value="Internal Only">Internal Only</option>
        <option value="Staff Only">Staff Only</option>
        <option value="Client Visible">Client Visible</option>
      </select>
      <SubmitButton />
    </form>
  );
}
