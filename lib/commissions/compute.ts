/**
 * Commission computation (TO-BE-UPDATE-PLAN.md Phase H, H9b), as the client gave it at the
 * 2026-10-02 review:
 *
 *   paid premium − 12% VAT → × commission rate → − 10% withholding tax = net commission
 *
 * Worked examples that must reproduce exactly (see compute.test.ts):
 *   Blue Royale renewal: 250,000 → 220,000 × 20% = 44,000 → 39,600
 *   Select:              134,000 → 117,920 × 20% = 23,584 → 21,225.60
 *
 * Pure and framework-free so the payment action (stored estimate) and the commissions screen
 * (H9c breakdown) always agree. Every step is computed in centavos and rounded to the centavo.
 */

/**
 * ⚠️ DH16 ASSUMPTION, not a decision: the commission base is premium × 0.88, per Eman's
 * examples. Not verified against actual payout statements. Strict VAT extraction (÷ 1.12)
 * would yield ₱40,178.57 instead of ₱39,600 on a ₱250,000 premium. To be confirmed by finance
 * before go-live — switch this one constant (or the `vatBase` step) if it changes.
 */
export const VAT_BASE_FACTOR = 0.88;

/** Withholding tax deducted from the gross commission. */
export const WITHHOLDING_TAX_RATE = 0.1;

export interface CommissionBreakdown {
  premium: number;
  /** Premium − base: the 12% VAT deduction. */
  vat: number;
  /** Commission base after VAT. */
  base: number;
  ratePct: number;
  /** base × rate. */
  gross: number;
  /** gross × 10%. */
  withholdingTax: number;
  /** gross − withholding tax: what the agency receives. */
  net: number;
}

const toCents = (amount: number) => Math.round(amount * 100);
const fromCents = (cents: number) => cents / 100;

export function computeCommission(premium: number, ratePct: number): CommissionBreakdown {
  if (!Number.isFinite(premium) || premium < 0) throw new RangeError("Premium must be a non-negative number.");
  if (!Number.isFinite(ratePct) || ratePct < 0 || ratePct > 100) throw new RangeError("Rate must be between 0 and 100.");

  const premiumCents = toCents(premium);
  const baseCents = Math.round(premiumCents * VAT_BASE_FACTOR);
  // ratePct can carry decimals (22.5%), so scale it to an integer before multiplying.
  const grossCents = Math.round((baseCents * Math.round(ratePct * 100)) / 10000);
  const whtCents = Math.round(grossCents * WITHHOLDING_TAX_RATE);
  const netCents = grossCents - whtCents;

  return {
    premium: fromCents(premiumCents),
    vat: fromCents(premiumCents - baseCents),
    base: fromCents(baseCents),
    ratePct,
    gross: fromCents(grossCents),
    withholdingTax: fromCents(whtCents),
    net: fromCents(netCents),
  };
}
