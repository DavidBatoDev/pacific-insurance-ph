"use client";

import { attachRequirementDocumentAction, beginRequirementAttachmentUploadAction } from "@/app/(app)/documents/requirement-attachment-actions";
import type { ActionResult } from "@/lib/actions/context";
import type { RequirementAttachmentReceipt, RequirementAttachmentSelection, RequirementTarget } from "@/lib/documents/requirement-attachment.types";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

type DeviceAttachmentAttempt = {
  path?: string;
  inFlight?: Promise<ActionResult<RequirementAttachmentReceipt>>;
};
// File identity prevents retaining bytes after the wizard/picker releases its selection.
const deviceAttachments = new WeakMap<File, Map<string, DeviceAttachmentAttempt>>();

/** Upload bytes directly to Storage; server actions receive metadata and source IDs only. */
export async function attachRequirementSelection(target: RequirementTarget, selection: RequirementAttachmentSelection): Promise<ActionResult<RequirementAttachmentReceipt>> {
  try {
    if (selection.type === "email") {
      return await attachRequirementDocumentAction(target, {
        type: "email",
        messageId: selection.attachment.messageId,
        partId: selection.attachment.partId,
        confirmOtherRecord: selection.confirmOtherRecord,
      });
    }
    const { file } = selection;
    const key = `${target.kind}:${target.recordId}:${target.requirementId}`;
    let targets = deviceAttachments.get(file);
    if (!targets) { targets = new Map(); deviceAttachments.set(file, targets); }
    let attempt = targets.get(key);
    if (!attempt) { attempt = {}; targets.set(key, attempt); }
    if (attempt.inFlight) return await attempt.inFlight;
    const state = attempt;
    const operation = (async (): Promise<ActionResult<RequirementAttachmentReceipt>> => {
      const mimeType = file.type || "application/octet-stream";
      if (!state.path) {
        const begin = await beginRequirementAttachmentUploadAction(target, { fileName: file.name, mimeType, size: file.size });
        if (!begin.ok) return begin;
        const upload = await getSupabaseBrowser().storage.from("documents").uploadToSignedUrl(begin.data.path, begin.data.token, file, { contentType: mimeType });
        if (upload.error) return { ok: false, error: "The file could not be uploaded. Choose the file again and retry." };
        state.path = begin.data.path;
      }
      // Reuse the immutable uploaded source after an uncertain receipt response.
      // Every explicit retry still checks current authorization in the receipt action.
      return await attachRequirementDocumentAction(target, { type: "upload", path: state.path, fileName: file.name, mimeType, size: file.size });
    })();
    state.inFlight = operation;
    try { return await operation; }
    finally { state.inFlight = undefined; }
  } catch {
    return { ok: false, error: "The attachment could not be saved. Check your connection and retry." };
  }
}
