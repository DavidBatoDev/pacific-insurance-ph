import "server-only";

import { getInboxRepository } from "@/lib/repositories/inbox";
import type { InboxCorrectionImpact, InboxCorrectionInput, InboxCorrectionTarget } from "@/lib/repositories/inbox/inbox.entity";
import { RepositoryError } from "@/lib/repositories/types";
import { getScopedInboxMessage, INBOX_TARGET_KINDS, InboxReviewError, requireInboxActor, validateInboxId } from "./review";

function validateTarget(target: InboxCorrectionTarget): void {
  if (!target || typeof target !== "object" || !INBOX_TARGET_KINDS.includes(target.kind))
    throw new InboxReviewError("Choose an existing record for the corrected association.");
  validateInboxId(target.id);
}

async function correctionActor(messageId: string) {
  const actor = await requireInboxActor();
  if (actor.appRole !== "admin") throw new InboxReviewError("Only an active Admin can correct an email association.", 403);
  const message = await getScopedInboxMessage(messageId, actor.id);
  if (!message.targetId) throw new InboxReviewError("Link this email before correcting its association.");
  return actor;
}

function validateCorrection(input: InboxCorrectionInput): void {
  if (!input || typeof input !== "object") throw new InboxReviewError("Review the correction before saving.");
  validateInboxId(input.messageId);
  validateTarget(input.target);
  if (typeof input.reason !== "string" || !input.reason.trim() || input.reason.trim().length > 2000)
    throw new InboxReviewError("Enter a correction reason of up to 2,000 characters.");
  if (typeof input.revision !== "string" || !/^[a-f0-9]{64}$/.test(input.revision))
    throw new InboxReviewError("Review the current impact before correcting the link.");
  if (typeof input.confirmCrossClient !== "boolean" || !Array.isArray(input.filings) || !Array.isArray(input.receipts))
    throw new InboxReviewError("Review each affected filing and checklist receipt.");
  const parts = new Set<string>();
  for (const filing of input.filings) {
    if (!filing || typeof filing.partId !== "string" || parts.has(filing.partId)
      || (filing.action !== "keep" && filing.action !== "move")
      || (filing.requirementId !== null && typeof filing.requirementId !== "string")
      || (filing.action === "keep" && filing.requirementId !== null))
      throw new InboxReviewError("Choose one disposition for each filed attachment.");
    parts.add(filing.partId);
    if (filing.requirementId !== null) validateInboxId(filing.requirementId);
  }
  const usages = new Set<string>();
  for (const receipt of input.receipts) {
    if (!receipt || typeof receipt.usageId !== "string" || usages.has(receipt.usageId)
      || (receipt.action !== "keep" && receipt.action !== "detach")
      || (receipt.remainingStatus !== null && receipt.remainingStatus !== "Pending" && receipt.remainingStatus !== "Incomplete")
      || (receipt.action === "keep" && receipt.remainingStatus !== null))
      throw new InboxReviewError("Choose one disposition for each checklist receipt.");
    validateInboxId(receipt.usageId.startsWith("document:") ? receipt.usageId.slice("document:".length) : receipt.usageId);
    usages.add(receipt.usageId);
  }
}

function correctionError(error: unknown): never {
  if (error instanceof RepositoryError) {
    if (error.code === "42501")
      throw new InboxReviewError("Only an active Admin with access to both records can correct this association.", 403);
    if (error.code === "P0001")
      throw new InboxReviewError("The association or its evidence changed, or is being edited. Review the impact again before correcting the link.", 409);
    if (error.code === "22023")
      throw new InboxReviewError("The correction could not be applied. Review the affected filings, checklist receipts and current record statuses, then refresh the impact.");
  }
  throw error;
}

export async function previewInboxCorrection(messageId: string, target: InboxCorrectionTarget): Promise<InboxCorrectionImpact> {
  const actor = await correctionActor(messageId);
  validateTarget(target);
  try {
    return await getInboxRepository().previewCorrection(messageId, target, actor.id);
  } catch (error) { correctionError(error); }
}

export async function correctInboxMessage(input: InboxCorrectionInput): Promise<string> {
  validateCorrection(input);
  const actor = await correctionActor(input.messageId);
  try {
    return await getInboxRepository().correctMessage({ ...input, reason: input.reason.trim() }, actor.id);
  } catch (error) { correctionError(error); }
}
