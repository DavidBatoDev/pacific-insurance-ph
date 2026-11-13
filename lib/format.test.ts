import { describe, expect, it } from "vitest";

import { money, moneyTotals } from "./format";

describe("native currency formatting", () => {
  it("formats each amount with its recorded currency", () => {
    expect(money(1250.5, "PHP")).toBe("₱1,250.50");
    expect(money(1250.5, "USD")).toBe("US$1,250.50");
    expect(money(1200, "USD")).toBe("US$1,200");
    expect(money(1200, null)).toBe("₱1,200");
  });

  it("keeps two decimals whenever there are cents, none for whole amounts", () => {
    expect(money(21225.6, "PHP")).toBe("₱21,225.60");
    expect(money(2358.4, "PHP")).toBe("₱2,358.40");
    expect(money(134000, "PHP")).toBe("₱134,000");
    expect(money(0.125, "PHP")).toBe("₱0.13");
  });

  it("keeps PHP and USD totals separate", () => {
    expect(moneyTotals(new Map([["PHP", 1250], ["USD", 50]]))).toBe("₱1K · US$50");
  });
});
