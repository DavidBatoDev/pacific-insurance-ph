/**
 * Lead Lifecycle constants shared by the board, list, forecast, Advance-Lead
 * modal and Contact Profile chips (client-safe).
 */

import type { Tone } from "./tone";

/** Axis 1 — lead_stage: the six board columns (exits: Converted / Lost). */
export const LEAD_BOARD_STAGES = [
  "New Lead",
  "Contacted",
  "Discovery",
  "Proposal",
  "Product Selected",
  "Application Started",
] as const;
export type LeadStage = (typeof LEAD_BOARD_STAGES)[number];

/**
 * The forward-only spine (`docs/lead-stage-status.md`): a lead only ever moves to the
 * immediately following stage (or to Lost, which is a separate action — not a stage value).
 * Returns null at the final stage, or for an unknown/terminal stage such as Lost/Converted.
 */
export function nextLeadStage(stage: string | null | undefined): LeadStage | null {
  const index = LEAD_BOARD_STAGES.indexOf((stage ?? "") as LeadStage);
  if (index === -1) return null;
  return LEAD_BOARD_STAGES[index + 1] ?? null;
}

/** The stages selectable from `stage`: itself plus the next one. Backward jumps and skips are not offered. */
export function allowedLeadStages(stage: string | null | undefined): string[] {
  const current = stage ?? LEAD_BOARD_STAGES[0];
  const next = nextLeadStage(current);
  return next ? [current, next] : [current];
}

/**
 * Defaults attached to the lifecycle action that opened the Advance popup. Generic UI actions
 * (profile/list Advance and board drag) deliberately are not listed: they do not describe an
 * interaction worth writing to the permanent timeline, and they do not imply a follow-up cadence.
 */
const ADVANCE_ACTION_DEFAULTS: Record<string, { note: string; followUpDays: number }> = {
  "First outreach sent": { note: "First outreach sent", followUpDays: 3 },
  "Inbound response logged": { note: "Inbound response logged", followUpDays: 1 },
  "Reached call logged": { note: "Reached call logged", followUpDays: 1 },
};

/** Resolve an action suggestion into editable popup defaults, using local calendar days. */
export function advanceLeadActionDefaults(
  label: string | null | undefined,
  today = new Date(),
): { note: string; followUpDate: string } {
  const defaults = label ? ADVANCE_ACTION_DEFAULTS[label] : undefined;
  if (!defaults) return { note: "", followUpDate: "" };

  const due = new Date(today);
  due.setHours(12, 0, 0, 0);
  due.setDate(due.getDate() + defaults.followUpDays);
  const year = due.getFullYear();
  const month = String(due.getMonth() + 1).padStart(2, "0");
  const day = String(due.getDate()).padStart(2, "0");
  return { note: defaults.note, followUpDate: `${year}-${month}-${day}` };
}

/** Human phrasing for a `yyyy-mm-dd` follow-up date. Local-calendar comparison. */
export function formatFollowUpDate(dateStr: string, today = new Date()): string {
  if (!dateStr) return "";
  const due = new Date(`${dateStr}T00:00:00`);
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - base.getTime()) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays <= 6) return `in ${diffDays} days`;
  return due.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Conversion readiness (`docs/lead-stage-status-example.md` Step 5): converting is the payoff of a
 * lead the client has already committed to, so it belongs at `Product Selected` — not at `New Lead`,
 * where it would skip discovery and the proposal entirely. Shared by the Contact Profile and the
 * wizard's server action so the UI and the rule cannot drift.
 */
export const CONVERT_READY_STAGE: LeadStage = "Product Selected";

/**
 * The stage a saved wizard draft puts a lead in (`docs/lead-stage-status-example.md` Step 6).
 * It moves the *stage* only — `lifecycle_stage` stays `Lead` and the card stays on the board.
 * The lifecycle hand-off is Step 7, when the wizard is actually completed.
 */
export const APPLICATION_STARTED_STAGE: LeadStage = "Application Started";

export function canConvertLead(stage: string | null | undefined): boolean {
  const index = LEAD_BOARD_STAGES.indexOf((stage ?? "") as LeadStage);
  // An unknown or terminal stage (Converted / Lost) is never "ready" — those records aren't leads.
  return index !== -1 && index >= LEAD_BOARD_STAGES.indexOf(CONVERT_READY_STAGE);
}

/** Stages a convert from `stage` jumps over, e.g. Discovery → ["Proposal", "Product Selected"]. */
export function stagesSkippedByConvert(stage: string | null | undefined): string[] {
  const index = LEAD_BOARD_STAGES.indexOf((stage ?? "") as LeadStage);
  if (index === -1) return [];
  return LEAD_BOARD_STAGES.slice(index + 1, LEAD_BOARD_STAGES.indexOf(CONVERT_READY_STAGE) + 1);
}

