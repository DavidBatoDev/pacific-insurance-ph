import type { InboxMessage, InboxTarget } from "@/lib/repositories/inbox/inbox.entity";

export type MatchSuggestion = {
  target: InboxTarget;
  reasons: string[];
  warnings: string[];
  /** Evidence is never authorization: every suggestion needs an Admin's confirmation. */
  requiresReview: true;
  consistent: boolean;
};

type MatchMessage = Pick<InboxMessage, "subject" | "bodyText" | "fromAddress" | "toAddresses" | "ccAddresses" | "isAutoReply">;

/** CRM-owned references only; ordinary names and arbitrary numbers are not identifiers. */
export function extractCrmReferences(text: string): string[] {
  return [...new Set((text.toUpperCase().match(/\b[A-Z]{2,8}-\d{4}-\d{4,8}\b/g) ?? []))];
}

function key(target: InboxTarget): string { return `${target.kind}:${target.id}`; }
function participantsMatch(message: MatchMessage, target: InboxTarget): boolean {
  // A recipient alone is not proof that the external sender is an expected participant.
  return target.participants.some((address) => address.trim().toLowerCase() === message.fromAddress.trim().toLowerCase());
}

/** Repository-owned label contract: source reference · optional policy number · client name. */
function hasPolicyReference(text: string, target: InboxTarget): boolean {
  if (target.kind !== "policy" && target.kind !== "renewal" && target.kind !== "travel") return false;
  const parts = target.label.split(" · ");
  if (parts.length < 3 || !parts[1].trim()) return false;
  const escaped = parts[1].trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Z0-9])${escaped}(?=$|[^A-Z0-9])`, "i").test(text);
}

export function suggestInboxTargets(
  message: MatchMessage,
  targets: InboxTarget[],
  threadTarget: InboxTarget | null = null,
): MatchSuggestion[] {
  const messageText = `${message.subject}\n${message.bodyText}`;
  const refs = extractCrmReferences(messageText);
  const unique = new Map(targets.map((target) => [key(target), target]));
  if (threadTarget) unique.set(key(threadTarget), threadTarget);
  const referenceMatches = [...unique.values()].filter((target) =>
    extractCrmReferences(target.label).some((reference) => refs.includes(reference)) || hasPolicyReference(messageText, target),
  );
  const referencedClients = new Set(referenceMatches.map((target) => target.clientId));
  const knownRefs = new Set([...unique.values()].flatMap((target) => extractCrmReferences(target.label)));
  const unknownReference = refs.some((reference) => !knownRefs.has(reference));
  const suggestions: MatchSuggestion[] = [];
  for (const target of unique.values()) {
    const established = threadTarget !== null && key(threadTarget) === key(target);
    const exactReference = referenceMatches.some((item) => key(item) === key(target));
    const expectedSender = participantsMatch(message, target);
    if (!established && !exactReference && !expectedSender) continue;
    const reasons: string[] = [];
    if (established) reasons.push("Previously linked Gmail thread");
    if (exactReference) reasons.push("Exact record reference in message");
    if (expectedSender) reasons.push("Sender matches a recorded participant");
    const warnings: string[] = [];
    if (!expectedSender) warnings.push("Sender is not a recorded participant. Confirm their identity independently.");
    if (referencedClients.size > 1 || (referencedClients.size === 1 && !referencedClients.has(target.clientId)))
      warnings.push("Message references another client or multiple clients.");
    if (referenceMatches.some((item) => item.clientId === target.clientId && key(item) !== key(target) && item.kind !== "client" && target.kind !== "client"))
      warnings.push("Message references another record. Check the intended record before linking.");
    if (unknownReference) warnings.push("A CRM reference is outside the available target list. Review it manually.");
    if (message.isAutoReply) warnings.push("Automatic reply; not proof of a business decision or document receipt.");
    if (!established && !exactReference) warnings.push("An email address alone does not identify the intended record.");
    suggestions.push({ target, reasons, warnings, requiresReview: true, consistent: warnings.length === 0 });
  }
  // Established mapping is evidence first, not permission to silently reuse a conflicting match.
  return suggestions.sort((a, b) =>
    Number(b.reasons.includes("Previously linked Gmail thread")) - Number(a.reasons.includes("Previously linked Gmail thread")) ||
    Number(b.consistent) - Number(a.consistent) || b.reasons.length - a.reasons.length || key(a.target).localeCompare(key(b.target)),
  ).slice(0, 8);
}
