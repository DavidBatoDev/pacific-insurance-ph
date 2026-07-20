// Pacific Insurance PH — Roles & permissions (drives the "View as" persona switcher)
// PROTOTYPE ONLY. This is a preview affordance, NOT real authentication.
// Real auth + role assignment + server-side enforcement land in Epic 4.
// Rule set mirrors permissions.md — drive UI gating from Perms.can(), never ad-hoc checks.

// Two switchable personas for the demo (Staff default, Admin secondary).
const PI_PERSONAS = {
  eman: { id: "eman", name: "Eman Bondoc", first: "Eman", role: "staff", roleLabel: "Staff · Broker", sub: "The daily operator — full pipeline CRUD", color: "#2563eb", initials: "EB" },
  matt: { id: "matt", name: "Matt Nassr", first: "Matt", role: "admin", roleLabel: "Admin · Owner", sub: "Full access — settings, team, products", color: "#047857", initials: "MN" },
};
const PI_PERSONA_ORDER = ["eman", "matt"];

// Capability per module (screen id) per role: full | edit | own | view | none
// edit = create/edit but no delete (delete is Admin-only, cross-cutting).
// own  = own records only (Agent) — scoping is a list filter in the prototype.
const PI_MATRIX = {
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
  documents:    { admin: "full", staff: "full", agent: "own" },
  tasks:        { admin: "full", staff: "full", agent: "own" },
  relationship: { admin: "full", staff: "full", agent: "view" },
  reports:      { admin: "full", staff: "full", agent: "own" },
  group:        { admin: "full", staff: "full", agent: "own" },
  products:     { admin: "full", staff: "view", agent: "view" },
  templates:    { admin: "full", staff: "edit", agent: "view" },
  settings:     { admin: "full", staff: "view", agent: "none" },
};

const Perms = {
  current: "eman", // active persona id; App keeps this in sync with localStorage (pi_persona)
  person() { return PI_PERSONAS[this.current] || PI_PERSONAS.eman; },
  role() { return this.person().role; },
  cap(module) { const m = PI_MATRIX[module]; return m ? (m[this.role()] || "none") : "full"; },
  // can(module, action): action ∈ view | create | edit | delete | export
  can(module, action) {
    const role = this.role();
    if (action === "view") return this.cap(module) !== "none";
    if (action === "delete") return role === "admin"; // hard-delete is Admin-only
    const cap = this.cap(module); // create / edit / export
    if (cap === "full" || cap === "edit" || cap === "own") return true;
    return false; // view / none
  },
};

window.Perms = Perms;
window.PI_PERSONAS = PI_PERSONAS;
window.PI_PERSONA_ORDER = PI_PERSONA_ORDER;
