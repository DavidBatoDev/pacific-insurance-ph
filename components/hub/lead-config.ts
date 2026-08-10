/**
 * Lead Lifecycle constants shared by the board, list, forecast, Advance-Lead
 * modal and Contact Profile chips (design prospect-data.jsx; client-safe).
 */

import type { Tone } from "./data";

/** Axis 1 — lead_stage: the six board columns (exits: Converted / Lost). */
export const LEAD_STAGES = [
  "New Lead",
  "Contacted",
  "Discovery",
  "Proposal",
  "Product Selected",
  "Application Started",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

/**
 * The forward-only spine (`docs/lead-stage-status.md`): a lead only ever moves to the
 * immediately following stage (or to Lost, which is a separate action — not a stage value).
 * Returns null at the final stage, or for an unknown/terminal stage such as Lost/Converted.
 */
export function nextLeadStage(stage: string | null | undefined): LeadStage | null {
  const index = LEAD_STAGES.indexOf((stage ?? "") as LeadStage);
  if (index === -1) return null;
  return LEAD_STAGES[index + 1] ?? null;
}

/** The stages selectable from `stage`: itself plus the next one. Backward jumps and skips are not offered. */
export function allowedLeadStages(stage: string | null | undefined): string[] {
  const current = stage ?? LEAD_STAGES[0];
  const next = nextLeadStage(current);
  return next ? [current, next] : [current];
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

/** Product-interest colour coding (board card dots, interest widget). */
export const PRODUCT_COLORS: Record<string, string> = {
  "Blue Royale": "#059669",
  Select: "#2563eb",
  "Travel Insurance": "#d97706",
  "BC Flexi": "#7c3aed",
  "BC Flexi HMO": "#7c3aed",
  FlexiShield: "#0891b2",
  "Premier Health": "#db2777",
  "Family Shield": "#0d9488",
};

export const nextStage = (stage: string | null): LeadStage => {
  const i = LEAD_STAGES.indexOf((stage ?? "") as LeadStage);
  return i >= 0 && i < LEAD_STAGES.length - 1
    ? LEAD_STAGES[i + 1]
    : LEAD_STAGES[LEAD_STAGES.length - 1];
};
