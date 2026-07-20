/**
 * Merge-field renderer shared by every composer (Engage, wizard, campaigns,
 * payment links) and the template editor preview. Pure and isomorphic.
 *
 * Supported fields mirror the design's TemplatesStore.fill: {{first_name}},
 * {{product}}, {{premium}}, {{agent}}, plus the proposal fields ({{budget}},
 * {{family_size}}, {{coverage_tier}}) and payment-link extras ({{reference}},
 * {{channel}}). Tolerates single- or double-brace usage.
 */

export interface MergeContext {
  first_name?: string | null;
  product?: string | null;
  premium?: string | null;
  agent?: string | null;
  budget?: string | null;
  family_size?: string | null;
  coverage_tier?: string | null;
  reference?: string | null;
  channel?: string | null;
}

export const MERGE_FIELDS = [
  "{{first_name}}",
  "{{product}}",
  "{{premium}}",
  "{{agent}}",
] as const;

export function fillTemplate(str: string, ctx: MergeContext = {}): string {
  const map: Record<string, string> = {
    first_name: ctx.first_name || "there",
    name: ctx.first_name || "there",
    product: ctx.product || "your plan",
    premium: ctx.premium || "your premium",
    agent: ctx.agent || "Pacific Insurance PH",
    budget: ctx.budget || "to be confirmed",
    family_size: ctx.family_size || "to be confirmed",
    coverage_tier: ctx.coverage_tier || "to be confirmed",
    reference: ctx.reference || "",
    channel: ctx.channel || "",
  };
  return (str || "").replace(
    /\{\{?\s*(first_name|name|product|premium|agent|budget|family_size|coverage_tier|reference|channel)\s*\}?\}/g,
    (_, key: string) => map[key] ?? "",
  );
}

/** Format a peso amount for merge contexts (₱73,000). */
export const pesoMerge = (n: number | null | undefined) =>
  n == null ? undefined : "₱" + n.toLocaleString("en-PH");
