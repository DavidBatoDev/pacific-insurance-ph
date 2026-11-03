import "server-only";

import { getCurrentUser } from "@/lib/auth/current-user";
import { toAppRole } from "@/lib/auth/permissions";
import { getApplicationRequirementsRepository } from "@/lib/repositories/application-requirements";
import { getCarrierWorkflowsRepository } from "@/lib/repositories/carrier-workflows";
import { getClaimRequirementsRepository } from "@/lib/repositories/claim-requirements";
import { getInboxRepository } from "@/lib/repositories/inbox";
import type { FilingPurpose, InboxMessage, InboxTarget, InboxTargetKind } from "@/lib/repositories/inbox/inbox.entity";
import { suggestInboxTargets, type MatchSuggestion } from "./matching";

export class InboxReviewError extends Error {
  constructor(message: string, public readonly status: number = 400) { super(message); this.name = "InboxReviewError"; }
}

export const INBOX_TARGET_KINDS: readonly InboxTargetKind[] = ["client", "application", "claim", "renewal", "travel", "policy"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateInboxId(id: string): void {
  if (!UUID.test(id)) throw new InboxReviewError("Correspondence not found.", 404);
}

/** Do not accept a browser-supplied actor or trust a role captured by an earlier page load. */
export async function requireInboxActor(actorId?: string) {
  const user = await getCurrentUser();
  if (!user || user.status !== "Active") throw new InboxReviewError("An active account is required.", 401);
  if (actorId !== undefined && user.id !== actorId) throw new InboxReviewError("This action is not permitted.", 403);
  return { ...user, appRole: toAppRole(user.role) };
}

export async function getScopedInboxMessage(messageId: string, actorId?: string): Promise<InboxMessage> {
  const actor = await requireInboxActor(actorId);
  validateInboxId(messageId);
  const message = await getInboxRepository().getVisible(messageId, actor.id);
  if (!message) throw new InboxReviewError("Correspondence not found.", 404);
  return message;
}

export interface InboxRequirementOption { id: string; label: string; status: string }
export interface InboxPurposeOption { value: FilingPurpose; label: string; requiresRequirement: boolean }
export function inboxPurposeOptions(kind: InboxTargetKind): InboxPurposeOption[] {
  const options: InboxPurposeOption[] = [{ value: "document", label: "Supporting document", requiresRequirement: false }];
  if (kind === "client" || kind === "application") options.push({ value: "proposal", label: "Illustrative proposal", requiresRequirement: false });
  if (kind === "application") options.push({ value: "application_requirement", label: "Application checklist receipt", requiresRequirement: true });
  if (kind === "claim") options.push({ value: "claim_requirement", label: "Claim checklist receipt", requiresRequirement: true });
  if (kind === "travel") options.push(
    { value: "travel_requirement", label: "Travel checklist receipt", requiresRequirement: true },
    { value: "travel_policy", label: "Issued travel policy", requiresRequirement: false },
    { value: "travel_application_copy", label: "Travel application copy", requiresRequirement: false },
  );
  return options;
}

/** Caller must obtain the message through getVisible before calling other record repositories. */
export async function getInboxRequirements(message: InboxMessage): Promise<InboxRequirementOption[]> {
  if (!message.targetId || !message.targetKind || !message.clientId) return [];
  switch (message.targetKind) {
    case "application": return (await getApplicationRequirementsRepository().listByApplication(message.targetId)).map((row) => ({ id: row.id, label: row.documentName + (row.appliesTo ? ` · ${row.appliesTo}` : ""), status: row.status }));
    case "claim": return (await getClaimRequirementsRepository().listByClaim(message.targetId)).map((row) => ({ id: row.id, label: row.documentName + (row.appliesTo ? ` · ${row.appliesTo}` : ""), status: row.status }));
    case "travel": return (await getCarrierWorkflowsRepository().listTravelRequirements(message.targetId)).map((row) => ({ id: row.id, label: row.documentName + (row.appliesTo ? ` · ${row.appliesTo}` : ""), status: row.status }));
    default: return [];
  }
}

/** The list never serializes full text or provider headers for unopened messages. */
export type InboxListMessage = Pick<InboxMessage, "id" | "subject" | "fromAddress" | "fromName" | "receivedAt" | "isAutoReply" | "targetId" | "filedParts"> & { attachmentCount: number };

export interface InboxReviewData {
  messages: InboxListMessage[];
  page: number;
  mayHaveNextPage: boolean;
  selected: InboxMessage | null;
  targets: InboxTarget[];
  linkedTarget: InboxTarget | null;
  suggestions: MatchSuggestion[];
  requirements: InboxRequirementOption[];
  purposes: InboxPurposeOption[];
  canLink: boolean;
  canFile: boolean;
}

export async function getInboxReviewData(actorId: string, selectedId?: string, page = 1): Promise<InboxReviewData> {
  const actor = await requireInboxActor(actorId);
  if (!Number.isSafeInteger(page) || page < 1 || page > 21474836) throw new InboxReviewError("Correspondence page not found.", 404);
  const repository = getInboxRepository();
  const rows = await repository.listVisible(actor.id, (page - 1) * 100);
  const messages = rows.map(({ id, subject, fromAddress, fromName, receivedAt, isAutoReply, targetId, filedParts, attachments }) => ({
    id, subject, fromAddress, fromName, receivedAt, isAutoReply, targetId, filedParts, attachmentCount: attachments.length,
  }));
  // Direct deep links cross the same SQL boundary independently of the current page.
  const selected = selectedId ? await getScopedInboxMessage(selectedId, actor.id) : rows[0] ?? null;
  const targets = await repository.listTargets(actor.id);
  const linkedTarget = selected?.targetId ? targets.find((target) => target.kind === selected.targetKind && target.id === selected.targetId) ?? null : null;
  let suggestions: MatchSuggestion[] = [];
  if (actor.appRole === "admin" && selected && !selected.targetId) {
    const threadTarget = await repository.getThreadTarget(selected.googleSubject, selected.gmailThreadId);
    // Never expose an established target outside the actor's currently authorized target set.
    const scopedThreadTarget = threadTarget && targets.find((target) => target.id === threadTarget.id && target.kind === threadTarget.kind) || null;
    suggestions = suggestInboxTargets(selected, targets, scopedThreadTarget);
  }
  const canFile = actor.appRole !== "agent";
  return {
    messages, selected, linkedTarget, suggestions, page, mayHaveNextPage: rows.length === 100,
    targets: actor.appRole === "admin" ? targets : [],
    requirements: selected && canFile ? await getInboxRequirements(selected) : [],
    purposes: selected?.targetKind && canFile ? inboxPurposeOptions(selected.targetKind) : [],
    canLink: actor.appRole === "admin", canFile,
  };
}

export async function linkInboxMessage(messageId: string, target: { kind: InboxTargetKind; id: string }, actorId: string): Promise<string> {
  const actor = await requireInboxActor(actorId);
  if (actor.appRole !== "admin") throw new InboxReviewError("Only an Admin can release unassigned correspondence.", 403);
  validateInboxId(messageId);
  validateInboxId(target.id);
  if (!INBOX_TARGET_KINDS.includes(target.kind)) throw new InboxReviewError("Choose a valid record.");
  await getScopedInboxMessage(messageId, actor.id);
  // The RPC resolves the client and current permissions itself; never accept clientId from this caller.
  return getInboxRepository().linkMessage(messageId, target, actor.id);
}
