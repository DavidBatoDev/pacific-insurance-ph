// Pacific Insurance PH — Lead Lifecycle data (two axes: lead_stage + lead_status)
const PP_STAFF = { eman: "Eman Bondoc", matt: "Matt Nassr", joy: "Joy Mercado", bea: "Bea Lim" };

// Product color coding
const PP_PRODUCTS = {
  "Blue Royale": "#059669",
  "Select": "#2563eb",
  "Travel Insurance": "#d97706",
  "BC Flexi": "#7c3aed",
  "FlexiShield": "#0891b2",
  "Premier Health": "#db2777",
  "Family Shield": "#0d9488",
};

/* ---------- Axis 1: lead_stage (ONE list — feeds both Kanban + funnel) ---------- */
// 6 board stages, then two exits: Converted (success) and Lost (terminal).
const PP_STAGES = ["New Lead", "Contacted", "Discovery", "Proposal", "Product Selected", "Application Started"];
const PP_STAGE_META = {
  "New Lead": { color: "#64748b", health: "good" },
  "Contacted": { color: "#2563eb", health: "good" },
  "Discovery": { color: "#0891b2", health: "good" },
  "Proposal": { color: "#7c3aed", health: "watch" },
  "Product Selected": { color: "#d97706", health: "good" },
  "Application Started": { color: "#059669", health: "good" },
  "Converted": { color: "#047857", health: "good" },
  "Lost": { color: "#dc2626", health: "risk" },
};

/* ---------- Axis 2: lead_status (orthogonal disposition chip) ---------- */
const PP_STATUSES = ["New", "Attempted", "Connected", "Qualified", "Nurturing", "Unresponsive"];
const PP_STATUS_TONE = { New: "slate", Attempted: "amber", Connected: "blue", Qualified: "green", Nurturing: "violet", Unresponsive: "red" };

// Stage close-probability (lead_stage → %) — the one tunable constant behind weighted value.
const PP_STAGE_PROB = { "New Lead": 0.10, "Contacted": 0.20, "Discovery": 0.35, "Proposal": 0.55, "Product Selected": 0.80, "Application Started": 0.95 };
const weightedValue = (lead) => Math.round((lead.est_premium || lead.value || 0) * (PP_STAGE_PROB[lead.stage] || 0));
const PP_STATUS_HINT = {
  New: "Just entered — not yet worked",
  Attempted: "Contacted, not reached",
  Connected: "Two-way contact established",
  Qualified: "Discovery complete — ready for a proposal",
  Nurturing: "Long-term hold",
  Unresponsive: "Went quiet",
};

/* ---------- Action → suggestion mapping (drives Advance-Lead presets) ---------- */
// nextStage: "next" advances one column; null keeps the current stage; a name jumps to it.
const PP_ADVANCE_MAP = {
  "Send Email": { status: "Attempted", stageTo: "Contacted", label: "Sent first email" },
  "Send Brochure": { status: "Attempted", stageTo: "Contacted", label: "Sent brochure" },
  "Discovery call — reached": { status: "Connected", stageTo: "Discovery", label: "Logged discovery call (reached)" },
  "Discovery call — no answer": { status: "Attempted", stageTo: null, label: "Logged discovery call (no answer)" },
  "Mark Discovery Complete": { status: "Qualified", stageTo: "Proposal", label: "Marked discovery complete" },
  "Send Proposal": { status: null, stageTo: "Proposal", label: "Sent proposal" },
  "Client picks a plan": { status: null, stageTo: "Product Selected", label: "Client picked a plan" },
  "Convert to Application": { status: "Qualified", stageTo: "Application Started", label: "Converting to application" },
  "Drag": { status: null, stageTo: null, label: "Moved on the board" },
};
// The template that "Also send…" fires per suggested action (reuses the Engage composer)
const PP_ACTION_TEMPLATE = {
  "Send Email": "Send Email", "Send Brochure": "Send Brochure",
  "Mark Discovery Complete": "Send Intake / Application Form", "Send Proposal": "Send Intake / Application Form",
};

const nextStage = (stage) => {
  const i = PP_STAGES.indexOf(stage);
  return i >= 0 && i < PP_STAGES.length - 1 ? PP_STAGES[i + 1] : PP_STAGES[PP_STAGES.length - 1];
};

