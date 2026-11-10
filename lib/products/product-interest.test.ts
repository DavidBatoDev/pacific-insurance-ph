import { describe, expect, it } from "vitest";

import { resolveProductInterest } from "./product-interest";

const ACTIVE = ["BC Flexi", "Blue Royale", "FlexiShield", "Select", "TravelSafe"];

describe("resolveProductInterest", () => {
  it("accepts active products in their catalog spelling", () => {
    expect(resolveProductInterest("  blue royale ", ACTIVE)).toEqual({ ok: true, value: "Blue Royale" });
    expect(resolveProductInterest("TRAVELSAFE", ACTIVE)).toEqual({ ok: true, value: "TravelSafe" });
  });

  it("records a Select variant name as Select", () => {
    expect(resolveProductInterest("Select Plus", ACTIVE)).toEqual({ ok: true, value: "Select" });
    expect(resolveProductInterest("select standard", ACTIVE)).toEqual({ ok: true, value: "Select" });
  });

  it("treats blank input as cleared", () => {
    expect(resolveProductInterest("", ACTIVE)).toEqual({ ok: true, value: null });
    expect(resolveProductInterest("   ", ACTIVE, "Select")).toEqual({ ok: true, value: null });
    expect(resolveProductInterest(null, ACTIVE)).toEqual({ ok: true, value: null });
  });

  it("rejects typos, invented and inactive products on a new value", () => {
    for (const value of ["Blue Royal", "Selec", "Premier Health", "Travel Insurance"]) {
      expect(resolveProductInterest(value, ACTIVE).ok).toBe(false);
    }
    expect(resolveProductInterest("Travel Insurance", ACTIVE, "Blue Royale").ok).toBe(false);
  });

  it("keeps a record's existing value unchanged even when it is no longer active", () => {
    expect(resolveProductInterest("Travel Insurance", ACTIVE, "Travel Insurance")).toEqual({ ok: true, value: "Travel Insurance" });
    expect(resolveProductInterest("Premier Health ", ACTIVE, "Premier Health")).toEqual({ ok: true, value: "Premier Health" });
  });

  it("rejects everything except blank when the catalog has no active products", () => {
    expect(resolveProductInterest("Select", []).ok).toBe(false);
    expect(resolveProductInterest("", [])).toEqual({ ok: true, value: null });
  });
});
