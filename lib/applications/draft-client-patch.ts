/**
 * What re-saving an application draft may write onto the draft's client record.
 *
 * Until 2026-10-06 a draft re-save copied the wizard form's identity straight onto the client
 * (`email: form.email || null`, …). When staff had picked an *existing* client, the hidden
 * new-client fields — typed earlier or filled by the browser's autofill — silently renamed that
 * client and replaced their email, with no client audit row. This helper is the rule that stops it:
 *
 * - A client that existed before the draft (picked as "Existing client", or a converted lead):
 *   identity, ownership and notes are never touched. Discovery fields only fill blanks.
 * - A client the wizard itself created for this draft: the form *is* that lead's record, so edits
 *   carry over — but an empty form value never clears what is stored.
 *
 * Pure (no I/O) so it is unit-tested in draft-client-patch.test.ts.
 */
import type { Client, ClientUpdate } from "@/lib/repositories/clients/client.entity";

export interface DraftClientFields {
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  dateOfBirth: string;
  address: string;
  /** Already normalised to a valid `clients.preferred_channel`, or null. */
  preferredChannel: string | null;
  leadSource: string;
  assignedUserId: string;
  notes: string;
  productInterest: string;
  estPremium: number | null;
  familySize: number | null;
  coverageTier: string;
}

type PatchableClient = Pick<
  Client,
  | "firstName"
  | "lastName"
  | "email"
  | "mobileNumber"
  | "dateOfBirth"
  | "address"
  | "preferredChannel"
  | "leadSource"
  | "assignedUserId"
  | "notes"
  | "productInterest"
  | "estPremium"
  | "familySize"
  | "coverageTier"
>;

const IDENTITY_KEYS = [
  "firstName",
  "lastName",
  "email",
  "mobileNumber",
  "dateOfBirth",
  "address",
  "preferredChannel",
  "leadSource",
  "assignedUserId",
  "notes",
] as const;
const DISCOVERY_KEYS = ["productInterest", "estPremium", "familySize", "coverageTier"] as const;

const isBlank = (value: unknown) => value == null || (typeof value === "string" && value.trim() === "");
const clean = (value: string | number | null) => (typeof value === "string" ? value.trim() : value);

/** How long before the draft a client must have existed to count as pre-existing. */
export const PRE_EXISTING_CLIENT_GRACE_MS = 60_000;

/** True when the client record predates the draft (it was picked, not created, by the wizard). */
export function clientPreExistedDraft(clientCreatedAt: string, draftCreatedAt: string): boolean {
  return new Date(draftCreatedAt).getTime() - new Date(clientCreatedAt).getTime() > PRE_EXISTING_CLIENT_GRACE_MS;
}

/** The fields that should change on the client; empty when nothing should be written. */
export function buildDraftClientPatch(
  existing: PatchableClient,
  fields: DraftClientFields,
  opts: { clientPreExisted: boolean },
): ClientUpdate {
  const patch: Record<string, string | number | null> = {};
  const consider = (key: keyof DraftClientFields & keyof PatchableClient, onlyFillBlank: boolean) => {
    const next = clean(fields[key]);
    if (isBlank(next)) return; // never clear a stored value from an empty form field
    const current = existing[key] as string | number | null;
    if (onlyFillBlank && !isBlank(current)) return;
    if (next !== current) patch[key] = next;
  };

  if (!opts.clientPreExisted) IDENTITY_KEYS.forEach((key) => consider(key, false));
  DISCOVERY_KEYS.forEach((key) => consider(key, opts.clientPreExisted));
  return patch as ClientUpdate;
}