/* ---------- Seed leads (each is a unified contact at lifecycle_stage = Lead) ---------- */
const PP_LEADS = [
  // New Lead
  { id: 1, rid: "000501", name: "John Santos", product: "Blue Royale", staff: "eman", stage: "New Lead", status: "New", last: "Inquiry via website", follow: 1, prio: "high", value: 185000 },
  { id: 2, rid: "000502", name: "Anna Cruz", product: "Select", staff: "joy", stage: "New Lead", status: "New", last: "Referral from R. Velasco", follow: 0, prio: "med", value: 92000 },
  { id: 3, rid: "000503", name: "Kevin Lao", product: "Travel Insurance", staff: "bea", stage: "New Lead", status: "Attempted", last: "FB Messenger inquiry", follow: 2, prio: "low", value: 18000 },
  // Contacted
  { id: 4, rid: "000504", name: "Maria Cruz", product: "Blue Royale", staff: "eman", stage: "Contacted", status: "Attempted", last: "Brochure sent · no reply yet", follow: -1, prio: "high", value: 156000 },
  { id: 5, rid: "000505", name: "Tonio Reyes", product: "Family Shield", staff: "joy", stage: "Contacted", status: "Connected", last: "Replied — wants plan details", follow: 1, prio: "med", value: 132000 },
  { id: 17, rid: "000517", name: "Rita Gonzales", product: "Select", staff: "joy", stage: "Contacted", status: "Unresponsive", last: "3 follow-ups · no reply", follow: -5, prio: "low", value: 64000 },
  // Discovery
  { id: 7, rid: "000507", name: "Robert Lim", product: "Premier Health", staff: "eman", stage: "Discovery", status: "Connected", last: "Discovery call done", follow: 1, prio: "high", value: 240000 },
  { id: 8, rid: "000508", name: "Carla Mendez", product: "Blue Royale", staff: "joy", stage: "Discovery", status: "Qualified", last: "Needs assessment complete", follow: 0, prio: "med", value: 168000 },
  { id: 9, rid: "000509", name: "Danilo Reyes", product: "Select", staff: "bea", stage: "Discovery", status: "Attempted", last: "Couldn't reach for call", follow: -2, prio: "med", value: 76000 },
  // Proposal
  { id: 10, rid: "000510", name: "Daniel Yu", product: "Premier Health", staff: "eman", stage: "Proposal", status: "Connected", last: "Proposal sent 5d ago", follow: -2, prio: "high", value: 265000, proposal_status: "Sent", proposal_decision: "Awaiting Decision" },
  { id: 11, rid: "000511", name: "Grace Tan", product: "Blue Royale", staff: "matt", stage: "Proposal", status: "Connected", last: "Awaiting decision", follow: 1, prio: "high", value: 198000, proposal_status: "Received" },
  { id: 12, rid: "000512", name: "Marco Cua", product: "Select", staff: "joy", stage: "Proposal", status: "Nurturing", last: "Negotiating premium", follow: 0, prio: "med", value: 110000, proposal_status: "Sent", proposal_decision: "Negotiating" },
  // Product Selected
  { id: 13, rid: "000513", name: "Patricia Lim", product: "Blue Royale", staff: "eman", stage: "Product Selected", status: "Qualified", last: "Chose Blue Royale", follow: 1, prio: "high", value: 185000 },
  { id: 14, rid: "000514", name: "Allan Ong", product: "Family Shield", staff: "joy", stage: "Product Selected", status: "Connected", last: "Confirmed coverage level", follow: 2, prio: "med", value: 148000 },
  { id: 6, rid: "000506", name: "Liza Park", product: "Select", staff: "joy", stage: "Product Selected", status: "Nurturing", last: "Deciding on payment plan", follow: 3, prio: "low", value: 88000 },
  // Application Started
  { id: 15, rid: "000515", name: "Bianca Sy", product: "Premier Health", staff: "eman", stage: "Application Started", status: "Qualified", last: "Filling application", follow: 0, prio: "high", value: 220000 },
  { id: 16, rid: "000516", name: "Noel Dela Paz", product: "Blue Royale", staff: "matt", stage: "Application Started", status: "Qualified", last: "Submitting documents", follow: 1, prio: "med", value: 175000 },
];

