import { describe, expect, it } from "vitest";

import { computeCommission, VAT_BASE_FACTOR, WITHHOLDING_TAX_RATE } from "./compute";

describe("computeCommission — the client's worked examples (Oct 2 review)", () => {
  it("Blue Royale renewal: 250,000 → 220,000 × 20% = 44,000 → 39,600", () => {
    expect(computeCommission(250_000, 20)).toEqual({
      premium: 250_000,
      vat: 30_000,
      base: 220_000,
      ratePct: 20,
      gross: 44_000,
      withholdingTax: 4_400,
      net: 39_600,
    });
  });

  it("Select: 134,000 → 117,920 × 20% = 23,584 → 21,225.60", () => {
    expect(computeCommission(134_000, 20)).toEqual({
      premium: 134_000,
      vat: 16_080,
      base: 117_920,
      ratePct: 20,
      gross: 23_584,
      withholdingTax: 2_358.4,
      net: 21_225.6,
    });
  });
});

describe("computeCommission — other rates and amounts", () => {
  it("handles a fractional rate (Blue Royale new business, 22.5%)", () => {
    const r = computeCommission(250_000, 22.5);
    expect(r.gross).toBe(49_500);
    expect(r.net).toBe(44_550);
  });

  it("handles centavos without floating-point drift", () => {
    const r = computeCommission(1_234.56, 30);
    expect(r.base).toBe(1_086.41); // 1,234.56 × 0.88 = 1,086.4128
    expect(r.gross).toBe(325.92); // × 30% = 325.923
    expect(r.withholdingTax).toBe(32.59);
    expect(r.net).toBe(293.33);
  });

  it("returns zeros for a 0% rate", () => {
    const r = computeCommission(100_000, 0);
    expect(r.gross).toBe(0);
    expect(r.net).toBe(0);
  });

  it("keeps the assumption constants explicit (DH16)", () => {
    expect(VAT_BASE_FACTOR).toBe(0.88);
    expect(WITHHOLDING_TAX_RATE).toBe(0.1);
  });

  it("rejects a negative premium or an out-of-range rate", () => {
    expect(() => computeCommission(-1, 20)).toThrow(RangeError);
    expect(() => computeCommission(1_000, -1)).toThrow(RangeError);
    expect(() => computeCommission(1_000, 101)).toThrow(RangeError);
    expect(() => computeCommission(Number.NaN, 20)).toThrow(RangeError);
  });
});
