import { describe, expect, it } from "vitest";

import { money, moneyTotals } from "./format";

describe("native currency formatting", () => {
  it("formats each amount with its recorded currency", () => {
    expect(money(1250.5, "PHP")).toBe("₱1,250.5");
    expect(money(1250.5, "USD")).toBe("US$1,250.5");
  });

  it("keeps PHP and USD totals separate", () => {
    expect(moneyTotals(new Map([["PHP", 1250], ["USD", 50]]))).toBe("₱1K · US$50");
  });
});
