/**
 * Staff sign-in addresses must belong to the agency's Google Workspace. Isomorphic: the invite
 * form shows the same rule the server enforces. The old CRM-only `pacificinsurance.ph` logins were
 * moved onto Workspace addresses in Phase J2 (`scripts/migrate-staff-emails.mjs`).
 */
export const STAFF_EMAIL_DOMAINS = ["pacificinsuranceph.com"] as const;

const LOCAL_PART = /^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?$/;

/**
 * Lower-cases and trims an address; returns null unless it is exactly one plain mailbox on an
 * allow-listed domain. Display names, lists, and header-injection characters are rejected.
 */
export function normalizeStaffEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (value.length > 254 || /[\s<>,;:"()[\]\\]/.test(value)) return null;
  const at = value.lastIndexOf("@");
  if (at <= 0 || value.indexOf("@") !== at) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!LOCAL_PART.test(local)) return null;
  return (STAFF_EMAIL_DOMAINS as readonly string[]).includes(domain) ? value : null;
}

/** Roles an invitation may grant; Owner is never delegated. */
export const INVITABLE_ROLES = ["Admin", "Assistant", "Viewer"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

/** What staff see for each DB role (`users.role`), on the Team tab and in invitation emails. */
export const STAFF_ROLE_LABELS: Record<string, string> = {
  Owner: "Admin · Owner",
  Admin: "Admin",
  Assistant: "Staff",
  Viewer: "Agent",
};