// Forecasting fields (only meaningful while lifecycle_stage = Lead): est_premium (deal size) + expected_close_date.
// est_premium reuses the deal value already on each lead; expected_close_date is derived deterministically
// (later-stage leads close sooner) so the Forecast timeline has This month / Next / Later buckets. Anchor: Jul 2026.
const PP_CLOSE_MONTHS = { "New Lead": 3, "Contacted": 2, "Discovery": 2, "Proposal": 1, "Product Selected": 0, "Application Started": 0 };
PP_LEADS.forEach((l) => {
  l.est_premium = l.value;
  const base = PP_CLOSE_MONTHS[l.stage] != null ? PP_CLOSE_MONTHS[l.stage] : 2;
  const monthsOut = Math.max(0, base - (l.id % 2)); // pull ~half of each stage one bucket earlier
  const d = new Date(2026, 6 + monthsOut, 8 + (l.id * 7) % 18);
  l.expected_close_date = d.toISOString().slice(0, 10);
});

// Exit counters (this month) — updated as leads convert / are lost
const PP_EXITS = { Converted: 15, Lost: 4, ConvertedValue: 3950000 };

const PP_PROPOSALS = [
  { name: "Daniel Yu", product: "Premier Health", step: 2, status: "Awaiting Decision", days: "Sent 5 days ago", staff: "eman" },
  { name: "Grace Tan", product: "Blue Royale", step: 2, status: "Awaiting Decision", days: "Sent 2 days ago", staff: "matt" },
  { name: "Marco Cua", product: "Select", step: 2, status: "Negotiating", days: "Sent 8 days ago", staff: "joy" },
  { name: "Carla Mendez", product: "Blue Royale", step: 0, status: "Proposal Requested", days: "Requested 1 day ago", staff: "joy" },
  { name: "Robert Lim", product: "Premier Health", step: 1, status: "Proposal Received", days: "From carrier today", staff: "eman" },
];

const PP_PRODUCT_INTEREST = [
  { name: "Blue Royale", pct: 46, color: "#059669" },
  { name: "Select", pct: 28, color: "#2563eb" },
  { name: "Travel Insurance", pct: 15, color: "#d97706" },
  { name: "BC Flexi", pct: 8, color: "#7c3aed" },
  { name: "FlexiShield", pct: 3, color: "#0891b2" },
];

const PP_FOLLOWUPS = [
  { action: "Call John Santos", sub: "New lead · discovery call", product: "Blue Royale", when: "Today, 10:00 AM", urg: "today", staff: "eman", icon: "phone" },
  { action: "Send brochure to Maria Cruz", sub: "Contacted · no reply yet", product: "Blue Royale", when: "Overdue 1 day", urg: "over", staff: "eman", icon: "mail" },
  { action: "Follow up proposal with Daniel Yu", sub: "Awaiting decision · 5 days", product: "Premier Health", when: "Overdue 2 days", urg: "over", staff: "eman", icon: "fileText" },
  { action: "Send intake form to Anna Cruz", sub: "New referral lead", product: "Select", when: "Today, 3:00 PM", urg: "today", staff: "joy", icon: "clipboard" },
  { action: "Re-nurture Rita Gonzales", sub: "Unresponsive · consider Mark Lost", product: "Select", when: "Overdue 5 days", urg: "over", staff: "joy", icon: "phone" },
  { action: "Check in with Grace Tan", sub: "Proposal sent · decision pending", product: "Blue Royale", when: "Tomorrow", urg: "soon", staff: "matt", icon: "phone" },
];

const PP_INTAKE = { sent: 28, completed: 19, awaiting: 9, recent: [
  { name: "Carla Mendez", when: "2h ago" },
  { name: "Tonio Reyes", when: "5h ago" },
  { name: "Liza Park", when: "Yesterday" },
] };