/**
 * Discovery readiness — the four answers a quote needs (docs/lead-stage-status.md: `Qualified`
 * means budget, family size, product and tier are actually on file, not just discussed).
 * Defined once and shared by the Advance popup's checklist and the server guard, so the UI and
 * the rule can never drift apart.
 */
export interface DiscoveryValues {
  estPremium?: number | null;
  familySize?: number | null;
  productInterest?: string | null;
  coverageTier?: string | null;
}

export function discoveryChecklist(
  values: DiscoveryValues,
): { key: keyof DiscoveryValues; label: string; done: boolean }[] {
  return [
    { key: "estPremium", label: "Budget", done: values.estPremium != null },
    // A zero-person household isn't a real answer, so require at least one.
    { key: "familySize", label: "Family size", done: values.familySize != null && values.familySize >= 1 },
    { key: "productInterest", label: "Product", done: !!values.productInterest },
    { key: "coverageTier", label: "Coverage tier", done: !!values.coverageTier },
  ];
}

/** Labels of the fields still missing; empty means the lead is quotable. */
export function discoveryGaps(values: DiscoveryValues): string[] {
  return discoveryChecklist(values).filter((item) => !item.done).map((item) => item.label);
}

/** "budget", "budget and family size", "budget, family size and product" — for error copy. */
export function formatGaps(gaps: string[]): string {
  const lower = gaps.map((gap) => gap.toLowerCase());
  if (lower.length <= 1) return lower[0] ?? "";
  return `${lower.slice(0, -1).join(", ")} and ${lower[lower.length - 1]}`;
}

export const STAGE_META: Record<string, { color: string; health: "good" | "watch" | "risk" }> = {
  "New Lead": { color: "#64748b", health: "good" },
  Contacted: { color: "#2563eb", health: "good" },
  Discovery: { color: "#0891b2", health: "good" },
  Proposal: { color: "#7c3aed", health: "watch" },
  "Product Selected": { color: "#d97706", health: "good" },
  "Application Started": { color: "#059669", health: "good" },
  Converted: { color: "#047857", health: "good" },
  Lost: { color: "#dc2626", health: "risk" },
};

export const STAGE_TONE: Record<string, Tone> = {
  "New Lead": "slate",
  Contacted: "blue",
  Discovery: "blue",
  Proposal: "violet",
  "Product Selected": "amber",
  "Application Started": "green",
  Converted: "green",
  Lost: "red",
};

