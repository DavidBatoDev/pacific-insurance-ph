"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/context";
import { fileInboxAttachment } from "@/lib/gmail/filing";
import { getScopedInboxMessage, InboxReviewError, linkInboxMessage, requireInboxActor } from "@/lib/gmail/review";
import type { FilingPurpose, InboxTargetKind } from "@/lib/repositories/inbox/inbox.entity";

export async function linkInboxMessageAction(messageId: string, target: { kind: InboxTargetKind; id: string }): Promise<ActionResult<string>> {
  try {
    const actor = await requireInboxActor();
    const communicationId = await linkInboxMessage(messageId, target, actor.id);
    const linked = await getScopedInboxMessage(messageId, actor.id);
    revalidatePath("/inbox");
    if (linked.clientId) revalidatePath(`/clients/${linked.clientId}`);
    return { ok: true, data: communicationId };
  } catch (error) {
    return { ok: false, error: error instanceof InboxReviewError ? error.message : "The message could not be linked. It may already be linked to another record or the record is no longer available. Refresh and review the current association." };
  }
}

export async function fileInboxAttachmentAction(
  messageId: string,
  partId: string,
  purpose: FilingPurpose,
  requirementId: string | null,
): Promise<ActionResult<string>> {
  try {
    const actor = await requireInboxActor();
    const documentId = await fileInboxAttachment(messageId, partId, purpose, requirementId, actor.id);
    const message = await getScopedInboxMessage(messageId, actor.id);
    revalidatePath("/inbox");
    revalidatePath("/documents");
    if (message.clientId) revalidatePath(`/clients/${message.clientId}`);
    for (const path of ["/prospects", "/applications", "/claims", "/travel", "/policies", "/renewals"]) revalidatePath(path);
    return { ok: true, data: documentId };
  } catch (error) {
    return { ok: false, error: error instanceof InboxReviewError ? error.message : "The PDF could not be filed. Check the Gmail connection, linked record's current workflow state, and checklist selection, then retry. An existing filing cannot be changed to a different purpose." };
  }
}
