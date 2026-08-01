/**
 * Role → capability matrix (mirrors docs web/permissions.md and the design
 * prototype's permissions.jsx). Pure and isomorphic — usable from server
 * components, server actions, and client components alike.
 *
 * The DB stores granular roles (`users.role`: Owner/Admin/Assistant/Viewer);
 * the app reasons in the three design roles. The "View as" switcher in the
 * topbar is a client-side PREVIEW that can only narrow the effective role —
 * it never widens access and never gates real auth (sign out, session).
 */

export type AppRole = "admin" | "staff" | "agent";

/** Map a `users.role` DB value onto the design's three-role model. */
export function toAppRole(dbRole: string): AppRole {
  switch (dbRole) {
    case "Owner":
    case "Admin":
      return "admin";
    case "Assistant":
      return "staff";
    default:
      return "agent";
  }
}

/** Strictness order — used so a preview can only narrow, never widen. */
const ROLE_RANK: Record<AppRole, number> = { admin: 3, staff: 2, agent: 1 };
export const narrowerOrEqual = (candidate: AppRole, real: AppRole) =>
  ROLE_RANK[candidate] <= ROLE_RANK[real];

/** Modules match ScreenId plus the record-detail surfaces. */
export type PermModule =
  | "dashboard" | "prospects" | "clients" | "contact" | "applications"
  | "policies" | "renewals" | "claims" | "travel" | "payments" | "commissions" | "documents"
  | "tasks" | "relationship" | "reports" | "group" | "products" | "templates"
  | "settings";

type Cap = "full" | "edit" | "own" | "view" | "none";

const MATRIX: Record<PermModule, Record<AppRole, Cap>> = {
  dashboard:    { admin: "full", staff: "full", agent: "own" },
  prospects:    { admin: "full", staff: "full", agent: "own" },
  clients:      { admin: "full", staff: "full", agent: "own" },
  contact:      { admin: "full", staff: "full", agent: "own" },
  applications: { admin: "full", staff: "full", agent: "own" },
  policies:     { admin: "full", staff: "full", agent: "own" },
  renewals:     { admin: "full", staff: "full", agent: "own" },
  claims:       { admin: "full", staff: "full", agent: "own" },
  travel:       { admin: "full", staff: "full", agent: "own" },
  payments:     { admin: "full", staff: "full", agent: "own" },
  commissions:  { admin: "full", staff: "full", agent: "own" },
  documents:    { admin: "full", staff: "full", agent: "own" },
  tasks:        { admin: "full", staff: "full", agent: "own" },
  relationship: { admin: "full", staff: "full", agent: "view" },
  reports:      { admin: "full", staff: "full", agent: "own" },
  group:        { admin: "full", staff: "full", agent: "own" },
  products:     { admin: "full", staff: "view", agent: "view" },
  templates:    { admin: "full", staff: "edit", agent: "view" },
  settings:     { admin: "full", staff: "view", agent: "none" },
};

export type PermAction = "view" | "create" | "edit" | "delete" | "export";

export function cap(role: AppRole, module: PermModule): Cap {
  return MATRIX[module]?.[role] ?? "none";
}

export function can(role: AppRole, module: PermModule, action: PermAction): boolean {
  if (action === "view") return cap(role, module) !== "none";
  if (action === "delete") return role === "admin"; // hard-delete is Admin-only
  const c = cap(role, module); // create / edit / export
  return c === "full" || c === "edit" || c === "own";
}