/** Axis 2 — lead_status: the orthogonal disposition chip. */
export const LEAD_STATUSES = [
  "New",
  "Attempted",
  "Connected",
  "Qualified",
  "Nurturing",
  "Unresponsive",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/**
 * Statuses reachable from the Advance-Lead popup's dropdown.
 *
 * `Nurturing` is excluded on purpose (`docs/lead-stage-status.md`): it "only ever gets set by Eman
 * deliberately clicking `Mark as Nurturing` — it's a choice, not a decay", and it carries a
 * **required re-engagement follow-up date** a bare dropdown cannot capture. Setting it from here
 * would produce a hold nothing ever resurfaces, so it goes through `markNurturingAction` instead.
 *
 * `Unresponsive` is excluded for the same reason it's excluded everywhere else the spec says "no
 * button" — it's system-inferred from 3 unanswered outbound touches (`lib/queries/lead-status-
 * inference.ts`), computed live on read, never hand-picked.
 *
 * Shared by the popup and `advanceLeadAction`'s guard so the UI and the rule cannot drift, the same
 * way {@link allowedLeadStages} and {@link discoveryGaps} already are.
 */
export function allowedLeadStatuses(): string[] {
  return LEAD_STATUSES.filter((status) => status !== "Nurturing" && status !== "Unresponsive");
}

export const STATUS_TONE: Record<string, Tone> = {
  New: "slate",
  Attempted: "amber",
  Connected: "blue",
  Qualified: "green",
  Nurturing: "violet",
  Unresponsive: "red",
};

export const STATUS_HINT: Record<string, string> = {
  New: "Just entered — not yet worked",
  Attempted: "Contacted, not reached",
  Connected: "Two-way contact established",
  Qualified: "Discovery complete — ready for a proposal",
  Nurturing: "Long-term hold",
  Unresponsive: "Went quiet",
};

/** Stage close-probability behind weighted pipeline value (Forecast view). */
export const STAGE_PROB: Record<string, number> = {
  "New Lead": 0.1,
  Contacted: 0.2,
  Discovery: 0.35,
  Proposal: 0.55,
  "Product Selected": 0.8,
  "Application Started": 0.95,
};

export const weightedValue = (stage: string | null, estPremium: number | null) =>
  Math.round((estPremium ?? 0) * (STAGE_PROB[stage ?? ""] ?? 0));

/* ---------- Proposal micro-status ---------- */

/** The four `proposal_status` steps, in order (`../../docs/web/data-model.md:74`). */
export const PROPOSAL_STATUSES = ["Requested", "Received", "Sent", "Decision"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/**
 * Sub-states of `proposal_status = Decision`.
 *
 * `../../docs/web/data-model.md:75` lists only the first two. `Declined` is a deliberate
 * extension (recorded in `docs/development-alignment.md`): without it a client who
 * explicitly says no has nowhere to go, since `Unresponsive` means *no reply* and `Lost`
 * is only reachable through it.
 */
export const PROPOSAL_DECISIONS = [
  { value: "Awaiting Decision", hint: "Sent — no reply from the client yet." },
  { value: "Negotiating", hint: "The client replied and is discussing terms." },
  { value: "Declined", hint: "The client turned this proposal down." },
] as const;
export type ProposalDecision = (typeof PROPOSAL_DECISIONS)[number]["value"];

export const isProposalDecision = (v: string | null | undefined): v is ProposalDecision =>
  PROPOSAL_DECISIONS.some((d) => d.value === v);

/**
 * The proposal panel's one-line summary, shared by Contact Profile and the board so the
 * two can't word the same state differently.
 *
 * The first three steps are past participles and read as sentences when lower-cased
 * (`Proposal requested — …`). `Decision` is a noun and does not, which is why it gets
 * written lines per sub-state rather than the generated one.
 */
export function proposalStatusLine(
  status: string | null | undefined,
  decision: string | null | undefined,
  productInterest: string | null | undefined,
): string {
  const product = productInterest ?? "carrier";
  if (!status) return "";
  if (status !== "Decision") return `Proposal ${status.toLowerCase()} — ${product} quote.`;
  switch (decision) {
    case "Awaiting Decision":
      return `Awaiting the client’s decision — ${product} quote.`;
    case "Negotiating":
      return `Negotiating terms — ${product} quote.`;
    case "Declined":
      return `Client declined — ${product} quote.`;
    default:
      // Rows that reached Decision before `proposal_decision` existed carry no sub-state.
      return `Decision logged — ${product} quote.`;
  }
}

/** What the board chips show: the sub-state once there is one, else the step. */
export const proposalChipLabel = (
  status: string | null | undefined,
  decision: string | null | undefined,
) => (status === "Decision" && decision ? decision : status);

/**
 * Product-interest colour coding (board card dots, interest widget).
 *
 * The keys double as the selectable product-interest list — `new-lead.tsx` and
 * `client-form.tsx` both render `Object.keys(PRODUCT_COLORS)` — so a name here is a
 * name a lead can carry, and `categoryForProduct()` routes on it. `BC Flexi HMO`
 * used to sit beside `BC Flexi`: only the former matched the `hmo` regex, so the
 * same product reached a different wizard branch depending on which string the lead
 * happened to hold. One name only.
 */
export const PRODUCT_COLORS: Record<string, string> = {
  "Blue Royale": "#059669",
  Select: "#2563eb",
  "Travel Insurance": "#d97706",
  "BC Flexi": "#7c3aed",
  FlexiShield: "#0891b2",
  "Premier Health": "#db2777",
  "Family Shield": "#0d9488",
};

export const nextStage = (stage: string | null): LeadStage => {
  const i = LEAD_BOARD_STAGES.indexOf((stage ?? "") as LeadStage);
  return i >= 0 && i < LEAD_BOARD_STAGES.length - 1
    ? LEAD_BOARD_STAGES[i + 1]
    : LEAD_BOARD_STAGES[LEAD_BOARD_STAGES.length - 1];
};

/* ---------- Lead list/board helpers ---------- */

/** Toggle `value` in a multi-select filter array. */
export const toggleFilterValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

/**
 * C2a product routing: Select / Blue Royale proposals are generated in-house;
 * every other product goes through Request Proposal (carrier portal).
 * WARNING: matches on product *names* — renaming either product in /products
 * silently flips its leads onto the other proposal workflow. Move to a
 * `products` column before importing real client data (FUTURE-REFACTOR.md §E5).
 */
export const isIndividualProposalProduct = (product: string | null) =>
  ["select", "blue royale"].includes(product?.trim().toLowerCase() ?? "");

/** Days until the follow-up date (negative = overdue), or null when unset. */
export const followDays = (d: string | null): number | null => {
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(d + "T00:00:00").getTime() - today.getTime()) / 86_400_000);
};

/** Expected-close bucket shared by the lead List drill-down and Forecast view. */
export const monthBucket = (iso: string | null): string => {
  if (!iso) return "Later";
  const now = new Date();
  const k = (new Date(iso).getFullYear() * 12 + new Date(iso).getMonth()) - (now.getFullYear() * 12 + now.getMonth());
  return k <= 0 ? "This month" : k === 1 ? "Next month" : "Later";
};