const PP_ACTIVITY = [
  { type: "convert", who: "Eman Bondoc", text: "converted <b>Diego Mercado</b> — stage → Application Started, lifecycle → Applicant", time: "22 minutes ago" },
  { type: "proposal_sent", who: "Matt Nassr", text: "advanced <b>Grace Tan</b> → Proposal Sent · status Connected", time: "1 hour ago" },
  { type: "discovery", who: "Eman Bondoc", text: "advanced <b>Robert Lim</b> → Discovery · status Connected", time: "2 hours ago" },
  { type: "brochure", who: "Joy Mercado", text: "sent brochure to <b>Tonio Reyes</b> — status → Attempted", time: "3 hours ago" },
  { type: "proposal_req", who: "Joy Mercado", text: "marked <b>Carla Mendez</b> discovery complete — status → Qualified", time: "4 hours ago" },
  { type: "inquiry", who: "System", text: "new lead created — <b>Kevin Lao</b> (Travel Insurance) · stage New Lead", time: "5 hours ago" },
  { type: "intake", who: "Carla Mendez", text: "completed <b>intake form</b>", time: "Yesterday, 4:40 PM" },
];

const PP_QUICK = [
  { label: "New Lead", icon: "plus", primary: true },
  { label: "Send Intake Form", icon: "clipboard", action: "Send Intake / Application Form" },
  { label: "Send Brochure", icon: "folder", action: "Send Brochure" },
  { label: "Request Proposal", icon: "fileText", action: "Request Proposal" },
  { label: "Log Discovery Call", icon: "phone", action: "Log Discovery Call" },
];

window.PPData = {
  PP_STAFF, PP_PRODUCTS, PP_STAGES, PP_STAGE_META, PP_STATUSES, PP_STATUS_TONE, PP_STATUS_HINT,
  PP_ADVANCE_MAP, PP_ACTION_TEMPLATE, nextStage, PP_STAGE_PROB, weightedValue,
  PP_LEADS, PP_EXITS, PP_PROPOSALS, PP_PRODUCT_INTEREST, PP_FOLLOWUPS, PP_INTAKE, PP_ACTIVITY, PP_QUICK,
  // Two-phase Convert to Application — mutate the shared board data so state survives the board
  // unmounting (e.g. converting from a Contact Profile). Board React listeners keep the live UI in sync.
  _convertPrior: {},
  leadConvertStart(rid) {
    const l = PP_LEADS.find((x) => x.rid === rid); if (!l) return;
    if (this._convertPrior[rid] == null) this._convertPrior[rid] = l.stage;
    l.stage = "Application Started"; l.converting = true; l.last = "Application wizard open";
  },
  leadConvertCommit(rid) {
    const i = PP_LEADS.findIndex((x) => x.rid === rid);
    if (i >= 0) { const l = PP_LEADS[i]; PP_EXITS.Converted += 1; PP_EXITS.ConvertedValue += (l.value || 0); PP_LEADS.splice(i, 1); }
    delete this._convertPrior[rid];
  },
  leadConvertAbandon(rid) {
    const l = PP_LEADS.find((x) => x.rid === rid);
    if (l) { l.stage = this._convertPrior[rid] || l.stage; l.converting = false; l.last = "Wizard discarded — still a lead"; }
    delete this._convertPrior[rid];
  },
  // Proposal micro-status (proposal_status / proposal_decision) — shared so the board pill and the
  // Contact Profile stepper stay in sync. Keyed by record id (rid).
  _proposals: PP_LEADS.reduce((m, l) => { if (l.proposal_status) m[l.rid] = { status: l.proposal_status, decision: l.proposal_decision || null }; return m; }, {}),
  proposalOf(rid) { return this._proposals[rid] || null; },
  setProposal(rid, patch) {
    this._proposals[rid] = { ...(this._proposals[rid] || {}), ...patch };
    const l = PP_LEADS.find((x) => x.rid === rid);
    if (l) { if (patch.status) l.proposal_status = patch.status; if (patch.decision) l.proposal_decision = patch.decision; }
    return this._proposals[rid];
  },
  // Back-compat alias for any consumer still reading PP_PROSPECTS (e.g. Engage recipient picker)
  get PP_PROSPECTS() { return PP_LEADS.map((p) => ({ ...p, pipeStage: p.stage, record_id: p.rid })); },
};
